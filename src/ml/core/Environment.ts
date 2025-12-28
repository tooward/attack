/**
 * Fighting Game RL Environment
 * 
 * OpenAI Gym-style interface for reinforcement learning training.
 * Wraps the core game engine and provides step-based interaction.
 */

import { GameState, InputFrame, InputAction } from '../../core/interfaces/types';
import { tick } from '../../core/Game';
import { createInitialState } from '../../core/Game';
import { CharacterDefinition } from '../../core/interfaces/types';
import { createInputBuffer, addInput, InputBuffer } from '../../core/systems/InputBuffer';

/**
 * Action bundle with direction, button, and hold duration
 */
export interface ActionBundle {
  direction: 'left' | 'right' | 'up' | 'down' | 'neutral';
  button: 'lp' | 'hp' | 'lk' | 'hk' | 'block' | 'special1' | 'special2' | 'super' | 'none';
  holdDuration: number; // 0-15 frames
}

/**
 * Environment configuration
 */
export interface EnvConfig {
  player1Character?: CharacterDefinition; // Deprecated, kept for backward compatibility
  player2Character?: CharacterDefinition; // Deprecated, kept for backward compatibility
  seed?: number;
  roundTime?: number; // Seconds
  curriculum?: CurriculumConstraints;
  entities?: Array<{
    characterId: string;
    id: string;
    teamId: number;
    startPosition: { x: number; y: number };
  }>;
  arena?: {
    width: number;
    height: number;
    groundLevel: number;
    leftBound: number;
    rightBound: number;
  };
  roundsToWin?: number;
}

/**
 * Curriculum constraints for progressive training
 */
export interface CurriculumConstraints {
  allowedMoves?: string[]; // Whitelist of move IDs
  disableSpecials?: boolean;
  disableSupers?: boolean;
  disableAirMoves?: boolean;
  fixedRange?: 'close' | 'mid' | 'far'; // Force fighters to stay at range
  opponentBehavior?: 'passive' | 'defensive' | 'scripted';
}

/**
 * Combat event for reward calculation
 */
export interface CombatEvent {
  type: 'hit' | 'block' | 'whiff' | 'knockdown' | 'combo' | 'throw' | 'antiair';
  attacker: string;
  defender: string;
  damage: number;
  frame: number;
}

/**
 * Environment info returned with each step
 */
export interface EnvInfo {
  frame: number;
  roundNumber: number;
  winner: string | null;
  damageDealt: Map<string, number>;
  damageTaken: Map<string, number>;
  combos: Map<string, number>;
  events: CombatEvent[];
  positions: Map<string, { x: number; y: number }>;
}

/**
 * Result of a step in the environment
 */
export interface StepResult {
  observations: Map<string, number[]>; // Entity ID -> observation vector
  rewards: Map<string, number>;
  done: boolean;
  info: EnvInfo;
}

/**
 * Internal state tracking for rewards
 */
interface RewardTracker {
  lastHealth: Map<string, number>;
  lastPosition: Map<string, { x: number; y: number }>;
  cumulativeRewards: Map<string, number>;
  stallingFrames: Map<string, number>;
  lastEngagementFrame: number;
}

/**
 * Fighting Game Environment
 */
export class FightingGameEnv {
  private gameState: GameState;
  private config: EnvConfig;
  private rewardTracker: RewardTracker;
  private entityIds: string[];
  private characterDefs: Map<string, CharacterDefinition>;
  private inputBuffers: Map<string, InputBuffer>;

  constructor(config: EnvConfig) {
    this.config = config;
    this.entityIds = ['player1', 'player2'];
    this.characterDefs = new Map();
    this.inputBuffers = new Map();

    // Populate character definitions from provided CharacterDefinition objects.
    // The core game loop requires this map for move execution + hit detection.
    if (this.config.player1Character) {
      this.characterDefs.set(this.config.player1Character.id, this.config.player1Character);
    }
    if (this.config.player2Character) {
      this.characterDefs.set(this.config.player2Character.id, this.config.player2Character);
    }

    this.gameState = this.createInitialGameState();
    this.inputBuffers = this.initializeInputBuffers();
    this.rewardTracker = this.initializeRewardTracker();
  }

  /**
   * Reset environment to initial state
   */
  reset(config?: Partial<EnvConfig>): GameState {
    if (config) {
      this.config = { ...this.config, ...config };

      // Refresh character definitions if updated.
      if (this.config.player1Character) {
        this.characterDefs.set(this.config.player1Character.id, this.config.player1Character);
      }
      if (this.config.player2Character) {
        this.characterDefs.set(this.config.player2Character.id, this.config.player2Character);
      }
    }

    this.gameState = this.createInitialGameState();
    this.inputBuffers = this.initializeInputBuffers();
    this.rewardTracker = this.initializeRewardTracker();
    
    return this.gameState;
  }

  /**
   * Step the environment forward one frame
   */
  step(actions: Map<string, ActionBundle>): StepResult {
    // Convert action bundles to input frames
    const inputs = new Map<string, InputFrame>();
    
    for (const [entityId, action] of actions.entries()) {
      const inputFrame = this.actionBundleToInputFrame(action, entityId);
      inputs.set(entityId, inputFrame);
    }

    // Apply curriculum constraints
    if (this.config.curriculum) {
      this.applyConstraints(inputs);
    }

    // Update per-entity input buffers (for special move detection)
    for (const entity of this.gameState.entities) {
      const existing = this.inputBuffers.get(entity.id) ?? createInputBuffer();
      const frame = inputs.get(entity.id) ?? { actions: new Set(), timestamp: this.gameState.frame };
      this.inputBuffers.set(entity.id, addInput(existing, frame));
    }

    // Tick the game forward
    const prevState = this.gameState;
    
    // DEBUG: Log positions before tick (first 5 frames only)
    const debugEnabled = process.env.ML_DEBUG === '1' && process.env.NODE_ENV !== 'test';
    if (debugEnabled && this.gameState.frame < 5) {
      console.log(
        `[ENV Frame ${this.gameState.frame}] Before tick:`,
        this.gameState.entities.map(e => `${e.id}: x=${e.position.x.toFixed(0)}`).join(', ')
      );
      console.log(
        '  Inputs:',
        Array.from(inputs.entries())
          .map(([id, inp]) => `${id}: ${Array.from(inp.actions).join(',')}`)
          .join(', ')
      );
    }
    
    this.gameState = tick(this.gameState, inputs, this.characterDefs, this.inputBuffers);
    
    // DEBUG: Log positions after tick
    if (debugEnabled && prevState.frame < 5) {
      console.log(
        `[ENV Frame ${this.gameState.frame}] After tick:`,
        this.gameState.entities.map(e => `${e.id}: x=${e.position.x.toFixed(0)}`).join(', ')
      );
      const moved = this.gameState.entities.some((e, i) =>
        Math.abs(e.position.x - prevState.entities[i].position.x) > 0.1
      );
      console.log(`  Movement detected: ${moved}`);
    }

    // Detect combat events
    const events = this.detectCombatEvents(prevState, this.gameState);

    // Calculate rewards for this step
    const rewards = this.calculateStepRewards(prevState, this.gameState, events);

    // Check if episode is done
    const done = this.gameState.isRoundOver || this.gameState.isMatchOver;

    // Build info object
    const info: EnvInfo = {
      frame: this.gameState.frame,
      roundNumber: this.gameState.round.roundNumber,
      winner: this.gameState.round.winner,
      damageDealt: this.getDamageDealt(prevState, this.gameState),
      damageTaken: this.getDamageTaken(prevState, this.gameState),
      combos: this.getComboCounts(this.gameState),
      events,
      positions: this.getPositions(this.gameState),
    };

    // Return observations as flattened arrays (will be encoded by ObservationEncoder)
    const observations = new Map<string, number[]>();
    for (const entityId of this.entityIds) {
      // Placeholder - will be properly encoded by ObservationEncoder
      observations.set(entityId, []);
    }

    return {
      observations,
      rewards,
      done,
      info,
    };
  }

  /**
   * Get current game state
   */
  getState(): GameState {
    return this.gameState;
  }

  /**
   * Check if episode is done
   */
  isDone(): boolean {
    return this.gameState.isRoundOver || this.gameState.isMatchOver;
  }

  /**
   * Get cumulative reward for an entity
   */
  getCumulativeReward(entityId: string): number {
    return this.rewardTracker.cumulativeRewards.get(entityId) || 0;
  }

  /**
   * Create initial game state
   */
  private createInitialGameState(): GameState {
    // Support both old and new config formats
    if (this.config.entities) {
      // New format
      const state = createInitialState({
        entities: this.config.entities,
        arena: this.config.arena || {
          width: 1000,
          height: 600,
          groundLevel: 500,
          leftBound: 100,
          rightBound: 900,
        },
        roundsToWin: this.config.roundsToWin || 2,
        roundTimeSeconds: this.config.roundTime || 60,
      });
      return state;
    } else {
      // Old format for backward compatibility
      const player1CharacterId = this.config.player1Character?.id ?? 'musashi';
      const player2CharacterId = this.config.player2Character?.id ?? 'musashi';

      const state = createInitialState({
        entities: [
          { characterId: player1CharacterId, id: 'player1', teamId: 0, startPosition: { x: 300, y: 500 } },
          { characterId: player2CharacterId, id: 'player2', teamId: 1, startPosition: { x: 700, y: 500 } },
        ],
        arena: {
          width: 1000,
          height: 600,
          groundLevel: 500,
          leftBound: 100,
          rightBound: 900,
        },
        roundsToWin: 2,
        roundTimeSeconds: this.config.roundTime || 60,
      });
      return state;
    }
  }

  private initializeInputBuffers(): Map<string, InputBuffer> {
    const buffers = new Map<string, InputBuffer>();
    for (const entity of this.gameState.entities) {
      buffers.set(entity.id, createInputBuffer());
    }
    return buffers;
  }

  /**
   * Initialize reward tracking
   */
  private initializeRewardTracker(): RewardTracker {
    const lastHealth = new Map<string, number>();
    const lastPosition = new Map<string, { x: number; y: number }>();
    const cumulativeRewards = new Map<string, number>();
    const stallingFrames = new Map<string, number>();

    for (const entity of this.gameState.entities) {
      lastHealth.set(entity.id, entity.health);
      lastPosition.set(entity.id, { x: entity.position.x, y: entity.position.y });
      cumulativeRewards.set(entity.id, 0);
      stallingFrames.set(entity.id, 0);
    }

    return {
      lastHealth,
      lastPosition,
      cumulativeRewards,
      stallingFrames,
      lastEngagementFrame: 0,
    };
  }

  /**
   * Convert ActionBundle to InputFrame
   */
  private actionBundleToInputFrame(action: ActionBundle, entityId: string): InputFrame {
    const actions: InputAction[] = [];

    // Add directional input
    // `ActionBundle.direction` is WORLD space. Do not flip based on facing.
    switch (action.direction) {
      case 'left':
        actions.push(InputAction.LEFT);
        break;
      case 'right':
        actions.push(InputAction.RIGHT);
        break;
      case 'up':
        actions.push(InputAction.UP);
        break;
      case 'down':
        actions.push(InputAction.DOWN);
        break;
    }

    // Add button input
    switch (action.button) {
      case 'lp':
        actions.push(InputAction.LIGHT_PUNCH);
        break;
      case 'hp':
        actions.push(InputAction.HEAVY_PUNCH);
        break;
      case 'lk':
        actions.push(InputAction.LIGHT_KICK);
        break;
      case 'hk':
        actions.push(InputAction.HEAVY_KICK);
        break;
      case 'block':
        actions.push(InputAction.BLOCK);
        break;
      // Add special/super mappings when those are implemented
    }

    return {
      actions: new Set(actions),
      timestamp: this.gameState.frame,
    };
  }

  /**
   * Apply curriculum constraints to inputs
   */
  private applyConstraints(inputs: Map<string, InputFrame>): void {
    if (!this.config.curriculum) return;

    const constraints = this.config.curriculum;

    // TODO: Implement move filtering based on allowedMoves
    // TODO: Implement special/super disabling
    // TODO: Implement air move disabling
    // This will require checking the resulting move against constraints
  }

  /**
   * Detect combat events from state transition
   */
  private detectCombatEvents(prevState: GameState, currState: GameState): CombatEvent[] {
    const events: CombatEvent[] = [];

    // Check each entity for damage taken
    for (const currEntity of currState.entities) {
      const prevEntity = prevState.entities.find(e => e.id === currEntity.id);
      if (!prevEntity) continue;

      // Hit detected (health decreased)
      if (currEntity.health < prevEntity.health) {
        const attacker = currState.entities.find(e => e.id !== currEntity.id);
        if (attacker) {
          const damage = prevEntity.health - currEntity.health;
          
          events.push({
            type: 'hit',
            attacker: attacker.id,
            defender: currEntity.id,
            damage,
            frame: currState.frame,
          });

          // Check for knockdown
          if (currEntity.status === 'knockdown' && prevEntity.status !== 'knockdown') {
            events.push({
              type: 'knockdown',
              attacker: attacker.id,
              defender: currEntity.id,
              damage,
              frame: currState.frame,
            });
          }
        }
      }

      // Combo detected (combo count increased)
      if (currEntity.comboCount > prevEntity.comboCount) {
        const attacker = currState.entities.find(e => e.id !== currEntity.id);
        if (attacker) {
          events.push({
            type: 'combo',
            attacker: attacker.id,
            defender: currEntity.id,
            damage: 0,
            frame: currState.frame,
          });
        }
      }
    }

    return events;
  }

  /**
   * Calculate step rewards (placeholder - will be implemented by RewardFunction)
   */
  private calculateStepRewards(
    prevState: GameState,
    currState: GameState,
    events: CombatEvent[]
  ): Map<string, number> {
    const rewards = new Map<string, number>();

    for (const entityId of this.entityIds) {
      // Placeholder: simple damage-based reward
      const currEntity = currState.entities.find(e => e.id === entityId);
      const prevEntity = prevState.entities.find(e => e.id === entityId);
      const opponent = currState.entities.find(e => e.id !== entityId);
      const prevOpponent = prevState.entities.find(e => e.id !== entityId);

      if (!currEntity || !prevEntity || !opponent || !prevOpponent) continue;

      let reward = 0;

      // Damage dealt
      const damageDealt = prevOpponent.health - opponent.health;
      reward += damageDealt * 1.0;

      // Damage taken
      const damageTaken = prevEntity.health - currEntity.health;
      reward += damageTaken * -1.0;

      // Round win/loss
      if (currState.round.winner === entityId) {
        reward += 100.0;
      } else if (currState.round.winner && currState.round.winner !== entityId) {
        reward += -100.0;
      }

      rewards.set(entityId, reward);

      // Update cumulative
      const cumulative = this.rewardTracker.cumulativeRewards.get(entityId) || 0;
      this.rewardTracker.cumulativeRewards.set(entityId, cumulative + reward);
    }

    return rewards;
  }

  /**
   * Get damage dealt by each entity
   */
  private getDamageDealt(prevState: GameState, currState: GameState): Map<string, number> {
    const damageDealt = new Map<string, number>();

    for (const entityId of this.entityIds) {
      const opponent = currState.entities.find(e => e.id !== entityId);
      const prevOpponent = prevState.entities.find(e => e.id !== entityId);

      if (opponent && prevOpponent) {
        damageDealt.set(entityId, prevOpponent.health - opponent.health);
      }
    }

    return damageDealt;
  }

  /**
   * Get damage taken by each entity
   */
  private getDamageTaken(prevState: GameState, currState: GameState): Map<string, number> {
    const damageTaken = new Map<string, number>();

    for (const entityId of this.entityIds) {
      const entity = currState.entities.find(e => e.id === entityId);
      const prevEntity = prevState.entities.find(e => e.id === entityId);

      if (entity && prevEntity) {
        damageTaken.set(entityId, prevEntity.health - entity.health);
      }
    }

    return damageTaken;
  }

  /**
   * Get combo counts
   */
  private getComboCounts(state: GameState): Map<string, number> {
    const combos = new Map<string, number>();

    for (const entity of state.entities) {
      combos.set(entity.id, entity.comboCount);
    }

    return combos;
  }

  /**
   * Get entity positions
   */
  private getPositions(state: GameState): Map<string, { x: number; y: number }> {
    const positions = new Map<string, { x: number; y: number }>();

    for (const entity of state.entities) {
      positions.set(entity.id, { x: entity.position.x, y: entity.position.y });
    }

    return positions;
  }
}
