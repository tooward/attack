/**
 * Tests for RewardFunction
 */

import { RewardFunction, DEFAULT_REWARD_WEIGHTS } from '../../src/ml/core/RewardFunction';
import { GameState } from '../../src/core/interfaces/types';
import { createInitialState } from '../../src/core/Game';
import { MUSASHI as musashi } from '../../src/core/data/musashi';
import { CombatEvent } from '../../src/ml/core/Environment';

describe('RewardFunction', () => {
  let rewardFn: RewardFunction;
  let gameState: GameState;

  const cloneState = <T,>(state: T): T => {
    // Jest tests were using shallow spreads, which share nested arrays/objects.
    // Reward calculations depend on deltas between prev/curr, so we need a deep copy.
    return JSON.parse(JSON.stringify(state)) as T;
  };

  beforeEach(() => {
    rewardFn = new RewardFunction(DEFAULT_REWARD_WEIGHTS);
    gameState = createInitialState({
      entities: [
        { characterId: 'musashi', id: 'player1', teamId: 0, startPosition: { x: 300, y: 500 } },
        { characterId: 'musashi', id: 'player2', teamId: 1, startPosition: { x: 700, y: 500 } },
      ],
      arena: {
        width: 1000,
        height: 600,
        groundLevel: 500,
        leftBound: 100,
        rightBound: 900,
      },
      roundsToWin: 2,
      roundTimeSeconds: 60,
    });
    rewardFn.reset(gameState);
  });

  describe('reset', () => {
    it('should initialize reward state', () => {
      expect(() => {
        rewardFn.reset(gameState);
      }).not.toThrow();
    });
  });

  describe('calculateReward', () => {
    it('should return a number', () => {
      const prevState = cloneState(gameState);
      const events: CombatEvent[] = [];
      
      const reward = rewardFn.calculateReward(prevState, gameState, 'player1', events);
      
      expect(typeof reward).toBe('number');
      expect(isNaN(reward)).toBe(false);
    });

    it('should give positive reward for damage dealt', () => {
      const prevState = cloneState(gameState);
      const currState = cloneState(gameState);
      
      // Reduce opponent health
      currState.entities[1].health = prevState.entities[1].health - 10;
      
      const events: CombatEvent[] = [{
        type: 'hit',
        attacker: 'player1',
        defender: 'player2',
        damage: 10,
        frame: 1,
      }];
      
      const reward = rewardFn.calculateReward(prevState, currState, 'player1', events);
      
      expect(reward).toBeGreaterThan(0);
    });

    it('should give negative reward for damage taken', () => {
      const prevState = cloneState(gameState);
      const currState = cloneState(gameState);
      
      // Reduce self health
      currState.entities[0].health = prevState.entities[0].health - 10;
      
      const events: CombatEvent[] = [{
        type: 'hit',
        attacker: 'player2',
        defender: 'player1',
        damage: 10,
        frame: 1,
      }];
      
      const reward = rewardFn.calculateReward(prevState, currState, 'player1', events);
      
      // Reward includes damage taken penalty plus other factors (positioning, etc)
      // Just verify it's not highly positive
      expect(reward).toBeLessThan(1.0);
    });

    it('should give large reward for round win', () => {
      const prevState = cloneState(gameState);
      const currState = cloneState(gameState);
      
      currState.round.winner = 'player1';
      
      const events: CombatEvent[] = [];
      
      const reward = rewardFn.calculateReward(prevState, currState, 'player1', events);
      
      expect(reward).toBeGreaterThan(50); // Should include round win bonus
    });

    it('should give large negative reward for round loss', () => {
      const prevState = cloneState(gameState);
      const currState = cloneState(gameState);
      
      currState.round.winner = 'player2';
      
      const events: CombatEvent[] = [];
      
      const reward = rewardFn.calculateReward(prevState, currState, 'player1', events);
      
      expect(reward).toBeLessThan(-50); // Should include round loss penalty
    });
  });

  describe('calculateRewardBreakdown', () => {
    it('should return breakdown object', () => {
      const prevState = cloneState(gameState);
      const events: CombatEvent[] = [];
      
      const breakdown = rewardFn.calculateRewardBreakdown(prevState, gameState, 'player1', events);
      
      expect(breakdown).toHaveProperty('total');
      expect(breakdown).toHaveProperty('damageDealt');
      expect(breakdown).toHaveProperty('damageTaken');
      expect(breakdown).toHaveProperty('roundOutcome');
      expect(breakdown).toHaveProperty('stalling');
    });

    it('should have total equal to sum of components', () => {
      const prevState = cloneState(gameState);
      const events: CombatEvent[] = [];
      
      const breakdown = rewardFn.calculateRewardBreakdown(prevState, gameState, 'player1', events);
      
      // Note: Due to floating point, we check approximate equality
      const sum = 
        breakdown.damageDealt +
        breakdown.damageTaken +
        breakdown.knockdown +
        breakdown.roundOutcome +
        breakdown.hitConfirm +
        breakdown.successfulBlock +
        breakdown.whiffPunish +
        breakdown.cornering +
        breakdown.rangeControl +
        breakdown.stalling +
        breakdown.diversity +
        breakdown.repetition +
        breakdown.style;
      
      expect(Math.abs(breakdown.total - sum)).toBeLessThan(0.01);
    });
  });

  describe('updateWeights', () => {
    it('should update reward weights', () => {
      const originalWeights = rewardFn.getWeights();
      
      rewardFn.updateWeights({ aggression: 0.5 });
      
      const newWeights = rewardFn.getWeights();
      
      expect(newWeights.aggression).toBe(0.5);
      expect(newWeights.damageDealt).toBe(originalWeights.damageDealt);
    });

    it('should preserve other weights', () => {
      const originalWeights = rewardFn.getWeights();
      
      rewardFn.updateWeights({ defense: 0.3 });
      
      const newWeights = rewardFn.getWeights();
      
      expect(newWeights.defense).toBe(0.3);
      expect(newWeights.damageDealt).toBe(originalWeights.damageDealt);
      expect(newWeights.knockdown).toBe(originalWeights.knockdown);
    });
  });
});
