/**
 * AI Training Script
 * 
 * Records bot-vs-bot matches and trains a neural network policy.
 * Run with: npx tsx scripts/train.ts
 */

import '@tensorflow/tfjs-node'; // Must be imported FIRST to register Node.js backend
import * as fs from 'fs';
import * as path from 'path';
import { createInitialState, tick, checkMatchEnd } from '../src/core/Game';
import { ReplayRecorder, Replay } from '../src/core/ai/ReplayRecorder';
import { PersonalityBot } from '../src/core/ai/PersonalityBot';
import { ImitationTrainer } from '../src/training/ImitationTrainer';
import { NeuralPolicy } from '../src/core/ai/NeuralPolicy';
import { generateObservation } from '../src/core/ai/Observation';
import { actionToInputFrame } from '../src/core/ai/ActionSpace';
import { GameState, GameConfig, AIPersonality } from '../src/core/interfaces/types';
import { MUSASHI } from '../src/core/data/musashi';

// Training configuration
const CONFIG = {
  numGames: 100,           // Number of games to record
  replayDir: './replays',  // Directory to save replays
  modelDir: './models',    // Directory to save trained models
  modelName: 'musashi_v1', // Model name
  
  // Training hyperparameters
  batchSize: 32,
  epochs: 50,
  validationSplit: 0.2,
  
  // Bot personalities (will cycle through these)
  personalities: [
    { // Defensive
      aggression: 0.2, riskTolerance: 0.3, defenseBias: 0.8, spacingTarget: 0.4,
      comboAmbition: 0.4, jumpRate: 0.1, throwRate: 0.2, fireballRate: 0.6,
      antiAirCommitment: 0.7, adaptivity: 0.5, discipline: 0.8, patternAddiction: 0.3, tiltThreshold: 0.7
    },
    { // Balanced
      aggression: 0.5, riskTolerance: 0.5, defenseBias: 0.5, spacingTarget: 0.3,
      comboAmbition: 0.6, jumpRate: 0.3, throwRate: 0.3, fireballRate: 0.4,
      antiAirCommitment: 0.6, adaptivity: 0.6, discipline: 0.6, patternAddiction: 0.4, tiltThreshold: 0.5
    },
    { // Aggressive
      aggression: 0.8, riskTolerance: 0.7, defenseBias: 0.2, spacingTarget: 0.2,
      comboAmbition: 0.8, jumpRate: 0.4, throwRate: 0.5, fireballRate: 0.2,
      antiAirCommitment: 0.5, adaptivity: 0.4, discipline: 0.4, patternAddiction: 0.6, tiltThreshold: 0.3
    },
    { // Ultra Aggressive
      aggression: 0.9, riskTolerance: 0.9, defenseBias: 0.1, spacingTarget: 0.15,
      comboAmbition: 0.9, jumpRate: 0.5, throwRate: 0.6, fireballRate: 0.1,
      antiAirCommitment: 0.4, adaptivity: 0.3, discipline: 0.2, patternAddiction: 0.7, tiltThreshold: 0.2
    },
    { // Turtle
      aggression: 0.3, riskTolerance: 0.2, defenseBias: 0.9, spacingTarget: 0.5,
      comboAmbition: 0.3, jumpRate: 0.1, throwRate: 0.1, fireballRate: 0.7,
      antiAirCommitment: 0.8, adaptivity: 0.7, discipline: 0.9, patternAddiction: 0.2, tiltThreshold: 0.8
    },
  ] as AIPersonality[],
};

/**
 * Create directories if they don't exist
 */
function ensureDirectories(): void {
  if (!fs.existsSync(CONFIG.replayDir)) {
    fs.mkdirSync(CONFIG.replayDir, { recursive: true });
  }
  if (!fs.existsSync(CONFIG.modelDir)) {
    fs.mkdirSync(CONFIG.modelDir, { recursive: true });
  }
}

/**
 * Record a single bot vs bot match
 */
async function recordMatch(
  gameState: GameState,
  bot1: PersonalityBot,
  bot2: PersonalityBot,
  recorder: ReplayRecorder,
  matchNumber: number,
  characterDefs: Map<string, any>
): Promise<Replay> {
  console.log(`Recording match ${matchNumber}/${CONFIG.numGames}...`);
  
  // Start recording
  recorder.startRecording();
  
  // Run match until completion
  while (!gameState.isMatchOver) {
    const frame = gameState.frame;
    
    // Get both entities
    const player1 = gameState.entities[0];
    const player2 = gameState.entities[1];
    
    if (!player1 || !player2) break;
    
    // Bot 1 decision
    const obs1 = generateObservation(gameState, player1.id);
    const action1 = bot1.selectAction(obs1, frame);
    const input1 = actionToInputFrame(action1, player1.facing, frame);
    recorder.recordStep(gameState, player1.id, action1, frame);
    
    // Bot 2 decision
    const obs2 = generateObservation(gameState, player2.id);
    const action2 = bot2.selectAction(obs2, frame);
    const input2 = actionToInputFrame(action2, player2.facing, frame);
    recorder.recordStep(gameState, player2.id, action2, frame);
    
    // Advance game
    const inputs = new Map();
    inputs.set(player1.id, input1);
    inputs.set(player2.id, input2);
    gameState = tick(gameState, inputs, characterDefs);
    gameState = checkMatchEnd(gameState);
  }
  
  // Stop recording and get replay
  const replay = recorder.stopRecording(gameState, {
    player1Type: 'personality',
    player2Type: 'personality',
  });
  
  // Save replay to disk
  const replayPath = path.join(CONFIG.replayDir, `match_${String(matchNumber).padStart(4, '0')}.json`);
  fs.writeFileSync(replayPath, ReplayRecorder.saveToJSON(replay));
  
  const winner = replay.winner;
  const p1Rounds = replay.finalScore.player1Rounds;
  const p2Rounds = replay.finalScore.player2Rounds;
  console.log(`  Winner: Player ${winner} (${p1Rounds}-${p2Rounds}) - ${replay.steps.length} frames recorded`);
  
  return replay;
}

/**
 * Record training data
 */
async function recordTrainingData(): Promise<Replay[]> {
  console.log('\n=== PHASE 1: Recording Training Data ===\n');
  console.log(`Recording ${CONFIG.numGames} bot-vs-bot matches...`);
  console.log(`Using ${CONFIG.personalities.length} different personality types\n`);
  
  const recorder = new ReplayRecorder();
  const replays: Replay[] = [];
  
  // Create character definitions map
  const characterDefs = new Map();
  characterDefs.set('musashi', MUSASHI);
  
  for (let i = 0; i < CONFIG.numGames; i++) {
    // Cycle through personalities
    const p1Index = i % CONFIG.personalities.length;
    const p2Index = (i + 1) % CONFIG.personalities.length;
    
    const bot1 = new PersonalityBot(CONFIG.personalities[p1Index]);
    const bot2 = new PersonalityBot(CONFIG.personalities[p2Index]);
    
    // Create fresh game state for each match
    const gameConfig: GameConfig = {
      entities: [
        { characterId: 'musashi', id: 'player1', teamId: 0, startPosition: { x: 200, y: 0 } },
        { characterId: 'musashi', id: 'player2', teamId: 1, startPosition: { x: 600, y: 0 } },
      ],
      arena: { width: 800, height: 600, groundLevel: 500, leftBound: 0, rightBound: 800 },
      roundsToWin: 2,
      roundTimeSeconds: 60,
    };
    const gameState = createInitialState(gameConfig);
    
    const replay = await recordMatch(gameState, bot1, bot2, recorder, i + 1, characterDefs);
    replays.push(replay);
  }
  
  console.log(`\n✓ Recorded ${replays.length} matches`);
  console.log(`✓ Total frames: ${replays.reduce((sum, r) => sum + r.steps.length, 0)}`);
  console.log(`✓ Replays saved to: ${CONFIG.replayDir}\n`);
  
  return replays;
}

/**
 * Train neural network
 */
async function trainNeuralNetwork(replays: Replay[]): Promise<void> {
  console.log('\n=== PHASE 2: Training Neural Network ===\n');
  
  // Create policy and trainer
  const policy = new NeuralPolicy();
  const trainer = new ImitationTrainer(policy);
  
  // Train
  const metrics = await trainer.train(replays, {
    batchSize: CONFIG.batchSize,
    epochs: CONFIG.epochs,
    validationSplit: CONFIG.validationSplit,
    shuffle: true,
    verbose: true,
  });
  
  // Save model (use file:// scheme for Node.js)
  const modelPath = `file://${path.resolve(CONFIG.modelDir, CONFIG.modelName)}`;
  console.log(`\nSaving model to: ${modelPath}`);
  await policy.save(modelPath);
  
  console.log('\n✓ Training complete!');
  console.log(`✓ Best validation accuracy: ${(metrics.bestValAccuracy! * 100).toFixed(2)}% at epoch ${metrics.bestEpoch! + 1}`);
  console.log(`✓ Final training accuracy: ${(metrics.trainAccuracy[metrics.trainAccuracy.length - 1] * 100).toFixed(2)}%`);
  console.log(`✓ Model saved to: ${CONFIG.modelDir}/${CONFIG.modelName}\n`);
  
  // Clean up
  policy.dispose();
}

/**
 * Load existing replays from disk
 */
function loadExistingReplays(): Replay[] {
  if (!fs.existsSync(CONFIG.replayDir)) {
    return [];
  }
  
  const files = fs.readdirSync(CONFIG.replayDir)
    .filter(f => f.endsWith('.json'))
    .sort();
  
  const replays: Replay[] = [];
  for (const file of files) {
    const json = fs.readFileSync(path.join(CONFIG.replayDir, file), 'utf8');
    replays.push(ReplayRecorder.loadFromJSON(json));
  }
  
  return replays;
}

/**
 * Main training pipeline
 */
async function main(): Promise<void> {
  console.log('===========================================');
  console.log('  AI Training Pipeline');
  console.log('===========================================');
  console.log(`Configuration:`);
  console.log(`  - Games to record: ${CONFIG.numGames}`);
  console.log(`  - Personalities: ${CONFIG.personalities.length} types`);
  console.log(`  - Training epochs: ${CONFIG.epochs}`);
  console.log(`  - Batch size: ${CONFIG.batchSize}`);
  console.log(`  - Validation split: ${CONFIG.validationSplit * 100}%`);
  console.log('===========================================\n');
  
  ensureDirectories();
  
  // Check for existing replays
  const existingReplays = loadExistingReplays();
  if (existingReplays.length > 0) {
    console.log(`Found ${existingReplays.length} existing replays in ${CONFIG.replayDir}`);
    console.log('Options:');
    console.log('  1. Use existing replays (skip recording)');
    console.log('  2. Record new games (will delete existing replays)');
    console.log('  3. Add more games to existing replays\n');
    
    // For now, just use existing if available
    console.log('Using existing replays for training...\n');
    await trainNeuralNetwork(existingReplays);
  } else {
    // Record new data
    const replays = await recordTrainingData();
    
    // Train on recorded data
    await trainNeuralNetwork(replays);
  }
  
  console.log('===========================================');
  console.log('  Training Complete!');
  console.log('===========================================');
  console.log(`\nTo use the trained bot in your game:`);
  console.log(`\n  const policy = new NeuralPolicy();`);
  console.log(`  await policy.load('file://./models/${CONFIG.modelName}');`);
  console.log(`  const bot = new NeuralBot(policy);\n`);
}

// Run training
main().catch(error => {
  console.error('Training failed:', error);
  process.exit(1);
});
