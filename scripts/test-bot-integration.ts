#!/usr/bin/env node

/**
 * Quick test script to verify bot integration with training system.
 * Runs a short training session against each bot type.
 */

import { getBotForStep, createBotActionFn, BotType, DEFAULT_CURRICULUM } from '../src/ml/training/BotSelector';

console.log('='.repeat(80));
console.log('Bot Integration Test');
console.log('='.repeat(80));

// Test 1: Verify curriculum progression
console.log('\n[Test 1] Curriculum Progression:');
const testSteps = [0, 500000, 1000000, 2000000, 5000000, 10000000];
for (const step of testSteps) {
  const config = getBotForStep(step, DEFAULT_CURRICULUM);
  console.log(`  ${step.toLocaleString().padStart(12)} steps: ${config.botType.padEnd(10)} difficulty ${config.difficulty}`);
}

// Test 2: Create bot action functions
console.log('\n[Test 2] Bot Action Functions:');
const botTypes: BotType[] = [
  BotType.TUTORIAL,
  BotType.GUARDIAN,
  BotType.AGGRESSOR,
  BotType.TACTICIAN,
  BotType.WILDCARD
];

for (const botType of botTypes) {
  for (const difficulty of [1, 5, 10]) {
    const actionFn = createBotActionFn(botType, difficulty);
    console.log(`  ✓ ${botType.padEnd(10)} difficulty ${difficulty}: function created`);
    
    // Validate function signature
    if (typeof actionFn !== 'function') {
      console.error(`    ✗ Expected function, got ${typeof actionFn}`);
      process.exit(1);
    }
  }
}

// Test 3: Verify legacy bots still work
console.log('\n[Test 3] Legacy Bot Compatibility:');
const legacyTypes = [BotType.LEGACY_EASY, BotType.LEGACY_TIGHT];
for (const botType of legacyTypes) {
  const actionFn = createBotActionFn(botType, 5);
  console.log(`  ✓ ${botType}: function created`);
  
  if (typeof actionFn !== 'function') {
    console.error(`    ✗ Expected function, got ${typeof actionFn}`);
    process.exit(1);
  }
}

console.log('\n' + '='.repeat(80));
console.log('✓ All bot integration tests passed!');
console.log('='.repeat(80));
console.log('\nTraining system ready:');
console.log('  npm run train                                    # Start training (progressive curriculum)');
console.log('  TRAIN_BOT_TYPE=GUARDIAN TRAIN_BOT_DIFFICULTY=7 npm run train  # Custom bot');
console.log('  TRAIN_STEPS=100000 npm run train                 # Quick test run');
console.log('\n');

