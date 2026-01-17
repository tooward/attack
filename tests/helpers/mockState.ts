/**
 * Mock State Helpers
 * Create mock game states and observations for testing
 */

import { GameState, FighterState, FighterStatus, ArenaConfig } from '../../src/core/interfaces/types';
import { Observation } from '../../src/core/ai/Observation';

/**
 * Create a basic mock game state with two fighters
 */
export function createMockGameState(): GameState {
  const arena: ArenaConfig = {
    width: 1000,
    height: 600,
    leftBound: 0,
    rightBound: 1000,
    groundLevel: 500,
  };

  const player1: FighterState = {
    id: 'player1',
    characterId: 'musashi',
    teamId: 0,
    position: { x: 300, y: 500 },
    velocity: { x: 0, y: 0 },
    health: 100,
    maxHealth: 100,
    energy: 100,
    maxEnergy: 100,
    superMeter: 0,
    maxSuperMeter: 100,
    facing: 1,
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
    activeSpecialMove: null,
    specialMoveFrame: 0,
    invincibilityState: null,
    armorState: null,
    cancelAvailable: false,
    lastCancelFrame: 0,
    hurtboxes: [],
    hitboxes: [],
  };

  const player2: FighterState = {
    ...player1,
    id: 'player2',
    characterId: 'musashi',
    teamId: 1,
    position: { x: 700, y: 500 },
    facing: -1,
  };

  return {
    frame: 0,
    entities: [player1, player2],
    projectiles: [],
    arena,
    round: {
      roundNumber: 1,
      timeRemaining: 3600, // 60 seconds
      winner: null,
    },
    match: {
      wins: { player1: 0, player2: 0 },
      roundsToWin: 2,
      matchWinner: null,
    },
    cameraPosition: { x: 500, y: 300 },
    isPaused: false,
    isRoundOver: false,
    isMatchOver: false,
    freezeFrames: 0,
    screenShake: {
      intensity: 0,
      duration: 0,
      elapsed: 0,
    },
  };
}

/**
 * Create a basic mock observation
 */
export function createMockObservation(): Observation {
  return {
    selfX: 0.3,
    selfY: 0.83,
    selfHealth: 1.0,
    selfEnergy: 1.0,
    selfSuperMeter: 0.0,
    selfIsGrounded: 1,
    selfFacing: 1,
    selfStatus: 0,
    selfMoveFrame: 0,
    selfStunFrames: 0,
    selfComboCount: 0,
    
    opponentRelativeX: 0.4,
    opponentRelativeY: 0.0,
    opponentHealth: 1.0,
    opponentEnergy: 1.0,
    opponentSuperMeter: 0.0,
    opponentIsGrounded: 1,
    opponentStatus: 0,
    opponentMoveFrame: 0,
    opponentStunFrames: 0,
    opponentComboCount: 0,
    
    roundTime: 1.0,
    distanceToOpponent: 0.4,
  };
}

/**
 * Create mock observation with custom parameters
 */
export function createCustomObservation(overrides: Partial<Observation>): Observation {
  return {
    ...createMockObservation(),
    ...overrides,
  };
}

/**
 * Create mock game state with custom fighter positions
 */
export function createMockGameStateWithPositions(
  player1X: number,
  player2X: number,
  player1Status: FighterStatus = FighterStatus.IDLE,
  player2Status: FighterStatus = FighterStatus.IDLE
): GameState {
  const state = createMockGameState();
  
  state.entities[0].position.x = player1X;
  state.entities[1].position.x = player2X;
  state.entities[0].status = player1Status;
  state.entities[1].status = player2Status;
  
  // Update facing based on positions
  state.entities[0].facing = player1X < player2X ? 1 : -1;
  state.entities[1].facing = player2X < player1X ? 1 : -1;
  
  return state;
}

/**
 * Simulate a fighter attacking
 */
export function setFighterAttacking(state: GameState, entityId: string, moveFrame: number = 5): GameState {
  const entity = state.entities.find(e => e.id === entityId);
  if (entity) {
    entity.status = FighterStatus.ATTACK;
    entity.moveFrame = moveFrame;
    entity.currentMove = 'light_punch';
  }
  return state;
}

/**
 * Simulate a fighter jumping
 */
export function setFighterJumping(state: GameState, entityId: string): GameState {
  const entity = state.entities.find(e => e.id === entityId);
  if (entity) {
    entity.status = FighterStatus.JUMP;
    entity.position.y = 300; // In air
    entity.velocity.y = -10;
  }
  return state;
}

/**
 * Simulate a fighter in recovery
 */
export function setFighterRecovering(state: GameState, entityId: string): GameState {
  const entity = state.entities.find(e => e.id === entityId);
  if (entity) {
    entity.status = FighterStatus.ATTACK;
    entity.moveFrame = 20; // Past active frames, in recovery
    entity.currentMove = 'heavy_punch';
  }
  return state;
}

/**
 * Simulate a fighter in hitstun
 */
export function setFighterInHitstun(state: GameState, entityId: string, frames: number = 10): GameState {
  const entity = state.entities.find(e => e.id === entityId);
  if (entity) {
    entity.status = FighterStatus.HITSTUN;
    entity.stunFramesRemaining = frames;
  }
  return state;
}
