/**
 * Bot Runtime
 * 
 * Production inference layer that applies difficulty knobs and style
 * configurations to create believable, human-like opponents.
 */

import * as tf from '@tensorflow/tfjs-node';
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
 * Bot runtime for inference
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
    const { action, confidence } = this.getPolicyAction(noisyObs);
    
    // Apply capability restrictions
    const filteredAction = this.applyCapabilityRestrictions(action);
    
    // Apply execution error
    const { action: finalAction, hadError } = this.applyExecutionError(filteredAction);
    
    this.lastAction = finalAction;
    
    return {
      action: finalAction,
      confidence,
      wasGreedy: this.random() < this.difficultyKnobs.greedyRate,
      hadError,
      reactionDelayed: this.reactionBuffer.length > 0,
    };
  }
  
  /**
   * Reset runtime state
   */
  public reset(): void {
    this.reactionBuffer = [];
    this.lastAction = 0;
    this.frameCount = 0;
  }
  
  /**
   * Apply reaction delay to state
   */
  private applyReactionDelay(state: GameState): GameState {
    // Add to buffer
    this.reactionBuffer.push(state);
    
    // Calculate actual delay with noise
    const baseDelay = this.difficultyKnobs.reactionDelay;
    const noise = this.difficultyKnobs.reactionNoise;
    const actualDelay = Math.max(0, Math.round(
      baseDelay + (this.random() - 0.5) * 2 * noise * baseDelay
    ));
    
    // Keep buffer at delay size
    while (this.reactionBuffer.length > actualDelay + 1) {
      this.reactionBuffer.shift();
    }
    
    // Return delayed state
    return this.reactionBuffer[0] || state;
  }
  
  /**
   * Apply observation noise (reduce opponent visibility)
   */
  private applyObservationNoise(obs: number[]): number[] {
    const reactionRate = this.difficultyKnobs.reactionToOpponent;
    
    if (reactionRate >= 1.0) {
      return obs;
    }
    
    // Blend with neutral observation (0.0)
    return obs.map(value => {
      if (this.random() > reactionRate) {
        return value * 0.5; // Partial observation
      }
      return value;
    });
  }
  
  /**
   * Get action from policy
   */
  private getPolicyAction(obs: number[]): { action: number; confidence: number } {
    return tf.tidy(() => {
      // Create tensor
      const obsTensor = tf.tensor2d([obs]);
      
      // Forward pass
      const output = this.model.predict(obsTensor) as tf.Tensor;
      const logits = (output.arraySync() as number[][])[0];
      
      // Apply temperature
      const temperature = this.difficultyKnobs.temperature;
      const scaledLogits = logits.map(l => l / temperature);
      
      // Softmax
      const maxLogit = Math.max(...scaledLogits);
      const expLogits = scaledLogits.map(l => Math.exp(l - maxLogit));
      const sumExp = expLogits.reduce((a, b) => a + b, 0);
      const probs = expLogits.map(e => e / sumExp);
      
      // Sample or greedy
      let action: number;
      if (this.random() < this.difficultyKnobs.greedyRate) {
        // Greedy
        action = probs.indexOf(Math.max(...probs));
      } else {
        // Sample
        action = this.sampleFromProbs(probs);
      }
      
      const confidence = probs[action];
      
      return { action, confidence };
    });
  }
  
  /**
   * Apply capability restrictions
   */
  private applyCapabilityRestrictions(action: number): number {
    // Map actions to categories (game-specific)
    // For now, use simple heuristics
    
    const isSpecial = action >= 6 && action <= 9;
    const isSuper = action >= 10 && action <= 11;
    const isCancel = action >= 12 && action <= 15;
    const isAdvancedCombo = action >= 16;
    
    if (isSpecial && this.difficultyKnobs.disableSpecials) {
      return this.getRandomBasicAction();
    }
    
    if (isSuper && this.difficultyKnobs.disableSupers) {
      return this.getRandomBasicAction();
    }
    
    if (isCancel && this.difficultyKnobs.disableCancels) {
      return this.getRandomBasicAction();
    }
    
    if (isAdvancedCombo && this.difficultyKnobs.disableAdvancedCombos) {
      return this.getRandomBasicAction();
    }
    
    return action;
  }
  
  /**
   * Apply execution error
   */
  private applyExecutionError(action: number): { action: number; hadError: boolean } {
    // Random drop
    if (this.random() < this.difficultyKnobs.executionError) {
      return { action: 0, hadError: true }; // Neutral/idle
    }
    
    // Input noise (wrong input)
    if (this.random() < this.difficultyKnobs.inputNoise) {
      const wrongAction = this.getSimilarAction(action);
      return { action: wrongAction, hadError: true };
    }
    
    return { action, hadError: false };
  }
  
  /**
   * Get random basic action (no specials/supers)
   */
  private getRandomBasicAction(): number {
    // Actions 0-5 are typically basic moves
    return Math.floor(this.random() * 6);
  }
  
  /**
   * Get similar action (for input noise)
   */
  private getSimilarAction(action: number): number {
    // Return nearby action
    const offset = this.random() < 0.5 ? -1 : 1;
    return Math.max(0, Math.min(17, action + offset)); // 18 actions total
  }
  
  /**
   * Sample from probability distribution
   */
  private sampleFromProbs(probs: number[]): number {
    const r = this.random();
    let cumsum = 0;
    
    for (let i = 0; i < probs.length; i++) {
      cumsum += probs[i];
      if (r <= cumsum) {
        return i;
      }
    }
    
    return probs.length - 1;
  }
  
  /**
   * Seeded random number generator
   */
  private seededRandom(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }
  
  /**
   * Get current configuration
   */
  public getConfig(): BotConfig {
    return { ...this.config };
  }
  
  /**
   * Get difficulty knobs
   */
  public getDifficultyKnobs(): DifficultyKnobs {
    return { ...this.difficultyKnobs };
  }
  
  /**
   * Get style config
   */
  public getStyleConfig(): StyleConfig {
    return JSON.parse(JSON.stringify(this.styleConfig));
  }
  
  /**
   * Update difficulty
   */
  public setDifficulty(difficulty: DifficultyLevel | DifficultyKnobs): void {
    if (typeof difficulty === 'number') {
      this.difficultyKnobs = getDifficultyKnobs(difficulty);
      this.config.difficulty = difficulty;
    } else {
      this.difficultyKnobs = difficulty;
      this.config.difficulty = difficulty;
    }
    
    this.reset();
  }
  
  /**
   * Update style
   */
  public setStyle(style: FightingStyle | StyleConfig): void {
    if (typeof style === 'string') {
      this.styleConfig = getStyleConfig(style);
      this.config.style = style;
    } else {
      this.styleConfig = style;
      this.config.style = style;
    }
    
    this.reset();
  }
  
  /**
   * Get statistics
   */
  public getStats(): BotRuntimeStats {
    return {
      frameCount: this.frameCount,
      reactionBufferSize: this.reactionBuffer.length,
      lastAction: this.lastAction,
      difficulty: typeof this.config.difficulty === 'number' 
        ? this.config.difficulty 
        : 'custom',
      style: this.styleConfig.metadata.name,
    };
  }
  
  /**
   * Dispose resources
   */
  public dispose(): void {
    // Model is not disposed here (may be shared)
    this.reactionBuffer = [];
  }
}

/**
 * Bot runtime statistics
 */
export interface BotRuntimeStats {
  frameCount: number;
  reactionBufferSize: number;
  lastAction: number;
  difficulty: DifficultyLevel | 'custom';
  style: FightingStyle;
}

/**
 * Create bot runtime from checkpoint
 */
export async function createBotRuntime(
  modelPath: string,
  config: BotConfig,
  randomSeed?: number
): Promise<BotRuntime> {
  const model = await tf.loadLayersModel(`file://${modelPath}`);
  return new BotRuntime(model, config, randomSeed);
}

/**
 * Create bot runtime from model
 */
export function createBotRuntimeFromModel(
  model: tf.LayersModel,
  config: BotConfig,
  randomSeed?: number
): BotRuntime {
  return new BotRuntime(model, config, randomSeed);
}

/**
 * Batch inference for multiple bots
 */
export class BotRuntimeBatch {
  private runtimes: BotRuntime[] = [];
  
  constructor(runtimes: BotRuntime[]) {
    this.runtimes = runtimes;
  }
  
  /**
   * Get actions for all bots
   */
  public getActions(states: GameState[]): BotAction[] {
    if (states.length !== this.runtimes.length) {
      throw new Error('Number of states must match number of runtimes');
    }
    
    return states.map((state, i) => this.runtimes[i].getAction(state));
  }
  
  /**
   * Reset all bots
   */
  public resetAll(): void {
    this.runtimes.forEach(r => r.reset());
  }
  
  /**
   * Dispose all bots
   */
  public dispose(): void {
    this.runtimes.forEach(r => r.dispose());
    this.runtimes = [];
  }
}

/**
 * Bot pool for matchmaking
 */
export class BotPool {
  private bots: Map<string, BotRuntime> = new Map();
  
  /**
   * Add bot to pool
   */
  public addBot(id: string, bot: BotRuntime): void {
    this.bots.set(id, bot);
  }
  
  /**
   * Get bot by ID
   */
  public getBot(id: string): BotRuntime | undefined {
    return this.bots.get(id);
  }
  
  /**
   * Remove bot from pool
   */
  public removeBot(id: string): void {
    const bot = this.bots.get(id);
    if (bot) {
      bot.dispose();
      this.bots.delete(id);
    }
  }
  
  /**
   * Get all bots
   */
  public getAllBots(): BotRuntime[] {
    return Array.from(this.bots.values());
  }
  
  /**
   * Find bots by difficulty
   */
  public findByDifficulty(level: DifficultyLevel): BotRuntime[] {
    return this.getAllBots().filter(bot => {
      const config = bot.getConfig();
      return config.difficulty === level;
    });
  }
  
  /**
   * Find bots by style
   */
  public findByStyle(style: FightingStyle): BotRuntime[] {
    return this.getAllBots().filter(bot => {
      const config = bot.getConfig();
      return config.style === style;
    });
  }
  
  /**
   * Clear pool
   */
  public clear(): void {
    this.bots.forEach(bot => bot.dispose());
    this.bots.clear();
  }
  
  /**
   * Get pool size
   */
  public size(): number {
    return this.bots.size;
  }
}
