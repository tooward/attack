/**
 * Physics System for Fighting Game
 * 
 * Implements deterministic, frame-based physics.
 * NOT a general physics engine - tailored for fighting game mechanics.
 */

import { FighterState, Vector2, ArenaConfig } from '../interfaces/types';

// Physics constants
const GRAVITY = 0.8;           // Pixels per frame^2
const FRICTION = 0.85;         // Ground friction coefficient
const MAX_FALL_SPEED = 20;     // Terminal velocity

/**
 * Apply gravity to a fighter
 */
export function applyGravity(fighter: FighterState): FighterState {
  if (fighter.isGrounded) {
    return fighter;
  }

  return {
    ...fighter,
    velocity: {
      ...fighter.velocity,
      y: Math.min(fighter.velocity.y + GRAVITY, MAX_FALL_SPEED),
    },
  };
}

/**
 * Apply friction when on ground
 */
export function applyFriction(fighter: FighterState): FighterState {
  if (!fighter.isGrounded) {
    return fighter;
  }

  return {
    ...fighter,
    velocity: {
      ...fighter.velocity,
      x: fighter.velocity.x * FRICTION,
    },
  };
}

/**
 * Update position based on velocity
 */
export function updatePosition(fighter: FighterState): FighterState {
  return {
    ...fighter,
    position: {
      x: fighter.position.x + fighter.velocity.x,
      y: fighter.position.y + fighter.velocity.y,
    },
  };
}

/**
 * Check if fighter is on the ground
 */
export function checkGrounded(
  fighter: FighterState,
  groundLevel: number
): FighterState {
  const isOnGround = fighter.position.y >= groundLevel;

  if (isOnGround && !fighter.isGrounded) {
    // Landing
    return {
      ...fighter,
      position: { ...fighter.position, y: groundLevel },
      velocity: { ...fighter.velocity, y: 0 },
      isGrounded: true,
    };
  } else if (!isOnGround && fighter.isGrounded) {
    // Leaving ground
    return {
      ...fighter,
      isGrounded: false,
    };
  }

  return fighter;
}

/**
 * Clamp fighter position to arena bounds
 */
export function keepInBounds(
  fighter: FighterState,
  arena: ArenaConfig
): FighterState {
  let newX = fighter.position.x;
  let newVelX = fighter.velocity.x;

  if (newX < arena.leftBound) {
    newX = arena.leftBound;
    newVelX = 0;
  } else if (newX > arena.rightBound) {
    newX = arena.rightBound;
    newVelX = 0;
  }

  if (newX !== fighter.position.x || newVelX !== fighter.velocity.x) {
    return {
      ...fighter,
      position: { ...fighter.position, x: newX },
      velocity: { ...fighter.velocity, x: newVelX },
    };
  }

  return fighter;
}

/**
 * Resolve collision between two fighters (push-box logic)
 * Returns both fighters with adjusted positions
 */
export function resolveFighterCollision(
  fighter1: FighterState,
  fighter2: FighterState
): [FighterState, FighterState] {
  // Simple AABB collision with push box size
  const PUSH_BOX_WIDTH = 60;
  const PUSH_BOX_HEIGHT = 80;

  const dx = fighter2.position.x - fighter1.position.x;
  const dy = Math.abs(fighter2.position.y - fighter1.position.y);

  // Check if push boxes overlap
  const overlapX = PUSH_BOX_WIDTH - Math.abs(dx);
  const overlapY = PUSH_BOX_HEIGHT - dy;

  if (overlapX > 0 && overlapY > 0 && fighter1.isGrounded && fighter2.isGrounded) {
    // Push fighters apart equally
    const pushAmount = overlapX / 2;
    const pushDir = dx > 0 ? 1 : -1;

    return [
      {
        ...fighter1,
        position: {
          ...fighter1.position,
          x: fighter1.position.x - pushAmount * pushDir,
        },
      },
      {
        ...fighter2,
        position: {
          ...fighter2.position,
          x: fighter2.position.x + pushAmount * pushDir,
        },
      },
    ];
  }

  return [fighter1, fighter2];
}

/**
 * Process all physics for a fighter in one step
 */
export function stepPhysics(
  fighter: FighterState,
  arena: ArenaConfig
): FighterState {
  let updated = fighter;
  
  updated = applyGravity(updated);
  updated = applyFriction(updated);
  updated = updatePosition(updated);
  updated = checkGrounded(updated, arena.groundLevel);
  updated = keepInBounds(updated, arena);
  
  return updated;
}

/**
 * Process physics for all fighters and resolve collisions
 */
export function stepAllPhysics(
  fighters: FighterState[],
  arena: ArenaConfig
): FighterState[] {
  // Step physics for each fighter individually
  let updated = fighters.map(f => stepPhysics(f, arena));

  // Resolve push-box collisions between fighters
  for (let i = 0; i < updated.length; i++) {
    for (let j = i + 1; j < updated.length; j++) {
      const [f1, f2] = resolveFighterCollision(updated[i], updated[j]);
      updated[i] = f1;
      updated[j] = f2;
    }
  }

  return updated;
}
