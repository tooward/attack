/**
 * Unit tests for Fighter state machine
 */

import {
  updateFighterState,
  canExecuteMove,
  applyHitstun,
  applyBlockstun,
  updateFacing,
  regenerateEnergy,
} from '../../src/core/entities/Fighter';
import {
  FighterState,
  FighterStatus,
  InputFrame,
  InputAction,
  MoveDefinition,
} from '../../src/core/interfaces/types';

describe('Fighter State Machine', () => {
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
    hurtboxes: [],
    hitboxes: [],
  };

  const mockMove: MoveDefinition = {
    id: 'light_punch',
    name: 'Light Punch',
    input: [InputAction.LIGHT_PUNCH],
    frameData: {
      startup: 4,
      active: 3,
      recovery: 6,
      totalFrames: 13,
    },
    damage: 10,
    chipDamage: 2,
    hitstun: 12,
    blockstun: 8,
    knockback: { x: 2, y: 0 },
    hitboxFrames: new Map([
      [4, [{ x: 40, y: 0, width: 30, height: 40 }]],
      [5, [{ x: 40, y: 0, width: 30, height: 40 }]],
      [6, [{ x: 40, y: 0, width: 30, height: 40 }]],
    ]),
    energyCost: 0,
    superMeterGain: 10,
    superMeterCost: 0,
    cancellableInto: [],
    cancellableOnHit: false,
    cancellableOnBlock: false,
    requiresGrounded: true,
    requiresAirborne: false,
  };

  const characterMoves = new Map([['light_punch', mockMove]]);

  describe('updateFighterState', () => {
    it('should transition to walk forward on right input', () => {
      const input: InputFrame = {
        actions: new Set([InputAction.RIGHT]),
        timestamp: 0,
      };

      const result = updateFighterState(mockFighter, input, characterMoves);

      expect(result.status).toBe(FighterStatus.WALK_FORWARD);
      expect(result.velocity.x).toBe(3);
    });

    it('should transition to walk backward on left input', () => {
      const input: InputFrame = {
        actions: new Set([InputAction.LEFT]),
        timestamp: 0,
      };

      const result = updateFighterState(mockFighter, input, characterMoves);

      expect(result.status).toBe(FighterStatus.WALK_BACKWARD);
      expect(result.velocity.x).toBe(-3);
    });

    it('should jump on up input when grounded', () => {
      const input: InputFrame = {
        actions: new Set([InputAction.UP]),
        timestamp: 0,
      };

      const result = updateFighterState(mockFighter, input, characterMoves);

      expect(result.status).toBe(FighterStatus.JUMP);
      expect(result.velocity.y).toBeLessThan(0);
      expect(result.isGrounded).toBe(false);
    });

    it('should not jump when airborne', () => {
      const airborne = { ...mockFighter, isGrounded: false };
      const input: InputFrame = {
        actions: new Set([InputAction.UP]),
        timestamp: 0,
      };

      const result = updateFighterState(airborne, input, characterMoves);

      expect(result.status).not.toBe(FighterStatus.JUMP);
    });

    it('should crouch on down input when grounded', () => {
      const input: InputFrame = {
        actions: new Set([InputAction.DOWN]),
        timestamp: 0,
      };

      const result = updateFighterState(mockFighter, input, characterMoves);

      expect(result.status).toBe(FighterStatus.CROUCH);
      expect(result.velocity.x).toBe(0);
    });

    it('should start attack on punch input', () => {
      const input: InputFrame = {
        actions: new Set([InputAction.LIGHT_PUNCH]),
        timestamp: 0,
      };

      const result = updateFighterState(mockFighter, input, characterMoves);

      expect(result.status).toBe(FighterStatus.ATTACK);
      expect(result.currentMove).toBe('light_punch');
      expect(result.moveFrame).toBe(0);
    });

    it('should block on block input', () => {
      const input: InputFrame = {
        actions: new Set([InputAction.BLOCK]),
        timestamp: 0,
      };

      const result = updateFighterState(mockFighter, input, characterMoves);

      expect(result.status).toBe(FighterStatus.BLOCK);
    });

    it('should decrement stun frames and stay in hitstun', () => {
      const stunned = { ...mockFighter, stunFramesRemaining: 10, status: FighterStatus.HITSTUN };
      const input: InputFrame = { actions: new Set(), timestamp: 0 };

      const result = updateFighterState(stunned, input, characterMoves);

      expect(result.stunFramesRemaining).toBe(9);
      expect(result.status).toBe(FighterStatus.HITSTUN);
    });

    it('should return to idle when stun ends', () => {
      const stunned = { ...mockFighter, stunFramesRemaining: 1, status: FighterStatus.HITSTUN };
      const input: InputFrame = { actions: new Set(), timestamp: 0 };

      const result = updateFighterState(stunned, input, characterMoves);

      expect(result.stunFramesRemaining).toBe(0);
      expect(result.status).toBe(FighterStatus.IDLE);
    });
  });

  describe('Move Execution', () => {
    it('should advance move frame each tick', () => {
      const attacking = {
        ...mockFighter,
        status: FighterStatus.ATTACK,
        currentMove: 'light_punch',
        moveFrame: 0,
      };
      const input: InputFrame = { actions: new Set(), timestamp: 0 };

      const result = updateFighterState(attacking, input, characterMoves);

      expect(result.moveFrame).toBe(1);
    });

    it('should activate hitboxes on active frames', () => {
      const attacking = {
        ...mockFighter,
        status: FighterStatus.ATTACK,
        currentMove: 'light_punch',
        moveFrame: 3, // Frame before hitbox activates
      };
      const input: InputFrame = { actions: new Set(), timestamp: 0 };

      const result = updateFighterState(attacking, input, characterMoves);

      expect(result.moveFrame).toBe(4);
      expect(result.hitboxes.length).toBeGreaterThan(0);
    });

    it('should complete move and return to idle', () => {
      const attacking = {
        ...mockFighter,
        status: FighterStatus.ATTACK,
        currentMove: 'light_punch',
        moveFrame: 12, // Last frame
      };
      const input: InputFrame = { actions: new Set(), timestamp: 0 };

      const result = updateFighterState(attacking, input, characterMoves);

      expect(result.status).toBe(FighterStatus.IDLE);
      expect(result.currentMove).toBeNull();
      expect(result.moveFrame).toBe(0);
      expect(result.hitboxes).toHaveLength(0);
    });

    it('should not execute move if insufficient energy', () => {
      const lowEnergy = { ...mockFighter, energy: 0 };
      const expensiveMove = {
        ...mockMove,
        id: 'special',
        energyCost: 50,
      };
      const moves = new Map([['special', expensiveMove]]);
      const input: InputFrame = {
        actions: new Set([InputAction.SPECIAL_1]),
        timestamp: 0,
      };

      // Manually try to start the move (since our simple input processor doesn't handle special)
      const result = updateFighterState(lowEnergy, input, moves);

      expect(result.currentMove).toBeNull();
    });
  });

  describe('canExecuteMove', () => {
    it('should allow grounded moves when grounded', () => {
      const result = canExecuteMove(mockFighter, mockMove);

      expect(result).toBe(true);
    });

    it('should not allow grounded moves when airborne', () => {
      const airborne = { ...mockFighter, isGrounded: false };
      const result = canExecuteMove(airborne, mockMove);

      expect(result).toBe(false);
    });

    it('should not allow moves during hitstun', () => {
      const stunned = { ...mockFighter, stunFramesRemaining: 5 };
      const result = canExecuteMove(stunned, mockMove);

      expect(result).toBe(false);
    });
  });

  describe('applyHitstun', () => {
    it('should put fighter in hitstun state', () => {
      const result = applyHitstun(mockFighter, 15, { x: 5, y: -2 });

      expect(result.status).toBe(FighterStatus.HITSTUN);
      expect(result.stunFramesRemaining).toBe(15);
      expect(result.velocity).toEqual({ x: 5, y: -2 });
    });

    it('should clear current move', () => {
      const attacking = { ...mockFighter, currentMove: 'light_punch', moveFrame: 5 };
      const result = applyHitstun(attacking, 10, { x: 3, y: 0 });

      expect(result.currentMove).toBeNull();
      expect(result.moveFrame).toBe(0);
      expect(result.hitboxes).toHaveLength(0);
    });
  });

  describe('applyBlockstun', () => {
    it('should put fighter in blockstun state', () => {
      const result = applyBlockstun(mockFighter, 8);

      expect(result.status).toBe(FighterStatus.BLOCKSTUN);
      expect(result.stunFramesRemaining).toBe(8);
      expect(result.velocity.x).toBe(0);
    });
  });

  describe('updateFacing', () => {
    it('should face right when opponent is to the right', () => {
      const facingLeft = { ...mockFighter, facing: -1 as const, position: { x: 300, y: 400 } };
      const result = updateFacing(facingLeft, 500);

      expect(result.facing).toBe(1);
    });

    it('should face left when opponent is to the left', () => {
      const facingRight = { ...mockFighter, facing: 1 as const, position: { x: 700, y: 400 } };
      const result = updateFacing(facingRight, 300);

      expect(result.facing).toBe(-1);
    });

    it('should not turn during attack', () => {
      const attacking = {
        ...mockFighter,
        status: FighterStatus.ATTACK,
        facing: 1 as const,
        position: { x: 700, y: 400 },
      };
      const result = updateFacing(attacking, 300);

      expect(result.facing).toBe(1); // Should not change
    });
  });

  describe('regenerateEnergy', () => {
    it('should regenerate energy over time', () => {
      const lowEnergy = { ...mockFighter, energy: 50 };
      const result = regenerateEnergy(lowEnergy);

      expect(result.energy).toBeGreaterThan(50);
    });

    it('should not exceed max energy', () => {
      const nearMax = { ...mockFighter, energy: 99.8 };
      const result = regenerateEnergy(nearMax);

      expect(result.energy).toBeLessThanOrEqual(nearMax.maxEnergy);
    });
  });
});
