import { config } from 'dotenv';

config(); // Load environment variables from .env file

export interface EntryPoint {
  name: string;
  ports: number[];
  protocols: ('http' | 'https' | 'ws' | 'wss')[];
  paths?: string[];
}

export default {
  API_KEY: process.env.API_KEY || 'your-secret-api-key',
  SSL_KEY: process.env.SSL_KEY || './key.pem',
  SSL_CERT: process.env.SSL_CERT || './cert.pem',
  SERVICES_FILE: process.env.SERVICES_FILE || './services.json',
  ENTRY_POINTS: JSON.parse(process.env.ENTRY_POINTS || '[]') as EntryPoint[],
};
