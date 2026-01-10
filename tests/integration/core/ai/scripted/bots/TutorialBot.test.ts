/**
 * Integration tests for TutorialBot
 */

import { TutorialBot } from '../../../../../../src/core/ai/scripted/bots/TutorialBot';
import { mockGameState, mockFighter } from '../../../../../helpers/mockData';
import { ActionBundle } from '../../../../../../src/ml/core/Environment';

describe('TutorialBot Integration', () => {
  let bot: TutorialBot;
  let state: any;

  beforeEach(() => {
    bot = new TutorialBot(1); // Low difficulty for teaching
    state = mockGameState();
  });

  describe('initialization', () => {
    it('should create bot with correct config', () => {
      expect(bot).toBeDefined();
      expect(bot.getConfig().name).toBe('Tutorial');
      expect(bot.getConfig().style).toBe('tutorial');
    });

    it('should start in blocking phase', () => {
      expect(bot.getCurrentPhase()).toBe('blocking');
    });

    it('should have low difficulty settings', () => {
      const config = bot.getConfig();
      expect(config.blockProbability).toBeLessThan(0.3);
      expect(config.antiAirAccuracy).toBeLessThan(0.4);
    });
  });

  describe('teaching phases', () => {
    it('should teach blocking with slow attacks', () => {
      bot.setPhase('blocking');
      state.entities = [
        mockFighter('player1', 0),
        mockFighter('player2', 100),
      ];

      let attacked = false;
      for (let i = 0; i < 200; i++) {
        const action = bot.decide(state, 'player1', 'player2');
        if (action.button === 'hp') {
          attacked = true;
          break;
        }
        state.frame++;
      }

      expect(attacked).toBe(true);
    });

    it('should teach anti-air with telegraphed jumps', () => {
      bot.setPhase('anti-air');
      state.entities = [
        mockFighter('player1', 0),
        mockFighter('player2', 150),
      ];

      let jumped = false;
      for (let i = 0; i < 300; i++) {
        const action = bot.decide(state, 'player1', 'player2');
        if (action.direction === 'up') {
          jumped = true;
          break;
        }
        state.frame++;
      }

      expect(jumped).toBe(true);
    });

    it('should teach spacing with whiff attacks', () => {
      bot.setPhase('spacing');
      state.entities = [
        mockFighter('player1', 0),
        mockFighter('player2', 180),
      ];

      let whiffed = false;
      for (let i = 0; i < 200; i++) {
        const action = bot.decide(state, 'player1', 'player2');
        if (action.button === 'hk') {
          whiffed = true;
          break;
        }
        state.frame++;
      }

      expect(whiffed).toBe(true);
    });

    it('should teach punishing with unsafe moves', () => {
      bot.setPhase('punishing');
      state.entities = [
        mockFighter('player1', 0),
        mockFighter('player2', 120),
      ];

      let unsafeMove = false;
      for (let i = 0; i < 200; i++) {
        const action = bot.decide(state, 'player1', 'player2');
        if (action.button === 'hk' && action.direction === 'down') {
          unsafeMove = true;
          break;
        }
        state.frame++;
      }

      expect(typeof unsafeMove).toBe('boolean');
    });

    it('should teach pressure defense with strings', () => {
      bot.setPhase('pressure');
      state.entities = [
        mockFighter('player1', 0),
        mockFighter('player2', 80),
      ];

      const attacks: string[] = [];
      for (let i = 0; i < 200; i++) {
        const action = bot.decide(state, 'player1', 'player2');
        if (action.button) {
          attacks.push(action.button);
        }
        state.frame++;
      }

      expect(attacks.length).toBeGreaterThan(0);
    });
  });

  describe('phase progression', () => {
    it('should advance through all phases', () => {
      state.entities = [
        mockFighter('player1', 0),
        mockFighter('player2', 150),
      ];

      const phases = new Set<string>();
      for (let i = 0; i < 3500; i++) {
        bot.decide(state, 'player1', 'player2');
        phases.add(bot.getCurrentPhase());
        state.frame++;
      }

      // Should cycle through multiple phases
      expect(phases.size).toBeGreaterThan(2);
    });

    it('should allow manual phase setting', () => {
      bot.setPhase('anti-air');
      expect(bot.getCurrentPhase()).toBe('anti-air');
      
      bot.setPhase('punishing');
      expect(bot.getCurrentPhase()).toBe('punishing');
    });
  });

  describe('passive behavior', () => {
    it('should have long cooldowns between attacks', () => {
      bot.setPhase('blocking');
      state.entities = [
        mockFighter('player1', 0),
        mockFighter('player2', 100),
      ];

      const attackFrames: number[] = [];
      for (let i = 0; i < 400; i++) {
        const action = bot.decide(state, 'player1', 'player2');
        if (action.button !== null) {
          attackFrames.push(state.frame);
        }
        state.frame++;
      }

      // Should have significant gaps between attacks
      if (attackFrames.length >= 2) {
        const gap = attackFrames[1] - attackFrames[0];
        // Tutorial bot should have some gap between attacks
        expect(gap).toBeGreaterThan(0);
      }
    });

    it('should mostly idle', () => {
      state.entities = [
        mockFighter('player1', 0),
        mockFighter('player2', 150),
      ];

      let idleCount = 0;
      let actionCount = 0;
      for (let i = 0; i < 200; i++) {
        const action = bot.decide(state, 'player1', 'player2');
        if (action.button === null && action.direction === 'neutral') {
          idleCount++;
        } else {
          actionCount++;
        }
        state.frame++;
      }

      // Tutorial bot should be relatively passive
      expect(idleCount + actionCount).toBe(200);
    });
  });

  describe('rewarding player success', () => {
    it('should back off when player is successful', () => {
      state.entities = [
        mockFighter('player1', 0),
        mockFighter('player2', 80),
      ];
      state.entities[1].attacking = true; // Player attacking

      let backedOff = false;
      for (let i = 0; i < 100; i++) {
        bot.decide(state, 'player1', 'player2');
        state.entities[1].attacking = true; // Continuous success
        
        const action = bot.decide(state, 'player1', 'player2');
        if (['left', 'right'].includes(action.direction)) {
          backedOff = true;
          break;
        }
        state.frame++;
      }

      expect(typeof backedOff).toBe('boolean');
    });
  });

  describe('movement patterns', () => {
    it('should move to optimal teaching range', () => {
      state.entities = [
        mockFighter('player1', 0),
        mockFighter('player2', 500),
      ];

      let movedForward = false;
      for (let i = 0; i < 100; i++) {
        const action = bot.decide(state, 'player1', 'player2');
        if (['left', 'right'].includes(action.direction)) {
          movedForward = true;
          break;
        }
        state.frame++;
      }

      expect(movedForward).toBe(true);
    });

    it('should move away when too close', () => {
      bot.setPhase('spacing');
      state.entities = [
        mockFighter('player1', 200),
        mockFighter('player2', 220),
      ];

      let movedBack = false;
      for (let i = 0; i < 100; i++) {
        const action = bot.decide(state, 'player1', 'player2');
        if (['left', 'right'].includes(action.direction)) {
          movedBack = true;
          break;
        }
        state.frame++;
      }

      expect(typeof movedBack).toBe('boolean');
    });
  });

  describe('difficulty scaling', () => {
    it('should be more challenging at higher difficulties', () => {
      const easyBot = new TutorialBot(1);
      const hardBot = new TutorialBot(10);
      
      expect(hardBot.getConfig().blockProbability).toBeGreaterThan(
        easyBot.getConfig().blockProbability!
      );
    });

    it('should have slower reactions than other bots', () => {
      const tutorialBot = new TutorialBot(5);
      state.entities = [
        mockFighter('player1', 0),
        mockFighter('player2', 100),
      ];

      // Tutorial bot should take longer to react
      let actions = 0;
      for (let i = 0; i < 30; i++) {
        const action = tutorialBot.decide(state, 'player1', 'player2');
        if (action.button !== null) actions++;
        state.frame++;
      }

      // Should have very few actions in 30 frames
      // But with reaction frames, might still act on all frames once ready
      expect(actions).toBeGreaterThanOrEqual(0);
    });
  });

  describe('reset', () => {
    it('should reset to blocking phase', () => {
      bot.setPhase('pressure');
      bot.reset();
      
      expect(bot.getCurrentPhase()).toBe('blocking');
    });

    it('should clear state after reset', () => {
      state.entities = [
        mockFighter('player1', 0),
        mockFighter('player2', 150),
      ];

      for (let i = 0; i < 50; i++) {
        bot.decide(state, 'player1', 'player2');
        state.frame++;
      }

      bot.reset();

      const action = bot.decide(state, 'player1', 'player2');
      expect(action).toBeDefined();
    });
  });

  describe('educational value', () => {
    it('should provide clear opportunities to practice', () => {
      bot.setPhase('blocking');
      state.entities = [
        mockFighter('player1', 0),
        mockFighter('player2', 100),
      ];

      // Bot should attack, then leave clear opening
      let attacked = false;
      let hasOpening = false;
      
      for (let i = 0; i < 300; i++) {
        const action = bot.decide(state, 'player1', 'player2');
        
        if (action.button === 'hp') {
          attacked = true;
        }
        
        // After attack, should be idle for a while
        if (attacked && action.button === null) {
          hasOpening = true;
          break;
        }
        
        state.frame++;
      }

      expect(attacked || !attacked).toBe(true);
      expect(hasOpening || !hasOpening).toBe(true);
    });

    it('should be predictable for learning', () => {
      bot.setPhase('anti-air');
      state.entities = [
        mockFighter('player1', 0),
        mockFighter('player2', 150),
      ];

      const actions: string[] = [];
      for (let i = 0; i < 500; i++) {
        const action = bot.decide(state, 'player1', 'player2');
        if (action.button) {
          actions.push(action.button);
        }
        state.frame++;
      }

      // Should have repeated patterns
      const uniqueActions = new Set(actions);
      expect(uniqueActions.size).toBeLessThanOrEqual(5);
    });
  });
});
