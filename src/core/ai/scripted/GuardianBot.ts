/**
 * GuardianBot - Defensive/Counter-puncher Bot
 * 
 * Behavior:
 * - Blocks 60-70% of incoming attacks
 * - Punishes unsafe moves (recovery > 15 frames)
 * - Anti-airs jumps with 70% accuracy
 * - Cautious offense - only attacks when safe
 * - Maintains optimal spacing
 * 
 * Difficulty Range: 3-7 (Medium to Hard)
 */

import { Observation, generateObservation } from '../Observation';
import { AIAction } from '../ActionSpace';
import { GameState, FighterStatus } from '../../interfaces/types';

export interface GuardianConfig {
  difficulty: number;           // 1-10
  blockProbability: number;     // Base block chance (0.6-0.7)
  antiAirAccuracy: number;      // Anti-air success rate (0.7)
  reactionDelay: number;        // Frames before reacting (1-9)
  executionAccuracy: number;    // Chance of correct execution (0.5-1.0)
}

export class GuardianBot {
  private config: GuardianConfig;
  private lastActionFrame: number = 0;
  private currentAction: AIAction = AIAction.IDLE;
  private actionDuration: number = 0;
  private opponentLastAction: string = '';
  private opponentRecoveryFrames: number = 0;
  private consecutiveBlocks: number = 0;
  
  constructor(difficulty: number = 5) {
    // Scale parameters based on difficulty (1-10)
    this.config = {
      difficulty,
      blockProbability: 0.4 + (difficulty * 0.03),        // 43% at diff 1, 70% at diff 10
      antiAirAccuracy: 0.4 + (difficulty * 0.03),         // 43% at diff 1, 70% at diff 10
      reactionDelay: Math.max(1, 10 - difficulty),        // 9 frames at diff 1, 1 frame at diff 10
      executionAccuracy: 0.5 + (difficulty * 0.05),       // 55% at diff 1, 100% at diff 10
    };
  }

  /**
   * Select next action based on observation
   */
  selectAction(observation: Observation, state: GameState, entityId: string, currentFrame: number): AIAction {
    // Can't act if stunned
    if (observation.selfStunFrames > 0) {
      return AIAction.IDLE;
    }

    // Continue current action for its duration
    if (this.actionDuration > 0) {
      this.actionDuration--;
      return this.currentAction;
    }

    // Apply reaction delay (higher difficulty = faster reactions)
    if (currentFrame - this.lastActionFrame < this.config.reactionDelay) {
      return AIAction.IDLE;
    }

    // Decision tree priority order:
    // 1. Punish opponent recovery
    // 2. Anti-air jumps
    // 3. Block incoming attacks
    // 4. Safe offense when at advantage
    // 5. Maintain spacing

    const opponent = state.entities.find(e => e.id !== entityId);
    if (!opponent) return AIAction.IDLE;

    const distance = Math.abs(observation.opponentRelativeX);
    const closeRange = distance < 0.2;    // Within attack range
    const midRange = distance >= 0.2 && distance < 0.5;
    const farRange = distance >= 0.5;

    // Priority 1: Punish recovery (opponent stuck in move recovery)
    if (this.isOpponentRecovering(opponent)) {
      const punish = this.calculatePunish(distance);
      if (punish && this.shouldExecute()) {
        return this.executeAction(punish, currentFrame);
      }
    }

    // Priority 2: Anti-air (opponent jumping)
    if (this.isOpponentJumping(opponent)) {
      const shouldAntiAir = Math.random() < this.config.antiAirAccuracy;
      if (shouldAntiAir && closeRange) {
        // Use HP as anti-air
        return this.executeAction(AIAction.HEAVY_PUNCH, currentFrame, 8);
      }
    }

    // Priority 3: Block incoming attacks
    if (this.isOpponentAttacking(opponent) && closeRange) {
      const shouldBlock = Math.random() < this.config.blockProbability;
      if (shouldBlock) {
        this.consecutiveBlocks++;
        return this.executeAction(AIAction.BLOCK, currentFrame, 10);
      }
    }

    // Priority 4: Safe offense when at advantage
    if (this.consecutiveBlocks >= 2 && closeRange) {
      // After blocking 2+ attacks, throw
      this.consecutiveBlocks = 0;
      return this.executeAction(AIAction.LIGHT_KICK, currentFrame, 6); // Throw placeholder
    }

    const frameAdvantage = this.estimateFrameAdvantage(opponent);
    if (frameAdvantage > 0 && closeRange) {
      // Safe to attack - use light attacks
      const attackChoice = Math.random() < 0.7 ? AIAction.LIGHT_PUNCH : AIAction.LIGHT_KICK;
      return this.executeAction(attackChoice, currentFrame, 8);
    }

    // Priority 5: Maintain spacing
    if (closeRange && frameAdvantage <= 0) {
      // Back away if not at advantage
      return this.executeAction(AIAction.WALK_BACKWARD, currentFrame, 15);
    }

    if (midRange) {
      // Walk into optimal range
      const approach = observation.opponentRelativeX > 0 ? AIAction.WALK_FORWARD : AIAction.WALK_BACKWARD;
      return this.executeAction(approach, currentFrame, 10);
    }

    if (farRange) {
      // Walk forward to close distance
      const approach = observation.opponentRelativeX > 0 ? AIAction.WALK_FORWARD : AIAction.WALK_BACKWARD;
      return this.executeAction(approach, currentFrame, 20);
    }

    return AIAction.IDLE;
  }

  /**
   * Detect if opponent is in recovery frames
   */
  private isOpponentRecovering(opponent: any): boolean {
    // Opponent is in hitstun or blockstun - can't act
    if (opponent.stunFramesRemaining > 0) {
      return false;
    }

    // Check if opponent is in recovery phase of an attack
    // Status ATTACK and moveFrame > active frames means recovery
    if (opponent.status === FighterStatus.ATTACK) {
      // Estimate: if moveFrame > 10, likely in recovery
      return opponent.moveFrame > 10;
    }

    return false;
  }

  /**
   * Detect if opponent is jumping
   */
  private isOpponentJumping(opponent: any): boolean {
    return opponent.status === FighterStatus.JUMP;
  }

  /**
   * Detect if opponent is currently attacking
   */
  private isOpponentAttacking(opponent: any): boolean {
    return opponent.status === FighterStatus.ATTACK && opponent.moveFrame < 10;
  }

  /**
   * Calculate optimal punish based on distance
   */
  private calculatePunish(distance: number): AIAction | null {
    // Close range: Heavy punch for max damage
    if (distance < 0.15) {
      return AIAction.HEAVY_PUNCH;
    }

    // Medium range: Light punch reaches
    if (distance < 0.25) {
      return AIAction.LIGHT_PUNCH;
    }

    // Too far to punish
    return null;
  }

  /**
   * Estimate frame advantage (positive = advantage, negative = disadvantage)
   */
  private estimateFrameAdvantage(opponent: any): number {
    // If opponent is stunned, we have advantage
    if (opponent.stunFramesRemaining > 0) {
      return opponent.stunFramesRemaining;
    }

    // If we just blocked, estimate disadvantage
    if (this.currentAction === AIAction.BLOCK) {
      return -2; // Usually slightly minus on block
    }

    // Neutral situation
    return 0;
  }

  /**
   * Check if action should execute (difficulty-based accuracy)
   */
  private shouldExecute(): boolean {
    return Math.random() < this.config.executionAccuracy;
  }

  /**
   * Execute an action with duration
   */
  private executeAction(action: AIAction, currentFrame: number, duration: number = 5): AIAction {
    this.currentAction = action;
    this.actionDuration = duration;
    this.lastActionFrame = currentFrame;

    // Reset consecutive blocks if not blocking
    if (action !== AIAction.BLOCK) {
      this.consecutiveBlocks = 0;
    }

    return action;
  }

  /**
   * Reset bot state (for new round)
   */
  reset(): void {
    this.lastActionFrame = 0;
    this.currentAction = AIAction.IDLE;
    this.actionDuration = 0;
    this.opponentLastAction = '';
    this.opponentRecoveryFrames = 0;
    this.consecutiveBlocks = 0;
  }

  /**
   * Get bot configuration
   */
  getConfig(): GuardianConfig {
    return { ...this.config };
  }

  /**
   * Get bot statistics (for testing/debugging)
   */
  getStats() {
    return {
      name: 'GuardianBot',
      difficulty: this.config.difficulty,
      blockProbability: this.config.blockProbability,
      antiAirAccuracy: this.config.antiAirAccuracy,
      reactionDelay: this.config.reactionDelay,
      consecutiveBlocks: this.consecutiveBlocks,
    };
  }
}
