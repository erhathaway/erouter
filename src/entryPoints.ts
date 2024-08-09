import config, { EntryPoint } from './config';

export function getEntryPoints(): EntryPoint[] {
  return config.ENTRY_POINTS;
}

export function findEntryPoint(port: number, protocol: string, path?: string): EntryPoint | undefined {
  return config.ENTRY_POINTS.find(ep => 
    ep.ports.includes(port) && 
    ep.protocols.includes(protocol as any) && 
    (!ep.paths || !path || ep.paths.some(p => path.startsWith(p)))
  );
}
