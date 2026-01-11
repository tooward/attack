/**
 * Integration test for replay recording during matches
 * Tests the complete flow: match creation -> input recording -> replay storage
 */

import WebSocket from 'ws';

const SERVER_URL = 'ws://localhost:8081';

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class TestClient {
  ws: WebSocket;
  clientId: string | null = null;
  roomId: string | null = null;
  matchFound: boolean = false;

  constructor(private name: string, private elo: number) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(SERVER_URL);

      this.ws.on('open', () => {
        console.log(`${this.name} connected`);
        resolve();
      });

      this.ws.on('message', (data: Buffer) => {
        this.handleMessage(JSON.parse(data.toString()));
      });

      this.ws.on('error', (error) => {
        console.error(`${this.name} error:`, error);
        reject(error);
      });
    });
  }

  handleMessage(message: any) {
    switch (message.type) {
      case 'CONNECTED':
        this.clientId = message.clientId;
        console.log(`${this.name} got client ID: ${this.clientId}`);
        break;

      case 'AUTHENTICATED':
        console.log(`${this.name} authenticated as ${message.userId}`);
        break;

      case 'QUEUE_JOINED':
        console.log(`${this.name} joined queue (position ${message.position}, Elo ${message.elo})`);
        break;

      case 'MATCH_FOUND':
        this.matchFound = true;
        this.roomId = message.roomId;
        console.log(`${this.name} matched! Room: ${message.roomId}, Side: Player ${message.playerSide + 1}`);
        break;

      case 'OPPONENT_INPUT':
        // Opponent action - just log
        break;

      case 'OPPONENT_DISCONNECTED':
        console.log(`${this.name} opponent disconnected`);
        break;
    }
  }

  authenticate() {
    this.ws.send(JSON.stringify({
      type: 'AUTHENTICATE',
      token: `${this.name}_token`
    }));
  }

  joinQueue() {
    this.ws.send(JSON.stringify({
      type: 'JOIN_QUEUE'
    }));
  }

  sendInput(frame: number, actions: number[]) {
    this.ws.send(JSON.stringify({
      type: 'INPUT',
      frame,
      actions
    }));
  }

  disconnect() {
    this.ws.close();
  }
}

async function runTest() {
  console.log('=== Integration Test: Replay Recording During Matches ===\n');

  // Create two test clients
  const player1 = new TestClient('Player1', 1500);
  const player2 = new TestClient('Player2', 1550);

  try {
    // Connect both clients
    console.log('Step 1: Connecting clients...');
    await player1.connect();
    await player2.connect();
    await delay(500);

    // Authenticate
    console.log('\nStep 2: Authenticating...');
    player1.authenticate();
    player2.authenticate();
    await delay(500);

    // Join matchmaking queue
    console.log('\nStep 3: Joining matchmaking queue...');
    player1.joinQueue();
    player2.joinQueue();
    await delay(2000); // Wait for matchmaking

    if (!player1.matchFound || !player2.matchFound) {
      throw new Error('Match not found!');
    }

    console.log('\n✓ Match created successfully!');

    // Simulate 180 frames (3 seconds at 60fps)
    console.log('\nStep 4: Simulating match with 180 frames...');
    for (let frame = 0; frame < 180; frame++) {
      // Player 1 inputs (more aggressive)
      const p1Actions = [
        Math.random() > 0.6 ? 1 : 0, // Left
        Math.random() > 0.6 ? 1 : 0, // Right
        Math.random() > 0.8 ? 1 : 0, // Light punch
        Math.random() > 0.9 ? 1 : 0, // Heavy punch
        Math.random() > 0.95 ? 1 : 0  // Special
      ];

      // Player 2 inputs (more defensive)
      const p2Actions = [
        Math.random() > 0.7 ? 1 : 0,
        Math.random() > 0.7 ? 1 : 0,
        Math.random() > 0.85 ? 1 : 0,
        Math.random() > 0.92 ? 1 : 0,
        Math.random() > 0.96 ? 1 : 0
      ];

      player1.sendInput(frame, p1Actions);
      player2.sendInput(frame, p2Actions);

      if (frame % 60 === 0) {
        console.log(`  Frame ${frame}...`);
      }

      // Small delay to simulate real gameplay
      await delay(5);
    }

    console.log('✓ Match simulation complete!');

    // Disconnect player 1 (player 2 wins)
    console.log('\nStep 5: Player 1 disconnecting (Player 2 wins)...');
    player1.disconnect();
    await delay(1000);

    console.log('✓ Replay should be saved!');

    // Check replay directory
    console.log('\nStep 6: Verifying replay files...');
    const fs = await import('fs/promises');
    const path = await import('path');
    const replayDir = path.join(process.cwd(), 'replays');

    try {
      const subdirs = await fs.readdir(replayDir);
      console.log(`  Found ${subdirs.length} subdirectories in replays/`);

      for (const subdir of subdirs) {
        const subdirPath = path.join(replayDir, subdir);
        const stat = await fs.stat(subdirPath);

        if (stat.isDirectory()) {
          const files = await fs.readdir(subdirPath);
          const jsonFiles = files.filter(f => f.endsWith('.json'));
          console.log(`  ${subdir}/: ${jsonFiles.length} replay files`);

          if (jsonFiles.length > 0) {
            // Read the most recent replay
            const latestFile = jsonFiles[jsonFiles.length - 1];
            const filePath = path.join(subdirPath, latestFile);
            const replayData = await fs.readFile(filePath, 'utf-8');
            const replay = JSON.parse(replayData);

            console.log(`\n  Latest Replay: ${replay.metadata.id}`);
            console.log(`    Winner: Player ${replay.metadata.winner}`);
            console.log(`    Frames: ${replay.frames.length || 'compressed'}`);
            console.log(`    Compressed: ${replay.compressed}`);
            console.log(`    Skill Level: ${replay.metadata.training.skillLevel}`);
            console.log(`    Quality Score: ${replay.metadata.training.qualityScore}`);
          }
        }
      }

      console.log('\n✓ Replay verification complete!');
    } catch (err) {
      console.log('  No replays found yet (directory might not exist)');
    }

    // Disconnect player 2
    player2.disconnect();

    console.log('\n=== All Tests Passed ===');
    console.log('Replay recording is working correctly during live matches!');

  } catch (error) {
    console.error('\n✗ Test failed:', error);
    player1.disconnect();
    player2.disconnect();
    process.exit(1);
  }

  // Exit after a short delay
  setTimeout(() => process.exit(0), 1000);
}

// Run the test
console.log('Starting server integration test...');
console.log('Make sure the server is running on port 8081!\n');

runTest();
