import { WebSocket, WebSocketServer } from 'ws';
import { chooseService } from '../services';
import { validateApiKey, validateInput, rateLimit, generateRequestId } from '../security';
import { findEntryPoint } from '../entryPoints';

export function handleWebSocket(wss: WebSocketServer) {
  wss.on('connection', (ws: WebSocket, req: Request) => {
    const url = new URL(req.url);
    const clientIp = req.headers.get("x-forwarded-for") || "unknown";

    // Check API key
    if (!validateApiKey(req.headers.get("x-api-key"))) {
      ws.close(1008, "Unauthorized");
      return;
    }

    // Rate limiting
    if (!rateLimit(clientIp)) {
      ws.close(1008, "Too Many Requests");
      return;
    }

    // Input validation
    if (!validateInput(url.pathname)) {
      ws.close(1008, "Bad Request");
      return;
    }

    const protocol = req.url.startsWith('wss') ? 'wss' : 'ws';
    const port = parseInt(url.port) || (protocol === 'wss' ? 443 : 80);

    const entryPoint = findEntryPoint(port, protocol, url.pathname);
    if (!entryPoint) {
      ws.close(1008, "Not Found");
      return;
    }

    const service = chooseService(entryPoint.name, url.pathname, protocol);

    if (!service) {
      ws.close(1013, "No available services");
      return;
    }

    const upstreamUrl = `${service.protocol}://${service.address}:${service.port}${url.pathname}${url.search}`;
    const upstreamWs = new WebSocket(upstreamUrl);

    upstreamWs.on('open', () => {
      ws.on('message', (message) => upstreamWs.send(message));
      upstreamWs.on('message', (message) => ws.send(message));
    });

    ws.on('close', () => upstreamWs.close());
    upstreamWs.on('close', () => ws.close());
  });
}
