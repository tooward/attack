/**
 * Kaze Character Definition
 * Fast rushdown fighter with aggressive pressure tools
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

// Hurtboxes (smaller/thinner than Musashi - rushdown archetype, X centered at 0)
const STANDING_HURTBOX: Rect = { x: 0, y: -78, width: 55, height: 78 };
const CROUCHING_HURTBOX: Rect = { x: 0, y: -56, width: 55, height: 56 };
const AIRBORNE_HURTBOX: Rect = { x: 0, y: -95, width: 70, height: 95 };

// Basic moves (faster than Musashi, lower damage)
const LIGHT_PUNCH: MoveDefinition = {
  id: 'light_punch',
  name: 'Light Punch',
  input: [InputAction.LIGHT_PUNCH],
  frameData: {
    startup: 3,    // Faster than Musashi (was 4)
    active: 2,
    recovery: 5,
    totalFrames: 10,
  },
  damage: 3,       // Less damage than Musashi (was 4)
  chipDamage: 1,
  hitstun: 10,
  blockstun: 7,
  knockback: { x: 1, y: 0 },
  hitboxFrames: new Map([
    [
      3,
      [
        { x: 35, y: -60, width: 28, height: 18 },
      ],
    ],
    [
      4,
      [
        { x: 40, y: -60, width: 30, height: 18 },
      ],
    ],
  ]),
  energyCost: 2,
  superMeterGain: 8,
  superMeterCost: 0,
  cancellableInto: ['light_kick', 'heavy_punch'],
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
    startup: 6,    // Faster than Musashi (was 8)
    active: 3,
    recovery: 10,
    totalFrames: 19,
  },
  damage: 9,       // Less than Musashi (was 10)
  chipDamage: 2,
  hitstun: 18,
  blockstun: 12,
  knockback: { x: 6, y: 0 },
  hitboxFrames: new Map([
    [
      6,
      [
        { x: 45, y: -64, width: 38, height: 28 },
      ],
    ],
    [
      7,
      [
        { x: 50, y: -64, width: 42, height: 28 },
      ],
    ],
    [
      8,
      [
        { x: 48, y: -64, width: 40, height: 28 },
      ],
    ],
  ]),
  energyCost: 8,
  superMeterGain: 20,
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
    startup: 4,
    active: 3,
    recovery: 6,
    totalFrames: 13,
  },
  damage: 4,
  chipDamage: 1,
  hitstun: 12,
  blockstun: 8,
  knockback: { x: 2, y: 0 },
  hitboxFrames: new Map([
    [
      4,
      [
        { x: 45, y: -38, width: 35, height: 25 },
      ],
    ],
    [
      5,
      [
        { x: 50, y: -38, width: 40, height: 25 },
      ],
    ],
    [
      6,
      [
        { x: 48, y: -38, width: 38, height: 25 },
      ],
    ],
  ]),
  energyCost: 3,
  superMeterGain: 10,
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
    startup: 7,
    active: 4,
    recovery: 11,
    totalFrames: 22,
  },
  damage: 10,
  chipDamage: 2,
  hitstun: 20,
  blockstun: 14,
  knockback: { x: 8, y: 2 },
  hitboxFrames: new Map([
    [
      7,
      [
        { x: 50, y: -50, width: 45, height: 32 },
      ],
    ],
    [
      8,
      [
        { x: 55, y: -50, width: 48, height: 32 },
      ],
    ],
    [
      9,
      [
        { x: 55, y: -50, width: 48, height: 32 },
      ],
    ],
    [
      10,
      [
        { x: 52, y: -50, width: 45, height: 32 },
      ],
    ],
  ]),
  energyCost: 5,
  superMeterGain: 30,
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
    startup: 4,
    active: 4,
    recovery: 7,
    totalFrames: 15,
  },
  damage: 5,
  chipDamage: 1,
  hitstun: 14,
  blockstun: 9,
  knockback: { x: 4, y: 2 },
  hitboxFrames: new Map([
    [
      4,
      [
        { x: 38, y: -8, width: 32, height: 28 },
      ],
    ],
    [
      5,
      [
        { x: 45, y: -38, width: 35, height: 25 },
      ],
    ],
    [
      6,
      [
        { x: 50, y: -38, width: 40, height: 25 },
      ],
    ],
    [
      7,
      [
        { x: 48, y: -38, width: 38, height: 25 },
      ],
    ],
  ]),
  energyCost: 4,
  superMeterGain: 20,
  superMeterCost: 0,
  cancellableInto: [],
  cancellableOnHit: false,
  cancellableOnBlock: false,
  requiresGrounded: false,
  requiresAirborne: true,
};

// Kaze Character
export const KAZE: CharacterDefinition = {
  id: 'kaze',
  name: 'Kaze',
  archetype: CharacterArchetype.RUSHDOWN,
  stats: {
    maxHealth: 90,              // Fragile (vs Musashi's 100)
    maxEnergy: 100,
    walkSpeed: 4,               // Faster than Musashi (was 3)
    jumpForce: 18,              // Higher jump
    gravity: 0.75,              // Floatier
    weight: 0.85,               // Takes more knockback
    speedModifier: 1.3,
    damageModifier: 0.9,
    jumpHeightModifier: 1.2,
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
    // Lightning Strike (Dash Punch)
    {
      id: 'lightning_strike',
      name: 'Lightning Strike',
      input: {
        motion: MotionInputType.DOUBLE_TAP_FORWARD,
        button: MotionButton.PUNCH,
        bufferWindow: 12,
      },
      variants: {
        light: {
          damage: 8,
          startupFrames: 10,
          activeFrames: 4,
          recoveryFrames: 10,
          blockAdvantage: 2,      // Plus on block!
          hitAdvantage: 12,
          movement: {
            horizontal: 12,
            vertical: 0,
            duration: 8,
          },
        },
        heavy: {
          damage: 14,
          startupFrames: 12,
          activeFrames: 6,
          recoveryFrames: 14,
          blockAdvantage: -4,     // Punishable
          hitAdvantage: 18,
          movement: {
            horizontal: 16,
            vertical: 0,
            duration: 10,
          },
        },
      },
      animationKey: 'lightning_strike',
    },
    // Flash Kick (Charge anti-air)
    {
      id: 'flash_kick',
      name: 'Flash Kick',
      input: {
        motion: MotionInputType.CHARGE_DOWN_UP,
        button: MotionButton.KICK,
        chargeTime: 30,
        bufferWindow: 8,
      },
      variants: {
        light: {
          damage: 10,
          startupFrames: 8,
          activeFrames: 8,
          recoveryFrames: 18,
          blockAdvantage: -14,
          hitAdvantage: 20,
          invincibility: [{
            start: 1,
            end: 6,
            type: 'strike',    // Upper body invincible only
          }],
          movement: {
            horizontal: 0,
            vertical: -14,
            duration: 10,
          },
        },
        heavy: {
          damage: 16,
          startupFrames: 6,
          activeFrames: 10,
          recoveryFrames: 22,
          blockAdvantage: -18,
          hitAdvantage: 25,
          invincibility: [{
            start: 1,
            end: 8,
            type: 'full',
          }],
          movement: {
            horizontal: 0,
            vertical: -18,
            duration: 12,
          },
        },
      },
      animationKey: 'flash_kick',
    },
    // Air Dash (Mobility)
    {
      id: 'air_dash',
      name: 'Air Dash',
      input: {
        motion: MotionInputType.DOUBLE_TAP_FORWARD,
        button: MotionButton.ANY,
        bufferWindow: 12,
      },
      variants: {
        light: {
          damage: 0,            // No damage, pure mobility
          startupFrames: 8,
          activeFrames: 12,
          recoveryFrames: 8,
          blockAdvantage: 0,
          hitAdvantage: 0,
          movement: {
            horizontal: 20,    // Fast forward dash
            vertical: 0,
            duration: 12,
          },
        },
        heavy: {
          damage: 0,
          startupFrames: 8,
          activeFrames: 12,
          recoveryFrames: 8,
          blockAdvantage: 0,
          hitAdvantage: 0,
          movement: {
            horizontal: 20,
            vertical: 0,
            duration: 12,
          },
        },
      },
      animationKey: 'air_dash',
    },
  ],
};
