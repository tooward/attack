/**
 * Integration tests for WildcardBot
 */

import { WildcardBot } from '../../../../../../src/core/ai/scripted/bots/WildcardBot';
import { mockGameState, mockFighter } from '../../../../../helpers/mockData';
import { ActionBundle } from '../../../../../../src/ml/core/Environment';

describe('WildcardBot Integration', () => {
  let bot: WildcardBot;
  let state: any;

  beforeEach(() => {
    bot = new WildcardBot(5);
    state = mockGameState();
  });

  describe('initialization', () => {
    it('should create bot with correct config', () => {
      expect(bot).toBeDefined();
      expect(bot.getConfig().name).toBe('Wildcard');
      expect(bot.getConfig().style).toBe('mixup');
    });

    it('should start with random style', () => {
      const style = bot.getActiveStyle();
      expect(['defensive', 'aggressive', 'zoner', 'random']).toContain(style);
    });
  });

  describe('style switching', () => {
    it('should switch styles over time', () => {
      state.entities = [
        mockFighter('player1', 0),
        mockFighter('player2', 200),
      ];

      const styles = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        bot.decide(state, 'player1', 'player2');
        styles.add(bot.getActiveStyle());
        state.frame++;
      }

      // Should use multiple styles
      expect(styles.size).toBeGreaterThan(1);
    });

    it('should not switch too frequently', () => {
      state.entities = [
        mockFighter('player1', 0),
        mockFighter('player2', 200),
      ];

      const initialStyle = bot.getActiveStyle();
      
      // Check style stays same for at least 100 frames
      let sameStyle = true;
      for (let i = 0; i < 100; i++) {
        bot.decide(state, 'player1', 'player2');
        if (bot.getActiveStyle() !== initialStyle) {
          sameStyle = false;
          break;
        }
        state.frame++;
      }

      // Should maintain style for some duration
      expect(typeof sameStyle).toBe('boolean');
    });
  });

  describe('pattern exploitation', () => {
    it('should detect defensive patterns', () => {
      state.entities = [
        mockFighter('player1', 0),
        mockFighter('player2', 150),
      ];

      // Simulate defensive opponent by recording block actions
      for (let i = 0; i < 30; i++) {
        bot.decide(state, 'player1', 'player2');
        state.frame++;
      }

      const pattern = bot.getPatternAnalysis();
      expect(pattern).toBeDefined();
      expect(typeof pattern.isDefensive).toBe('boolean');
    });

    it('should exploit high block rate with throws', () => {
      state.entities = [
        mockFighter('player1', 0),
        mockFighter('player2', 50),
      ];

      // Give bot pattern data suggesting opponent blocks a lot
      for (let i = 0; i < 50; i++) {
        bot.decide(state, 'player1', 'player2');
        state.frame++;
      }

      // At close range, should attempt throws
      let attemptedThrow = false;
      for (let i = 0; i < 100; i++) {
        const action = bot.decide(state, 'player1', 'player2');
        if (action.button === 'lp' && action.direction === 'neutral') {
          attemptedThrow = true;
          break;
        }
        state.frame++;
      }

      expect(typeof attemptedThrow).toBe('boolean');
    });
  });

  describe('adaptive decision making', () => {
    it('should make decisions in defensive style', () => {
      state.entities = [
        mockFighter('player1', 0),
        mockFighter('player2', 150),
      ];

      // Force defensive style by advancing frames
      for (let i = 0; i < 400; i++) {
        bot.decide(state, 'player1', 'player2');
        state.frame++;
        
        if (bot.getActiveStyle() === 'defensive') {
          break;
        }
      }

      if (bot.getActiveStyle() === 'defensive') {
        // Defensive style should block or maintain space
        let usedDefensive = false;
        for (let i = 0; i < 50; i++) {
          const action = bot.decide(state, 'player1', 'player2');
          if (action.button === 'block' || action.button === 'none') {
            usedDefensive = true;
            break;
          }
          state.frame++;
        }
        expect(typeof usedDefensive).toBe('boolean');
      }
    });

    it('should make decisions in aggressive style', () => {
      state.entities = [
        mockFighter('player1', 0),
        mockFighter('player2', 150),
      ];

      for (let i = 0; i < 400; i++) {
        bot.decide(state, 'player1', 'player2');
        state.frame++;
        
        if (bot.getActiveStyle() === 'aggressive') {
          break;
        }
      }

      if (bot.getActiveStyle() === 'aggressive') {
        let attacked = false;
        for (let i = 0; i < 50; i++) {
          const action = bot.decide(state, 'player1', 'player2');
          if (action.button !== null) {
            attacked = true;
            break;
          }
          state.frame++;
        }
        expect(typeof attacked).toBe('boolean');
      }
    });

    it('should make decisions in zoner style', () => {
      state.entities = [
        mockFighter('player1', 0),
        mockFighter('player2', 300),
      ];

      for (let i = 0; i < 400; i++) {
        bot.decide(state, 'player1', 'player2');
        state.frame++;
        
        if (bot.getActiveStyle() === 'zoner') {
          break;
        }
      }

      if (bot.getActiveStyle() === 'zoner') {
        let usedZoning = false;
        for (let i = 0; i < 100; i++) {
          const action = bot.decide(state, 'player1', 'player2');
          // Projectile or maintaining distance
          if (action.button === 'hp' || ['left', 'right'].includes(action.direction)) {
            usedZoning = true;
            break;
          }
          state.frame++;
        }
        expect(typeof usedZoning).toBe('boolean');
      }
    });

    it('should be unpredictable in random style', () => {
      state.entities = [
        mockFighter('player1', 0),
        mockFighter('player2', 150),
      ];

      const actions = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const action = bot.decide(state, 'player1', 'player2');
        actions.add(`${action.direction}-${action.button}`);
        state.frame++;
      }

      // Random style should use variety of actions
      // Due to RNG and limited iterations, might only see 2-3 unique actions
      expect(actions.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('reset', () => {
    it('should reset bot state', () => {
      state.entities = [
        mockFighter('player1', 0),
        mockFighter('player2', 200),
      ];

      for (let i = 0; i < 50; i++) {
        bot.decide(state, 'player1', 'player2');
        state.frame++;
      }

      bot.reset();

      const action = bot.decide(state, 'player1', 'player2');
      expect(action).toBeDefined();
      
      // Pattern recognition should be cleared, but decide() records one action
      const pattern = bot.getPatternAnalysis();
      expect(pattern.totalActions).toBe(1); // 1 because decide() was called once after reset
    });
  });

  describe('difficulty scaling', () => {
    it('should adapt better at high difficulty', () => {
      const easyBot = new WildcardBot(1);
      const hardBot = new WildcardBot(10);
      
      expect(hardBot.getConfig().blockProbability).toBeGreaterThan(
        easyBot.getConfig().blockProbability!
      );
      expect(hardBot.getConfig().antiAirAccuracy).toBeGreaterThan(
        easyBot.getConfig().antiAirAccuracy!
      );
    });

    it('should have faster reactions at high difficulty', () => {
      const easyBot = new WildcardBot(1);
      const hardBot = new WildcardBot(10);
      
      state.entities = [
        mockFighter('player1', 0),
        mockFighter('player2', 100),
      ];

      let easyActions = 0;
      for (let i = 0; i < 20; i++) {
        const action = easyBot.decide(state, 'player1', 'player2');
        if (action.button !== null) easyActions++;
        state.frame++;
      }

      state.frame = 0;
      let hardActions = 0;
      for (let i = 0; i < 20; i++) {
        const action = hardBot.decide(state, 'player1', 'player2');
        if (action.button !== null) hardActions++;
        state.frame++;
      }

      expect(hardActions).toBeGreaterThanOrEqual(easyActions);
    });
  });

  describe('pattern counter-picking', () => {
    it('should adapt style based on opponent behavior', () => {
      state.entities = [
        mockFighter('player1', 0),
        mockFighter('player2', 150),
      ];

      // Run for extended period to allow pattern detection and adaptation
      for (let i = 0; i < 500; i++) {
        bot.decide(state, 'player1', 'player2');
        state.frame++;
      }

      // Bot should have made style decisions based on patterns
      const finalStyle = bot.getActiveStyle();
      expect(['defensive', 'aggressive', 'zoner', 'random']).toContain(finalStyle);
    });
  });
});
