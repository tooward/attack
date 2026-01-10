/**
 * AdvancedScriptedBot Base Class
 * 
 * Sophisticated bot architecture with:
 * - State-based decision making (not frame counting)
 * - Configurable difficulty and personality
 * - Reaction delays and execution errors
 * - Pattern tracking and adaptation
 * 
 * All advanced bots inherit from this class.
 */

import { GameState } from '../../interfaces/types';
import { ActionBundle } from '../../../ml/core/Environment';
import { StateReader } from './utils/StateReader';
import { FrameDataAnalyzer } from './systems/FrameDataAnalyzer';
import { DifficultyModulator } from './systems/DifficultyModulator';

/**
 * Bot configuration
 */
export interface BotConfig {
  name: string;
  style: 'defensive' | 'rushdown' | 'zoner' | 'mixup' | 'tutorial';
  difficulty: number; // 1-10
  blockProbability?: number; // 0.0-1.0 (optional, calculated from difficulty if not provided)
  antiAirAccuracy?: number; // 0.0-1.0 (optional, calculated from difficulty if not provided)
}

/**
 * Tactical situation enum
 */
export type TacticalSituation = 'offense' | 'defense' | 'neutral';

/**
 * Base class for all advanced scripted bots
 */
export abstract class AdvancedScriptedBot {
  protected config: BotConfig;
  protected stateReader: StateReader;
  protected frameAnalyzer: FrameDataAnalyzer;
  protected difficultyModulator: DifficultyModulator;
  
  // Internal state
  protected reactionBuffer: ActionBundle | null = null;
  protected framesUntilAction: number = 0;
  protected lastOpponentAction: string = '';
  protected opponentPatternHistory: string[] = [];
  protected lastDecisionFrame: number = 0;
  
  constructor(config: BotConfig) {
    this.config = {
      ...config,
      // Set defaults based on difficulty if not provided
      blockProbability: config.blockProbability ?? (0.3 + (config.difficulty * 0.04)),
      antiAirAccuracy: config.antiAirAccuracy ?? (0.3 + (config.difficulty * 0.04)),
    };
    
    this.stateReader = new StateReader();
    this.frameAnalyzer = new FrameDataAnalyzer();
    this.difficultyModulator = new DifficultyModulator(config.difficulty);
  }

  /**
   * Main decision method called every frame
   * Implements reaction delay and decision tree
   */
  public decide(state: GameState, actorId: string, targetId: string): ActionBundle {
    // Update internal state
    this.updateState(state, actorId, targetId);
    
    // Check if we're still in reaction delay
    if (this.framesUntilAction > 0) {
      this.framesUntilAction--;
      // Return buffered action or idle
      return this.reactionBuffer || { direction: 'neutral', button: 'none', holdDuration: 0 };
    }
    
    // Make new decision
    const decision = this.makeDecision(state, actorId, targetId);
    
    // Apply difficulty modulation (execution errors)
    const modulatedDecision = this.difficultyModulator.applyModulation(
      decision,
      this.difficultyModulator.getReactionTimeFrames(),
      this.difficultyModulator.getExecutionAccuracy()
    );
    
    // Set reaction delay for next decision
    this.framesUntilAction = this.difficultyModulator.getReactionTimeFrames() + 
                             this.difficultyModulator.getRandomDelay();
    this.reactionBuffer = modulatedDecision;
    this.lastDecisionFrame = state.frame;
    
    return modulatedDecision;
  }

  /**
   * Update internal state (track patterns, analyze frames)
   */
  protected updateState(state: GameState, actorId: string, targetId: string): void {
    const opponent = this.stateReader.getEntity(state, targetId);
    
    if (!opponent) return;

    // Track opponent's current action
    const currentAction = this.stateReader.getLastAction(opponent);
    if (currentAction !== this.lastOpponentAction) {
      this.opponentPatternHistory.push(currentAction);
      this.lastOpponentAction = currentAction;
      
      // Keep only last 20 actions
      if (this.opponentPatternHistory.length > 20) {
        this.opponentPatternHistory.shift();
      }
    }
    
    // Update frame advantage analysis
    this.frameAnalyzer.update(state, actorId, targetId);
  }

  /**
   * Core decision logic (implemented by subclasses)
   */
  protected abstract makeDecision(state: GameState, actorId: string, targetId: string): ActionBundle;

  /**
   * Detect if opponent has a pattern (spamming same move)
   */
  protected detectPattern(moves: string[]): string | null {
    if (this.opponentPatternHistory.length < 6) return null;
    
    const recent = this.opponentPatternHistory.slice(-6);
    
    // Check for repeating patterns
    for (const move of moves) {
      const count = recent.filter(a => a === move).length;
      if (count >= 3) {
        return move; // Opponent is spamming this move
      }
    }
    
    return null;
  }

  /**
   * Get tactical situation (offense, defense, neutral)
   */
  protected getTacticalSituation(): TacticalSituation {
    const advantage = this.frameAnalyzer.getFrameAdvantage();
    
    if (advantage > 2) return 'offense';
    if (advantage < -2) return 'defense';
    return 'neutral';
  }

  /**
   * Get idle/neutral action
   */
  protected getIdleAction(): ActionBundle {
    return { direction: 'neutral', button: 'none', holdDuration: 0 };
  }

  /**
   * Reset bot state (called between rounds)
   */
  public reset(): void {
    this.reactionBuffer = null;
    this.framesUntilAction = 0;
    this.lastOpponentAction = '';
    this.opponentPatternHistory = [];
    this.lastDecisionFrame = 0;
    this.frameAnalyzer.reset();
  }

  /**
   * Get bot name
   */
  public getName(): string {
    return this.config.name;
  }

  /**
   * Get bot style
   */
  public getStyle(): string {
    return this.config.style;
  }

  /**
   * Get bot difficulty
   */
  public getDifficulty(): number {
    return this.config.difficulty;
  }

  /**
   * Get bot configuration
   */
  public getConfig(): BotConfig {
    return this.config;
  }

  /**
   * Set bot difficulty (allows dynamic adjustment)
   */
  public setDifficulty(difficulty: number): void {
    this.config.difficulty = difficulty;
    this.difficultyModulator.setDifficulty(difficulty);
    
    // Recalculate derived stats
    this.config.blockProbability = 0.3 + (difficulty * 0.04);
    this.config.antiAirAccuracy = 0.3 + (difficulty * 0.04);
  }
}
