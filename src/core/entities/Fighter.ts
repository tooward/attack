/**
 * Fighter State Machine
 * 
 * Manages fighter states and transitions.
 * Handles move execution and action states.
 */

import {
  FighterState,
  FighterStatus,
  InputFrame,
  InputAction,
  MoveDefinition,
} from '../interfaces/types';

/**
 * Update fighter state based on input and current status
 */
export function updateFighterState(
  fighter: FighterState,
  input: InputFrame,
  characterMoves: Map<string, MoveDefinition>
): FighterState {
  // Decrement stun frames
  if (fighter.stunFramesRemaining > 0) {
    const newStunFrames = fighter.stunFramesRemaining - 1;
    
    if (newStunFrames === 0) {
      // Stun ended, return to idle
      return {
        ...fighter,
        stunFramesRemaining: 0,
        status: FighterStatus.IDLE,
      };
    }
    
    return {
      ...fighter,
      stunFramesRemaining: newStunFrames,
    };
  }

  // Decrement invincibility frames
  let invincibleFrames = Math.max(0, fighter.invincibleFrames - 1);

  // If currently executing a move, advance it
  if (fighter.currentMove) {
    return advanceMoveFrame(fighter, characterMoves, invincibleFrames);
  }

  // Handle input-based state transitions
  return processInput(fighter, input, characterMoves, invincibleFrames);
}

/**
 * Advance the current move by one frame
 */
function advanceMoveFrame(
  fighter: FighterState,
  characterMoves: Map<string, MoveDefinition>,
  invincibleFrames: number
): FighterState {
  const move = characterMoves.get(fighter.currentMove!);
  if (!move) {
    // Move definition not found, reset to idle
    return {
      ...fighter,
      currentMove: null,
      moveFrame: 0,
      status: FighterStatus.IDLE,
      hitboxes: [],
      invincibleFrames,
    };
  }

  const nextFrame = fighter.moveFrame + 1;

  // Check if move is complete
  if (nextFrame >= move.frameData.totalFrames) {
    return {
      ...fighter,
      currentMove: null,
      moveFrame: 0,
      status: FighterStatus.IDLE,
      hitboxes: [],
      invincibleFrames,
    };
  }

  // Update hitboxes based on current frame
  const activeHitboxes = move.hitboxFrames.get(nextFrame) || [];

  return {
    ...fighter,
    moveFrame: nextFrame,
    hitboxes: activeHitboxes,
    invincibleFrames,
  };
}

/**
 * Process input and transition to new state
 */
function processInput(
  fighter: FighterState,
  input: InputFrame,
  characterMoves: Map<string, MoveDefinition>,
  invincibleFrames: number
): FighterState {
  const actions = input.actions;

  // Attack inputs (priority: attacks > movement)
  if (actions.has(InputAction.LIGHT_PUNCH)) {
    return startMove(fighter, 'light_punch', characterMoves, invincibleFrames);
  }
  if (actions.has(InputAction.HEAVY_PUNCH)) {
    return startMove(fighter, 'heavy_punch', characterMoves, invincibleFrames);
  }
  if (actions.has(InputAction.LIGHT_KICK)) {
    return startMove(fighter, 'light_kick', characterMoves, invincibleFrames);
  }
  if (actions.has(InputAction.HEAVY_KICK)) {
    return startMove(fighter, 'heavy_kick', characterMoves, invincibleFrames);
  }

  // Block
  if (actions.has(InputAction.BLOCK)) {
    return {
      ...fighter,
      status: FighterStatus.BLOCK,
      velocity: { x: 0, y: fighter.velocity.y },
      invincibleFrames,
    };
  }

  // Jump
  if (actions.has(InputAction.UP) && fighter.isGrounded) {
    return {
      ...fighter,
      status: FighterStatus.JUMP,
      velocity: { x: fighter.velocity.x, y: -15 }, // Jump velocity
      isGrounded: false,
      invincibleFrames,
    };
  }

  // Crouch
  if (actions.has(InputAction.DOWN) && fighter.isGrounded) {
    return {
      ...fighter,
      status: FighterStatus.CROUCH,
      velocity: { x: 0, y: fighter.velocity.y },
      invincibleFrames,
    };
  }

  // Movement
  let newStatus = FighterStatus.IDLE;
  let newVelocityX = 0;

  if (fighter.isGrounded) {
    if (actions.has(InputAction.RIGHT)) {
      newStatus = fighter.facing === 1 ? FighterStatus.WALK_FORWARD : FighterStatus.WALK_BACKWARD;
      newVelocityX = 3; // Walk speed
    } else if (actions.has(InputAction.LEFT)) {
      newStatus = fighter.facing === 1 ? FighterStatus.WALK_BACKWARD : FighterStatus.WALK_FORWARD;
      newVelocityX = -3;
    }
  }

  return {
    ...fighter,
    status: newStatus,
    velocity: { x: newVelocityX, y: fighter.velocity.y },
    invincibleFrames,
  };
}

/**
 * Start executing a move
 */
function startMove(
  fighter: FighterState,
  moveId: string,
  characterMoves: Map<string, MoveDefinition>,
  invincibleFrames: number
): FighterState {
  const move = characterMoves.get(moveId);
  if (!move) {
    return { ...fighter, invincibleFrames };
  }

  // Check if fighter can execute this move
  if (!canExecuteMove(fighter, move)) {
    return { ...fighter, invincibleFrames };
  }

  // Check if fighter has enough energy
  if (fighter.energy < move.energyCost) {
    return { ...fighter, invincibleFrames };
  }

  // Get initial hitboxes (frame 0)
  const initialHitboxes = move.hitboxFrames.get(0) || [];

  // Check for invincibility frames from move
  let newInvincibleFrames = invincibleFrames;
  if (move.invincibleFrames && move.invincibleFrames.includes(0)) {
    newInvincibleFrames = 1; // Will be counted down next frame
  }

  return {
    ...fighter,
    status: FighterStatus.ATTACK,
    currentMove: moveId,
    moveFrame: 0,
    energy: fighter.energy - move.energyCost,
    velocity: { x: 0, y: fighter.velocity.y }, // Stop movement during attack
    hitboxes: initialHitboxes,
    invincibleFrames: newInvincibleFrames,
  };
}

/**
 * Check if a fighter can execute a move
 */
export function canExecuteMove(
  fighter: FighterState,
  move: MoveDefinition
): boolean {
  // Check ground/air requirements
  if (move.requiresGrounded && !fighter.isGrounded) {
    return false;
  }
  if (move.requiresAirborne && fighter.isGrounded) {
    return false;
  }

  // Can't start a new move while in hitstun/blockstun
  if (fighter.stunFramesRemaining > 0) {
    return false;
  }

  return true;
}

/**
 * Apply hit to fighter (put in hitstun)
 */
export function applyHitstun(
  fighter: FighterState,
  hitstunFrames: number,
  knockback: { x: number; y: number }
): FighterState {
  return {
    ...fighter,
    status: FighterStatus.HITSTUN,
    stunFramesRemaining: hitstunFrames,
    velocity: { ...knockback },
    currentMove: null,
    moveFrame: 0,
    hitboxes: [],
  };
}

/**
 * Apply blockstun to fighter
 */
export function applyBlockstun(
  fighter: FighterState,
  blockstunFrames: number
): FighterState {
  return {
    ...fighter,
    status: FighterStatus.BLOCKSTUN,
    stunFramesRemaining: blockstunFrames,
    velocity: { x: 0, y: fighter.velocity.y },
    currentMove: null,
    moveFrame: 0,
    hitboxes: [],
  };
}

/**
 * Update fighter facing direction to look at opponent
 */
export function updateFacing(
  fighter: FighterState,
  opponentX: number
): FighterState {
  // Don't turn during attacks or stun
  if (
    fighter.status === FighterStatus.ATTACK ||
    fighter.status === FighterStatus.HITSTUN ||
    fighter.status === FighterStatus.BLOCKSTUN
  ) {
    return fighter;
  }

  const shouldFaceRight = opponentX > fighter.position.x;
  const newFacing = shouldFaceRight ? 1 : -1;

  if (newFacing !== fighter.facing) {
    return { ...fighter, facing: newFacing };
  }

  return fighter;
}

/**
 * Regenerate energy over time
 */
export function regenerateEnergy(fighter: FighterState): FighterState {
  if (fighter.energy >= fighter.maxEnergy) {
    return fighter;
  }

  const regenRate = 0.5; // Energy per frame
  const newEnergy = Math.min(fighter.maxEnergy, fighter.energy + regenRate);

  return { ...fighter, energy: newEnergy };
}
