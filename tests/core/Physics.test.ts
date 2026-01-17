/**
 * Unit tests for Physics system
 */

import {
  applyGravity,
  applyFriction,
  updatePosition,
  checkGrounded,
  keepInBounds,
  resolveFighterCollision,
  stepPhysics,
} from '../../src/core/systems/Physics';
import { FighterState, FighterStatus, ArenaConfig } from '../../src/core/interfaces/types';

describe('Physics System', () => {
  const mockFighter: FighterState = {
    id: 'test',
    characterId: 'musashi',
    teamId: 0,
    position: { x: 500, y: 300 },
    velocity: { x: 0, y: 0 },
    facing: 1,
    health: 100,
    maxHealth: 100,
    energy: 100,
    maxEnergy: 100,
    superMeter: 0,
    maxSuperMeter: 300,
    status: FighterStatus.IDLE,
    isGrounded: false,
    currentMove: null,
    moveFrame: 0,
    comboCount: 0,
    comboScaling: 1.0,
    comboStartFrame: 0,
    lastHitFrame: 0,
    lastHitByFrame: 0,
    stunFramesRemaining: 0,
    invincibleFrames: 0,
    activeSpecialMove: null,
    specialMoveFrame: 0,
    invincibilityState: null,
    armorState: null,
    cancelAvailable: false,
    lastCancelFrame: 0,
    hurtboxes: [],
    hitboxes: [],
  };

  const mockArena: ArenaConfig = {
    width: 1000,
    height: 600,
    groundLevel: 400,
    leftBound: 50,
    rightBound: 950,
  };

  describe('applyGravity', () => {
    it('should not apply gravity when fighter is grounded', () => {
      const fighter = { ...mockFighter, isGrounded: true, velocity: { x: 0, y: 0 } };
      const result = applyGravity(fighter);

      expect(result.velocity.y).toBe(0);
    });

    it('should apply gravity when fighter is airborne', () => {
      const fighter = { ...mockFighter, isGrounded: false, velocity: { x: 0, y: 0 } };
      const result = applyGravity(fighter);

      expect(result.velocity.y).toBeGreaterThan(0);
    });

    it('should cap fall speed at terminal velocity', () => {
      const fighter = { ...mockFighter, isGrounded: false, velocity: { x: 0, y: 25 } };
      const result = applyGravity(fighter);

      expect(result.velocity.y).toBeLessThanOrEqual(20); // MAX_FALL_SPEED
    });
  });

  describe('applyFriction', () => {
    it('should reduce horizontal velocity when grounded', () => {
      const fighter = { ...mockFighter, isGrounded: true, velocity: { x: 10, y: 0 } };
      const result = applyFriction(fighter);

      expect(Math.abs(result.velocity.x)).toBeLessThan(Math.abs(fighter.velocity.x));
    });

    it('should not apply friction when airborne', () => {
      const fighter = { ...mockFighter, isGrounded: false, velocity: { x: 10, y: 0 } };
      const result = applyFriction(fighter);

      expect(result.velocity.x).toBe(10);
    });
  });

  describe('updatePosition', () => {
    it('should update position based on velocity', () => {
      const fighter = { ...mockFighter, position: { x: 100, y: 200 }, velocity: { x: 5, y: -10 } };
      const result = updatePosition(fighter);

      expect(result.position.x).toBe(105);
      expect(result.position.y).toBe(190);
    });
  });

  describe('checkGrounded', () => {
    it('should set isGrounded to true when touching ground', () => {
      const fighter = { ...mockFighter, position: { x: 500, y: 400 }, isGrounded: false };
      const result = checkGrounded(fighter, 400);

      expect(result.isGrounded).toBe(true);
      expect(result.velocity.y).toBe(0);
    });

    it('should snap position to ground level on landing', () => {
      const fighter = { ...mockFighter, position: { x: 500, y: 405 }, isGrounded: false };
      const result = checkGrounded(fighter, 400);

      expect(result.position.y).toBe(400);
    });

    it('should set isGrounded to false when above ground', () => {
      const fighter = { ...mockFighter, position: { x: 500, y: 300 }, isGrounded: true };
      const result = checkGrounded(fighter, 400);

      expect(result.isGrounded).toBe(false);
    });
  });

  describe('keepInBounds', () => {
    it('should clamp position to left bound', () => {
      const fighter = { ...mockFighter, position: { x: 30, y: 400 } };
      const result = keepInBounds(fighter, mockArena);

      expect(result.position.x).toBe(50);
      expect(result.velocity.x).toBe(0);
    });

    it('should clamp position to right bound', () => {
      const fighter = { ...mockFighter, position: { x: 980, y: 400 } };
      const result = keepInBounds(fighter, mockArena);

      expect(result.position.x).toBe(950);
      expect(result.velocity.x).toBe(0);
    });

    it('should not modify position if within bounds', () => {
      const fighter = { ...mockFighter, position: { x: 500, y: 400 } };
      const result = keepInBounds(fighter, mockArena);

      expect(result.position.x).toBe(500);
    });
  });

  describe('resolveFighterCollision', () => {
    it('should push fighters apart when overlapping', () => {
      const fighter1 = { ...mockFighter, position: { x: 500, y: 400 }, isGrounded: true };
      const fighter2 = { ...mockFighter, position: { x: 530, y: 400 }, isGrounded: true };

      const [result1, result2] = resolveFighterCollision(fighter1, fighter2);

      // They should be pushed apart
      expect(result2.position.x).toBeGreaterThan(result1.position.x);
      expect(result2.position.x - result1.position.x).toBeGreaterThanOrEqual(60);
    });

    it('should not push fighters if not overlapping', () => {
      const fighter1 = { ...mockFighter, position: { x: 300, y: 400 }, isGrounded: true };
      const fighter2 = { ...mockFighter, position: { x: 700, y: 400 }, isGrounded: true };

      const [result1, result2] = resolveFighterCollision(fighter1, fighter2);

      expect(result1.position.x).toBe(300);
      expect(result2.position.x).toBe(700);
    });

    it('should not push if either fighter is airborne', () => {
      const fighter1 = { ...mockFighter, position: { x: 500, y: 300 }, isGrounded: false };
      const fighter2 = { ...mockFighter, position: { x: 530, y: 400 }, isGrounded: true };

      const [result1, result2] = resolveFighterCollision(fighter1, fighter2);

      expect(result1.position.x).toBe(500);
      expect(result2.position.x).toBe(530);
    });
  });

  describe('stepPhysics', () => {
    it('should apply full physics pipeline', () => {
      const fighter = {
        ...mockFighter,
        position: { x: 500, y: 350 },
        velocity: { x: 5, y: 2 },
        isGrounded: false,
      };

      const result = stepPhysics(fighter, mockArena);

      // Position should be updated
      expect(result.position.x).not.toBe(fighter.position.x);
      expect(result.position.y).not.toBe(fighter.position.y);
      
      // Gravity should be applied
      expect(result.velocity.y).toBeGreaterThan(fighter.velocity.y);
    });

    it('should land fighter on ground', () => {
      const fighter = {
        ...mockFighter,
        position: { x: 500, y: 395 },
        velocity: { x: 0, y: 10 },
        isGrounded: false,
      };

      const result = stepPhysics(fighter, mockArena);

      expect(result.isGrounded).toBe(true);
      expect(result.position.y).toBe(400);
      expect(result.velocity.y).toBe(0);
    });
  });
});
