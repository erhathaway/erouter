import { chooseService, getAuthService, getErrorService } from '../services';
import { validateApiKey, validateInput, rateLimit, generateRequestId, addSecurityHeaders } from '../security';
import { findEntryPoint } from '../entryPoints';

async function forwardAuth(authService: { service: string, port: number, path: string }, originalReq: Request): Promise<boolean> {
  const authUrl = `http://${authService.service}:${authService.port}${authService.path}`;
  const authReq = new Request(authUrl, {
    method: 'GET',
    headers: originalReq.headers,
  });

  try {
    const authResponse = await fetch(authReq);
    return authResponse.ok;
  } catch (error) {
    console.error(`Error during forward auth: ${error}`);
    return false;
  }
}

export async function handleHttpRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const clientIp = req.headers.get("x-forwarded-for") || "unknown";

  // Check API key
  if (!validateApiKey(req.headers.get("x-api-key"))) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Rate limiting
  if (!rateLimit(clientIp)) {
    return new Response("Too Many Requests", { status: 429 });
  }

  // Input validation
  if (!validateInput(url.pathname)) {
    return new Response("Bad Request", { status: 400 });
  }

  const protocol = req.url.startsWith('https') ? 'https' : 'http';
  const port = parseInt(url.port) || (protocol === 'https' ? 443 : 80);
  
  const entryPoint = findEntryPoint(port, protocol, url.pathname);
  if (!entryPoint) {
    return new Response("Not Found", { status: 404 });
  }

  const service = chooseService(entryPoint.name, url.pathname, protocol);

  if (!service) {
    return new Response("No available services", { status: 503 });
  }

  // Forward Auth
  const authService = getAuthService(service);
  if (authService) {
    const isAuthorized = await forwardAuth(authService, req);
    if (!isAuthorized) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const upstreamUrl = `${service.protocol}://${service.address}:${service.port}${url.pathname}${url.search}`;
  const upstreamReq = new Request(upstreamUrl, {
    method: req.method,
    headers: req.headers,
    body: req.body,
  });

  // Remove sensitive headers
  upstreamReq.headers.delete("x-api-key");

  // Add request ID for tracing
  upstreamReq.headers.set("x-request-id", generateRequestId());

  try {
    const response = await fetch(upstreamReq);
    
    // Error handling
    const errorService = getErrorService(service, response.status);
    if (errorService) {
      const errorUrl = `http://${errorService.service}:${errorService.port}${errorService.path}`;
      const errorReq = new Request(errorUrl, {
        method: 'GET',
        headers: req.headers,
      });
      const errorResponse = await fetch(errorReq);
      return new Response(errorResponse.body, {
        status: errorResponse.status,
        headers: addSecurityHeaders(new Headers(errorResponse.headers)),
      });
    }

    // Add security headers
    const secureHeaders = addSecurityHeaders(new Headers(response.headers));

    return new Response(response.body, {
      status: response.status,
      headers: secureHeaders,
    });
  } catch (error) {
    console.error(`Error proxying to ${upstreamUrl}:`, error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
