import { watch } from 'fs';
import config from './config';

export interface Service {
  name: string;
  address: string;
  port: number;
  protocol: 'http' | 'https' | 'ws' | 'wss';
  tags: {
    exact?: string[];
    prefix?: string[];
    auth?: string;
    error?: { [key: string]: string };
    priority?: number;
    entryPoints?: string[];
  };
}

let services: Service[] = [];

export async function loadServices() {
  try {
    const content = await Bun.file(config.SERVICES_FILE).text();
    services = JSON.parse(content);
    console.log("Updated services:", services);
  } catch (error) {
    console.error("Error loading services:", error);
  }
}

export function chooseService(entryPoint: string, path: string, protocol: 'http' | 'https' | 'ws' | 'wss'): Service | null {
  const compatibleServices = services.filter(s => 
    s.protocol === protocol && 
    (!s.tags.entryPoints || s.tags.entryPoints.includes(entryPoint))
  );

  // Sort services by priority (higher priority first)
  compatibleServices.sort((a, b) => (b.tags.priority || 0) - (a.tags.priority || 0));

  for (const service of compatibleServices) {
    // Check exact match
    if (service.tags.exact && service.tags.exact.includes(path)) {
      return service;
    }

    // Check prefix match
    if (service.tags.prefix && service.tags.prefix.some(prefix => path.startsWith(prefix))) {
      return service;
    }
  }

  // If no match found, return the first compatible service (or null if none)
  return compatibleServices[0] || null;
}

export function getAuthService(service: Service): { service: string, port: number, path: string } | null {
  if (service.tags.auth) {
    const [authService, portPath] = service.tags.auth.split(':');
    const [port, path] = portPath.split('/');
    return { service: authService, port: parseInt(port), path: '/' + path };
  }
  return null;
}

export function getErrorService(service: Service, statusCode: number): { service: string, port: number, path: string } | null {
  if (service.tags.error) {
    for (const [errorRange, errorService] of Object.entries(service.tags.error)) {
      const [start, end] = errorRange.split('-').map(Number);
      if (statusCode >= start && statusCode <= (end || start)) {
        const [service, portPath] = errorService.split(':');
        const [port, path] = portPath.split('/');
        return { service, port: parseInt(port), path: '/' + path };
      }
    }
  }
  return null;
}

export function watchServices() {
  watch(config.SERVICES_FILE, (event, filename) => {
    if (event === "change") {
      console.log("services.json changed, reloading...");
      loadServices();
    }
  });
}
