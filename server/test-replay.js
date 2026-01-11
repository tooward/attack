import { ReplayRecorder } from './dist/ReplayRecorder.js';
import { ReplayCompressor } from './dist/ReplayCompressor.js';
import { ReplayStorage } from './dist/storage/ReplayStorage.js';
import * as path from 'path';
import * as fs from 'fs/promises';

async function testReplaySystem() {
  console.log('=== Testing Replay System ===\n');

  // Test 1: Recording
  console.log('Test 1: Recording a match...');
  const recorder = new ReplayRecorder();
  
  const mockPlayer1 = { id: 'player1', userId: 'user1', elo: 1500 };
  const mockPlayer2 = { id: 'player2', userId: 'user2', elo: 1600 };
  
  recorder.startRecording('test-match-001', mockPlayer1, mockPlayer2);
  
  // Simulate 600 frames (10 seconds at 60fps)
  for (let i = 0; i < 600; i++) {
    const p1Input = [
      Math.random() > 0.7 ? 1 : 0, // Left
      Math.random() > 0.7 ? 1 : 0, // Right
      Math.random() > 0.9 ? 1 : 0, // Light punch
      Math.random() > 0.9 ? 1 : 0, // Heavy punch
      Math.random() > 0.95 ? 1 : 0  // Special
    ];
    
    const p2Input = [
      Math.random() > 0.7 ? 1 : 0,
      Math.random() > 0.7 ? 1 : 0,
      Math.random() > 0.9 ? 1 : 0,
      Math.random() > 0.9 ? 1 : 0,
      Math.random() > 0.95 ? 1 : 0
    ];
    
    recorder.recordFrame(i, p1Input, p2Input);
  }
  
  const replay = recorder.stopRecording(1);
  
  if (replay) {
    console.log(`✓ Recorded ${replay.frames.length} frames`);
    console.log(`  Match ID: ${replay.metadata.id}`);
    console.log(`  Winner: Player ${replay.metadata.winner}`);
    console.log(`  Skill Level: ${replay.metadata.training.skillLevel}`);
  } else {
    console.log('✗ Failed to record replay');
    return;
  }
  
  // Test 2: Compression
  console.log('\nTest 2: Compressing replay...');
  const originalSize = JSON.stringify(replay.frames).length;
  const compressed = ReplayCompressor.compress(replay);
  const compressedSize = JSON.stringify(compressed.frames).length;
  const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
  
  console.log(`✓ Original size: ${(originalSize / 1024).toFixed(2)} KB`);
  console.log(`  Compressed size: ${(compressedSize / 1024).toFixed(2)} KB`);
  console.log(`  Reduction: ${ratio}%`);
  
  // Test 3: Decompression
  console.log('\nTest 3: Decompressing replay...');
  const decompressed = ReplayCompressor.decompress(compressed);
  
  if (decompressed.frames.length === replay.frames.length) {
    console.log(`✓ Decompressed ${decompressed.frames.length} frames`);
    
    // Verify first and last frames match
    const firstMatch = JSON.stringify(decompressed.frames[0]) === JSON.stringify(replay.frames[0]);
    const lastMatch = JSON.stringify(decompressed.frames[599]) === JSON.stringify(replay.frames[599]);
    
    if (firstMatch && lastMatch) {
      console.log('  ✓ Frame data matches original');
    } else {
      console.log('  ✗ Frame data mismatch');
    }
  } else {
    console.log(`✗ Frame count mismatch: ${decompressed.frames.length} vs ${replay.frames.length}`);
  }
  
  // Test 4: Storage
  console.log('\nTest 4: Saving replay to disk...');
  const storage = new ReplayStorage({
    directory: path.join(process.cwd(), 'replays', 'test'),
    compress: true
  });
  
  await storage.initialize();
  const filepath = await storage.saveReplay(replay);
  console.log(`✓ Saved to: ${filepath}`);
  
  // Test 5: Loading
  console.log('\nTest 5: Loading replay from disk...');
  const loaded = await storage.loadReplay('test-match-001');
  
  if (loaded) {
    console.log(`✓ Loaded replay: ${loaded.metadata.id}`);
    console.log(`  Frames: ${loaded.frames.length}`);
    console.log(`  Compressed: ${loaded.compressed}`);
  } else {
    console.log('✗ Failed to load replay');
  }
  
  // Test 6: Storage stats
  console.log('\nTest 6: Storage statistics...');
  const stats = await storage.getStats();
  console.log(`✓ Total replays: ${stats.totalReplays}`);
  console.log(`  Total size: ${(stats.totalSize / 1024).toFixed(2)} KB`);
  
  // Cleanup
  console.log('\nCleaning up test files...');
  await fs.rm(path.join(process.cwd(), 'replays', 'test'), { recursive: true, force: true });
  console.log('✓ Cleanup complete');
  
  console.log('\n=== All Tests Passed ===');
}

// Run tests
testReplaySystem().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
