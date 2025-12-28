/**
 * Bot Runtime - Browser Version
 * 
 * Production inference layer for browser environments.
 * Uses @tensorflow/tfjs instead of @tensorflow/tfjs-node.
 */

import * as tf from '@tensorflow/tfjs';
import { DifficultyKnobs, DifficultyLevel, getDifficultyKnobs } from './DifficultyConfig';
import { FightingStyle, StyleConfig, getStyleConfig, getStyleOneHot } from './StyleConfig';
import { ObservationEncoder } from '../core/ObservationEncoder';
import type { GameState } from '../../core/interfaces/types';

/**
 * Bot configuration
 */
export interface BotConfig {
  difficulty: DifficultyLevel | DifficultyKnobs;
  style: FightingStyle | StyleConfig;
  playerIndex: number;
}

/**
 * Action with metadata
 */
export interface BotAction {
  action: number;
  confidence: number;
  wasGreedy: boolean;
  hadError: boolean;
  reactionDelayed: boolean;
}

/**
 * Bot runtime for inference (browser version)
 */
export class BotRuntime {
  private encoder: ObservationEncoder;
  private model: tf.LayersModel;
  private config: BotConfig;
  private difficultyKnobs: DifficultyKnobs;
  private styleConfig: StyleConfig;
  
  // State
  private reactionBuffer: GameState[] = [];
  private lastAction: number = 0;
  private frameCount: number = 0;
  private random: () => number;
  
  constructor(
    model: tf.LayersModel,
    config: BotConfig,
    randomSeed?: number
  ) {
    this.model = model;
    this.config = config;
    this.encoder = new ObservationEncoder();
    
    // Parse difficulty
    if (typeof config.difficulty === 'number') {
      this.difficultyKnobs = getDifficultyKnobs(config.difficulty);
    } else {
      this.difficultyKnobs = config.difficulty;
    }
    
    // Parse style
    if (typeof config.style === 'string') {
      this.styleConfig = getStyleConfig(config.style);
    } else {
      this.styleConfig = config.style;
    }
    
    // Initialize random (seeded for reproducibility)
    if (randomSeed !== undefined) {
      this.random = this.seededRandom(randomSeed);
    } else {
      this.random = Math.random;
    }
  }
  
  /**
   * Get action for current game state
   */
  public getAction(state: GameState): BotAction {
    this.frameCount++;
    
    // Apply reaction delay
    const delayedState = this.applyReactionDelay(state);
    
    // Encode observation
    const obs = this.encoder.encode(delayedState, this.config.playerIndex.toString());
    
    // Add style one-hot
    const styleOneHot = getStyleOneHot(this.styleConfig.metadata.name);
    const obsWithStyle = [...obs, ...styleOneHot];
    
    // Apply observation noise (reduce opponent visibility)
    const noisyObs = this.applyObservationNoise(obsWithStyle);
    
    // Get policy output
    const obsTensor = tf.tensor2d([noisyObs]);
    const [policyLogits, value] = this.model.predict(obsTensor) as [tf.Tensor, tf.Tensor];
    
    // Sample action
    const action = this.sampleAction(policyLogits);
    const confidence = this.getActionConfidence(policyLogits, action);
    
    // Apply execution error
    const { finalAction, hadError } = this.applyExecutionError(action);
    
    // Check if action was delayed
    const reactionDelayed = this.reactionBuffer.length > 0;
    
    // Cleanup
    obsTensor.dispose();
    policyLogits.dispose();
    value.dispose();
    
    this.lastAction = finalAction;
    
    return {
      action: finalAction,
      confidence,
      wasGreedy: false,
      hadError,
      reactionDelayed,
    };
  }
  
  /**
   * Change difficulty at runtime
   */
  public setDifficulty(difficulty: DifficultyLevel | DifficultyKnobs): void {
    if (typeof difficulty === 'number') {
      this.difficultyKnobs = getDifficultyKnobs(difficulty);
      this.config.difficulty = difficulty;
    } else {
      this.difficultyKnobs = difficulty;
      this.config.difficulty = difficulty;
    }
  }
  
  /**
   * Change style at runtime
   */
  public setStyle(style: FightingStyle | StyleConfig): void {
    if (typeof style === 'string') {
      this.styleConfig = getStyleConfig(style);
      this.config.style = style;
    } else {
      this.styleConfig = style;
      this.config.style = style;
    }
  }
  
  /**
   * Apply reaction delay by buffering states
   */
  private applyReactionDelay(state: GameState): GameState {
    const delay = this.difficultyKnobs.reactionDelay;
    
    // Add to buffer
    this.reactionBuffer.push(state);
    
    // Keep buffer at delay size
    if (this.reactionBuffer.length > delay) {
      this.reactionBuffer.shift();
    }
    
    // Return delayed state (or current if buffer not full)
    if (this.reactionBuffer.length >= delay) {
      return this.reactionBuffer[0];
    } else {
      return state;
    }
  }
  
  /**
   * Apply observation noise based on difficulty
   */
  private applyObservationNoise(obs: number[]): number[] {
    // Use reactionNoise as observation noise
    const noise = this.difficultyKnobs.reactionNoise * 0.1; // Scale down
    
    if (noise === 0) {
      return obs;
    }
    
    return obs.map(val => {
      const noisyVal = val + (this.random() - 0.5) * 2 * noise;
      return Math.max(-1, Math.min(1, noisyVal)); // Clamp to [-1, 1]
    });
  }
  
  /**
   * Sample action from policy logits
   */
  private sampleAction(logits: tf.Tensor): number {
    const probs = tf.softmax(logits as tf.Tensor1D);
    const probsArray = probs.arraySync() as number[];
    probs.dispose();
    
    // Sample from distribution
    const rand = this.random();
    let cumulative = 0;
    
    for (let i = 0; i < probsArray.length; i++) {
      cumulative += probsArray[i];
      if (rand < cumulative) {
        return i;
      }
    }
    
    return probsArray.length - 1;
  }
  
  /**
   * Get confidence of selected action
   */
  private getActionConfidence(logits: tf.Tensor, action: number): number {
    const probs = tf.softmax(logits as tf.Tensor1D);
    const probsArray = probs.arraySync() as number[];
    probs.dispose();
    
    return probsArray[action];
  }
  
  /**
   * Apply execution error (mistakes)
   */
  private applyExecutionError(action: number): { finalAction: number; hadError: boolean } {
    const errorRate = this.difficultyKnobs.executionError;
    
    if (this.random() < errorRate) {
      // Make a mistake: random action instead
      const randomAction = Math.floor(this.random() * 10); // Assume 10 actions
      return { finalAction: randomAction, hadError: true };
    }
    
    return { finalAction: action, hadError: false };
  }
  
  /**
   * Seeded random number generator
   */
  private seededRandom(seed: number): () => number {
    let current = seed;
    return () => {
      current = (current * 9301 + 49297) % 233280;
      return current / 233280;
    };
  }
  
  /**
   * Dispose resources
   */
  public dispose(): void {
    // Model is managed externally, don't dispose it here
    this.reactionBuffer = [];
  }
}

/**
 * Create bot runtime from model path
 */
export async function createBotRuntime(
  modelPath: string,
  config: BotConfig
): Promise<BotRuntime> {
  const model = await tf.loadLayersModel(modelPath);
  return new BotRuntime(model, config);
}
