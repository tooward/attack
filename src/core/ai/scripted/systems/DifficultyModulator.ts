/**
 * DifficultyModulator System
 * 
 * Applies difficulty-based modifications to bot decisions:
 * - Reaction time delays
 * - Execution errors
 * - Decision randomization
 * 
 * Makes bots feel more human and provides skill scaling.
 */

import { ActionBundle } from '../../../../ml/core/Environment';

export class DifficultyModulator {
  private difficulty: number; // 1-10
  
  constructor(difficulty: number) {
    this.difficulty = Math.max(1, Math.min(10, difficulty));
  }

  /**
   * Apply difficulty-based modulation to an action
   */
  applyModulation(
    action: ActionBundle,
    reactionTimeFrames: number,
    executionAccuracy: number
  ): ActionBundle {
    // Apply execution errors based on accuracy
    if (Math.random() > executionAccuracy) {
      return this.applyExecutionError(action);
    }

    return action;
  }

  /**
   * Apply an execution error (wrong button, wrong direction, etc.)
   */
  private applyExecutionError(action: ActionBundle): ActionBundle {
    const errorType = Math.random();
    
    if (errorType < 0.4) {
      // Wrong button (40% of errors)
      return {
        ...action,
        button: this.getRandomButton(action.button)
      };
    } else if (errorType < 0.7) {
      // Wrong direction (30% of errors)
      return {
        ...action,
        direction: this.getRandomDirection()
      };
    } else {
      // No action (30% of errors - "dropped input")
      return {
        direction: 'neutral',
        button: 'none',
        holdDuration: 0
      };
    }
  }

  /**
   * Get a random button (for execution errors)
   */
  private getRandomButton(original: ActionBundle['button']): ActionBundle['button'] {
    const buttons: ActionBundle['button'][] = ['lp', 'hp', 'lk', 'hk', 'block', 'none'];
    const filtered = buttons.filter(b => b !== original);
    return filtered[Math.floor(Math.random() * filtered.length)];
  }

  /**
   * Get a random direction
   */
  private getRandomDirection(): ActionBundle['direction'] {
    const directions: ActionBundle['direction'][] = ['left', 'right', 'up', 'down', 'neutral'];
    return directions[Math.floor(Math.random() * directions.length)];
  }

  /**
   * Calculate reaction time in frames based on difficulty
   * Difficulty 1: 15 frames (~250ms)
   * Difficulty 5: 6 frames (~100ms)
   * Difficulty 10: 1 frame (~16ms)
   */
  getReactionTimeFrames(): number {
    return Math.max(1, Math.floor(16 - (this.difficulty * 1.5)));
  }

  /**
   * Calculate execution accuracy based on difficulty
   * Difficulty 1: 50%
   * Difficulty 5: 75%
   * Difficulty 10: 100%
   */
  getExecutionAccuracy(): number {
    return Math.min(1.0, 0.45 + (this.difficulty * 0.055));
  }

  /**
   * Calculate probability for an action based on difficulty
   * Used for things like blocking, anti-airs, etc.
   */
  getProbability(baseProbability: number): number {
    // Scale probability based on difficulty
    // Lower difficulty = lower probability
    const scale = this.difficulty / 10;
    return baseProbability * (0.5 + (scale * 0.5));
  }

  /**
   * Add noise to a probability (makes decisions less predictable)
   */
  addNoise(probability: number, noiseAmount: number = 0.1): number {
    const noise = (Math.random() - 0.5) * 2 * noiseAmount;
    return Math.max(0, Math.min(1, probability + noise));
  }

  /**
   * Should perform an action based on probability and difficulty
   */
  shouldAct(probability: number): boolean {
    const adjustedProbability = this.getProbability(probability);
    const noisyProbability = this.addNoise(adjustedProbability);
    return Math.random() < noisyProbability;
  }

  /**
   * Add random delay to reaction (0-N frames based on difficulty)
   */
  getRandomDelay(): number {
    const maxDelay = Math.max(0, 10 - this.difficulty);
    return Math.floor(Math.random() * maxDelay);
  }

  /**
   * Get difficulty level
   */
  getDifficulty(): number {
    return this.difficulty;
  }

  /**
   * Set difficulty level
   */
  setDifficulty(difficulty: number): void {
    this.difficulty = Math.max(1, Math.min(10, difficulty));
  }

  /**
   * Check if should make a "mistake" (random bad decision)
   * Lower difficulty = more mistakes
   */
  shouldMakeMistake(): boolean {
    const mistakeRate = (11 - this.difficulty) * 0.05; // 50% at diff 1, 5% at diff 10
    return Math.random() < mistakeRate;
  }

  /**
   * Apply timing variance (makes frame-perfect inputs less consistent)
   */
  applyTimingVariance(idealFrame: number): number {
    const variance = Math.max(0, 5 - Math.floor(this.difficulty / 2));
    const offset = Math.floor((Math.random() - 0.5) * 2 * variance);
    return Math.max(0, idealFrame + offset);
  }
}
