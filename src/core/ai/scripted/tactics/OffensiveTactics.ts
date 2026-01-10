/**
 * OffensiveTactics Module
 * 
 * Offensive combat tactics for bots:
 * - Frame traps (pressure with small gaps)
 * - Mix-ups (high/low/throw variations)
 * - Combo execution
 * - Pressure strings
 * - Tick throws
 * - Aggressive approaches
 */

import { GameState, FighterState } from '../../../interfaces/types';
import { ActionBundle } from '../../../../ml/core/Environment';
import { StateReader } from '../utils/StateReader';
import { FrameDataAnalyzer } from '../systems/FrameDataAnalyzer';

export class OffensiveTactics {
  private lastMixupChoice: 'high' | 'low' | 'throw' | null = null;
  private pressureCount: number = 0;

  constructor(
    private stateReader: StateReader,
    private frameAnalyzer: FrameDataAnalyzer
  ) {}

  /**
   * Frame trap - attack with small gap to catch opponent pressing buttons
   */
  public frameTrap(
    state: GameState,
    actor: FighterState,
    opponent: FighterState
  ): ActionBundle | null {
    // Only frame trap if opponent is in blockstun or just recovered
    const blockstun = this.frameAnalyzer.getBlockstunFrames(opponent);
    
    if (blockstun > 0 && blockstun < 5) {
      // Attack just as blockstun ends to catch mashing
      return { direction: 'neutral', button: 'lp', holdDuration: 0 };
    }

    return null;
  }

  /**
   * Mix-up attack - randomize between high, low, and throw
   */
  public mixupAttack(
    distance: number,
    mixupRate: number = 0.6
  ): ActionBundle {
    // Decide on mix-up type
    const rand = Math.random();
    let choice: 'high' | 'low' | 'throw';

    if (rand < 0.33) {
      choice = 'high';
    } else if (rand < 0.66) {
      choice = 'low';
    } else {
      choice = 'throw';
    }

    // Avoid repeating same mix-up twice
    if (choice === this.lastMixupChoice && Math.random() > mixupRate) {
      choice = choice === 'high' ? 'low' : 'high';
    }

    this.lastMixupChoice = choice;

    switch (choice) {
      case 'high':
        return { direction: 'neutral', button: 'lp', holdDuration: 0 };
      case 'low':
        return { direction: 'down', button: 'lk', holdDuration: 0 };
      case 'throw':
        // Throw is Light Punch at close range
        return distance < 60 
          ? { direction: 'neutral', button: 'lp', holdDuration: 0 }
          : { direction: 'neutral', button: 'lk', holdDuration: 0 };
    }
  }

  /**
   * Pressure string - sequence of attacks to keep opponent blocking
   */
  public pressureString(pressurePhase: number): ActionBundle {
    // 3-hit pressure string: LP -> LK -> LP
    const phase = pressurePhase % 9;
    
    if (phase < 3) {
      return { direction: 'neutral', button: 'lp', holdDuration: 0 };
    } else if (phase < 6) {
      return { direction: 'neutral', button: 'lk', holdDuration: 0 };
    } else {
      return { direction: 'neutral', button: 'lp', holdDuration: 0 };
    }
  }

  /**
   * Tick throw - attack then immediately throw
   */
  public tickThrow(state: GameState, actor: FighterState, opponent: FighterState): ActionBundle {
    const distance = this.stateReader.getDistance(actor, opponent);
    
    if (distance < 60) {
      // Close enough for throw
      this.pressureCount++;
      
      // Throw after every 2-3 hits
      if (this.pressureCount >= 2 && Math.random() > 0.5) {
        this.pressureCount = 0;
        return { direction: 'neutral', button: 'lp', holdDuration: 0 }; // Throw
      }
    }

    // Continue pressure
    return { direction: 'neutral', button: 'lp', holdDuration: 0 };
  }

  /**
   * Combo starter - optimal combo based on range
   */
  public comboStarter(distance: number, hasAdvantage: boolean): ActionBundle | null {
    if (!hasAdvantage) return null;

    const range = this.stateReader.getRange(distance);

    switch (range) {
      case 'close':
        // LP -> LK -> HP combo starter
        return { direction: 'neutral', button: 'lp', holdDuration: 0 };
      
      case 'mid':
        // LK -> HP combo
        return { direction: 'neutral', button: 'lk', holdDuration: 0 };
      
      case 'far':
        // Single HP
        return { direction: 'neutral', button: 'hp', holdDuration: 0 };
    }
  }

  /**
   * Combo continuation - follow up after successful hit
   */
  public comboContinuation(comboCount: number, distance: number): ActionBundle | null {
    if (comboCount === 0) return null;

    const range = this.stateReader.getRange(distance);

    // Simple combo chains
    if (comboCount === 1) {
      return { direction: 'neutral', button: 'lk', holdDuration: 0 };
    } else if (comboCount === 2) {
      return { direction: 'neutral', button: 'hp', holdDuration: 0 };
    }

    return null; // End combo
  }

  /**
   * Aggressive approach - close distance quickly
   */
  public aggressiveApproach(
    state: GameState,
    actor: FighterState,
    opponent: FighterState
  ): ActionBundle {
    const distance = this.stateReader.getDistance(actor, opponent);
    const toward = this.stateReader.getDirectionToward(actor, opponent);

    // If far, dash in
    if (distance > 200) {
      return { direction: toward, button: 'none', holdDuration: 3 }; // Dash
    }

    // If mid, walk forward with occasional jump
    if (distance > 120) {
      if (Math.random() < 0.15) {
        // Jump forward 15% of time
        return { direction: 'up', button: 'none', holdDuration: 0 };
      }
      return { direction: toward, button: 'none', holdDuration: 0 };
    }

    // Already close
    return { direction: 'neutral', button: 'none', holdDuration: 0 };
  }

  /**
   * Overhead attack - slow but hits crouching opponents
   */
  public overheadAttack(): ActionBundle {
    // Use jumping attack or standing HP as overhead
    return { direction: 'neutral', button: 'hp', holdDuration: 0 };
  }

  /**
   * Reset pressure - brief pause then continue
   */
  public resetPressure(): ActionBundle {
    return { direction: 'neutral', button: 'none', holdDuration: 2 };
  }

  /**
   * Check if should go for throw mix-up
   */
  public shouldThrow(
    opponent: FighterState,
    distance: number,
    throwRate: number
  ): boolean {
    // Throw if close and opponent is blocking
    return distance < 60 && 
           this.stateReader.isBlocking(opponent) && 
           Math.random() < throwRate;
  }

  /**
   * Check if should do frame trap
   */
  public shouldFrameTrap(
    opponent: FighterState,
    frameTrapRate: number
  ): boolean {
    const blockstun = this.frameAnalyzer.getBlockstunFrames(opponent);
    return blockstun > 0 && blockstun < 5 && Math.random() < frameTrapRate;
  }

  /**
   * Get offensive priority action
   */
  public getOffensivePriority(
    state: GameState,
    actor: FighterState,
    opponent: FighterState,
    config: {
      frameTrapRate: number;
      throwRate: number;
      mixupRate: number;
    }
  ): ActionBundle | null {
    const distance = this.stateReader.getDistance(actor, opponent);

    // Priority 1: Frame trap opportunity
    if (this.shouldFrameTrap(opponent, config.frameTrapRate)) {
      const frameTrap = this.frameTrap(state, actor, opponent);
      if (frameTrap) return frameTrap;
    }

    // Priority 2: Throw mix-up
    if (this.shouldThrow(opponent, distance, config.throwRate)) {
      return this.tickThrow(state, actor, opponent);
    }

    // Priority 3: Combo continuation if already hitting
    const comboCount = this.stateReader.getComboCount(actor);
    if (comboCount > 0) {
      const combo = this.comboContinuation(comboCount, distance);
      if (combo) return combo;
    }

    // Priority 4: Mix-up attack at close range
    if (distance < 100) {
      return this.mixupAttack(distance, config.mixupRate);
    }

    return null; // No offensive action available
  }

  /**
   * Reset internal state
   */
  public reset(): void {
    this.lastMixupChoice = null;
    this.pressureCount = 0;
  }
}
