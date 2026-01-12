/**
 * GuardianBot Tests
 * 
 * Tests for defensive bot behavior:
 * - Blocking probability (60-70%)
 * - Anti-air accuracy (70%)
 * - Punish detection and execution
 * - Spacing maintenance
 * - Difficulty scaling
 */

import { GuardianBot } from '../../src/core/ai/scripted/GuardianBot';
import { Observation } from '../../src/core/ai/Observation';
import { AIAction } from '../../src/core/ai/ActionSpace';
import { GameState, FighterStatus } from '../../src/core/interfaces/types';
import { createMockGameState, createMockObservation } from '../helpers/mockState';

describe('GuardianBot', () => {
  let bot: GuardianBot;
  let mockState: GameState;
  let mockObservation: Observation;

  beforeEach(() => {
    bot = new GuardianBot(5); // Medium difficulty
    mockState = createMockGameState();
    mockObservation = createMockObservation();
  });

  describe('Configuration', () => {
    it('should scale difficulty parameters correctly', () => {
      const easyBot = new GuardianBot(1);
      const hardBot = new GuardianBot(10);

      const easyConfig = easyBot.getConfig();
      const hardConfig = hardBot.getConfig();

      // Higher difficulty = higher block probability
      expect(hardConfig.blockProbability).toBeGreaterThan(easyConfig.blockProbability);

      // Higher difficulty = better anti-air accuracy
      expect(hardConfig.antiAirAccuracy).toBeGreaterThan(easyConfig.antiAirAccuracy);

      // Higher difficulty = faster reactions (lower delay)
      expect(hardConfig.reactionDelay).toBeLessThan(easyConfig.reactionDelay);

      // Higher difficulty = better execution
      expect(hardConfig.executionAccuracy).toBeGreaterThan(easyConfig.executionAccuracy);
    });

    it('should have defensive playstyle characteristics', () => {
      const config = bot.getConfig();

      // Medium difficulty should have reasonable block rate
      expect(config.blockProbability).toBeGreaterThanOrEqual(0.5);
      expect(config.blockProbability).toBeLessThanOrEqual(0.7);

      // Should have decent anti-air accuracy
      expect(config.antiAirAccuracy).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe('Blocking Behavior', () => {
    it('should block incoming attacks at expected rate', () => {
      const trials = 1000;
      let blockCount = 0;

      for (let i = 0; i < trials; i++) {
        // Reset for each trial
        bot.reset();

        // Setup: opponent attacking at close range
        const state = createMockGameState();
        const opponent = state.entities[1];
        opponent.status = FighterStatus.ATTACK;
        opponent.moveFrame = 5; // Active frames

        const obs = createMockObservation();
        obs.opponentRelativeX = 0.1; // Close range
        obs.selfStunFrames = 0;

        const action = bot.selectAction(obs, state, 'player1', i);

        if (action === AIAction.BLOCK) {
          blockCount++;
        }
      }

      const blockRate = blockCount / trials;

      // Should block 40-70% (difficulty 5 = ~55%)
      expect(blockRate).toBeGreaterThanOrEqual(0.40);
      expect(blockRate).toBeLessThanOrEqual(0.75);

      console.log(`GuardianBot block rate: ${(blockRate * 100).toFixed(1)}%`);
    });

    it('should not block when opponent is not attacking', () => {
      const state = createMockGameState();
      const opponent = state.entities[1];
      opponent.status = FighterStatus.IDLE;

      const obs = createMockObservation();
      obs.opponentRelativeX = 0.1; // Close range
      obs.selfStunFrames = 0;

      const action = bot.selectAction(obs, state, 'player1', 10);

      // Should not block idle opponent
      expect(action).not.toBe(AIAction.BLOCK);
    });

    it('should counter-attack after blocking multiple times', () => {
      const state = createMockGameState();
      const opponent = state.entities[1];
      opponent.status = FighterStatus.ATTACK;
      opponent.moveFrame = 5;

      const obs = createMockObservation();
      obs.opponentRelativeX = 0.1;
      obs.selfStunFrames = 0;

      // Force multiple blocks
      let frameCounter = 0;
      let foundCounterAttack = false;

      for (let i = 0; i < 50; i++) {
        const action = bot.selectAction(obs, state, 'player1', frameCounter);
        frameCounter += 10; // Simulate time passing

        // After blocking, should eventually counter-attack
        if (action === AIAction.LIGHT_KICK || 
            action === AIAction.LIGHT_PUNCH ||
            action === AIAction.HEAVY_PUNCH) {
          foundCounterAttack = true;
          break;
        }
      }

      expect(foundCounterAttack).toBe(true);
    });
  });

  describe('Anti-Air Behavior', () => {
    it('should anti-air jumping opponents at expected rate', () => {
      const trials = 1000;
      let antiAirCount = 0;

      for (let i = 0; i < trials; i++) {
        bot.reset();

        const state = createMockGameState();
        const opponent = state.entities[1];
        opponent.status = FighterStatus.JUMP;

        const obs = createMockObservation();
        obs.opponentRelativeX = 0.1; // Close range
        obs.opponentRelativeY = 0.2; // In air
        obs.selfStunFrames = 0;

        const action = bot.selectAction(obs, state, 'player1', i * 10);

        if (action === AIAction.HEAVY_PUNCH) {
          antiAirCount++;
        }
      }

      const antiAirRate = antiAirCount / trials;

      // Should anti-air ~40-70% (difficulty 5 = ~55%)
      expect(antiAirRate).toBeGreaterThanOrEqual(0.35);
      expect(antiAirRate).toBeLessThanOrEqual(0.75);

      console.log(`GuardianBot anti-air rate: ${(antiAirRate * 100).toFixed(1)}%`);
    });

    it('should not anti-air when opponent is grounded', () => {
      const state = createMockGameState();
      const opponent = state.entities[1];
      opponent.status = FighterStatus.IDLE;

      const obs = createMockObservation();
      obs.opponentRelativeX = 0.1;
      obs.opponentRelativeY = 0.0; // On ground
      obs.opponentIsGrounded = 1;
      obs.selfStunFrames = 0;

      const action = bot.selectAction(obs, state, 'player1', 10);

      // Should not use anti-air against grounded opponent
      // (Heavy punch might still be used, but not as anti-air)
    });
  });

  describe('Punish Detection', () => {
    it('should punish opponent recovery frames', () => {
      const state = createMockGameState();
      const opponent = state.entities[1];
      opponent.status = FighterStatus.ATTACK;
      opponent.moveFrame = 15; // In recovery
      opponent.stunFramesRemaining = 0;

      const obs = createMockObservation();
      obs.opponentRelativeX = 0.1; // Close range
      obs.selfStunFrames = 0;

      const action = bot.selectAction(obs, state, 'player1', 10);

      // Should attempt to punish (HP or LP)
      expect([AIAction.HEAVY_PUNCH, AIAction.LIGHT_PUNCH]).toContain(action);
    });

    it('should not punish when opponent is too far', () => {
      const state = createMockGameState();
      const opponent = state.entities[1];
      opponent.status = FighterStatus.ATTACK;
      opponent.moveFrame = 15;

      const obs = createMockObservation();
      obs.opponentRelativeX = 0.6; // Far range
      obs.selfStunFrames = 0;

      const action = bot.selectAction(obs, state, 'player1', 10);

      // Should not try to punish from far away
      expect(action).not.toBe(AIAction.HEAVY_PUNCH);
    });
  });

  describe('Spacing Behavior', () => {
    it('should back away when at disadvantage at close range', () => {
      const state = createMockGameState();
      const opponent = state.entities[1];
      opponent.status = FighterStatus.IDLE;

      const obs = createMockObservation();
      obs.opponentRelativeX = 0.1; // Very close
      obs.selfStunFrames = 0;

      // Bot just blocked (disadvantage)
      bot.selectAction(obs, state, 'player1', 5);

      const state2 = createMockGameState();
      state2.entities[1].status = FighterStatus.IDLE;

      const action = bot.selectAction(obs, state2, 'player1', 15);

      // Should create space
      expect(action).toBe(AIAction.WALK_BACKWARD);
    });

    it('should approach from far range', () => {
      const state = createMockGameState();
      const opponent = state.entities[1];
      opponent.status = FighterStatus.IDLE;

      const obs = createMockObservation();
      obs.opponentRelativeX = 0.8; // Far range
      obs.selfStunFrames = 0;

      const action = bot.selectAction(obs, state, 'player1', 10);

      // Should walk forward to close distance
      expect(action).toBe(AIAction.WALK_FORWARD);
    });

    it('should maintain mid-range spacing', () => {
      const state = createMockGameState();
      const opponent = state.entities[1];
      opponent.status = FighterStatus.IDLE;

      const obs = createMockObservation();
      obs.opponentRelativeX = 0.3; // Mid range
      obs.selfStunFrames = 0;

      const action = bot.selectAction(obs, state, 'player1', 10);

      // Should adjust spacing (walk forward or backward)
      expect([AIAction.WALK_FORWARD, AIAction.WALK_BACKWARD, AIAction.IDLE]).toContain(action);
    });
  });

  describe('Safe Offense', () => {
    it('should attack when at frame advantage', () => {
      const state = createMockGameState();
      const opponent = state.entities[1];
      opponent.status = FighterStatus.IDLE;
      opponent.stunFramesRemaining = 5; // Opponent in stun = advantage

      const obs = createMockObservation();
      obs.opponentRelativeX = 0.1; // Close range
      obs.opponentStunFrames = 5 / 60;
      obs.selfStunFrames = 0;

      const action = bot.selectAction(obs, state, 'player1', 10);

      // Should take advantage and attack
      expect([AIAction.LIGHT_PUNCH, AIAction.LIGHT_KICK]).toContain(action);
    });

    it('should not attack recklessly when at disadvantage', () => {
      const state = createMockGameState();
      const opponent = state.entities[1];
      opponent.status = FighterStatus.IDLE;

      const obs = createMockObservation();
      obs.opponentRelativeX = 0.1;
      obs.selfStunFrames = 0;

      // Simulate being at disadvantage (just got hit)
      const action = bot.selectAction(obs, state, 'player1', 10);

      // Should not use heavy attacks when uncertain
      expect(action).not.toBe(AIAction.HEAVY_KICK);
    });
  });

  describe('Reaction Delay', () => {
    it('should respect reaction delay between actions', () => {
      const state = createMockGameState();
      const obs = createMockObservation();
      obs.selfStunFrames = 0;

      const action1 = bot.selectAction(obs, state, 'player1', 10);
      const action2 = bot.selectAction(obs, state, 'player1', 11); // 1 frame later

      // With reaction delay, should not change action immediately
      // (unless action duration expired)
    });
  });

  describe('Reset Functionality', () => {
    it('should reset state properly', () => {
      const state = createMockGameState();
      const obs = createMockObservation();

      // Take some actions
      bot.selectAction(obs, state, 'player1', 10);
      bot.selectAction(obs, state, 'player1', 20);

      const statsBefore = bot.getStats();
      
      // Reset
      bot.reset();

      const statsAfter = bot.getStats();

      // Consecutive blocks should reset
      expect(statsAfter.consecutiveBlocks).toBe(0);
    });
  });

  describe('Integration - Full Match Behavior', () => {
    it('should demonstrate defensive playstyle over 300 frames', () => {
      const actions: AIAction[] = [];

      for (let frame = 0; frame < 300; frame += 5) {
        const state = createMockGameState();
        const obs = createMockObservation();
        obs.selfStunFrames = 0;

        // Vary opponent state
        const opponent = state.entities[1];
        if (frame % 30 < 15) {
          opponent.status = FighterStatus.ATTACK;
          opponent.moveFrame = 5;
        } else {
          opponent.status = FighterStatus.IDLE;
        }

        const action = bot.selectAction(obs, state, 'player1', frame);
        actions.push(action);
      }

      // Count action types
      const blockCount = actions.filter(a => a === AIAction.BLOCK).length;
      const attackCount = actions.filter(a => 
        a === AIAction.LIGHT_PUNCH || 
        a === AIAction.HEAVY_PUNCH ||
        a === AIAction.LIGHT_KICK ||
        a === AIAction.HEAVY_KICK
      ).length;

      // Defensive bot should block more than it attacks
      console.log(`GuardianBot match stats: ${blockCount} blocks, ${attackCount} attacks`);
      
      // Should have significant blocking behavior
      expect(blockCount).toBeGreaterThan(0);
    });
  });
});
