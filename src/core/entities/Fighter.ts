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
import {
  InputBuffer,
  checkQuarterCircleForward,
  checkDragonPunch,
  checkButtonPress,
} from '../systems/InputBuffer';

/**
 * Update fighter state based on input and current status
 */
export function updateFighterState(
  fighter: FighterState,
  input: InputFrame,
  characterMoves: Map<string, MoveDefinition>,
  inputBuffer?: InputBuffer,
  currentFrame: number = 0
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
    return advanceMoveFrame(fighter, characterMoves, invincibleFrames, input, inputBuffer, currentFrame);
  }

  // Handle input-based state transitions
  return processInput(fighter, input, characterMoves, invincibleFrames, inputBuffer, currentFrame);
}

/**
 * Advance the current move by one frame
 */
function advanceMoveFrame(
  fighter: FighterState,
  characterMoves: Map<string, MoveDefinition>,
  invincibleFrames: number,
  input: InputFrame,
  inputBuffer?: InputBuffer,
  currentFrame: number = 0
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

  // Check if we can cancel this move
  if (inputBuffer) {
    // Check for cancel attempts (special moves first)
    if (checkDoubleQuarterCircleForward(inputBuffer, fighter.facing) &&
        (checkButtonPress(inputBuffer, InputAction.LIGHT_PUNCH, 3) || checkButtonPress(inputBuffer, InputAction.HEAVY_PUNCH, 3))) {
      const superMove = findMoveByMotionInput(characterMoves, '236236P');
      if (superMove && canCancelInto(fighter, move, superMove.id, currentFrame)) {
        return startMove(fighter, superMove.id, characterMoves, invincibleFrames, currentFrame, true);
      }
    }

    if (checkDragonPunch(inputBuffer, InputAction.LIGHT_PUNCH, fighter.facing) ||
        checkDragonPunch(inputBuffer, InputAction.HEAVY_PUNCH, fighter.facing)) {
      const dpMove = findMoveByMotionInput(characterMoves, '623P');
      if (dpMove && canCancelInto(fighter, move, dpMove.id, currentFrame)) {
        return startMove(fighter, dpMove.id, characterMoves, invincibleFrames, currentFrame, true);
      }
    }

    if (checkQuarterCircleForward(inputBuffer, InputAction.LIGHT_PUNCH, fighter.facing) ||
        checkQuarterCircleForward(inputBuffer, InputAction.HEAVY_PUNCH, fighter.facing)) {
      const hadokenMove = findMoveByMotionInput(characterMoves, '236P');
      if (hadokenMove && canCancelInto(fighter, move, hadokenMove.id, currentFrame)) {
        return startMove(fighter, hadokenMove.id, characterMoves, invincibleFrames, currentFrame, true);
      }
    }

    // Check normal move cancels
    if (input.actions.has(InputAction.LIGHT_PUNCH) && canCancelInto(fighter, move, 'light_punch', currentFrame)) {
      return startMove(fighter, 'light_punch', characterMoves, invincibleFrames, currentFrame, true);
    }
    if (input.actions.has(InputAction.HEAVY_PUNCH) && canCancelInto(fighter, move, 'heavy_punch', currentFrame)) {
      return startMove(fighter, 'heavy_punch', characterMoves, invincibleFrames, currentFrame, true);
    }
    if (input.actions.has(InputAction.LIGHT_KICK) && canCancelInto(fighter, move, 'light_kick', currentFrame)) {
      return startMove(fighter, 'light_kick', characterMoves, invincibleFrames, currentFrame, true);
    }
    if (input.actions.has(InputAction.HEAVY_KICK) && canCancelInto(fighter, move, 'heavy_kick', currentFrame)) {
      return startMove(fighter, 'heavy_kick', characterMoves, invincibleFrames, currentFrame, true);
    }
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
      cancelAvailable: false,
    };
  }

  // Update hitboxes based on current frame
  const activeHitboxes = move.hitboxFrames.get(nextFrame) || [];

  // Check for invincibility frames from move definition
  let newInvincibleFrames = invincibleFrames;
  if (move.invincibleFrames && move.invincibleFrames.includes(nextFrame)) {
    newInvincibleFrames = 1; // Set invincibility for this frame
  }

  // Check if we're in a cancellable window
  let cancelAvailable = false;
  if (move.cancellableFrames) {
    const { start, end } = move.cancellableFrames;
    cancelAvailable = nextFrame >= start && nextFrame <= end;
  }

  return {
    ...fighter,
    moveFrame: nextFrame,
    hitboxes: activeHitboxes,
    invincibleFrames: newInvincibleFrames,
    cancelAvailable,
  };
}

/**
 * Process input and transition to new state
 */
function processInput(
  fighter: FighterState,
  input: InputFrame,
  characterMoves: Map<string, MoveDefinition>,
  invincibleFrames: number,
  inputBuffer?: InputBuffer,
  currentFrame: number = 0
): FighterState {
  const actions = input.actions;

  // Check for special moves first (higher priority than normal attacks)
  if (inputBuffer) {
    // Super Combo: Double Quarter-Circle Forward + Punch (236236P)
    if (checkDoubleQuarterCircleForward(inputBuffer, fighter.facing)) {
      const superMove = findMoveByMotionInput(characterMoves, '236236P');
      if (superMove && checkButtonPress(inputBuffer, InputAction.LIGHT_PUNCH, 3)) {
        return startMove(fighter, superMove.id, characterMoves, invincibleFrames, currentFrame);
      }
      if (superMove && checkButtonPress(inputBuffer, InputAction.HEAVY_PUNCH, 3)) {
        return startMove(fighter, superMove.id, characterMoves, invincibleFrames, currentFrame);
      }
    }

    // Dragon Punch: 623P (Forward, Down, Down-Forward + Punch)
    if (checkDragonPunch(inputBuffer, InputAction.LIGHT_PUNCH, fighter.facing) ||
        checkDragonPunch(inputBuffer, InputAction.HEAVY_PUNCH, fighter.facing)) {
      const dpMove = findMoveByMotionInput(characterMoves, '623P');
      if (dpMove) {
        return startMove(fighter, dpMove.id, characterMoves, invincibleFrames, currentFrame);
      }
    }

    // Hadoken: Quarter-Circle Forward + Punch (236P)
    if (checkQuarterCircleForward(inputBuffer, InputAction.LIGHT_PUNCH, fighter.facing) ||
        checkQuarterCircleForward(inputBuffer, InputAction.HEAVY_PUNCH, fighter.facing)) {
      const hadokenMove = findMoveByMotionInput(characterMoves, '236P');
      if (hadokenMove) {
        return startMove(fighter, hadokenMove.id, characterMoves, invincibleFrames, currentFrame);
      }
    }
  }

  // Normal attack inputs (priority: attacks > movement)
  if (actions.has(InputAction.LIGHT_PUNCH)) {
    return startMove(fighter, 'light_punch', characterMoves, invincibleFrames, currentFrame);
  }
  if (actions.has(InputAction.HEAVY_PUNCH)) {
    return startMove(fighter, 'heavy_punch', characterMoves, invincibleFrames, currentFrame);
  }
  if (actions.has(InputAction.LIGHT_KICK)) {
    return startMove(fighter, 'light_kick', characterMoves, invincibleFrames, currentFrame);
  }
  if (actions.has(InputAction.HEAVY_KICK)) {
    return startMove(fighter, 'heavy_kick', characterMoves, invincibleFrames, currentFrame);
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
 * Find a move by its motion input notation (e.g., '236P', '623P')
 */
function findMoveByMotionInput(
  characterMoves: Map<string, MoveDefinition>,
  motionInput: string
): MoveDefinition | null {
  for (const move of characterMoves.values()) {
    if (move.motionInput === motionInput) {
      return move;
    }
  }
  return null;
}

/**
 * Check for double quarter-circle forward (236236)
 * This is used for super moves
 */
function checkDoubleQuarterCircleForward(
  buffer: InputBuffer,
  facing: number,
  maxFrames: number = 25
): boolean {
  const recentHistory = buffer.history.slice(-maxFrames);
  
  let qcfCount = 0;
  let foundDown = false;
  let foundDownForward = false;
  
  for (const frame of recentHistory) {
    // Reset state when we complete a QCF
    if (foundDownForward && 
        ((facing === 1 && frame.actions.has(InputAction.RIGHT)) ||
         (facing === -1 && frame.actions.has(InputAction.LEFT)))) {
      qcfCount++;
      foundDown = false;
      foundDownForward = false;
      
      if (qcfCount >= 2) {
        return true;
      }
    }
    
    // Check for down
    if (frame.actions.has(InputAction.DOWN)) {
      foundDown = true;
    }
    
    // Check for down-forward
    if (foundDown &&
        frame.actions.has(InputAction.DOWN) &&
        ((facing === 1 && frame.actions.has(InputAction.RIGHT)) ||
         (facing === -1 && frame.actions.has(InputAction.LEFT)))) {
      foundDownForward = true;
    }
  }
  
  return false;
}

/**
 * Check if current move can be canceled into another move
 */
function canCancelInto(
  fighter: FighterState,
  currentMove: MoveDefinition,
  newMoveId: string,
  currentFrame: number
): boolean {
  // Check if we're in a cancellable window
  if (!currentMove.cancellableFrames) {
    return false;
  }

  const { start, end } = currentMove.cancellableFrames;
  if (fighter.moveFrame < start || fighter.moveFrame > end) {
    return false;
  }

  // Check if the move we want to cancel into is allowed
  if (!currentMove.cancellableInto.includes(newMoveId)) {
    return false;
  }

  // Prevent cancel loops (can't cancel again too soon)
  const framesSinceLastCancel = currentFrame - fighter.lastCancelFrame;
  if (framesSinceLastCancel < 10) {
    return false;
  }

  return true;
}

/**
 * Start executing a move
 */
function startMove(
  fighter: FighterState,
  moveId: string,
  characterMoves: Map<string, MoveDefinition>,
  invincibleFrames: number,
  currentFrame: number = 0,
  isCancel: boolean = false
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

  // Check if super move requires meter
  if (move.isSpecial && move.superMeterCost && fighter.superMeter < move.superMeterCost) {
    return { ...fighter, invincibleFrames };
  }

  // Get initial hitboxes (frame 0)
  const initialHitboxes = move.hitboxFrames.get(0) || [];

  // Check for invincibility frames from move
  let newInvincibleFrames = invincibleFrames;
  if (move.invincibleFrames && move.invincibleFrames.includes(0)) {
    newInvincibleFrames = 1; // Will be counted down next frame
  }

  // Calculate costs
  const newEnergy = fighter.energy - move.energyCost;
  const newSuperMeter = move.superMeterCost 
    ? fighter.superMeter - move.superMeterCost 
    : fighter.superMeter;

  return {
    ...fighter,
    status: FighterStatus.ATTACK,
    currentMove: moveId,
    moveFrame: 0,
    energy: newEnergy,
    superMeter: newSuperMeter,
    velocity: { x: 0, y: fighter.velocity.y }, // Stop movement during attack
    hitboxes: initialHitboxes,
    invincibleFrames: newInvincibleFrames,
    cancelAvailable: false, // Reset cancel flag
    lastCancelFrame: isCancel ? currentFrame : fighter.lastCancelFrame,
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

/**
 * Regenerate super meter over time (passive meter gain)
 * Much slower than energy regen to keep meter valuable
 */
export function regenerateSuperMeter(fighter: FighterState): FighterState {
  if (fighter.superMeter >= fighter.maxSuperMeter) {
    return fighter;
  }

  const regenRate = 0.1; // Super meter per frame (slow passive gain)
  const newSuperMeter = Math.min(fighter.maxSuperMeter, fighter.superMeter + regenRate);

  return { ...fighter, superMeter: newSuperMeter };
}
