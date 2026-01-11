#!/usr/bin/env node

const WebSocket = require('ws');

const WS_URL = process.env.WS_URL || 'ws://localhost:8081';
const playerName = process.argv[2] || 'Player' + Math.floor(Math.random() * 1000);
const elo = parseInt(process.argv[3]) || (1000 + Math.floor(Math.random() * 400)); // Random Elo 1000-1400

console.log(`\n=== ${playerName} (Elo: ${elo}) ===`);
console.log(`Connecting to ${WS_URL}...`);

const ws = new WebSocket(WS_URL);
let inQueue = false;

ws.on('open', () => {
  console.log('✓ Connected to server');
  
  // Authenticate
  ws.send(JSON.stringify({
    type: 'AUTHENTICATE',
    token: playerName
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  
  // Auto-respond to pings
  if (message.type === 'PING') {
    ws.send(JSON.stringify({ type: 'PONG' }));
    return;
  }
  
  console.log(`← ${message.type}:`, JSON.stringify(message, null, 2));
  
  // After auth, join queue
  if (message.type === 'AUTHENTICATED') {
    console.log(`\n✓ Authenticated as ${message.userId}`);
    console.log('Joining matchmaking queue...\n');
    ws.send(JSON.stringify({ type: 'JOIN_QUEUE' }));
  }
  
  // Queue joined
  if (message.type === 'QUEUE_JOINED') {
    inQueue = true;
    console.log(`\n⏳ In queue (position ${message.position}/${message.queueSize})`);
    console.log(`   Your Elo: ${message.elo}`);
    console.log(`   Searching for opponent...\n`);
  }
  
  // Match found
  if (message.type === 'MATCH_FOUND') {
    inQueue = false;
    console.log('\n🎮 ═══════════════════════════════');
    console.log('     MATCH FOUND!');
    console.log('═══════════════════════════════');
    console.log(`Room: ${message.roomId}`);
    console.log(`Playing as: Player ${message.playerSide + 1}`);
    console.log(`Opponent: ${message.opponentId}`);
    console.log(`Opponent Elo: ${message.opponentElo}`);
    console.log(`Elo Difference: ${Math.abs(elo - message.opponentElo)}`);
    console.log('═══════════════════════════════\n');
    
    // Simulate sending inputs for 5 seconds
    let frame = 0;
    const inputInterval = setInterval(() => {
      const actions = [Math.floor(Math.random() * 9)]; // Random action
      ws.send(JSON.stringify({
        type: 'INPUT',
        frame: frame++,
        actions
      }));
    }, 16); // ~60fps
    
    // Stop after 5 seconds
    setTimeout(() => {
      clearInterval(inputInterval);
      console.log('\n✓ Match simulation complete\n');
    }, 5000);
  }
  
  // Opponent input
  if (message.type === 'OPPONENT_INPUT') {
    // Just acknowledge, don't spam console
  }
  
  // Opponent disconnected
  if (message.type === 'OPPONENT_DISCONNECTED') {
    console.log('\n⚠️  Opponent disconnected from match\n');
  }
});

ws.on('close', () => {
  console.log('✗ Disconnected from server\n');
  process.exit(0);
});

ws.on('error', (error) => {
  console.error('✗ WebSocket error:', error.message);
  process.exit(1);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\nClosing connection...');
  if (inQueue) {
    ws.send(JSON.stringify({ type: 'LEAVE_QUEUE' }));
  }
  ws.close();
});
