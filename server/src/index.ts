import { NetworkManager } from './NetworkManager';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const WS_PORT = parseInt(process.env.WS_PORT || '8081');

// Create WebSocket server
const networkManager = new NetworkManager(WS_PORT);

console.log('='.repeat(50));
console.log('Five Rings Fighting Game - Multiplayer Server');
console.log('='.repeat(50));
console.log(`WebSocket Server: ws://localhost:${WS_PORT}`);
console.log('Ready for connections...');
console.log('='.repeat(50));

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down server...');
  process.exit(0);
});
