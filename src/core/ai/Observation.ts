/**
 * Observation System
 * Converts GameState into normalized observation for AI agents
 */

import { GameState, FighterState, FighterStatus } from '../interfaces/types';

/**
 * Normalized observation of game state for a single fighter
 * All values normalized to 0-1 (or -1 to 1) for neural network input
 */
export interface Observation {
  // Self state
  selfX: number;              // Position normalized to arena (0-1)
  selfY: number;              // Y position normalized (0-1)
  selfHealth: number;         // Health ratio (0-1)
  selfEnergy: number;         // Energy ratio (0-1)
  selfSuperMeter: number;     // Super meter ratio (0-1)
  selfIsGrounded: number;     // Boolean as 0 or 1
  selfFacing: number;         // -1 (left) or 1 (right)
  selfStatus: number;         // Status enum normalized (0-1)
  selfMoveFrame: number;      // Current move frame normalized (0-1)
  selfStunFrames: number;     // Stun frames remaining normalized (0-1)
  selfComboCount: number;     // Combo count normalized (0-1)
  
  // Opponent state (relative to self)
  opponentRelativeX: number;  // Opponent X relative to self (-1 to 1)
  opponentRelativeY: number;  // Opponent Y relative to self (-1 to 1)
  opponentHealth: number;     // Opponent health ratio (0-1)
  opponentEnergy: number;     // Opponent energy ratio (0-1)
  opponentSuperMeter: number; // Opponent super meter (0-1)
  opponentIsGrounded: number; // Boolean as 0 or 1
  opponentStatus: number;     // Status enum normalized (0-1)
  opponentMoveFrame: number;  // Opponent move frame (0-1)
  opponentStunFrames: number; // Opponent stun frames (0-1)
  opponentComboCount: number; // Opponent combo count (0-1)
  
  // Game state
  roundTime: number;          // Time remaining normalized (0-1)
  distanceToOpponent: number; // Distance normalized (0-1)
  
  // Total: 23 floats
}

/**
 * Generate observation for a specific entity
 */
export function generateObservation(
  state: GameState,
  entityId: string
): Observation {
  const self = state.entities.find((e) => e.id === entityId);
  const opponent = state.entities.find((e) => e.id !== entityId);

  if (!self || !opponent) {
    throw new Error(`Entity ${entityId} not found in game state`);
  }

  const arena = state.arena;
  const arenaWidth = arena.rightBound - arena.leftBound;
  const arenaHeight = arena.height;

  // Normalize self position
  const selfX = (self.position.x - arena.leftBound) / arenaWidth;
  const selfY = self.position.y / arenaHeight;

  // Calculate relative opponent position
  const dx = opponent.position.x - self.position.x;
  const dy = opponent.position.y - self.position.y;
  const opponentRelativeX = dx / arenaWidth; // -1 to 1
  const opponentRelativeY = dy / arenaHeight;

  // Calculate distance
  const distance = Math.sqrt(dx * dx + dy * dy);
  const maxDistance = Math.sqrt(arenaWidth * arenaWidth + arenaHeight * arenaHeight);
  const distanceToOpponent = distance / maxDistance;

  // Normalize status enum (0-8 mapped to 0-1)
  const selfStatus = normalizeStatus(self.status);
  const opponentStatus = normalizeStatus(opponent.status);

  // Normalize move frame (assume max 60 frames for any move)
  const selfMoveFrame = Math.min(self.moveFrame / 60, 1.0);
  const opponentMoveFrame = Math.min(opponent.moveFrame / 60, 1.0);

  // Normalize stun frames (assume max 60 frames)
  const selfStunFrames = Math.min(self.stunFramesRemaining / 60, 1.0);
  const opponentStunFrames = Math.min(opponent.stunFramesRemaining / 60, 1.0);

  // Normalize combo count (assume max 10 hits)
  const selfComboCount = Math.min(self.comboCount / 10, 1.0);
  const opponentComboCount = Math.min(opponent.comboCount / 10, 1.0);

  // Normalize round time (divide by initial time)
  const initialRoundTime = 60 * 60; // 60 seconds at 60fps
  const roundTime = state.round.timeRemaining / initialRoundTime;

  return {
    selfX,
    selfY,
    selfHealth: self.health / self.maxHealth,
    selfEnergy: self.energy / self.maxEnergy,
    selfSuperMeter: self.superMeter / self.maxSuperMeter,
    selfIsGrounded: self.isGrounded ? 1 : 0,
    selfFacing: self.facing,
    selfStatus,
    selfMoveFrame,
    selfStunFrames,
    selfComboCount,

    opponentRelativeX,
    opponentRelativeY,
    opponentHealth: opponent.health / opponent.maxHealth,
    opponentEnergy: opponent.energy / opponent.maxEnergy,
    opponentSuperMeter: opponent.superMeter / opponent.maxSuperMeter,
    opponentIsGrounded: opponent.isGrounded ? 1 : 0,
    opponentStatus,
    opponentMoveFrame,
    opponentStunFrames,
    opponentComboCount,

    roundTime,
    distanceToOpponent,
  };
}

/**
 * Normalize FighterStatus enum to 0-1 range
 */
function normalizeStatus(status: FighterStatus): number {
  // Map status enum to normalized value
  switch (status) {
    case FighterStatus.IDLE:
      return 0.0;
    case FighterStatus.WALK_FORWARD:
      return 0.125;
    case FighterStatus.WALK_BACKWARD:
      return 0.25;
    case FighterStatus.CROUCH:
      return 0.375;
    case FighterStatus.JUMP:
      return 0.5;
    case FighterStatus.ATTACK:
      return 0.625;
    case FighterStatus.BLOCK:
      return 0.75;
    case FighterStatus.HITSTUN:
      return 0.875;
    case FighterStatus.BLOCKSTUN:
      return 1.0;
    default:
      return 0.0;
  }
}

/**
 * Convert observation to flat array for neural network input
 */
export function observationToArray(obs: Observation): number[] {
  return [
    obs.selfX,
    obs.selfY,
    obs.selfHealth,
    obs.selfEnergy,
    obs.selfSuperMeter,
    obs.selfIsGrounded,
    obs.selfFacing,
    obs.selfStatus,
    obs.selfMoveFrame,
    obs.selfStunFrames,
    obs.selfComboCount,
    obs.opponentRelativeX,
    obs.opponentRelativeY,
    obs.opponentHealth,
    obs.opponentEnergy,
    obs.opponentSuperMeter,
    obs.opponentIsGrounded,
    obs.opponentStatus,
    obs.opponentMoveFrame,
    obs.opponentStunFrames,
    obs.opponentComboCount,
    obs.roundTime,
    obs.distanceToOpponent,
  ];
}
