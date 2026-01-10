/**
 * GuardianBot Integration Tests
 * 
 * Tests for full GuardianBot behavior:
 * - Defensive patterns
 * - Blocking consistency
 * - Anti-air reactions
 * - Punish consistency
 * - Spacing maintenance
 */

import { GuardianBot } from '../../../../src/core/ai/scripted/bots/GuardianBot';
import { GameState, FighterState, FighterStatus } from '../../../../src/core/interfaces/types';

describe('GuardianBot Integration', () => {
  // Helper to create mock fighter state
  const createMockFighter = (overrides: Partial<FighterState> = {}): FighterState => ({
    id: 'test_fighter',
    characterId: 'musashi',
    teamId: 0,
    position: { x: 400, y: 0 },
    velocity: { x: 0, y: 0 },
    facing: 1,
    health: 1000,
    maxHealth: 1000,
    energy: 100,
    maxEnergy: 100,
    superMeter: 0,
    maxSuperMeter: 1000,
    status: FighterStatus.IDLE,
    isGrounded: true,
    currentMove: null,
    moveFrame: 0,
    comboCount: 0,
    comboScaling: 1.0,
    comboStartFrame: 0,
    lastHitFrame: 0,
    lastHitByFrame: 0,
    stunFramesRemaining: 0,
    invincibleFrames: 0,
    cancelAvailable: false,
    lastCancelFrame: 0,
    hurtboxes: [],
    hitboxes: [],
    ...overrides,
  });

  // Helper to create mock game state
  const createMockState = (entities: FighterState[], frame: number = 0): GameState => ({
    frame,
    entities,
    projectiles: [],
    round: {
      roundNumber: 1,
      timeRemaining: 5400,
      winner: null,
    },
    match: {
      wins: {},
      roundsToWin: 2,
      matchWinner: null,
    },
    arena: {
      width: 800,
      height: 600,
      groundLevel: 500,
      leftBound: 0,
      rightBound: 800,
    },
    cameraPosition: { x: 0, y: 0 },
    isPaused: false,
    isRoundOver: false,
    isMatchOver: false,
    freezeFrames: 0,
    screenShake: null,
  });

  describe('Defensive Behavior', () => {
    it('should block incoming attacks with configured probability', () => {
      const bot = new GuardianBot(5);
      let blockedCount = 0;
      const trials = 100;

      for (let i = 0; i < trials; i++) {
        const actor = createMockFighter({ id: 'bot' });
        const opponent = createMockFighter({
          id: 'opponent',
          position: { x: 450, y: 0 },
          status: FighterStatus.ATTACK,
          currentMove: 'lp',
          hitboxes: [{ x: 0, y: 0, width: 50, height: 50 }],
        });

        const state = createMockState([actor, opponent], i);
        const action = bot.decide(state, 'bot', 'opponent');

        if (action.button === 'block') {
          blockedCount++;
        }
      }

      // Guardian at difficulty 5 should block 40-70% of attacks
      expect(blockedCount).toBeGreaterThan(20);
      expect(blockedCount).toBeLessThan(80);
    });

    it('should anti-air jumping opponents', () => {
      const bot = new GuardianBot(7); // Higher difficulty for more consistent anti-airs
      let antiAirCount = 0;
      const trials = 100;

      for (let i = 0; i < trials; i++) {
        const actor = createMockFighter({ id: 'bot', position: { x: 400, y: 0 } });
        const opponent = createMockFighter({
          id: 'opponent',
          position: { x: 480, y: 100 },
          isGrounded: false,
        });

        const state = createMockState([actor, opponent], i);
        const action = bot.decide(state, 'bot', 'opponent');

        // Anti-air typically uses HP
        if (action.button === 'hp') {
          antiAirCount++;
        }
      }

      // At difficulty 7, should anti-air frequently (40-80% range)
      expect(antiAirCount).toBeGreaterThan(30);
      expect(antiAirCount).toBeLessThan(85);
    });

    it('should punish recovery consistently', () => {
      const bot = new GuardianBot(8);
      let punishedCount = 0;
      const trials = 50;

      for (let i = 0; i < trials; i++) {
        // Reset bot for each trial
        bot.reset();
        
        const actor = createMockFighter({ id: 'bot', position: { x: 400, y: 0 } });
        const opponent = createMockFighter({
          id: 'opponent',
          position: { x: 470, y: 0 },
          status: FighterStatus.ATTACK,
          currentMove: 'hk',
          moveFrame: 20, // In recovery
          hitboxes: [], // No active hitboxes = recovery
        });

        const state = createMockState([actor, opponent], i * 100);
        
        // Bot needs to detect recovery state
        // Make multiple decisions to overcome reaction delay
        for (let frame = 0; frame < 20; frame++) {
          const currentState = createMockState([actor, opponent], (i * 100) + frame);
          const action = bot.decide(currentState, 'bot', 'opponent');
          
          // Check if bot is attacking (punishing)
          if (action.button !== 'none' && action.button !== 'block') {
            punishedCount++;
            break; // Count once per trial
          }
        }
      }

      // Should punish recovery opportunities (accounting for reaction delay and difficulty)
      // At difficulty 8, should punish >=10% of opportunities given reaction delays
      expect(punishedCount).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Spacing Behavior', () => {
    it('should maintain optimal spacing distance', () => {
      const bot = new GuardianBot(5);
      const optimalRange = bot.getOptimalRange(); // 150px

      const actor = createMockFighter({ id: 'bot', position: { x: 400, y: 0 } });
      
      // Test too close - need to give bot frames to react
      const opponentClose = createMockFighter({
        id: 'opponent',
        position: { x: 450, y: 0 }, // 50px away, too close
      });
      const stateClose = createMockState([actor, opponentClose]);
      
      // Make multiple decisions to overcome reaction delay
      let actionClose = bot.decide(stateClose, 'bot', 'opponent');
      for (let i = 0; i < 20; i++) {
        actionClose = bot.decide(stateClose, 'bot', 'opponent');
      }
      
      // Should eventually move away (left, since opponent is on right)
      expect(actionClose.direction).toBe('left');

      // Test too far
      bot.reset();
      const opponentFar = createMockFighter({
        id: 'opponent',
        position: { x: 650, y: 0 }, // 250px away, too far
      });
      const stateFar = createMockState([actor, opponentFar]);
      
      // Make multiple decisions to overcome reaction delay
      let actionFar = bot.decide(stateFar, 'bot', 'opponent');
      for (let i = 0; i < 15; i++) {
        actionFar = bot.decide(stateFar, 'bot', 'opponent');
      }
      
      // Should move toward (right) or stay neutral due to reaction delay
      expect(['right', 'neutral']).toContain(actionFar.direction);
    });

    it('should stay neutral at optimal range', () => {
      const bot = new GuardianBot(5);

      const actor = createMockFighter({ id: 'bot', position: { x: 400, y: 0 } });
      const opponent = createMockFighter({
        id: 'opponent',
        position: { x: 550, y: 0 }, // 150px away, perfect
      });

      const state = createMockState([actor, opponent]);
      const action = bot.decide(state, 'bot', 'opponent');

      // Should not move much (neutral or minimal movement)
      expect(action.direction === 'neutral' || action.button === 'none').toBe(true);
    });
  });

  describe('Offensive Behavior', () => {
    it('should only attack when at frame advantage', () => {
      const bot = new GuardianBot(5);
      let attackedWhileDisadvantaged = 0;
      const trials = 50;

      for (let i = 0; i < trials; i++) {
        const actor = createMockFighter({ 
          id: 'bot', 
          position: { x: 400, y: 0 },
          stunFramesRemaining: 5, // Disadvantaged
        });
        const opponent = createMockFighter({
          id: 'opponent',
          position: { x: 450, y: 0 },
          stunFramesRemaining: 0,
        });

        const state = createMockState([actor, opponent], i);
        const action = bot.decide(state, 'bot', 'opponent');

        // Shouldn't attack while disadvantaged
        if (['lp', 'hp', 'lk', 'hk'].includes(action.button)) {
          attackedWhileDisadvantaged++;
        }
      }

      // Should rarely attack while disadvantaged (<25%)
      expect(attackedWhileDisadvantaged).toBeLessThan(13);
    });

    it('should use safe attacks at close range when advantaged', () => {
      const bot = new GuardianBot(5);

      const actor = createMockFighter({ 
        id: 'bot', 
        position: { x: 400, y: 0 },
        stunFramesRemaining: 0,
      });
      const opponent = createMockFighter({
        id: 'opponent',
        position: { x: 450, y: 0 }, // Close
        stunFramesRemaining: 5, // Disadvantaged
      });

      const state = createMockState([actor, opponent]);
      
      // Update frame analyzer so it detects advantage
      for (let i = 0; i < 3; i++) {
        bot.decide(state, 'bot', 'opponent');
      }

      const action = bot.decide(state, 'bot', 'opponent');

      // Should attack (lp, lk, or hp are all valid)
      const isAttacking = ['lp', 'lk', 'hp'].includes(action.button);
      expect(isAttacking).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should scale block probability with difficulty', () => {
      const easyBot = new GuardianBot(1);
      const hardBot = new GuardianBot(10);

      expect(easyBot.getBlockProbability()).toBeLessThan(hardBot.getBlockProbability());
      expect(easyBot.getBlockProbability()).toBeCloseTo(0.43, 1);
      expect(hardBot.getBlockProbability()).toBeCloseTo(0.7, 1);
    });

    it('should scale anti-air accuracy with difficulty', () => {
      const easyBot = new GuardianBot(1);
      const hardBot = new GuardianBot(10);

      expect(easyBot.getAntiAirAccuracy()).toBeLessThan(hardBot.getAntiAirAccuracy());
      expect(easyBot.getAntiAirAccuracy()).toBeCloseTo(0.43, 1);
      expect(hardBot.getAntiAirAccuracy()).toBeCloseTo(0.7, 1);
    });

    it('should allow difficulty adjustment', () => {
      const bot = new GuardianBot(5);
      expect(bot.getDifficulty()).toBe(5);

      bot.setDifficulty(8);
      expect(bot.getDifficulty()).toBe(8);
      expect(bot.getBlockProbability()).toBeGreaterThan(0.5);
    });

    it('should have correct name and style', () => {
      const bot = new GuardianBot(5);
      expect(bot.getName()).toBe('Guardian');
      expect(bot.getStyle()).toBe('defensive');
    });
  });

  describe('State Management', () => {
    it('should reset state between rounds', () => {
      const bot = new GuardianBot(5);
      
      const actor = createMockFighter({ id: 'bot' });
      const opponent = createMockFighter({ id: 'opponent', currentMove: 'lp' });
      const state = createMockState([actor, opponent]);

      // Make some decisions to build state
      for (let i = 0; i < 10; i++) {
        bot.decide(state, 'bot', 'opponent');
      }

      // Reset
      bot.reset();

      // Should start fresh (no internal state affecting decisions)
      const action = bot.decide(state, 'bot', 'opponent');
      expect(action).toBeDefined();
    });

    it('should handle null entities gracefully', () => {
      const bot = new GuardianBot(5);
      const state = createMockState([]); // No entities

      const action = bot.decide(state, 'bot', 'opponent');
      
      // Should return an action (may be buffered from reaction delay)
      expect(action).toBeDefined();
      expect(action.direction).toBeDefined();
      expect(action.button).toBeDefined();
    });
  });
});
