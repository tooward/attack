/**
 * SpacingTactics Module
 * 
 * Spacing and zoning tactics for bots:
 * - Projectile patterns
 * - Zone control
 * - Keep-away strategies
 * - Anti-approach tools
 * - Whiff punishing
 * - Space resetting
 */

import { GameState, FighterState } from '../../../interfaces/types';
import { ActionBundle } from '../../../../ml/core/Environment';
import { StateReader } from '../utils/StateReader';
import { FrameDataAnalyzer } from '../systems/FrameDataAnalyzer';

export class SpacingTactics {
  private lastProjectileFrame: number = 0;
  private projectileCount: number = 0;

  constructor(
    private stateReader: StateReader,
    private frameAnalyzer: FrameDataAnalyzer
  ) {}

  /**
   * Fire projectile (Hadoken-style)
   */
  public fireProjectile(state: GameState, actor: FighterState): ActionBundle | null {
    // Cooldown check (don't spam too fast)
    const frameSinceLastProjectile = state.frame - this.lastProjectileFrame;
    if (frameSinceLastProjectile < 60) { // At least 1 second between projectiles
      return null;
    }

    this.lastProjectileFrame = state.frame;
    this.projectileCount++;

    // Use special move (when implemented) or HP as placeholder
    return { direction: 'neutral', button: 'hp', holdDuration: 0 };
  }

  /**
   * Maintain zoning distance
   */
  public maintainZoneDistance(
    state: GameState,
    actor: FighterState,
    opponent: FighterState,
    optimalDistance: number
  ): ActionBundle {
    const distance = this.stateReader.getDistance(actor, opponent);
    const away = this.stateReader.getDirectionAway(actor, opponent);
    const toward = this.stateReader.getDirectionToward(actor, opponent);

    // Too close: back up
    if (distance < optimalDistance - 50) {
      return { direction: away, button: 'none', holdDuration: 2 }; // Backdash
    }

    // Too far: move in slightly
    if (distance > optimalDistance + 80) {
      return { direction: toward, button: 'none', holdDuration: 0 };
    }

    // Good distance: hold ground
    return { direction: 'neutral', button: 'none', holdDuration: 0 };
  }

  /**
   * Anti-approach tool (counter opponent trying to close distance)
   */
  public antiApproach(
    state: GameState,
    actor: FighterState,
    opponent: FighterState
  ): ActionBundle | null {
    // Check if opponent is approaching
    if (!this.stateReader.isApproaching(actor, opponent)) {
      return null;
    }

    const distance = this.stateReader.getDistance(actor, opponent);

    // If jumping in, anti-air
    if (this.stateReader.isJumping(opponent) && distance < 200) {
      return { direction: 'neutral', button: 'hp', holdDuration: 0 };
    }

    // If dashing in, use poke
    if (distance < 150) {
      return { direction: 'neutral', button: 'lk', holdDuration: 0 };
    }

    return null;
  }

  /**
   * Whiff punish - attack when opponent misses
   */
  public whiffPunish(
    state: GameState,
    actor: FighterState,
    opponent: FighterState
  ): ActionBundle | null {
    const distance = this.stateReader.getDistance(actor, opponent);

    // Check if opponent's move will whiff
    if (!this.frameAnalyzer.willMoveWhiff(state, opponent, actor)) {
      return null;
    }

    // If in range, punish with fast normal
    if (distance < 120) {
      return { direction: 'neutral', button: 'lk', holdDuration: 0 };
    }

    // If far, walk forward to get in range
    if (distance < 200) {
      return { 
        direction: this.stateReader.getDirectionToward(actor, opponent), 
        button: 'none', 
        holdDuration: 0 
      };
    }

    return null;
  }

  /**
   * Poke - safe long-range attack
   */
  public poke(distance: number): ActionBundle {
    const range = this.stateReader.getRange(distance);

    if (range === 'far' || range === 'mid') {
      // Long poke (LK or HP)
      return Math.random() < 0.5
        ? { direction: 'neutral', button: 'lk', holdDuration: 0 }
        : { direction: 'neutral', button: 'hp', holdDuration: 0 };
    }

    // Close poke
    return { direction: 'neutral', button: 'lp', holdDuration: 0 };
  }

  /**
   * Space reset - back off to reset to neutral
   */
  public spaceReset(
    state: GameState,
    actor: FighterState,
    opponent: FighterState
  ): ActionBundle {
    const away = this.stateReader.getDirectionAway(actor, opponent);
    const isCornered = this.stateReader.isCornered(state, actor);

    if (isCornered) {
      // Jump away if cornered
      return { direction: 'up', button: 'none', holdDuration: 0 };
    }

    // Backdash
    return { direction: away, button: 'none', holdDuration: 3 };
  }

  /**
   * Corner escape - get out when trapped in corner
   */
  public cornerEscape(
    state: GameState,
    actor: FighterState,
    opponent: FighterState
  ): ActionBundle {
    const distance = this.stateReader.getDistance(actor, opponent);
    const away = this.stateReader.getDirectionAway(actor, opponent);

    // If opponent is close, jump over
    if (distance < 100) {
      return { direction: away === 'left' ? 'up' : 'up', button: 'none', holdDuration: 0 };
    }

    // Walk out
    return { direction: away, button: 'none', holdDuration: 0 };
  }

  /**
   * Retreat - back up while staying grounded
   */
  public retreat(
    actor: FighterState,
    opponent: FighterState
  ): ActionBundle {
    const away = this.stateReader.getDirectionAway(actor, opponent);
    return { direction: away, button: 'none', holdDuration: 0 };
  }

  /**
   * Zone with normals - use long-range attacks to control space
   */
  public zoneWithNormals(distance: number): ActionBundle {
    // Vary between pokes
    const rand = Math.random();
    
    if (rand < 0.4) {
      return { direction: 'neutral', button: 'lk', holdDuration: 0 };
    } else if (rand < 0.7) {
      return { direction: 'neutral', button: 'hp', holdDuration: 0 };
    } else {
      return { direction: 'down', button: 'lk', holdDuration: 0 }; // Sweep
    }
  }

  /**
   * Check if should fire projectile
   */
  public shouldFireProjectile(
    state: GameState,
    distance: number,
    projectileRate: number
  ): boolean {
    const frameSinceLastProjectile = state.frame - this.lastProjectileFrame;
    const cooldownPassed = frameSinceLastProjectile > 60;
    const goodRange = distance > 200 && distance < 500;
    
    return cooldownPassed && goodRange && Math.random() < projectileRate;
  }

  /**
   * Check if should anti-approach
   */
  public shouldAntiApproach(
    actor: FighterState,
    opponent: FighterState
  ): boolean {
    return this.stateReader.isApproaching(actor, opponent);
  }

  /**
   * Get spacing priority action
   */
  public getSpacingPriority(
    state: GameState,
    actor: FighterState,
    opponent: FighterState,
    config: {
      optimalDistance: number;
      projectileRate: number;
      pokeRate: number;
    }
  ): ActionBundle | null {
    const distance = this.stateReader.getDistance(actor, opponent);

    // Priority 1: Escape corner if trapped
    if (this.stateReader.isCornered(state, actor) && distance < 150) {
      return this.cornerEscape(state, actor, opponent);
    }

    // Priority 2: Anti-approach if opponent coming in
    if (this.shouldAntiApproach(actor, opponent)) {
      const antiApproach = this.antiApproach(state, actor, opponent);
      if (antiApproach) return antiApproach;
    }

    // Priority 3: Whiff punish opportunity
    const whiff = this.whiffPunish(state, actor, opponent);
    if (whiff) return whiff;

    // Priority 4: Fire projectile
    if (this.shouldFireProjectile(state, distance, config.projectileRate)) {
      const projectile = this.fireProjectile(state, actor);
      if (projectile) return projectile;
    }

    // Priority 5: Poke to control space
    if (distance < 300 && Math.random() < config.pokeRate) {
      return this.poke(distance);
    }

    // Priority 6: Maintain distance
    return this.maintainZoneDistance(state, actor, opponent, config.optimalDistance);
  }

  /**
   * Reset internal state
   */
  public reset(): void {
    this.lastProjectileFrame = 0;
    this.projectileCount = 0;
  }
}
