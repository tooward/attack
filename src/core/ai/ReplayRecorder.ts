/**
 * ReplayRecorder - Records match data for training
 * 
 * Captures observation-action pairs and match outcomes for supervised learning
 * or imitation learning. Can be used to create training datasets from bot vs bot
 * matches or human play.
 */

import { GameState, InputFrame } from '../interfaces/types';
import { generateObservation, Observation } from './Observation';
import { AIAction } from './ActionSpace';

/**
 * Observation data for training
 */
export interface ObservationData {
  selfX: number;
  selfY: number;
  selfVelX: number;
  selfVelY: number;
  selfHealth: number;
  selfEnergy: number;
  selfSuperMeter: number;
  selfStatus: number;
  selfStunFrames: number;
  selfInvincibleFrames: number;
  opponentX: number;
  opponentY: number;
  opponentVelX: number;
  opponentVelY: number;
  opponentHealth: number;
  opponentEnergy: number;
  opponentSuperMeter: number;
  opponentStatus: number;
  opponentStunFrames: number;
  opponentInvincibleFrames: number;
  distanceToOpponent: number;
  roundTimeRemaining: number;
  facingRight: number;
}

/**
 * Single step in a replay
 */
export interface ReplayStep {
  frame: number;
  observation: ObservationData;
  action: AIAction;
  reward: number; // Damage dealt - damage taken this frame
}

/**
 * Complete match replay
 */
export interface Replay {
  steps: ReplayStep[];
  winner: number; // Entity ID of winner (0 = draw)
  finalScore: {
    player1Health: number;
    player2Health: number;
    player1Rounds: number;
    player2Rounds: number;
  };
  timestamp: number;
  metadata?: {
    player1Type?: string; // 'human' | 'random' | 'personality' | 'neural'
    player2Type?: string;
    personality1?: any;
    personality2?: any;
  };
}

/**
 * Records match data during gameplay
 */
export class ReplayRecorder {
  private steps: ReplayStep[] = [];
  private lastHealth: Map<string, number> = new Map();
  private isRecording = false;
  private startTime = 0;

  /**
   * Start recording a new match
   */
  startRecording(): void {
    this.steps = [];
    this.lastHealth.clear();
    this.isRecording = true;
    this.startTime = Date.now();
  }

  /**
   * Record a single step
   */
  recordStep(
    state: GameState,
    entityId: string,
    action: AIAction,
    frame: number
  ): void {
    if (!this.isRecording) return;

    // Get entity and opponent
    const entity = state.entities.find(e => e.id === entityId);
    const opponent = state.entities.find(e => e.id !== entityId);
    
    if (!entity || !opponent) return;

    // Generate observation - convert Observation to ObservationData
    const obs = generateObservation(state, entityId);
    const observation: ObservationData = {
      selfX: obs.selfX,
      selfY: obs.selfY,
      selfVelX: entity.velocity.x / 10,
      selfVelY: entity.velocity.y / 10,
      selfHealth: obs.selfHealth,
      selfEnergy: obs.selfEnergy,
      selfSuperMeter: obs.selfSuperMeter,
      selfStatus: obs.selfStatus,
      selfStunFrames: obs.selfStunFrames,
      selfInvincibleFrames: entity.invincibleFrames / 100,
      opponentX: obs.opponentRelativeX,
      opponentY: obs.opponentRelativeY,
      opponentVelX: opponent.velocity.x / 10,
      opponentVelY: opponent.velocity.y / 10,
      opponentHealth: obs.opponentHealth,
      opponentEnergy: obs.opponentEnergy,
      opponentSuperMeter: obs.opponentSuperMeter,
      opponentStatus: obs.opponentStatus,
      opponentStunFrames: obs.opponentStunFrames,
      opponentInvincibleFrames: opponent.invincibleFrames / 100,
      distanceToOpponent: obs.distanceToOpponent,
      roundTimeRemaining: obs.roundTime,
      facingRight: entity.facing === 1 ? 1 : 0,
    };

    // Calculate reward (damage dealt - damage taken this frame)
    const currentHealth = entity.health;
    const lastHealth = this.lastHealth.get(entityId) ?? currentHealth;
    const damageTaken = lastHealth - currentHealth;

    const opponentCurrentHealth = opponent.health;
    const opponentLastHealth = this.lastHealth.get(opponent.id) ?? opponentCurrentHealth;
    const damageDealt = opponentLastHealth - opponentCurrentHealth;

    const reward = damageDealt - damageTaken;

    // Update health tracking
    this.lastHealth.set(entityId, currentHealth);
    this.lastHealth.set(opponent.id, opponentCurrentHealth);

    // Record step
    this.steps.push({
      frame,
      observation,
      action,
      reward,
    });
  }

  /**
   * Stop recording and return complete replay
   */
  stopRecording(state: GameState, metadata?: any): Replay {
    this.isRecording = false;

    const player1 = state.entities[0];
    const player2 = state.entities[1];

    // Determine winner based on wins record
    const player1Wins = player1 ? state.match.wins[player1.id] || 0 : 0;
    const player2Wins = player2 ? state.match.wins[player2.id] || 0 : 0;
    
    let winner = 0;
    if (player1Wins > player2Wins) {
      winner = player1?.id ? parseInt(player1.id.replace(/\D/g, '')) : 0;
    } else if (player2Wins > player1Wins) {
      winner = player2?.id ? parseInt(player2.id.replace(/\D/g, '')) : 0;
    }

    const replay: Replay = {
      steps: this.steps,
      winner,
      finalScore: {
        player1Health: player1?.health || 0,
        player2Health: player2?.health || 0,
        player1Rounds: player1Wins,
        player2Rounds: player2Wins,
      },
      timestamp: this.startTime,
      metadata,
    };

    return replay;
  }

  /**
   * Cancel recording without saving
   */
  cancelRecording(): void {
    this.isRecording = false;
    this.steps = [];
    this.lastHealth.clear();
  }

  /**
   * Check if currently recording
   */
  isActive(): boolean {
    return this.isRecording;
  }

  /**
   * Get current step count
   */
  getStepCount(): number {
    return this.steps.length;
  }

  /**
   * Save replay to JSON
   */
  static saveToJSON(replay: Replay): string {
    return JSON.stringify(replay, null, 2);
  }

  /**
   * Load replay from JSON
   */
  static loadFromJSON(json: string): Replay {
    return JSON.parse(json);
  }

  /**
   * Convert replay to training data format
   * Returns arrays of observations and actions for supervised learning
   */
  static toTrainingData(replay: Replay): {
    observations: number[][];
    actions: number[];
    rewards: number[];
  } {
    const observations: number[][] = [];
    const actions: number[] = [];
    const rewards: number[] = [];

    for (const step of replay.steps) {
      // Convert observation to array
      const obs = [
        step.observation.selfX,
        step.observation.selfY,
        step.observation.selfVelX,
        step.observation.selfVelY,
        step.observation.selfHealth,
        step.observation.selfEnergy,
        step.observation.selfSuperMeter,
        step.observation.selfStatus,
        step.observation.selfStunFrames,
        step.observation.selfInvincibleFrames,
        step.observation.opponentX,
        step.observation.opponentY,
        step.observation.opponentVelX,
        step.observation.opponentVelY,
        step.observation.opponentHealth,
        step.observation.opponentEnergy,
        step.observation.opponentSuperMeter,
        step.observation.opponentStatus,
        step.observation.opponentStunFrames,
        step.observation.opponentInvincibleFrames,
        step.observation.distanceToOpponent,
        step.observation.roundTimeRemaining,
        step.observation.facingRight,
      ];

      observations.push(obs);
      actions.push(step.action);
      rewards.push(step.reward);
    }

    return { observations, actions, rewards };
  }
}
