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
  ]),
};
