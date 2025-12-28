/**
 * End-to-End Integration Tests
 * 
 * Tests the complete ML bot system from model loading to inference.
 */

import { BotRuntime, BotConfig } from '../../src/ml/inference/BotRuntime';
import { getDifficultyKnobs } from '../../src/ml/inference/DifficultyConfig';
import { getStyleConfig } from '../../src/ml/inference/StyleConfig';
import { ModelOptimizer, MOBILE_OPTIMIZATION_CONFIG } from '../../src/ml/deployment/ModelOptimizer';
import * as tf from '@tensorflow/tfjs-node';
import type { GameState } from '../../src/core/interfaces/types';

/**
 * Create mock game state for testing
 */
function createMockGameState(): GameState {
  return {
    entities: [
      {
        id: '1',
        position: { x: 800, y: 500 },
        velocity: { x: 0, y: 0 },
        health: 80,
        maxHealth: 100,
        superMeter: 50,
        maxSuperMeter: 100,
        energy: 100,
        maxEnergy: 100,
        status: 'idle',
        stunFramesRemaining: 0,
        facing: 1,
        isGrounded: true,
        comboCount: 0,
      },
      {
        id: '2',
        position: { x: 1200, y: 500 },
        velocity: { x: 0, y: 0 },
        health: 70,
        maxHealth: 100,
        superMeter: 30,
        maxSuperMeter: 100,
        energy: 100,
        maxEnergy: 100,
        status: 'idle',
        stunFramesRemaining: 0,
        facing: -1,
        isGrounded: true,
        comboCount: 0,
      },
    ],
    arena: {
      leftBound: 0,
      rightBound: 2000,
      height: 750,
    },
    round: {
      timeRemaining: 3600,
    },
  } as GameState;
}

/**
 * Create a simple test model
 */
function createTestModel(obsSize: number = 45, actionSize: number = 18): tf.LayersModel {
  const input = tf.input({ shape: [obsSize] });
  const dense1 = tf.layers.dense({ units: 64, activation: 'relu' }).apply(input) as tf.SymbolicTensor;
  const dense2 = tf.layers.dense({ units: 64, activation: 'relu' }).apply(dense1) as tf.SymbolicTensor;
  
  // Policy head
  const policyOutput = tf.layers.dense({ 
    units: actionSize, 
    activation: 'softmax',
    name: 'policy'
  }).apply(dense2) as tf.SymbolicTensor;
  
  const model = tf.model({ inputs: input, outputs: policyOutput });
  
  return model;
}

describe('End-to-End Integration Tests', () => {
  let testModel: tf.LayersModel;

  beforeAll(() => {
    // Create test model
    testModel = createTestModel();
  });

  afterAll(() => {
    testModel.dispose();
  });

  describe('Bot Runtime Integration', () => {
    it('should create bot with valid config', () => {
      const config: BotConfig = {
        difficulty: 5,
        style: 'rushdown',
        playerIndex: 2,
      };

      const bot = new BotRuntime(
        testModel,
        config
      );

      expect(bot).toBeDefined();
      expect(bot.getConfig()).toEqual(config);
      
      bot.dispose();
    });

    it('should get action from game state', () => {
      const config: BotConfig = {
        difficulty: 5,
        style: 'rushdown',
        playerIndex: 2,
      };

      const bot = new BotRuntime(
        testModel,
        config
      );

      const state = createMockGameState();
      const action = bot.getAction(state);

      expect(action).toBeDefined();
      expect(action.action).toBeGreaterThanOrEqual(0);
      expect(action.action).toBeLessThan(18);
      expect(action.confidence).toBeGreaterThanOrEqual(0);
      expect(action.confidence).toBeLessThanOrEqual(1);
      
      bot.dispose();
    });

    it('should respect difficulty settings', () => {
      const config: BotConfig = {
        difficulty: 1,  // Beginner
        style: 'mixup',
        playerIndex: 2,
      };

      const bot = new BotRuntime(
        testModel,
        config,
        42  // Seeded for reproducibility
      );

      const state = createMockGameState();
      const actions: number[] = [];

      // Collect actions
      for (let i = 0; i < 100; i++) {
        const action = bot.getAction(state);
        actions.push(action.action);
      }

      // Level 1 should have high execution error rate
      // So we expect some repeated/error actions
      const uniqueActions = new Set(actions).size;
      expect(uniqueActions).toBeGreaterThan(3);  // Some variety
      
      bot.dispose();
    });

    it('should change difficulty at runtime', () => {
      const config: BotConfig = {
        difficulty: 5,
        style: 'zoner',
        playerIndex: 2,
      };

      const bot = new BotRuntime(
        testModel,
        config
      );

      const initialDifficulty = bot.getDifficultyKnobs();
      expect(initialDifficulty.reactionDelay).toBe(10);

      // Change to level 10
      bot.setDifficulty(10);
      const newDifficulty = bot.getDifficultyKnobs();
      expect(newDifficulty.reactionDelay).toBe(0);
      
      bot.dispose();
    });

    it('should change style at runtime', () => {
      const config: BotConfig = {
        difficulty: 5,
        style: 'rushdown',
        playerIndex: 2,
      };

      const bot = new BotRuntime(
        testModel,
        config
      );

      const initialStyle = bot.getStyleConfig();
      expect(initialStyle.metadata.name).toBe('rushdown');

      // Change to zoner
      bot.setStyle('zoner');
      const newStyle = bot.getStyleConfig();
      expect(newStyle.metadata.name).toBe('zoner');
      
      bot.dispose();
    });
  });

  describe('Performance Tests', () => {
    it('should meet inference time requirements (<16ms)', () => {
      const config: BotConfig = {
        difficulty: 5,
        style: 'mixup',
        playerIndex: 2,
      };

      const bot = new BotRuntime(
        testModel,
        config
      );

      const state = createMockGameState();
      const iterations = 100;
      
      // Warmup
      for (let i = 0; i < 10; i++) {
        bot.getAction(state);
      }

      // Measure
      const startTime = Date.now();
      for (let i = 0; i < iterations; i++) {
        bot.getAction(state);
      }
      const endTime = Date.now();

      const avgTime = (endTime - startTime) / iterations;
      expect(avgTime).toBeLessThan(16);  // 60fps budget

      bot.dispose();
    });

    it('should handle multiple bots efficiently', () => {
      const bots = [];
      
      // Create 4 bots
      for (let i = 0; i < 4; i++) {
        const config: BotConfig = {
          difficulty: (i % 10) + 1 as any,
          style: ['rushdown', 'zoner', 'turtle', 'mixup'][i % 4] as any,
          playerIndex: 2,
        };

        bots.push(
          new BotRuntime(
            testModel,
            config
          )
        );
      }

      const state = createMockGameState();
      const iterations = 50;

      const startTime = Date.now();
      for (let i = 0; i < iterations; i++) {
        for (const bot of bots) {
          bot.getAction(state);
        }
      }
      const endTime = Date.now();

      const totalTime = endTime - startTime;
      const avgTimePerBot = totalTime / (iterations * bots.length);
      
      expect(avgTimePerBot).toBeLessThan(20);  // Allow some overhead

      bots.forEach(b => b.dispose());
    });
  });

  describe('Model Optimization', () => {
    it('should optimize model for production', async () => {
      const optimizer = new ModelOptimizer(MOBILE_OPTIMIZATION_CONFIG);
      
      const { model: optimizedModel, stats } = await optimizer.optimizeModel(testModel);

      expect(optimizedModel).toBeDefined();
      expect(stats.compressionRatio).toBeGreaterThan(1);
      expect(stats.optimizedSize).toBeLessThan(stats.originalSize);

      optimizedModel.dispose();
    });

    it('optimized model should maintain accuracy', async () => {
      const optimizer = new ModelOptimizer({
        quantization: { enabled: true, dtype: 'int8' },
        pruning: { enabled: true, threshold: 0.01, sparsity: 0.5 },
        compression: { enabled: false, algorithm: 'gzip' },
      });

      // Create validation data
      const validationInputs = tf.randomNormal([100, 45]);
      const validationOutputs = testModel.predict(validationInputs) as tf.Tensor;

      const { model: optimizedModel, stats } = await optimizer.optimizeModel(
        testModel,
        { inputs: validationInputs, outputs: validationOutputs }
      );

      // Accuracy delta should be small (<= 5% + tiny epsilon for float noise)
      expect(Math.abs(stats.accuracyDelta)).toBeLessThanOrEqual(0.0501);

      validationInputs.dispose();
      validationOutputs.dispose();
      optimizedModel.dispose();
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory during inference', () => {
      const config: BotConfig = {
        difficulty: 5,
        style: 'rushdown',
        playerIndex: 2,
      };

      const bot = new BotRuntime(
        testModel,
        config
      );

      const state = createMockGameState();
      
      const initialMemory = tf.memory();
      
      // Run many inferences
      for (let i = 0; i < 1000; i++) {
        bot.getAction(state);
      }

      const finalMemory = tf.memory();
      
      // Number of tensors should not grow significantly
      const tensorGrowth = finalMemory.numTensors - initialMemory.numTensors;
      expect(tensorGrowth).toBeLessThan(10);

      bot.dispose();
    });

    it('should properly dispose resources', () => {
      const config: BotConfig = {
        difficulty: 5,
        style: 'zoner',
        playerIndex: 2,
      };

      const initialMemory = tf.memory();

      const bot = new BotRuntime(
        testModel,
        config
      );

      const state = createMockGameState();
      bot.getAction(state);
      
      bot.dispose();

      const finalMemory = tf.memory();
      
      // Tensor count should return to near original
      const tensorDiff = Math.abs(finalMemory.numTensors - initialMemory.numTensors);
      expect(tensorDiff).toBeLessThan(5);
    });
  });

  describe('Determinism', () => {
    it('should produce identical results with same seed', () => {
      const seed = 12345;
      const state = createMockGameState();

      const config: BotConfig = {
        difficulty: 5,
        style: 'mixup',
        playerIndex: 2,
      };

      const bot1 = new BotRuntime(
        testModel,
        config,
        seed
      );

      const bot2 = new BotRuntime(
        testModel,
        config,
        seed
      );

      const actions1: number[] = [];
      const actions2: number[] = [];

      for (let i = 0; i < 50; i++) {
        actions1.push(bot1.getAction(state).action);
        actions2.push(bot2.getAction(state).action);
      }

      expect(actions1).toEqual(actions2);
      
      bot1.dispose();
      bot2.dispose();
    });
  });

  describe('Edge Cases', () => {
    it('should handle extreme game states', () => {
      const config: BotConfig = {
        difficulty: 5,
        style: 'turtle',
        playerIndex: 2,
      };

      const bot = new BotRuntime(
        testModel,
        config
      );

      // Extreme state: both players at 1 HP, far apart
      const extremeState = createMockGameState();
      extremeState.entities[0].health = 1;
      extremeState.entities[1].health = 1;
      extremeState.entities[0].position.x = 100;
      extremeState.entities[1].position.x = 1900;

      const action = bot.getAction(extremeState);
      expect(action.action).toBeGreaterThanOrEqual(0);
      expect(action.action).toBeLessThan(18);
      
      bot.dispose();
    });

    it('should handle rapid difficulty changes', () => {
      const config: BotConfig = {
        difficulty: 5,
        style: 'rushdown',
        playerIndex: 2,
      };

      const bot = new BotRuntime(
        testModel,
        config
      );

      const state = createMockGameState();

      // Rapidly change difficulty
      for (let level = 1; level <= 10; level++) {
        bot.setDifficulty(level as any);
        const action = bot.getAction(state);
        expect(action).toBeDefined();
      }
      
      bot.dispose();
    });
  });
});
