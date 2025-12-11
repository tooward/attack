/**
 * Neural Network Tests
 * Test neural policy, neural bot, and imitation training
 */

import { describe, test, expect } from '@jest/globals';
import '@tensorflow/tfjs';
import { NeuralPolicy, DEFAULT_POLICY_CONFIG } from '../../src/core/ai/NeuralPolicy';
import { NeuralBot } from '../../src/core/ai/NeuralBot';
import { ImitationTrainer } from '../../src/training/ImitationTrainer';
import { Observation } from '../../src/core/ai/Observation';
import { AIAction } from '../../src/core/ai/ActionSpace';
import { Replay, ReplayStep } from '../../src/core/ai/ReplayRecorder';

describe('Neural Network System', () => {
  test('creates neural policy with correct architecture', () => {
    const policy = new NeuralPolicy();
    const model = policy.getModel();

    expect(model).toBeDefined();
    expect(model.layers.length).toBeGreaterThan(0);

    // Verify model has correct number of layers (input + hidden + output)
    expect(model.layers.length).toBeGreaterThanOrEqual(3);

    policy.dispose();
  });

  test('policy predicts action probabilities', async () => {
    const policy = new NeuralPolicy();

    const observation: Observation = {
      selfX: 0.3,
      selfY: 0.8,
      selfHealth: 1.0,
      selfEnergy: 0.5,
      selfSuperMeter: 0.0,
      selfIsGrounded: 1,
      selfFacing: 1,
      selfStatus: 0.0,
      selfMoveFrame: 0.0,
      selfStunFrames: 0.0,
      selfComboCount: 0.0,
      opponentRelativeX: 0.4,
      opponentRelativeY: 0.0,
      opponentHealth: 1.0,
      opponentEnergy: 0.5,
      opponentSuperMeter: 0.0,
      opponentIsGrounded: 1,
      opponentStatus: 0.0,
      opponentMoveFrame: 0.0,
      opponentStunFrames: 0.0,
      opponentComboCount: 0.0,
      roundTime: 1.0,
      distanceToOpponent: 0.4,
    };

    const probabilities = await policy.predict(observation);

    // Should have 14 action probabilities
    expect(probabilities.length).toBe(14);

    // All probabilities should be between 0 and 1
    for (const prob of probabilities) {
      expect(prob).toBeGreaterThanOrEqual(0);
      expect(prob).toBeLessThanOrEqual(1);
    }

    // Probabilities should sum to approximately 1 (softmax output)
    const sum = probabilities.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);

    policy.dispose();
  });

  test('policy selects valid actions', async () => {
    const policy = new NeuralPolicy();

    const observation: Observation = {
      selfX: 0.3,
      selfY: 0.8,
      selfHealth: 1.0,
      selfEnergy: 0.5,
      selfSuperMeter: 0.0,
      selfIsGrounded: 1,
      selfFacing: 1,
      selfStatus: 0.0,
      selfMoveFrame: 0.0,
      selfStunFrames: 0.0,
      selfComboCount: 0.0,
      opponentRelativeX: 0.4,
      opponentRelativeY: 0.0,
      opponentHealth: 1.0,
      opponentEnergy: 0.5,
      opponentSuperMeter: 0.0,
      opponentIsGrounded: 1,
      opponentStatus: 0.0,
      opponentMoveFrame: 0.0,
      opponentStunFrames: 0.0,
      opponentComboCount: 0.0,
      roundTime: 1.0,
      distanceToOpponent: 0.4,
    };

    // Test multiple selections
    for (let i = 0; i < 10; i++) {
      const action = await policy.selectAction(observation);
      expect(action).toBeGreaterThanOrEqual(0);
      expect(action).toBeLessThan(14);
    }

    policy.dispose();
  });

  test('NeuralBot respects action duration', async () => {
    const policy = new NeuralPolicy();
    const bot = new NeuralBot(policy, { temperature: 1.0, actionDuration: 5, useGreedy: false });

    const observation: Observation = {
      selfX: 0.3,
      selfY: 0.8,
      selfHealth: 1.0,
      selfEnergy: 0.5,
      selfSuperMeter: 0.0,
      selfIsGrounded: 1,
      selfFacing: 1,
      selfStatus: 0.0,
      selfMoveFrame: 0.0,
      selfStunFrames: 0.0,
      selfComboCount: 0.0,
      opponentRelativeX: 0.4,
      opponentRelativeY: 0.0,
      opponentHealth: 1.0,
      opponentEnergy: 0.5,
      opponentSuperMeter: 0.0,
      opponentIsGrounded: 1,
      opponentStatus: 0.0,
      opponentMoveFrame: 0.0,
      opponentStunFrames: 0.0,
      opponentComboCount: 0.0,
      roundTime: 1.0,
      distanceToOpponent: 0.4,
    };

    const firstAction = await bot.selectAction(observation, 0);
    
    // Next few frames should return same action
    const secondAction = await bot.selectAction(observation, 1);
    const thirdAction = await bot.selectAction(observation, 2);
    
    expect(secondAction).toBe(firstAction);
    expect(thirdAction).toBe(firstAction);

    policy.dispose();
  });

  test('policy can train on batch', async () => {
    const policy = new NeuralPolicy();

    const observations: Observation[] = [];
    const actions: AIAction[] = [];

    // Create simple training data
    for (let i = 0; i < 10; i++) {
      observations.push({
        selfX: 0.3,
        selfY: 0.8,
        selfHealth: 1.0,
        selfEnergy: 0.5,
        selfSuperMeter: 0.0,
        selfIsGrounded: 1,
        selfFacing: 1,
        selfStatus: 0.0,
        selfMoveFrame: 0.0,
        selfStunFrames: 0.0,
        selfComboCount: 0.0,
        opponentRelativeX: 0.4,
        opponentRelativeY: 0.0,
        opponentHealth: 1.0,
        opponentEnergy: 0.5,
        opponentSuperMeter: 0.0,
        opponentIsGrounded: 1,
        opponentStatus: 0.0,
        opponentMoveFrame: 0.0,
        opponentStunFrames: 0.0,
        opponentComboCount: 0.0,
        roundTime: 1.0,
        distanceToOpponent: 0.4,
      });
      actions.push(AIAction.LIGHT_PUNCH);
    }

    const result = await policy.trainBatch(observations, actions);

    expect(result.loss).toBeGreaterThan(0);
    expect(result.accuracy).toBeGreaterThanOrEqual(0);
    expect(result.accuracy).toBeLessThanOrEqual(1);

    policy.dispose();
  });

  test('imitation trainer extracts data from replays', async () => {
    const policy = new NeuralPolicy();
    const trainer = new ImitationTrainer(policy);

    // Create mock replay
    const mockReplay: Replay = {
      steps: [
        {
          frame: 0,
          observation: {
            selfX: 0.3,
            selfY: 0.8,
            selfVelX: 0,
            selfVelY: 0,
            selfHealth: 1.0,
            selfEnergy: 0.5,
            selfSuperMeter: 0.0,
            selfStatus: 0.0,
            selfStunFrames: 0.0,
            selfInvincibleFrames: 0.0,
            opponentX: 0.7,
            opponentY: 0.8,
            opponentVelX: 0,
            opponentVelY: 0,
            opponentHealth: 1.0,
            opponentEnergy: 0.5,
            opponentSuperMeter: 0.0,
            opponentStatus: 0.0,
            opponentStunFrames: 0.0,
            opponentInvincibleFrames: 0.0,
            distanceToOpponent: 0.4,
            roundTimeRemaining: 1.0,
            facingRight: 1,
          },
          action: AIAction.WALK_FORWARD,
          reward: 0,
        },
      ],
      winner: 1,
      finalScore: {
        player1Health: 100,
        player2Health: 80,
        player1Rounds: 2,
        player2Rounds: 1,
      },
      timestamp: Date.now(),
    };

    // Train should not throw
    await expect(
      trainer.train([mockReplay], { batchSize: 1, epochs: 1, validationSplit: 0.0, shuffle: false, verbose: false })
    ).resolves.toBeDefined();

    policy.dispose();
  }, 30000); // 30 second timeout for training
});
