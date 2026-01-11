#!/usr/bin/env node

const WebSocket = require('ws');

const WS_URL = process.env.WS_URL || 'ws://localhost:8081';

console.log(`Connecting to ${WS_URL}...`);

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✓ Connected to server');
  
  // Authenticate
  ws.send(JSON.stringify({
    type: 'AUTHENTICATE',
    token: 'test-user-' + Math.random().toString(36).substr(2, 9)
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  console.log('← Received:', message.type, message);
  
  // Auto-respond to pings
  if (message.type === 'PING') {
    ws.send(JSON.stringify({ type: 'PONG' }));
  }
  
  // After auth, join queue
  if (message.type === 'AUTHENTICATED') {
    console.log('\n✓ Authenticated, joining matchmaking queue...\n');
    ws.send(JSON.stringify({ type: 'JOIN_QUEUE' }));
  }
  
  // Match found
  if (message.type === 'MATCH_FOUND') {
    console.log('\n🎮 MATCH FOUND!');
    console.log(`   Room: ${message.roomId}`);
    console.log(`   Playing as: Player ${message.playerSide + 1}`);
    console.log(`   Opponent: ${message.opponentId}\n`);
  }
});

ws.on('close', () => {
  console.log('✗ Disconnected from server');
  process.exit(0);
});

ws.on('error', (error) => {
  console.error('✗ WebSocket error:', error.message);
  process.exit(1);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\nClosing connection...');
  ws.close();
});
