/**
 * DefensiveTactics Module
 * 
 * Defensive combat tactics for bots:
 * - Blocking (high/low)
 * - Anti-airing
 * - Punishing unsafe moves
 * - Spacing and footsies
 * - Counter-attacking
 */

import { GameState, FighterState } from '../../../interfaces/types';
import { ActionBundle } from '../../../../ml/core/Environment';
import { StateReader } from '../utils/StateReader';
import { FrameDataAnalyzer } from '../systems/FrameDataAnalyzer';

export class DefensiveTactics {
  constructor(
    private stateReader: StateReader,
    private frameAnalyzer: FrameDataAnalyzer
  ) {}

  /**
   * Calculate optimal punish combo based on recovery frames and distance
   */
  public calculatePunish(recoveryFrames: number, distance: number): ActionBundle | null {
    const severity = this.frameAnalyzer.getPunishSeverity(recoveryFrames, distance);
    
    switch (severity) {
      case 'heavy':
        // Big punish - Heavy Punch
        return { direction: 'neutral', button: 'hp', holdDuration: 0 };
      
      case 'medium':
        // Medium punish - Light Kick
        return { direction: 'neutral', button: 'lk', holdDuration: 0 };
      
      case 'light':
        // Light punish - Light Punch
        return { direction: 'neutral', button: 'lp', holdDuration: 0 };
      
      case 'none':
      default:
        return null; // Not punishable
    }
  }

  /**
   * Perform anti-air based on opponent's jump trajectory and distance
   */
  public antiAir(state: GameState, actor: FighterState, opponent: FighterState): ActionBundle | null {
    const distance = this.stateReader.getDistance(actor, opponent);
    
    // Only anti-air if opponent is jumping
    if (!this.stateReader.isJumping(opponent)) {
      return null;
    }

    // If opponent is close, use standing Heavy Punch
    if (distance < 120) {
      return { direction: 'neutral', button: 'hp', holdDuration: 0 };
    }
    
    // If opponent is mid-range, use crouching Heavy Punch
    if (distance < 200) {
      return { direction: 'down', button: 'hp', holdDuration: 0 };
    }
    
    // Too far to anti-air effectively
    return null;
  }

  /**
   * Block opponent's attack (high or low)
   */
  public block(opponent: FighterState): ActionBundle {
    const move = opponent.currentMove || '';
    
    // Block low against crouching attacks or light kicks
    if (move.includes('crouch') || move.includes('lk')) {
      return { direction: 'down', button: 'block', holdDuration: 3 };
    }
    
    // Block high against everything else
    return { direction: 'neutral', button: 'block', holdDuration: 3 };
  }

  /**
   * Safe attack - use frame-advantaged normals
   */
  public safeAttack(distance: number): ActionBundle {
    const range = this.stateReader.getRange(distance);
    
    switch (range) {
      case 'close':
        // Close: Light Punch (fastest, safest)
        return { direction: 'neutral', button: 'lp', holdDuration: 0 };
      
      case 'mid':
        // Mid: Light Kick (good range, safe on block)
        return { direction: 'neutral', button: 'lk', holdDuration: 0 };
      
      case 'far':
      default:
        // Far: Walk forward
        return { direction: 'right', button: 'none', holdDuration: 0 };
    }
  }

  /**
   * Maintain optimal spacing (stay at preferred distance)
   */
  public maintainSpacing(
    state: GameState,
    actor: FighterState, 
    opponent: FighterState, 
    optimalRange: number
  ): ActionBundle {
    const distance = this.stateReader.getDistance(actor, opponent);
    const toward = this.stateReader.getDirectionToward(actor, opponent);
    const away = this.stateReader.getDirectionAway(actor, opponent);
    
    // Too close: back up
    if (distance < optimalRange - 30) {
      return { direction: away, button: 'none', holdDuration: 0 };
    }
    
    // Too far: move in
    if (distance > optimalRange + 30) {
      return { direction: toward, button: 'none', holdDuration: 0 };
    }
    
    // Perfect range: stay neutral
    return { direction: 'neutral', button: 'none', holdDuration: 0 };
  }

  /**
   * Counter-attack - quick attack after blocking
   */
  public counterAttack(state: GameState, actor: FighterState, opponent: FighterState): ActionBundle | null {
    // Check if opponent just finished attacking and is in recovery
    if (this.frameAnalyzer.isOpponentInRecovery(opponent)) {
      const distance = this.stateReader.getDistance(actor, opponent);
      const recovery = this.frameAnalyzer.getOpponentRecoveryFrames(opponent);
      
      return this.calculatePunish(recovery, distance);
    }
    
    return null;
  }

  /**
   * Whiff punish - attack when opponent misses
   */
  public whiffPunish(state: GameState, actor: FighterState, opponent: FighterState): ActionBundle | null {
    const distance = this.stateReader.getDistance(actor, opponent);
    
    // Check if opponent's move will whiff
    if (this.frameAnalyzer.willMoveWhiff(state, opponent, actor)) {
      // Move forward and punish
      if (distance > 80) {
        // Too far, need to close distance first
        return { direction: this.stateReader.getDirectionToward(actor, opponent), button: 'none', holdDuration: 0 };
      }
      
      // In range, attack
      return { direction: 'neutral', button: 'lk', holdDuration: 0 };
    }
    
    return null;
  }

  /**
   * Escape pressure - get out of disadvantage
   */
  public escapePressure(
    state: GameState,
    actor: FighterState, 
    opponent: FighterState
  ): ActionBundle {
    const isCornered = this.stateReader.isCornered(state, actor);
    
    if (isCornered) {
      // Cornered: try to jump out
      const away = this.stateReader.getDirectionAway(actor, opponent);
      return { direction: away === 'left' ? 'up' : 'up', button: 'none', holdDuration: 0 };
    }
    
    // Not cornered: backdash
    const away = this.stateReader.getDirectionAway(actor, opponent);
    return { direction: away, button: 'none', holdDuration: 2 };
  }

  /**
   * Tech throw - escape throw attempt (simplified)
   */
  public techThrow(): ActionBundle {
    // In a real implementation, this would detect throw startup
    // For now, just return a light punch (throw tech)
    return { direction: 'neutral', button: 'lp', holdDuration: 0 };
  }

  /**
   * Wake-up defense - defensive option after knockdown
   */
  public wakeupDefense(state: GameState, actor: FighterState): ActionBundle {
    // Simple wake-up: block
    return { direction: 'neutral', button: 'block', holdDuration: 5 };
  }

  /**
   * Check if should block based on opponent state
   */
  public shouldBlock(
    state: GameState,
    actor: FighterState,
    opponent: FighterState,
    blockProbability: number
  ): boolean {
    // Always block if opponent is attacking and we're not at advantage
    if (this.stateReader.isAttacking(opponent)) {
      const advantage = this.stateReader.getFrameAdvantage(actor, opponent);
      if (advantage <= 0) {
        return Math.random() < blockProbability;
      }
    }
    
    return false;
  }

  /**
   * Check if should anti-air
   */
  public shouldAntiAir(
    opponent: FighterState,
    antiAirAccuracy: number
  ): boolean {
    return this.stateReader.isJumping(opponent) && Math.random() < antiAirAccuracy;
  }

  /**
   * Get defensive priority action (highest priority defensive option)
   */
  public getDefensivePriority(
    state: GameState,
    actor: FighterState,
    opponent: FighterState,
    config: {
      blockProbability: number;
      antiAirAccuracy: number;
    }
  ): ActionBundle | null {
    const distance = this.stateReader.getDistance(actor, opponent);
    
    // Priority 1: Punish recovery
    if (this.frameAnalyzer.isOpponentInRecovery(opponent)) {
      const recovery = this.frameAnalyzer.getOpponentRecoveryFrames(opponent);
      const punish = this.calculatePunish(recovery, distance);
      if (punish) return punish;
    }
    
    // Priority 2: Anti-air
    if (this.shouldAntiAir(opponent, config.antiAirAccuracy)) {
      const antiAir = this.antiAir(state, actor, opponent);
      if (antiAir) return antiAir;
    }
    
    // Priority 3: Block
    if (this.shouldBlock(state, actor, opponent, config.blockProbability)) {
      return this.block(opponent);
    }
    
    return null; // No defensive action needed
  }
}
