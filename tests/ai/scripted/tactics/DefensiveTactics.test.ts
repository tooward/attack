/**
 * DefensiveTactics Unit Tests
 * 
 * Tests for defensive combat tactics:
 * - Punishing
 * - Anti-airing
 * - Blocking
 * - Spacing
 * - Counter-attacking
 */

import { DefensiveTactics } from '../../../../src/core/ai/scripted/tactics/DefensiveTactics';
import { StateReader } from '../../../../src/core/ai/scripted/utils/StateReader';
import { FrameDataAnalyzer } from '../../../../src/core/ai/scripted/systems/FrameDataAnalyzer';
import { GameState, FighterState, FighterStatus } from '../../../../src/core/interfaces/types';

describe('DefensiveTactics', () => {
  let tactics: DefensiveTactics;
  let stateReader: StateReader;
  let frameAnalyzer: FrameDataAnalyzer;

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
  const createMockState = (entities: FighterState[]): GameState => ({
    frame: 0,
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

  beforeEach(() => {
    stateReader = new StateReader();
    frameAnalyzer = new FrameDataAnalyzer();
    tactics = new DefensiveTactics(stateReader, frameAnalyzer);
  });

  describe('calculatePunish', () => {
    it('should use HP for 15+ frame recovery at close range', () => {
      const punish = tactics.calculatePunish(20, 70);
      expect(punish).not.toBeNull();
      expect(punish?.button).toBe('hp');
    });

    it('should use LK for 10-14 frame recovery at medium range', () => {
      const punish = tactics.calculatePunish(12, 90);
      expect(punish).not.toBeNull();
      expect(punish?.button).toBe('lk');
    });

    it('should use LP for 6-9 frame recovery', () => {
      const punish = tactics.calculatePunish(7, 110);
      expect(punish).not.toBeNull();
      expect(punish?.button).toBe('lp');
    });

    it('should return null if recovery is too short', () => {
      const punish = tactics.calculatePunish(4, 100);
      expect(punish).toBeNull();
    });

    it('should return null if opponent is too far', () => {
      const punish = tactics.calculatePunish(20, 200);
      expect(punish).toBeNull();
    });

    it('should choose lighter punish if barely in range', () => {
      const punish = tactics.calculatePunish(15, 79); // Just at HP range boundary
      expect(punish).not.toBeNull();
      expect(punish?.button).toBe('hp');
    });
  });

  describe('antiAir', () => {
    it('should use HP for close jumps', () => {
      const state = createMockState([]);
      const actor = createMockFighter({ id: 'actor', position: { x: 400, y: 0 } });
      const opponent = createMockFighter({ 
        id: 'opponent', 
        position: { x: 480, y: 100 }, // 80px away, airborne
        isGrounded: false 
      });

      const antiAir = tactics.antiAir(state, actor, opponent);
      expect(antiAir).not.toBeNull();
      expect(antiAir?.button).toBe('hp');
      expect(antiAir?.direction).toBe('neutral');
    });

    it('should use crouching HP for mid-range jumps', () => {
      const state = createMockState([]);
      const actor = createMockFighter({ id: 'actor', position: { x: 400, y: 0 } });
      const opponent = createMockFighter({ 
        id: 'opponent', 
        position: { x: 550, y: 100 }, // 150px away
        isGrounded: false 
      });

      const antiAir = tactics.antiAir(state, actor, opponent);
      expect(antiAir).not.toBeNull();
      expect(antiAir?.button).toBe('hp');
      expect(antiAir?.direction).toBe('down');
    });

    it('should return null if opponent is too far', () => {
      const state = createMockState([]);
      const actor = createMockFighter({ id: 'actor', position: { x: 400, y: 0 } });
      const opponent = createMockFighter({ 
        id: 'opponent', 
        position: { x: 700, y: 100 }, // 300px away
        isGrounded: false 
      });

      const antiAir = tactics.antiAir(state, actor, opponent);
      expect(antiAir).toBeNull();
    });

    it('should return null if opponent is grounded', () => {
      const state = createMockState([]);
      const actor = createMockFighter({ id: 'actor', position: { x: 400, y: 0 } });
      const opponent = createMockFighter({ 
        id: 'opponent', 
        position: { x: 480, y: 0 },
        isGrounded: true 
      });

      const antiAir = tactics.antiAir(state, actor, opponent);
      expect(antiAir).toBeNull();
    });
  });

  describe('block', () => {
    it('should block low against crouching attacks', () => {
      const opponent = createMockFighter({ currentMove: 'crouch_lp' });
      const block = tactics.block(opponent);
      
      expect(block.direction).toBe('down');
      expect(block.button).toBe('block');
    });

    it('should block low against light kicks', () => {
      const opponent = createMockFighter({ currentMove: 'lk' });
      const block = tactics.block(opponent);
      
      expect(block.direction).toBe('down');
      expect(block.button).toBe('block');
    });

    it('should block high against other attacks', () => {
      const opponent = createMockFighter({ currentMove: 'hp' });
      const block = tactics.block(opponent);
      
      expect(block.direction).toBe('neutral');
      expect(block.button).toBe('block');
    });

    it('should block high when opponent has no current move', () => {
      const opponent = createMockFighter({ currentMove: null });
      const block = tactics.block(opponent);
      
      expect(block.direction).toBe('neutral');
      expect(block.button).toBe('block');
    });
  });

  describe('safeAttack', () => {
    it('should use LP at close range', () => {
      const attack = tactics.safeAttack(60);
      expect(attack.button).toBe('lp');
    });

    it('should use LK at medium range', () => {
      const attack = tactics.safeAttack(120);
      expect(attack.button).toBe('lk');
    });

    it('should walk forward at far range', () => {
      const attack = tactics.safeAttack(300);
      expect(attack.direction).toBe('right');
      expect(attack.button).toBe('none');
    });

    it('should always return a valid action', () => {
      const attack = tactics.safeAttack(150);
      expect(attack).toBeDefined();
      expect(attack.direction).toBeDefined();
      expect(attack.button).toBeDefined();
    });
  });

  describe('maintainSpacing', () => {
    const optimalRange = 150;

    it('should back away if too close', () => {
      const state = createMockState([]);
      const actor = createMockFighter({ id: 'actor', position: { x: 400, y: 0 } });
      const opponent = createMockFighter({ id: 'opponent', position: { x: 450, y: 0 } }); // 50px away

      const action = tactics.maintainSpacing(state, actor, opponent, optimalRange);
      expect(action.direction).toBe('left'); // Away from opponent
      expect(action.button).toBe('none');
    });

    it('should move forward if too far', () => {
      const state = createMockState([]);
      const actor = createMockFighter({ id: 'actor', position: { x: 400, y: 0 } });
      const opponent = createMockFighter({ id: 'opponent', position: { x: 600, y: 0 } }); // 200px away

      const action = tactics.maintainSpacing(state, actor, opponent, optimalRange);
      expect(action.direction).toBe('right'); // Toward opponent
      expect(action.button).toBe('none');
    });

    it('should stay neutral at optimal range', () => {
      const state = createMockState([]);
      const actor = createMockFighter({ id: 'actor', position: { x: 400, y: 0 } });
      const opponent = createMockFighter({ id: 'opponent', position: { x: 550, y: 0 } }); // 150px away

      const action = tactics.maintainSpacing(state, actor, opponent, optimalRange);
      expect(action.direction).toBe('neutral');
    });

    it('should handle opponent on left side', () => {
      const state = createMockState([]);
      const actor = createMockFighter({ id: 'actor', position: { x: 500, y: 0 } });
      const opponent = createMockFighter({ id: 'opponent', position: { x: 300, y: 0 } }); // Left side, 200px

      const action = tactics.maintainSpacing(state, actor, opponent, optimalRange);
      expect(action.direction).toBe('left'); // Toward opponent on left
    });
  });

  describe('shouldBlock', () => {
    it('should block with probability when opponent is attacking', () => {
      const state = createMockState([]);
      const actor = createMockFighter({ id: 'actor' });
      const opponent = createMockFighter({ 
        id: 'opponent',
        status: FighterStatus.ATTACK,
        hitboxes: [{ x: 0, y: 0, width: 50, height: 50 }]
      });

      // Test many times to verify probability works
      let blockedCount = 0;
      const trials = 1000;
      for (let i = 0; i < trials; i++) {
        if (tactics.shouldBlock(state, actor, opponent, 0.7)) {
          blockedCount++;
        }
      }

      // Should block approximately 70% of the time (with some variance)
      expect(blockedCount).toBeGreaterThan(600);
      expect(blockedCount).toBeLessThan(800);
    });

    it('should not block when opponent is not attacking', () => {
      const state = createMockState([]);
      const actor = createMockFighter({ id: 'actor' });
      const opponent = createMockFighter({ 
        id: 'opponent',
        status: FighterStatus.IDLE,
        hitboxes: []
      });

      const shouldBlock = tactics.shouldBlock(state, actor, opponent, 0.7);
      expect(shouldBlock).toBe(false);
    });
  });

  describe('shouldAntiAir', () => {
    it('should anti-air with probability when opponent is jumping', () => {
      const opponent = createMockFighter({ isGrounded: false });

      // Test many times to verify probability
      let antiAirCount = 0;
      const trials = 1000;
      for (let i = 0; i < trials; i++) {
        if (tactics.shouldAntiAir(opponent, 0.6)) {
          antiAirCount++;
        }
      }

      // Should anti-air approximately 60% of the time
      expect(antiAirCount).toBeGreaterThan(500);
      expect(antiAirCount).toBeLessThan(700);
    });

    it('should not anti-air when opponent is grounded', () => {
      const opponent = createMockFighter({ isGrounded: true });
      const shouldAntiAir = tactics.shouldAntiAir(opponent, 0.6);
      expect(shouldAntiAir).toBe(false);
    });
  });

  describe('escapePressure', () => {
    it('should jump away when cornered', () => {
      const state = createMockState([]);
      const actor = createMockFighter({ 
        id: 'actor', 
        position: { x: 50, y: 0 } // Near left edge
      });
      const opponent = createMockFighter({ 
        id: 'opponent', 
        position: { x: 200, y: 0 } 
      });

      const action = tactics.escapePressure(state, actor, opponent);
      expect(action.direction).toBe('up'); // Jump
    });

    it('should backdash when not cornered', () => {
      const state = createMockState([]);
      const actor = createMockFighter({ 
        id: 'actor', 
        position: { x: 400, y: 0 } // Center
      });
      const opponent = createMockFighter({ 
        id: 'opponent', 
        position: { x: 300, y: 0 } 
      });

      const action = tactics.escapePressure(state, actor, opponent);
      expect(action.direction).toBe('right'); // Away from opponent
      expect(action.button).toBe('none');
    });
  });
});
