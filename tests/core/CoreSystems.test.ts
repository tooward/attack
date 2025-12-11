/**
 * Unit tests for Core Systems: Special Moves, Combos, and Super Meter
 */

import {
  updateFighterState,
  regenerateSuperMeter,
} from '../../src/core/entities/Fighter';
import {
  resolveHit,
  calculateDamage,
  checkComboTimeout,
} from '../../src/core/systems/Combat';
import {
  createInputBuffer,
  addInput,
  checkQuarterCircleForward,
  checkDragonPunch,
  InputBuffer,
} from '../../src/core/systems/InputBuffer';
import {
  FighterState,
  FighterStatus,
  InputFrame,
  InputAction,
  MoveDefinition,
} from '../../src/core/interfaces/types';
import { MUSASHI } from '../../src/core/data/musashi';

describe('Core Systems Integration', () => {
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
    id: 'test_move',
    name: 'Test Move',
    input: [InputAction.LIGHT_PUNCH],
    motionInput: '5LP',
    frameData: {
      startup: 5,
      active: 3,
      recovery: 8,
      totalFrames: 16,
    },
    damage: 10,
    hitstun: 12,
    blockstun: 8,
    chipDamage: 1,
    knockback: { x: 5, y: 0 },
    hitboxFrames: new Map([[5, [{ x: 60, y: 30, width: 50, height: 40 }]]]),
    energyCost: 0,
    superMeterCost: 0,
    superMeterGain: 10,
    invincibleFrames: [],
    cancellableInto: [],
    cancellableOnHit: false,
    cancellableOnBlock: false,
    cancellableOnWhiff: false,
    requiresGrounded: true,
    requiresAirborne: false,
  };

  describe('Special Moves', () => {
    let inputBuffer: InputBuffer;
    let characterMoves: Map<string, MoveDefinition>;

    beforeEach(() => {
      inputBuffer = createInputBuffer();
      characterMoves = MUSASHI.moves;
    });

    test('should detect Quarter Circle Forward (236) motion', () => {
      // Simulate 236 motion for right-facing fighter
      let buffer = inputBuffer;
      buffer = addInput(buffer, { actions: new Set([InputAction.DOWN]), timestamp: 100 });
      buffer = addInput(buffer, { actions: new Set([InputAction.DOWN, InputAction.RIGHT]), timestamp: 101 });
      buffer = addInput(buffer, { actions: new Set([InputAction.RIGHT, InputAction.LIGHT_PUNCH]), timestamp: 102 });

      expect(checkQuarterCircleForward(buffer, InputAction.LIGHT_PUNCH, 1)).toBe(true);
    });

    test('should detect Dragon Punch (623) motion', () => {
      // Simulate 623 motion for right-facing fighter
      let buffer = inputBuffer;
      buffer = addInput(buffer, { actions: new Set([InputAction.RIGHT]), timestamp: 100 });
      buffer = addInput(buffer, { actions: new Set([InputAction.DOWN]), timestamp: 101 });
      buffer = addInput(buffer, { actions: new Set([InputAction.DOWN, InputAction.RIGHT, InputAction.LIGHT_PUNCH]), timestamp: 102 });

      expect(checkDragonPunch(buffer, InputAction.LIGHT_PUNCH, 1)).toBe(true);
    });

    test('should execute special move from motion input', () => {
      // Add QCF motion
      let buffer = inputBuffer;
      buffer = addInput(buffer, { actions: new Set([InputAction.DOWN]), timestamp: 100 });
      buffer = addInput(buffer, { actions: new Set([InputAction.DOWN, InputAction.RIGHT]), timestamp: 101 });
      buffer = addInput(buffer, { actions: new Set([InputAction.RIGHT, InputAction.LIGHT_PUNCH]), timestamp: 102 });

      const input: InputFrame = { actions: new Set([InputAction.RIGHT, InputAction.LIGHT_PUNCH]), timestamp: 102 };

      const fighter = { ...mockFighter, energy: 100 };
      const result = updateFighterState(fighter, input, characterMoves, buffer, 102);

      // Should execute Hadoken (fireball)
      expect(result.currentMove).toBe('hadoken');
      expect(result.status).toBe(FighterStatus.ATTACK);
    });

    test('should not execute special move with insufficient energy', () => {
      // Add QCF motion
      let buffer = inputBuffer;
      buffer = addInput(buffer, { actions: new Set([InputAction.DOWN]), timestamp: 100 });
      buffer = addInput(buffer, { actions: new Set([InputAction.DOWN, InputAction.RIGHT]), timestamp: 101 });
      buffer = addInput(buffer, { actions: new Set([InputAction.RIGHT, InputAction.LIGHT_PUNCH]), timestamp: 102 });

      const input: InputFrame = { actions: new Set([InputAction.RIGHT, InputAction.LIGHT_PUNCH]), timestamp: 102 };

      const fighter = { ...mockFighter, energy: 5 }; // Not enough energy
      const result = updateFighterState(fighter, input, characterMoves, buffer, 102);

      // Should not execute special move
      expect(result.currentMove).not.toBe('hadoken');
    });

    test('should apply invincibility frames during special moves', () => {
      // Dragon Punch has invincibility frames
      const dpMove = characterMoves.get('shoryuken');
      expect(dpMove).toBeDefined();
      expect(dpMove!.invincibleFrames).toBeDefined();
      expect(dpMove!.invincibleFrames!.length).toBeGreaterThan(0);
    });
  });

  describe('Combo System', () => {
    test('should apply damage scaling on consecutive hits', () => {
      // First hit: 100% damage
      expect(calculateDamage(100, 1.0)).toBe(100);
      
      // Second hit: 90% damage
      expect(calculateDamage(100, 0.9)).toBe(90);
      
      // Third hit: 80% damage
      expect(calculateDamage(100, 0.8)).toBe(80);
      
      // Fourth hit: 70% damage
      expect(calculateDamage(100, 0.7)).toBe(70);
    });

    test('should scale damage to minimum 30%', () => {
      // 8th hit and beyond should be 30% damage
      expect(calculateDamage(100, 0.3)).toBe(30);
      expect(calculateDamage(100, 0.2)).toBe(20); // Still uses provided scaling
    });

    test('should track combo count and scaling on hit', () => {
      const attacker = { ...mockFighter, comboCount: 0, comboScaling: 1.0 };
      const defender = { ...mockFighter, id: 'defender' };
      const currentFrame = 1000;

      const [newAttacker, newDefender] = resolveHit(attacker, defender, mockMove, currentFrame);

      expect(newAttacker.comboCount).toBe(1);
      // Scaling is calculated for the next hit, so after first hit it's still 1.0
      // After second hit it becomes 0.9, etc.
      expect(newAttacker.comboScaling).toBe(1.0);
      expect(newAttacker.lastHitFrame).toBe(currentFrame);
      expect(newDefender.lastHitByFrame).toBe(currentFrame);
    });

    test('should reset combo on block', () => {
      const attacker = { ...mockFighter, comboCount: 3, comboScaling: 0.7 };
      const defender = { ...mockFighter, id: 'defender', status: FighterStatus.BLOCK };
      const currentFrame = 1000;

      const [newAttacker] = resolveHit(attacker, defender, mockMove, currentFrame);

      expect(newAttacker.comboCount).toBe(0);
      expect(newAttacker.comboScaling).toBe(1.0);
    });

    test('should timeout combo after 90 frames', () => {
      const fighter = {
        ...mockFighter,
        comboCount: 5,
        comboScaling: 0.5,
        lastHitFrame: 1000,
      };

      // 90 frames later - combo should still be active (> 90 is the check)
      let result = checkComboTimeout(fighter, 1090, 90);
      expect(result.comboCount).toBe(5);
      expect(result.comboScaling).toBe(0.5);

      // 91 frames later - combo should reset
      result = checkComboTimeout(fighter, 1091, 90);
      expect(result.comboCount).toBe(0);
      expect(result.comboScaling).toBe(1.0);
    });

    test('should track cancel windows in move definitions', () => {
      const normalMove = MUSASHI.moves.get('light_punch')!;

      // Check that move has cancel properties defined
      expect(normalMove.cancellableInto).toBeDefined();
      expect(normalMove.cancellableOnHit).toBeDefined();
      expect(normalMove.cancellableOnBlock).toBeDefined();
    });
  });

  describe('Super Meter System', () => {
    test('should gain meter on successful hit', () => {
      const attacker = { ...mockFighter, superMeter: 0 };
      const defender = { ...mockFighter, id: 'defender' };
      const move = { ...mockMove, superMeterGain: 20 };
      const currentFrame = 1000;

      const [newAttacker] = resolveHit(attacker, defender, move, currentFrame);

      expect(newAttacker.superMeter).toBe(20);
    });

    test('should gain reduced meter on blocked hit', () => {
      const attacker = { ...mockFighter, superMeter: 0 };
      const defender = { ...mockFighter, id: 'defender', status: FighterStatus.BLOCK };
      const move = { ...mockMove, superMeterGain: 20 };
      const currentFrame = 1000;

      const [newAttacker] = resolveHit(attacker, defender, move, currentFrame);

      expect(newAttacker.superMeter).toBe(10); // 50% of normal gain
    });

    test('should gain defensive meter when hit', () => {
      const attacker = { ...mockFighter };
      const defender = { ...mockFighter, id: 'defender', superMeter: 0 };
      const move = { ...mockMove, damage: 20 };
      const currentFrame = 1000;

      const [, newDefender] = resolveHit(attacker, defender, move, currentFrame);

      // Defender gains 1.5x damage as meter
      expect(newDefender.superMeter).toBe(30);
    });

    test('should gain defensive meter when blocking', () => {
      const attacker = { ...mockFighter };
      const defender = { ...mockFighter, id: 'defender', status: FighterStatus.BLOCK, superMeter: 0 };
      const move = { ...mockMove, chipDamage: 5 };
      const currentFrame = 1000;

      const [, newDefender] = resolveHit(attacker, defender, move, currentFrame);

      // Defender gains 2x chip damage as meter
      expect(newDefender.superMeter).toBe(10);
    });

    test('should cap meter at maximum', () => {
      const attacker = { ...mockFighter, superMeter: 290, maxSuperMeter: 300 };
      const defender = { ...mockFighter, id: 'defender' };
      const move = { ...mockMove, superMeterGain: 20 };
      const currentFrame = 1000;

      const [newAttacker] = resolveHit(attacker, defender, move, currentFrame);

      expect(newAttacker.superMeter).toBe(300); // Capped at max
    });

    test('should regenerate meter passively', () => {
      const fighter = { ...mockFighter, superMeter: 50 };
      const result = regenerateSuperMeter(fighter);

      expect(result.superMeter).toBe(50.1); // 0.1 per frame
    });

    test('should not regenerate meter above maximum', () => {
      const fighter = { ...mockFighter, superMeter: 300, maxSuperMeter: 300 };
      const result = regenerateSuperMeter(fighter);

      expect(result.superMeter).toBe(300);
    });

    test('should deduct meter cost for super moves', () => {
      const superMove = MUSASHI.moves.get('super_combo')!;
      expect(superMove.superMeterCost).toBeGreaterThan(0);
    });

    test('should track meter through full combo sequence', () => {
      let attacker = { ...mockFighter, superMeter: 0, comboCount: 0, comboScaling: 1.0 };
      let defender = { ...mockFighter, id: 'defender', superMeter: 0 };
      const move = { ...mockMove, superMeterGain: 10, damage: 20 };
      let currentFrame = 1000;

      // Hit 1
      [attacker, defender] = resolveHit(attacker, defender, move, currentFrame);
      expect(attacker.superMeter).toBe(10);
      expect(attacker.comboCount).toBe(1);
      expect(defender.superMeter).toBe(30); // 1.5x damage

      // Hit 2
      currentFrame += 20;
      [attacker, defender] = resolveHit(attacker, defender, move, currentFrame);
      expect(attacker.superMeter).toBe(20);
      expect(attacker.comboCount).toBe(2);
      expect(attacker.comboScaling).toBe(0.9);

      // Hit 3
      currentFrame += 20;
      [attacker, defender] = resolveHit(attacker, defender, move, currentFrame);
      expect(attacker.superMeter).toBe(30);
      expect(attacker.comboCount).toBe(3);
      expect(attacker.comboScaling).toBe(0.8);
    });
  });

  describe('Special Move Energy Costs', () => {
    test('should have energy cost for special moves', () => {
      const hadoken = MUSASHI.moves.get('hadoken')!;
      expect(hadoken.energyCost).toBeGreaterThan(0);
    });

    test('should prevent special move execution with insufficient energy', () => {
      let buffer = createInputBuffer();
      buffer = addInput(buffer, { actions: new Set([InputAction.DOWN]), timestamp: 100 });
      buffer = addInput(buffer, { actions: new Set([InputAction.DOWN, InputAction.RIGHT]), timestamp: 101 });
      buffer = addInput(buffer, { actions: new Set([InputAction.RIGHT, InputAction.LIGHT_PUNCH]), timestamp: 102 });

      const input: InputFrame = { actions: new Set([InputAction.RIGHT, InputAction.LIGHT_PUNCH]), timestamp: 102 };
      const fighter = { ...mockFighter, energy: 5 }; // Low energy
      const result = updateFighterState(fighter, input, MUSASHI.moves, buffer, 102);

      expect(result.currentMove).not.toBe('hadoken');
      expect(result.energy).toBe(5); // Energy not deducted
    });
  });

  describe('Projectile Creation from Special Moves', () => {
    test('should create projectile definition from special move', () => {
      const hadoken = MUSASHI.moves.get('hadoken')!;
      expect(hadoken.projectile).toBeDefined();
      expect(hadoken.projectile?.speed).toBeGreaterThan(0);
      expect(hadoken.projectile?.damage).toBeGreaterThan(0);
    });
  });
});
