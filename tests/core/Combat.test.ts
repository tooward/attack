/**
 * Unit tests for Combat system
 */

import {
  rectsOverlap,
  checkHit,
  calculateDamage,
  resolveHit,
  updateHurtboxes,
} from '../../src/core/systems/Combat';
import {
  FighterState,
  FighterStatus,
  Rect,
  MoveDefinition,
  InputAction,
} from '../../src/core/interfaces/types';

describe('Combat System', () => {
  const mockFighter: FighterState = {
    id: 'test',
    characterId: 'musashi',
    teamId: 0,
    position: { x: 500, y: 400 },
    velocity: { x: 0, y: 0 },
    facing: 1,
    health: 100,
    maxHealth: 100,
    energy: 100,
    maxEnergy: 100,
    superMeter: 0,
    maxSuperMeter: 300,
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
    hurtboxes: [{ x: 0, y: 0, width: 60, height: 80 }],
    hitboxes: [],
  };

  const mockMove: MoveDefinition = {
    id: 'light_punch',
    name: 'Light Punch',
    input: [InputAction.LIGHT_PUNCH],
    frameData: { startup: 4, active: 3, recovery: 6, totalFrames: 13 },
    damage: 10,
    chipDamage: 2,
    hitstun: 12,
    blockstun: 8,
    knockback: { x: 2, y: 0 },
    hitboxFrames: new Map(),
    energyCost: 0,
    superMeterGain: 10,
    superMeterCost: 0,
    cancellableInto: [],
    cancellableOnHit: false,
    cancellableOnBlock: false,
    requiresGrounded: true,
    requiresAirborne: false,
  };

  describe('rectsOverlap', () => {
    it('should detect overlap when rectangles intersect', () => {
      const rect1: Rect = { x: 40, y: 0, width: 30, height: 40 };
      const pos1 = { x: 500, y: 400 };
      const rect2: Rect = { x: 0, y: 0, width: 60, height: 80 };
      const pos2 = { x: 550, y: 400 };

      const result = rectsOverlap(rect1, pos1, 1, rect2, pos2, 1);

      expect(result).toBe(true);
    });

    it('should not detect overlap when rectangles are separate', () => {
      const rect1: Rect = { x: 40, y: 0, width: 30, height: 40 };
      const pos1 = { x: 300, y: 400 };
      const rect2: Rect = { x: 0, y: 0, width: 60, height: 80 };
      const pos2 = { x: 700, y: 400 };

      const result = rectsOverlap(rect1, pos1, 1, rect2, pos2, 1);

      expect(result).toBe(false);
    });

    it('should handle flipped rectangles (facing left)', () => {
      const rect1: Rect = { x: 40, y: 0, width: 30, height: 40 };
      const pos1 = { x: 600, y: 400 };
      const rect2: Rect = { x: 0, y: 0, width: 60, height: 80 };
      const pos2 = { x: 550, y: 400 };

      // rect1 facing left, so hitbox extends to the left
      const result = rectsOverlap(rect1, pos1, -1, rect2, pos2, 1);

      expect(result).toBe(true);
    });
  });

  describe('checkHit', () => {
    it('should detect hit when hitbox overlaps hurtbox', () => {
      const attacker: FighterState = {
        ...mockFighter,
        id: 'attacker',
        position: { x: 500, y: 400 },
        hitboxes: [{ x: 40, y: 0, width: 30, height: 40 }],
        hurtboxes: [],
      };

      const defender: FighterState = {
        ...mockFighter,
        id: 'defender',
        teamId: 1,
        position: { x: 550, y: 400 },
        hurtboxes: [{ x: 0, y: 0, width: 60, height: 80 }],
        hitboxes: [],
      };

      const result = checkHit(attacker, defender);

      expect(result).not.toBeNull();
      expect(result?.attackerId).toBe('attacker');
      expect(result?.defenderId).toBe('defender');
    });

    it('should not detect hit when out of range', () => {
      const attacker: FighterState = {
        ...mockFighter,
        id: 'attacker',
        position: { x: 300, y: 400 },
        hitboxes: [{ x: 40, y: 0, width: 30, height: 40 }],
      };

      const defender: FighterState = {
        ...mockFighter,
        id: 'defender',
        teamId: 1,
        position: { x: 700, y: 400 },
        hurtboxes: [{ x: 0, y: 0, width: 60, height: 80 }],
      };

      const result = checkHit(attacker, defender);

      expect(result).toBeNull();
    });

    it('should not detect hit on teammates', () => {
      const attacker: FighterState = {
        ...mockFighter,
        id: 'attacker',
        teamId: 0,
        position: { x: 500, y: 400 },
        hitboxes: [{ x: 40, y: 0, width: 30, height: 40 }],
      };

      const defender: FighterState = {
        ...mockFighter,
        id: 'defender',
        teamId: 0, // Same team
        position: { x: 550, y: 400 },
        hurtboxes: [{ x: 0, y: 0, width: 60, height: 80 }],
      };

      const result = checkHit(attacker, defender);

      expect(result).toBeNull();
    });

    it('should not detect hit on invincible fighters', () => {
      const attacker: FighterState = {
        ...mockFighter,
        id: 'attacker',
        position: { x: 500, y: 400 },
        hitboxes: [{ x: 40, y: 0, width: 30, height: 40 }],
      };

      const defender: FighterState = {
        ...mockFighter,
        id: 'defender',
        teamId: 1,
        position: { x: 550, y: 400 },
        hurtboxes: [{ x: 0, y: 0, width: 60, height: 80 }],
        invincibleFrames: 5,
      };

      const result = checkHit(attacker, defender);

      expect(result).toBeNull();
    });

    it('should detect blocked hit', () => {
      const attacker: FighterState = {
        ...mockFighter,
        id: 'attacker',
        position: { x: 500, y: 400 },
        hitboxes: [{ x: 40, y: 0, width: 30, height: 40 }],
      };

      const defender: FighterState = {
        ...mockFighter,
        id: 'defender',
        teamId: 1,
        status: FighterStatus.BLOCK,
        position: { x: 550, y: 400 },
        hurtboxes: [{ x: 0, y: 0, width: 60, height: 80 }],
      };

      const result = checkHit(attacker, defender);

      expect(result).not.toBeNull();
      expect(result?.wasBlocked).toBe(true);
    });
  });

  describe('calculateDamage', () => {
    it('should return base damage with 1.0 scaling', () => {
      const damage = calculateDamage(10, 1.0);

      expect(damage).toBe(10);
    });

    it('should scale damage with combo scaling', () => {
      const damage1 = calculateDamage(10, 0.9); // First hit scaling
      const damage2 = calculateDamage(10, 0.8); // Second hit scaling
      const damage3 = calculateDamage(10, 0.7); // Third hit scaling

      expect(damage1).toBe(9);
      expect(damage2).toBe(8);
      expect(damage3).toBe(7);
    });

    it('should apply minimum scaling floor', () => {
      const damage = calculateDamage(10, 0.3); // Minimum scaling

      expect(damage).toBe(3); // 10 * 0.3
    });
  });

  describe('resolveHit', () => {
    it('should apply damage and hitstun on clean hit', () => {
      const attacker: FighterState = {
        ...mockFighter,
        id: 'attacker',
        comboCount: 0,
        superMeter: 0,
      };

      const defender: FighterState = {
        ...mockFighter,
        id: 'defender',
        health: 100,
      };

      const [newAttacker, newDefender] = resolveHit(attacker, defender, mockMove, 0);

      expect(newDefender.health).toBe(90); // 100 - 10
      expect(newDefender.status).toBe(FighterStatus.HITSTUN);
      expect(newDefender.stunFramesRemaining).toBe(12);
      expect(newAttacker.comboCount).toBe(1);
      expect(newAttacker.superMeter).toBe(10);
    });

    it('should apply chip damage and blockstun on blocked hit', () => {
      const attacker: FighterState = {
        ...mockFighter,
        id: 'attacker',
        superMeter: 0,
      };

      const defender: FighterState = {
        ...mockFighter,
        id: 'defender',
        health: 100,
        status: FighterStatus.BLOCK,
      };

      const [newAttacker, newDefender] = resolveHit(attacker, defender, mockMove, 0);

      expect(newDefender.health).toBe(98); // 100 - 2 chip
      expect(newDefender.status).toBe(FighterStatus.BLOCKSTUN);
      expect(newDefender.stunFramesRemaining).toBe(8);
      expect(newAttacker.superMeter).toBe(5); // Half meter on block
    });

    it('should not reduce health below zero', () => {
      const attacker: FighterState = {
        ...mockFighter,
        id: 'attacker',
      };

      const defender: FighterState = {
        ...mockFighter,
        id: 'defender',
        health: 5,
      };

      const [, newDefender] = resolveHit(attacker, defender, mockMove, 0);

      expect(newDefender.health).toBe(0);
    });

    it('should apply knockback on hit', () => {
      const attacker: FighterState = {
        ...mockFighter,
        id: 'attacker',
        facing: 1,
      };

      const defender: FighterState = {
        ...mockFighter,
        id: 'defender',
      };

      const [, newDefender] = resolveHit(attacker, defender, mockMove, 0);

      expect(newDefender.velocity.x).toBe(2); // knockback.x * facing
    });

    it('should flip knockback based on attacker facing', () => {
      const attacker: FighterState = {
        ...mockFighter,
        id: 'attacker',
        facing: -1,
      };

      const defender: FighterState = {
        ...mockFighter,
        id: 'defender',
      };

      const [, newDefender] = resolveHit(attacker, defender, mockMove, 0);

      expect(newDefender.velocity.x).toBe(-2); // knockback.x * facing (-1)
    });
  });

  describe('updateHurtboxes', () => {
    const standingBox: Rect = { x: 0, y: 0, width: 60, height: 80 };
    const crouchingBox: Rect = { x: 0, y: 20, width: 60, height: 60 };
    const airborneBox: Rect = { x: -10, y: -10, width: 80, height: 100 };

    it('should use standing hurtbox when idle', () => {
      const fighter = { ...mockFighter, status: FighterStatus.IDLE, isGrounded: true };
      const result = updateHurtboxes(fighter, standingBox, crouchingBox, airborneBox);

      expect(result.hurtboxes).toHaveLength(1);
      expect(result.hurtboxes[0]).toEqual(standingBox);
    });

    it('should use crouching hurtbox when crouching', () => {
      const fighter = { ...mockFighter, status: FighterStatus.CROUCH, isGrounded: true };
      const result = updateHurtboxes(fighter, standingBox, crouchingBox, airborneBox);

      expect(result.hurtboxes).toHaveLength(1);
      expect(result.hurtboxes[0]).toEqual(crouchingBox);
    });

    it('should use airborne hurtbox when not grounded', () => {
      const fighter = { ...mockFighter, isGrounded: false };
      const result = updateHurtboxes(fighter, standingBox, crouchingBox, airborneBox);

      expect(result.hurtboxes).toHaveLength(1);
      expect(result.hurtboxes[0]).toEqual(airborneBox);
    });
  });
});
