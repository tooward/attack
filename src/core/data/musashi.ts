/**
 * Musashi Character Definition
 * Balanced all-rounder fighter with good fundamentals
 */

import { CharacterDefinition, InputAction, MoveDefinition, Rect } from '../interfaces/types';

// Hurtboxes
const STANDING_HURTBOX: Rect = { x: 0, y: 0, width: 60, height: 80 };
const CROUCHING_HURTBOX: Rect = { x: 0, y: 20, width: 60, height: 60 };
const AIRBORNE_HURTBOX: Rect = { x: -10, y: -10, width: 80, height: 100 };

// Move Definitions
const LIGHT_PUNCH: MoveDefinition = {
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
    [
      4,
      [
        { x: 40, y: 20, width: 30, height: 20 }, // Frame 4 (startup complete)
      ],
    ],
    [
      5,
      [
        { x: 45, y: 20, width: 35, height: 20 }, // Frame 5 (extended)
      ],
    ],
    [
      6,
      [
        { x: 40, y: 20, width: 30, height: 20 }, // Frame 6 (retract)
      ],
    ],
  ]),
  energyCost: 0,
  superMeterGain: 10,
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
    startup: 8,
    active: 4,
    recovery: 12,
    totalFrames: 24,
  },
  damage: 25,
  chipDamage: 5,
  hitstun: 20,
  blockstun: 14,
  knockback: { x: 8, y: 0 },
  hitboxFrames: new Map([
    [
      8,
      [
        { x: 50, y: 15, width: 40, height: 30 },
      ],
    ],
    [
      9,
      [
        { x: 55, y: 15, width: 45, height: 30 },
      ],
    ],
    [
      10,
      [
        { x: 55, y: 15, width: 45, height: 30 },
      ],
    ],
    [
      11,
      [
        { x: 50, y: 15, width: 40, height: 30 },
      ],
    ],
  ]),
  energyCost: 0,
  superMeterGain: 20,
  superMeterCost: 0,
  cancellableInto: [],
  cancellableOnHit: false,
  cancellableOnBlock: false,
  requiresGrounded: true,
  requiresAirborne: false,
};

const LIGHT_KICK: MoveDefinition = {
  id: 'light_kick',
  name: 'Light Kick',
  input: [InputAction.LIGHT_KICK],
  frameData: {
    startup: 5,
    active: 3,
    recovery: 7,
    totalFrames: 15,
  },
  damage: 12,
  chipDamage: 2,
  hitstun: 14,
  blockstun: 9,
  knockback: { x: 3, y: 0 },
  hitboxFrames: new Map([
    [
      5,
      [
        { x: 45, y: 35, width: 35, height: 25 },
      ],
    ],
    [
      6,
      [
        { x: 50, y: 35, width: 40, height: 25 },
      ],
    ],
    [
      7,
      [
        { x: 45, y: 35, width: 35, height: 25 },
      ],
    ],
  ]),
  energyCost: 0,
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
    startup: 10,
    active: 5,
    recovery: 15,
    totalFrames: 30,
  },
  damage: 30,
  chipDamage: 6,
  hitstun: 25,
  blockstun: 16,
  knockback: { x: 10, y: 0 },
  hitboxFrames: new Map([
    [
      10,
      [
        { x: 55, y: 30, width: 45, height: 35 },
      ],
    ],
    [
      11,
      [
        { x: 60, y: 30, width: 50, height: 35 },
      ],
    ],
    [
      12,
      [
        { x: 60, y: 30, width: 50, height: 35 },
      ],
    ],
    [
      13,
      [
        { x: 60, y: 30, width: 50, height: 35 },
      ],
    ],
    [
      14,
      [
        { x: 55, y: 30, width: 45, height: 35 },
      ],
    ],
  ]),
  energyCost: 0,
  superMeterGain: 25,
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
    startup: 5,
    active: 4,
    recovery: 8,
    totalFrames: 17,
  },
  damage: 15,
  chipDamage: 3,
  hitstun: 15,
  blockstun: 10,
  knockback: { x: 5, y: 3 },
  hitboxFrames: new Map([
    [
      5,
      [
        { x: 40, y: -10, width: 35, height: 30 },
      ],
    ],
    [
      6,
      [
        { x: 45, y: -10, width: 40, height: 30 },
      ],
    ],
    [
      7,
      [
        { x: 45, y: -10, width: 40, height: 30 },
      ],
    ],
    [
      8,
      [
        { x: 40, y: -10, width: 35, height: 30 },
      ],
    ],
  ]),
  energyCost: 0,
  superMeterGain: 15,
  superMeterCost: 0,
  cancellableInto: [],
  cancellableOnHit: false,
  cancellableOnBlock: false,
  requiresGrounded: false,
  requiresAirborne: true,
};

// Special Moves

const HADOKEN: MoveDefinition = {
  id: 'hadoken',
  name: 'Spiritual Wave',
  input: [InputAction.LIGHT_PUNCH], // Will be checked via motion input
  motionInput: '236P', // Quarter-circle forward + Punch
  frameData: {
    startup: 12,
    active: 0, // Projectile is active, not fighter
    recovery: 18,
    totalFrames: 30,
  },
  damage: 0, // Projectile does damage
  chipDamage: 0,
  hitstun: 0,
  blockstun: 8,
  knockback: { x: 0, y: 0 },
  hitboxFrames: new Map(), // No fighter hitboxes
  energyCost: 25,
  superMeterGain: 0,
  superMeterCost: 0,
  isSpecial: true,
  projectile: {
    id: 'hadoken_projectile',
    name: 'Spiritual Wave Projectile',
    speed: 8,
    gravity: 0,
    acceleration: 0,
    damage: 15,
    chipDamage: 3,
    hitstun: 18,
    blockstun: 12,
    knockback: { x: 4, y: 0 },
    lifespan: 120, // 2 seconds at 60fps
    hitLimit: 1,
    hitbox: { x: -16, y: -16, width: 32, height: 32 },
    destroyOnHit: true,
  },
  cancellableInto: ['super_combo'],
  cancellableFrames: { start: 12, end: 12 }, // Can cancel on projectile spawn
  cancellableOnHit: false,
  cancellableOnBlock: false,
  cancellableOnWhiff: false,
  requiresGrounded: true,
  requiresAirborne: false,
};

const SHORYUKEN: MoveDefinition = {
  id: 'shoryuken',
  name: 'Dragon Ascent',
  input: [InputAction.HEAVY_PUNCH], // Will be checked via motion input
  motionInput: '623P', // Dragon punch motion
  frameData: {
    startup: 3, // VERY fast
    active: 8,
    recovery: 25, // VERY punishable
    totalFrames: 36,
  },
  damage: 35,
  chipDamage: 0, // Can't be blocked
  hitstun: 30,
  blockstun: 0,
  knockback: { x: 2, y: -12 }, // Launch upward
  hitboxFrames: new Map([
    [3, [{ x: 10, y: -40, width: 40, height: 80 }]],
    [4, [{ x: 10, y: -60, width: 40, height: 100 }]],
    [5, [{ x: 10, y: -80, width: 40, height: 120 }]],
    [6, [{ x: 10, y: -80, width: 40, height: 120 }]],
    [7, [{ x: 10, y: -60, width: 40, height: 100 }]],
    [8, [{ x: 10, y: -40, width: 40, height: 80 }]],
  ]),
  energyCost: 50,
  superMeterGain: 0,
  superMeterCost: 0,
  isSpecial: true,
  invincibleFrames: [1, 2, 3, 4, 5, 6, 7, 8], // Fully invincible during active frames
  cancellableInto: ['super_combo'],
  cancellableFrames: { start: 8, end: 11 },
  cancellableOnHit: true,
  cancellableOnBlock: false,
  cancellableOnWhiff: false,
  requiresGrounded: true,
  requiresAirborne: false,
};

const SUPER_COMBO: MoveDefinition = {
  id: 'super_combo',
  name: 'Five Rings Barrage',
  input: [InputAction.HEAVY_PUNCH], // Will be checked via motion input
  motionInput: '236236P', // Double quarter-circle forward
  frameData: {
    startup: 5,
    active: 60, // Long cinematic attack
    recovery: 15,
    totalFrames: 80,
  },
  damage: 80, // MASSIVE damage
  chipDamage: 20,
  hitstun: 60,
  blockstun: 40,
  knockback: { x: 8, y: -4 },
  hitboxFrames: new Map([
    [5, [{ x: 0, y: -100, width: 200, height: 200 }]], // Screen-filling hitbox
  ]),
  energyCost: 0,
  superMeterGain: 0,
  superMeterCost: 100, // Full meter
  isSpecial: true,
  invincibleFrames: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20], // Long invincibility
  cancellableInto: [],
  cancellableOnHit: false,
  cancellableOnBlock: false,
  cancellableOnWhiff: false,
  requiresGrounded: true,
  requiresAirborne: false,
};

// Musashi Character
export const MUSASHI: CharacterDefinition = {
  id: 'musashi',
  name: 'Musashi',
  stats: {
    maxHealth: 100,
    maxEnergy: 100,
    walkSpeed: 3,
    jumpForce: 16,
    gravity: 0.8,
    weight: 1.0,
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
    ['hadoken', HADOKEN],
    ['shoryuken', SHORYUKEN],
    ['super_combo', SUPER_COMBO],
  ]),
};
