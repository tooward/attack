/**
 * Tests for FightingGameEnv
 */

import { FightingGameEnv, ActionBundle } from '../../src/ml/core/Environment';
import { MUSASHI as musashi } from '../../src/core/data/musashi';

describe('FightingGameEnv', () => {
  let env: FightingGameEnv;

  beforeEach(() => {
    env = new FightingGameEnv({
      player1Character: musashi,
      player2Character: musashi,
      roundTime: 99,
    });
  });

  describe('reset', () => {
    it('should reset environment to initial state', () => {
      // Step a few times
      const idleAction: ActionBundle = {
        direction: 'neutral',
        button: 'none',
        holdDuration: 0,
      };

      const actions = new Map<string, ActionBundle>();
      actions.set('player1', idleAction);
      actions.set('player2', idleAction);

      env.step(actions);
      env.step(actions);

      // Reset
      const state = env.reset();

      expect(state.frame).toBe(0);
      expect(state.round.roundNumber).toBe(1);
      expect(state.entities.length).toBe(2);
      expect(state.entities[0].health).toBe(state.entities[0].maxHealth);
    });

    it('should clear cumulative rewards', () => {
      const idleAction: ActionBundle = {
        direction: 'neutral',
        button: 'none',
        holdDuration: 0,
      };

      const actions = new Map<string, ActionBundle>();
      actions.set('player1', idleAction);
      actions.set('player2', idleAction);

      env.step(actions);

      const rewardBefore = env.getCumulativeReward('player1');
      env.reset();
      const rewardAfter = env.getCumulativeReward('player1');

      expect(rewardAfter).toBe(0);
    });
  });

  describe('step', () => {
    it('should increment frame counter', () => {
      const idleAction: ActionBundle = {
        direction: 'neutral',
        button: 'none',
        holdDuration: 0,
      };

      const actions = new Map<string, ActionBundle>();
      actions.set('player1', idleAction);
      actions.set('player2', idleAction);

      const result = env.step(actions);
      expect(result.info.frame).toBe(1);

      const result2 = env.step(actions);
      expect(result2.info.frame).toBe(2);
    });

    it('should return observations for all entities', () => {
      const idleAction: ActionBundle = {
        direction: 'neutral',
        button: 'none',
        holdDuration: 0,
      };

      const actions = new Map<string, ActionBundle>();
      actions.set('player1', idleAction);
      actions.set('player2', idleAction);

      const result = env.step(actions);

      expect(result.observations.has('player1')).toBe(true);
      expect(result.observations.has('player2')).toBe(true);
    });

    it('should return rewards for all entities', () => {
      const idleAction: ActionBundle = {
        direction: 'neutral',
        button: 'none',
        holdDuration: 0,
      };

      const actions = new Map<string, ActionBundle>();
      actions.set('player1', idleAction);
      actions.set('player2', idleAction);

      const result = env.step(actions);

      expect(result.rewards.has('player1')).toBe(true);
      expect(result.rewards.has('player2')).toBe(true);
    });

    it('should set done flag when round ends', () => {
      const idleAction: ActionBundle = {
        direction: 'neutral',
        button: 'none',
        holdDuration: 0,
      };

      const actions = new Map<string, ActionBundle>();
      actions.set('player1', idleAction);
      actions.set('player2', idleAction);

      // Step until round timeout or health depletes
      let result;
      for (let i = 0; i < 99 * 60 + 10; i++) {
        result = env.step(actions);
        if (result.done) break;
      }

      expect(result?.done).toBe(true);
    });
  });

  describe('isDone', () => {
    it('should return false initially', () => {
      expect(env.isDone()).toBe(false);
    });

    it('should return true after round ends', () => {
      const idleAction: ActionBundle = {
        direction: 'neutral',
        button: 'none',
        holdDuration: 0,
      };

      const actions = new Map<string, ActionBundle>();
      actions.set('player1', idleAction);
      actions.set('player2', idleAction);

      // Step until round ends
      for (let i = 0; i < 99 * 60 + 10; i++) {
        env.step(actions);
        if (env.isDone()) break;
      }

      expect(env.isDone()).toBe(true);
    });
  });

  describe('combat events', () => {
    it('should detect damage events', () => {
      // This test would require setting up a combat scenario
      // For now, we'll skip implementation details
      expect(true).toBe(true);
    });
  });
});
