import { createHash } from "crypto";
import config from './config';

const rateLimits = new Map<string, { count: number, lastReset: number }>();

export function validateApiKey(apiKey: string | null): boolean {
  return apiKey === config.API_KEY;
}

export function validateInput(input: string): boolean {
  return /^[a-zA-Z0-9\-_\/]+$/.test(input);
}

export function rateLimit(ip: string): boolean {
  const now = Date.now();
  const limit = rateLimits.get(ip) || { count: 0, lastReset: now };

  if (now - limit.lastReset > 60000) {  // Reset every minute
    limit.count = 0;
    limit.lastReset = now;
  }

  limit.count++;
  rateLimits.set(ip, limit);

  return limit.count <= 100;  // 100 requests per minute
}

export function generateRequestId(): string {
  return createHash('sha256').update(Date.now().toString()).digest('hex');
}

export function addSecurityHeaders(headers: Headers): Headers {
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return headers;
}
