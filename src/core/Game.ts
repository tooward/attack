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
  ProjectileState,
} from './interfaces/types';
import { updateFighterState, regenerateEnergy, regenerateSuperMeter } from './entities/Fighter';
import { stepAllPhysics } from './systems/Physics';
import { scanForHits, updateHurtboxes, checkComboTimeout } from './systems/Combat';
import { createInputBuffer, addInput, InputBuffer } from './systems/InputBuffer';
import { createProjectile, updateProjectile, checkProjectileHit, applyProjectileHit } from './entities/Projectile';

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
    comboScaling: 1.0,
    comboStartFrame: 0,
    lastHitFrame: 0,
    lastHitByFrame: 0,
    
    // Frame Data
    stunFramesRemaining: 0,
    invincibleFrames: 0,
    
    // Cancel tracking
    cancelAvailable: false,
    lastCancelFrame: 0,
    
    // Hitboxes (empty initially)
    hurtboxes: [],
    hitboxes: [],
  }));

  const roundTimeFrames = config.roundTimeSeconds * 60; // 60 fps

  // Note: InputBuffers need to be tracked separately per entity by the calling code
  // We don't store them in GameState to keep it serializable

  return {
    frame: 0,
    entities,
    projectiles: [], // Initialize empty projectiles array
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
    freezeFrames: 0,
    screenShake: null,
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
 * @param characterDefs Character definitions for move lookups
 * @param inputBuffers Map of entity ID to their input buffer (for special moves)
 * @returns New game state (immutable update)
 */
export function tick(
  state: GameState,
  inputs: Map<string, InputFrame>,
  characterDefs?: Map<string, CharacterDefinition>,
  inputBuffers?: Map<string, InputBuffer>
): GameState {
  // Don't advance if paused or round is over
  if (state.isPaused || state.isRoundOver) {
    return state;
  }

  // Check for freeze frames (hit pause)
  if (state.freezeFrames > 0) {
    return {
      ...state,
      freezeFrames: state.freezeFrames - 1,
      // Update screen shake even during freeze
      screenShake: state.screenShake ? updateScreenShake(state.screenShake) : null,
    };
  }

  // Create a new state object (immutability)
  let newState: GameState = {
    ...state,
    frame: state.frame + 1,
    entities: state.entities.map(entity => ({ ...entity })),
  };

  // Track new projectiles spawned this frame
  const newProjectiles: ProjectileState[] = [];

  // 1. Update fighter states (input processing + state machine)
  newState.entities = newState.entities.map(fighter => {
    const input = inputs.get(fighter.id) || { actions: new Set(), timestamp: state.frame };
    const characterDef = characterDefs?.get(fighter.characterId);
    const moves = characterDef?.moves || new Map();
    const inputBuffer = inputBuffers?.get(fighter.id);
    
    const updatedFighter = updateFighterState(fighter, input, moves, inputBuffer, newState.frame);
    
    // Check if fighter just started a special move that spawns a projectile
    if (updatedFighter.currentMove && updatedFighter.moveFrame === 0) {
      const move = moves.get(updatedFighter.currentMove);
      if (move?.projectile) {
        // Spawn projectile
        const projectile = createProjectile(move.projectile, updatedFighter, newState.frame);
        newProjectiles.push(projectile);
      }
    }
    
    return updatedFighter;
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
    const combatResult = scanForHits(newState.entities, moveMaps, newState.frame);
    newState.entities = combatResult.entities;
    
    // Trigger visual effects for hits
    if (combatResult.hitEvents.length > 0) {
      // Use the strongest hit this frame for visual effects
      const strongestHit = combatResult.hitEvents.reduce((prev, current) => 
        current.damage > prev.damage ? current : prev
      );
      newState = triggerHitFreeze(newState, strongestHit.damage, strongestHit.wasBlocked);
      newState = triggerScreenShake(newState, strongestHit.damage, strongestHit.wasBlocked);
    }
  }

  // 3b. Check for combo timeouts
  newState.entities = newState.entities.map(fighter => 
    checkComboTimeout(fighter, newState.frame)
  );

  // 3c. Regenerate energy and super meter
  newState.entities = newState.entities.map(fighter => {
    let updated = regenerateEnergy(fighter);
    updated = regenerateSuperMeter(updated);
    return updated;
  });

  // 4. Update projectiles
  // Update existing projectiles
  let activeProjectiles = state.projectiles.map(proj => 
    updateProjectile(proj, newState.frame, newState.arena.width)
  ).filter(proj => proj !== null) as ProjectileState[];
  
  // Add newly spawned projectiles
  activeProjectiles = [...activeProjectiles, ...newProjectiles];
  
  // Check projectile-fighter collisions
  for (const projectile of activeProjectiles) {
    for (let i = 0; i < newState.entities.length; i++) {
      const fighter = newState.entities[i];
      
      // Can't hit yourself or teammates
      if (fighter.id === projectile.ownerId || fighter.teamId === projectile.teamId) {
        continue;
      }
      
      // Check collision
      if (checkProjectileHit(projectile, fighter)) {
        const wasBlocked = fighter.status === FighterStatus.BLOCK;
        const result = applyProjectileHit(projectile, fighter, wasBlocked);
        
        // Update fighter
        newState.entities[i] = result.fighter;
        
        // Update or remove projectile
        const projIndex = activeProjectiles.indexOf(projectile);
        if (result.projectile) {
          activeProjectiles[projIndex] = result.projectile;
        } else {
          // Projectile destroyed
          activeProjectiles.splice(projIndex, 1);
        }
        
        // Trigger visual effects
        newState = triggerHitFreeze(newState, projectile.damage, wasBlocked);
        newState = triggerScreenShake(newState, projectile.damage, wasBlocked);
        
        break; // Projectile hit someone, stop checking
      }
    }
  }
  
  newState.projectiles = activeProjectiles;
  
  // 5. Update hurtboxes based on stance
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
  
  // 6. Decrement round timer
  newState.round = {
    ...newState.round,
    timeRemaining: Math.max(0, newState.round.timeRemaining - 1),
  };

  // 7. Update screen shake
  newState.screenShake = newState.screenShake ? updateScreenShake(newState.screenShake) : null;

  // 8. Check for round end conditions
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
 * Update screen shake state
 */
function updateScreenShake(shake: NonNullable<GameState['screenShake']>): NonNullable<GameState['screenShake']> | null {
  const newElapsed = shake.elapsed + 1;
  if (newElapsed >= shake.duration) {
    return null; // Shake complete
  }
  return {
    ...shake,
    elapsed: newElapsed,
  };
}

/**
 * Trigger hit freeze based on hit strength
 */
export function triggerHitFreeze(state: GameState, damage: number, wasBlocked: boolean): GameState {
  // Freeze duration based on damage
  let freezeFrames = 0;
  
  if (wasBlocked) {
    // Shorter freeze on block
    if (damage < 10) freezeFrames = 2;
    else if (damage < 20) freezeFrames = 3;
    else freezeFrames = 4;
  } else {
    // Longer freeze on hit
    if (damage < 10) freezeFrames = 3;
    else if (damage < 20) freezeFrames = 5;
    else if (damage < 30) freezeFrames = 7;
    else freezeFrames = 10; // Super hit
  }
  
  return {
    ...state,
    freezeFrames,
  };
}

/**
 * Trigger screen shake based on hit strength
 */
export function triggerScreenShake(state: GameState, damage: number, wasBlocked: boolean): GameState {
  // Only shake on clean hits, not blocks
  if (wasBlocked) {
    return state;
  }
  
  // Shake intensity based on damage
  let intensity = 0;
  let duration = 0;
  
  if (damage < 15) {
    // Light hit - no shake
    return state;
  } else if (damage < 25) {
    // Medium hit - light shake
    intensity = 2;
    duration = 6;
  } else if (damage < 35) {
    // Heavy hit - medium shake
    intensity = 4;
    duration = 10;
  } else {
    // Super hit - strong shake
    intensity = 8;
    duration = 15;
  }
  
  return {
    ...state,
    screenShake: {
      intensity,
      duration,
      elapsed: 0,
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
    comboScaling: 1.0,
    comboStartFrame: 0,
    stunFramesRemaining: 0,
    invincibleFrames: 0,
    cancelAvailable: false,
    lastCancelFrame: 0,
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
