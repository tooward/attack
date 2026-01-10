/**
 * Mock data helpers for testing
 */

import { GameState, FighterState, FighterStatus } from '../../src/core/interfaces/types';

/**
 * Create a mock fighter with sensible defaults
 */
export function mockFighter(id: string, x: number = 400, overrides: Partial<FighterState> = {}): FighterState {
  return {
    id,
    characterId: 'musashi',
    teamId: 0,
    position: { x, y: 0 },
    velocity: { x: 0, y: 0 },
    facing: 1,
    health: 1000,
    maxHealth: 1000,
    energy: 100,
    maxEnergy: 100,
    superMeter: 0,
    maxSuperMeter: 1000,
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
    hurtboxes: [],
    hitboxes: [],
    ...overrides,
  };
}

/**
 * Create a mock game state
 */
export function mockGameState(overrides: Partial<GameState> = {}): GameState {
  const actor = mockFighter('player1', 100);
  const opponent = mockFighter('player2', 200);
  
  return {
    frame: 0,
    entities: [actor, opponent],
    projectiles: [],
    round: {
      roundNumber: 1,
      timeRemaining: 5400,
      winner: null,
    },
    match: {
      wins: {},
      roundsToWin: 2,
      matchWinner: null,
    },
    arena: {
      width: 800,
      height: 600,
      groundLevel: 500,
      leftBound: 0,
      rightBound: 800,
    },
    cameraPosition: { x: 0, y: 0 },
    isPaused: false,
    isRoundOver: false,
    isMatchOver: false,
    freezeFrames: 0,
    screenShake: null,
    ...overrides,
  };
}
