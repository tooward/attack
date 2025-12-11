/**
 * Core Game Loop
 * 
 * This is the heartbeat of the fighting game engine.
 * Pure TypeScript - no Phaser dependencies.
 */

import {
  GameState,
  GameConfig,
  InputFrame,
  FighterState,
  FighterStatus,
  ArenaConfig,
  Vector2,
  CharacterDefinition,
} from './interfaces/types';
import { updateFighterState } from './entities/Fighter';
import { stepAllPhysics } from './systems/Physics';
import { scanForHits, updateHurtboxes } from './systems/Combat';

/**
 * Create the initial game state from configuration
 */
export function createInitialState(config: GameConfig): GameState {
  const entities: FighterState[] = config.entities.map(entityConfig => ({
    // Identity
    id: entityConfig.id,
    characterId: entityConfig.characterId,
    teamId: entityConfig.teamId,
    
    // Transform
    position: { ...entityConfig.startPosition },
    velocity: { x: 0, y: 0 },
    facing: entityConfig.teamId === 0 ? 1 : -1, // Player faces right, enemy left
    
    // Resources (will be populated from character definition)
    health: 100,
    maxHealth: 100,
    energy: 100,
    maxEnergy: 100,
    superMeter: 0,
    maxSuperMeter: 300,
    
    // State
    status: FighterStatus.IDLE,
    isGrounded: true,
    
    // Current Action
    currentMove: null,
    moveFrame: 0,
    
    // Combat Tracking
    comboCount: 0,
    lastHitFrame: 0,
    lastHitByFrame: 0,
    
    // Frame Data
    stunFramesRemaining: 0,
    invincibleFrames: 0,
    
    // Hitboxes (empty initially)
    hurtboxes: [],
    hitboxes: [],
  }));

  const roundTimeFrames = config.roundTimeSeconds * 60; // 60 fps

  return {
    frame: 0,
    entities,
    round: {
      roundNumber: 1,
      timeRemaining: roundTimeFrames,
      winner: null,
    },
    match: {
      wins: {},
      roundsToWin: config.roundsToWin,
      matchWinner: null,
    },
    arena: config.arena,
    cameraPosition: { x: 0, y: 0 },
    isPaused: false,
    isRoundOver: false,
    isMatchOver: false,
  };
}

/**
 * Main game loop - advances game state by one frame
 * 
 * This function is PURE - same inputs always produce same outputs.
 * It's the only function that advances time in the game world.
 * 
 * @param state Current game state (will NOT be mutated)
 * @param inputs Map of entity ID to their input for this frame
 * @returns New game state (immutable update)
 */
export function tick(
  state: GameState,
  inputs: Map<string, InputFrame>,
  characterDefs?: Map<string, CharacterDefinition>
): GameState {
  // Don't advance if paused or round is over
  if (state.isPaused || state.isRoundOver) {
    return state;
  }

  // Create a new state object (immutability)
  let newState: GameState = {
    ...state,
    frame: state.frame + 1,
    entities: state.entities.map(entity => ({ ...entity })),
  };

  // 1. Update fighter states (input processing + state machine)
  newState.entities = newState.entities.map(fighter => {
    const input = inputs.get(fighter.id) || { actions: new Set(), timestamp: state.frame };
    const characterDef = characterDefs?.get(fighter.characterId);
    const moves = characterDef?.moves || new Map();
    
    return updateFighterState(fighter, input, moves);
  });

  // 2. Apply physics to all fighters
  newState.entities = stepAllPhysics(newState.entities, newState.arena);

  // 3. Check for hits and resolve combat
  if (characterDefs) {
    // Convert CharacterDefinition map to move map for scanForHits
    const moveMaps = new Map<string, Map<string, import('./interfaces/types').MoveDefinition>>();
    characterDefs.forEach((charDef, charId) => {
      moveMaps.set(charId, charDef.moves);
    });
    newState.entities = scanForHits(newState.entities, moveMaps);
  }

  // 4. Update hurtboxes based on stance
  newState.entities = newState.entities.map(fighter => {
    const characterDef = characterDefs?.get(fighter.characterId);
    if (characterDef) {
      return updateHurtboxes(
        fighter,
        characterDef.standingHurtbox,
        characterDef.crouchingHurtbox,
        characterDef.airborneHurtbox
      );
    }
    return fighter;
  });
  
  // 5. Decrement round timer
  newState.round = {
    ...newState.round,
    timeRemaining: Math.max(0, newState.round.timeRemaining - 1),
  };

  // 6. Check for round end conditions
  newState = checkRoundEnd(newState);

  return newState;
}

/**
 * Check if the round should end and update state accordingly
 */
function checkRoundEnd(state: GameState): GameState {
  // Time out
  if (state.round.timeRemaining <= 0) {
    // Determine winner by health
    const livingEntities = state.entities.filter(e => e.health > 0);
    if (livingEntities.length > 0) {
      const winner = livingEntities.reduce((prev, current) =>
        prev.health > current.health ? prev : current
      );
      return {
        ...state,
        round: { ...state.round, winner: winner.id },
        isRoundOver: true,
      };
    }
  }

  // Check if any team has been eliminated
  const teamHealths = new Map<number, number>();
  for (const entity of state.entities) {
    const current = teamHealths.get(entity.teamId) || 0;
    teamHealths.set(entity.teamId, current + entity.health);
  }

  // If any team has 0 health, round is over
  for (const [teamId, health] of teamHealths) {
    if (health <= 0) {
      // Find the winning team
      const winningTeam = [...teamHealths.entries()].find(
        ([id, hp]) => id !== teamId && hp > 0
      );
      if (winningTeam) {
        const winner = state.entities.find(e => e.teamId === winningTeam[0]);
        if (winner) {
          return {
            ...state,
            round: { ...state.round, winner: winner.id },
            isRoundOver: true,
          };
        }
      }
    }
  }

  return state;
}

/**
 * Check if the match should end and update state accordingly
 */
export function checkMatchEnd(state: GameState): GameState {
  if (!state.isRoundOver) {
    return state;
  }

  // Update win count
  const wins = { ...state.match.wins };
  if (state.round.winner) {
    wins[state.round.winner] = (wins[state.round.winner] || 0) + 1;
  }

  // Check if any entity has won enough rounds
  for (const [entityId, winCount] of Object.entries(wins)) {
    if (winCount >= state.match.roundsToWin) {
      return {
        ...state,
        match: {
          ...state.match,
          wins,
          matchWinner: entityId,
        },
        isMatchOver: true,
      };
    }
  }

  // If no match winner yet, just update wins
  return {
    ...state,
    match: {
      ...state.match,
      wins,
    },
  };
}

/**
 * Reset for next round (preserves match state)
 */
export function startNextRound(
  state: GameState,
  config: GameConfig
): GameState {
  const nextRoundNumber = state.round.roundNumber + 1;
  const roundTimeFrames = config.roundTimeSeconds * 60;

  // Reset entities to starting positions with full health
  const resetEntities = state.entities.map((entity, index) => ({
    ...entity,
    position: { ...config.entities[index].startPosition },
    velocity: { x: 0, y: 0 },
    health: entity.maxHealth,
    energy: entity.maxEnergy,
    superMeter: entity.superMeter, // Preserve meter between rounds
    status: FighterStatus.IDLE,
    isGrounded: true,
    currentMove: null,
    moveFrame: 0,
    comboCount: 0,
    stunFramesRemaining: 0,
    invincibleFrames: 0,
    hurtboxes: [],
    hitboxes: [],
  }));

  return {
    ...state,
    entities: resetEntities,
    round: {
      roundNumber: nextRoundNumber,
      timeRemaining: roundTimeFrames,
      winner: null,
    },
    isRoundOver: false,
  };
}
