/**
 * Neural Bot
 * 
 * AI bot that uses a trained neural network policy to select actions.
 * Supports temperature-based exploration and action smoothing.
 */

import { Observation } from './Observation';
import { AIAction } from './ActionSpace';
import { NeuralPolicy } from './NeuralPolicy';

/**
 * Configuration for neural bot behavior
 */
export interface NeuralBotConfig {
  temperature: number;        // Exploration temperature (1.0 = normal, >1 = more random)
  actionDuration: number;     // Frames to continue same action
  useGreedy: boolean;         // Use best action instead of sampling
}

/**
 * Default configuration
 */
export const DEFAULT_NEURAL_BOT_CONFIG: NeuralBotConfig = {
  temperature: 1.0,
  actionDuration: 5,
  useGreedy: false,
};

/**
 * Bot that uses neural network for decision making
 */
export class NeuralBot {
  private policy: NeuralPolicy;
  private config: NeuralBotConfig;
  
  private currentAction: AIAction = AIAction.IDLE;
  private actionDuration: number = 0;
  private lastActionFrame: number = 0;

  constructor(
    policy: NeuralPolicy,
    config: NeuralBotConfig = DEFAULT_NEURAL_BOT_CONFIG
  ) {
    this.policy = policy;
    this.config = config;
  }

  /**
   * Select action based on neural network policy
   */
  async selectAction(
    observation: Observation,
    currentFrame: number
  ): Promise<AIAction> {
    // Can't act if stunned
    if (observation.selfStunFrames > 0) {
      return AIAction.IDLE;
    }

    // Continue current action for its duration
    if (this.actionDuration > 0) {
      this.actionDuration--;
      return this.currentAction;
    }

    // Query neural network for new action
    let action: AIAction;
    if (this.config.useGreedy) {
      action = await this.policy.selectBestAction(observation);
    } else {
      action = await this.policy.selectAction(observation, this.config.temperature);
    }

    // Set action duration
    this.actionDuration = this.config.actionDuration;
    this.currentAction = action;
    this.lastActionFrame = currentFrame;

    return action;
  }

  /**
   * Reset bot state
   */
  reset(): void {
    this.currentAction = AIAction.IDLE;
    this.actionDuration = 0;
    this.lastActionFrame = 0;
  }

  /**
   * Get the underlying policy
   */
  getPolicy(): NeuralPolicy {
    return this.policy;
  }

  /**
   * Set temperature for exploration
   */
  setTemperature(temperature: number): void {
    this.config.temperature = temperature;
  }

  /**
   * Enable/disable greedy action selection
   */
  setGreedy(greedy: boolean): void {
    this.config.useGreedy = greedy;
  }
}
