import { serve } from "bun";
import { WebSocketServer } from 'ws';
import { loadServices, watchServices } from './services';
import { handleHttpRequest } from './proxy/http';
import { handleWebSocket } from './proxy/websocket';
import { getEntryPoints } from './entryPoints';
import config from './config';

async function main() {
  await loadServices();
  watchServices();

  const entryPoints = getEntryPoints();

  for (const ep of entryPoints) {
    for (const port of ep.ports) {
      if (ep.protocols.includes('http') || ep.protocols.includes('https')) {
        const server = serve({
          fetch: (req) => handleHttpRequest(req),
          port: port,
          tls: ep.protocols.includes('https') ? {
            key: Bun.file(config.SSL_KEY),
            cert: Bun.file(config.SSL_CERT),
          } : undefined
        });
        console.log(`HTTP/HTTPS server for entry point ${ep.name} running on port ${port}`);
      }

      if (ep.protocols.includes('ws') || ep.protocols.includes('wss')) {
        const wss = new WebSocketServer({ port: port });
        handleWebSocket(wss);
        console.log(`WebSocket server for entry point ${ep.name} running on port ${port}`);
      }
    }
  }
}

main().catch(console.error);
