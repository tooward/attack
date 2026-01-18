/**
 * Tetsuo Character Definition
 * Slow grappler with high damage and command grabs
 */

import { 
  CharacterDefinition, 
  InputAction, 
  MoveDefinition, 
  Rect,
  CharacterArchetype,
  SpecialMoveDefinition,
  MotionInputType,
  MotionButton
} from '../interfaces/types';

// Hurtboxes (larger/wider than others - tank archetype, X centered at 0)
const STANDING_HURTBOX: Rect = { x: 0, y: -85, width: 70, height: 85 };
const CROUCHING_HURTBOX: Rect = { x: 0, y: -60, width: 70, height: 60 };
const AIRBORNE_HURTBOX: Rect = { x: 0, y: -110, width: 95, height: 110 };

// Basic moves (slower than others, higher damage)
const LIGHT_PUNCH: MoveDefinition = {
  id: 'light_punch',
  name: 'Light Punch',
  input: [InputAction.LIGHT_PUNCH],
  frameData: {
    startup: 5,    // Slower than Musashi (was 4)
    active: 3,
    recovery: 8,
    totalFrames: 16,
  },
  damage: 5,       // More damage than Musashi (was 4)
  chipDamage: 1,
  hitstun: 14,
  blockstun: 10,
  knockback: { x: 3, y: 0 },
  hitboxFrames: new Map([
    [
      5,
      [
        { x: 42, y: 20, width: 35, height: 22 },
      ],
    ],
    [
      6,
      [
        { x: 48, y: 20, width: 40, height: 22 },
      ],
    ],
    [
      7,
      [
        { x: 45, y: 20, width: 38, height: 22 },
      ],
    ],
  ]),
  energyCost: 4,
  superMeterGain: 12,
  superMeterCost: 0,
  cancellableInto: ['heavy_punch'],
  cancellableOnHit: true,
  cancellableOnBlock: false,
  requiresGrounded: true,
  requiresAirborne: false,
};

const HEAVY_PUNCH: MoveDefinition = {
  id: 'heavy_punch',
  name: 'Heavy Punch',
  input: [InputAction.HEAVY_PUNCH],
  frameData: {
    startup: 10,   // Slower than Musashi (was 8)
    active: 5,
    recovery: 16,
    totalFrames: 31,
  },
  damage: 13,      // More damage than Musashi (was 10)
  chipDamage: 3,
  hitstun: 24,
  blockstun: 18,
  knockback: { x: 10, y: 0 },
  hitboxFrames: new Map([
    [
      10,
      [
        { x: 52, y: 16, width: 45, height: 35 },
      ],
    ],
    [
      11,
      [
        { x: 58, y: 16, width: 50, height: 35 },
      ],
    ],
    [
      12,
      [
        { x: 58, y: 16, width: 50, height: 35 },
      ],
    ],
    [
      13,
      [
        { x: 55, y: 16, width: 48, height: 35 },
      ],
    ],
    [
      14,
      [
        { x: 52, y: 16, width: 45, height: 35 },
      ],
    ],
  ]),
  energyCost: 12,
  superMeterGain: 25,
  superMeterCost: 0,
  cancellableInto: [],
  cancellableOnHit: true,
  cancellableOnBlock: false,
  requiresGrounded: true,
  requiresAirborne: false,
};

const LIGHT_KICK: MoveDefinition = {
  id: 'light_kick',
  name: 'Light Kick',
  input: [InputAction.LIGHT_KICK],
  frameData: {
    startup: 6,
    active: 4,
    recovery: 9,
    totalFrames: 19,
  },
  damage: 6,
  chipDamage: 1,
  hitstun: 14,
  blockstun: 10,
  knockback: { x: 3, y: 0 },
  hitboxFrames: new Map([
    [
      6,
      [
        { x: 48, y: 42, width: 40, height: 28 },
      ],
    ],
    [
      7,
      [
        { x: 53, y: 42, width: 45, height: 28 },
      ],
    ],
    [
      8,
      [
        { x: 53, y: 42, width: 45, height: 28 },
      ],
    ],
    [
      9,
      [
        { x: 50, y: 42, width: 42, height: 28 },
      ],
    ],
  ]),
  energyCost: 4,
  superMeterGain: 12,
  superMeterCost: 0,
  cancellableInto: ['heavy_kick'],
  cancellableOnHit: true,
  cancellableOnBlock: false,
  requiresGrounded: true,
  requiresAirborne: false,
};

const HEAVY_KICK: MoveDefinition = {
  id: 'heavy_kick',
  name: 'Heavy Kick',
  input: [InputAction.HEAVY_KICK],
  frameData: {
    startup: 12,
    active: 5,
    recovery: 18,
    totalFrames: 35,
  },
  damage: 14,
  chipDamage: 3,
  hitstun: 25,
  blockstun: 18,
  knockback: { x: 10, y: 3 },
  hitboxFrames: new Map([
    [
      12,
      [
        { x: 55, y: 32, width: 50, height: 38 },
      ],
    ],
    [
      13,
      [
        { x: 60, y: 32, width: 55, height: 38 },
      ],
    ],
    [
      14,
      [
        { x: 60, y: 32, width: 55, height: 38 },
      ],
    ],
    [
      15,
      [
        { x: 60, y: 32, width: 55, height: 38 },
      ],
    ],
    [
      16,
      [
        { x: 58, y: 32, width: 52, height: 38 },
      ],
    ],
  ]),
  energyCost: 8,
  superMeterGain: 35,
  superMeterCost: 0,
  cancellableInto: [],
  cancellableOnHit: false,
  cancellableOnBlock: false,
  requiresGrounded: true,
  requiresAirborne: false,
};

const AIR_PUNCH: MoveDefinition = {
  id: 'air_punch',
  name: 'Air Punch',
  input: [InputAction.LIGHT_PUNCH],
  frameData: {
    startup: 7,
    active: 5,
    recovery: 10,
    totalFrames: 22,
  },
  damage: 8,
  chipDamage: 2,
  hitstun: 18,
  blockstun: 12,
  knockback: { x: 6, y: 3 },
  hitboxFrames: new Map([
    [
      7,
      [
        { x: 42, y: -12, width: 40, height: 32 },
      ],
    ],
    [
      8,
      [
        { x: 48, y: -12, width: 45, height: 32 },
      ],
    ],
    [
      9,
      [
        { x: 48, y: -12, width: 45, height: 32 },
      ],
    ],
    [
      10,
      [
        { x: 48, y: -12, width: 45, height: 32 },
      ],
    ],
    [
      11,
      [
        { x: 45, y: -12, width: 42, height: 32 },
      ],
    ],
  ]),
  energyCost: 6,
  superMeterGain: 25,
  superMeterCost: 0,
  cancellableInto: [],
  cancellableOnHit: false,
  cancellableOnBlock: false,
  requiresGrounded: false,
  requiresAirborne: true,
};

// Tetsuo Character
export const TETSUO: CharacterDefinition = {
  id: 'tetsuo',
  name: 'Tetsuo',
  archetype: CharacterArchetype.GRAPPLER,
  stats: {
    maxHealth: 120,             // Tank (vs Musashi's 100)
    maxEnergy: 100,
    walkSpeed: 2,               // Slower than Musashi (was 3)
    jumpForce: 14,              // Lower jump
    gravity: 0.9,               // Falls faster
    weight: 1.25,               // Takes less knockback
    speedModifier: 0.7,
    damageModifier: 1.3,
    jumpHeightModifier: 0.8,
  },
  standingHurtbox: STANDING_HURTBOX,
  crouchingHurtbox: CROUCHING_HURTBOX,
  airborneHurtbox: AIRBORNE_HURTBOX,
  moves: new Map([
    ['light_punch', LIGHT_PUNCH],
    ['heavy_punch', HEAVY_PUNCH],
    ['light_kick', LIGHT_KICK],
    ['heavy_kick', HEAVY_KICK],
    ['air_punch', AIR_PUNCH],
  ]),
  specialMoves: [
    // Spinning Piledriver (Command Grab)
    {
      id: 'spinning_piledriver',
      name: 'Spinning Piledriver',
      input: {
        motion: MotionInputType.FULL_CIRCLE,
        button: MotionButton.PUNCH,
        bufferWindow: 20,      // Extra lenient for 360
      },
      variants: {
        light: {
          damage: 25,           // Massive damage
          startupFrames: 5,
          activeFrames: 3,
          recoveryFrames: 18,
          blockAdvantage: 0,    // Can't be blocked
          hitAdvantage: 30,
          isCommandGrab: true,
          grabRange: 1.2,       // 20% larger than normal throw
        },
        heavy: {
          damage: 35,           // Enormous damage
          startupFrames: 3,     // Faster startup
          activeFrames: 3,
          recoveryFrames: 20,
          blockAdvantage: 0,
          hitAdvantage: 35,
          isCommandGrab: true,
          grabRange: 1.5,       // 50% larger than normal throw
        },
      },
      animationKey: 'spinning_piledriver',
    },
    // Charging Bull (Armored Rush)
    {
      id: 'charging_bull',
      name: 'Charging Bull',
      input: {
        motion: MotionInputType.CHARGE_BACK_FORWARD,
        button: MotionButton.PUNCH,
        chargeTime: 30,
        bufferWindow: 8,
      },
      variants: {
        light: {
          damage: 12,
          startupFrames: 18,
          activeFrames: 10,
          recoveryFrames: 14,
          blockAdvantage: -2,
          hitAdvantage: 15,
          armor: {
            hits: 1,            // Absorbs 1 hit
            start: 8,
            end: 18,
            damageReduction: 0, // Full absorption
          },
          movement: {
            horizontal: 14,
            vertical: 0,
            duration: 12,
          },
        },
        heavy: {
          damage: 18,
          startupFrames: 20,
          activeFrames: 12,
          recoveryFrames: 16,
          blockAdvantage: -4,
          hitAdvantage: 20,
          armor: {
            hits: 2,            // Absorbs 2 hits
            start: 10,
            end: 20,
            damageReduction: 0,
          },
          movement: {
            horizontal: 18,
            vertical: 0,
            duration: 14,
          },
        },
      },
      animationKey: 'charging_bull',
    },
    // Seismic Slam (Ground Pound)
    {
      id: 'seismic_slam',
      name: 'Seismic Slam',
      input: {
        motion: MotionInputType.DOUBLE_TAP_FORWARD,
        button: MotionButton.KICK,
        bufferWindow: 10,
      },
      variants: {
        light: {
          damage: 10,
          startupFrames: 24,
          activeFrames: 6,
          recoveryFrames: 18,
          blockAdvantage: -8,
          hitAdvantage: 20,    // Launcher on hit
        },
        heavy: {
          damage: 16,
          startupFrames: 30,
          activeFrames: 8,
          recoveryFrames: 22,
          blockAdvantage: -12,
          hitAdvantage: 30,    // Big launcher
        },
      },
      animationKey: 'seismic_slam',
    },
  ],
};
