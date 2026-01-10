/**
 * TacticianBot - Zoner Bot
 * 
 * Style: Zoner / Keep-away
 * Behavior:
 * - Maintains distance at projectile range
 * - Projectile spam with safe timing
 * - Whiff punishes and pokes
 * - Anti-approach tools
 * - Space control and corner escape
 * 
 * Difficulty scaling:
 * - 1-3: Basic zoning, predictable projectiles
 * - 4-6: Mixed projectiles, better spacing
 * - 7-10: Optimal zoning, consistent whiff punishes
 */

import { GameState } from '../../../interfaces/types';
import { ActionBundle } from '../../../../ml/core/Environment';
import { AdvancedScriptedBot, BotConfig } from '../AdvancedScriptedBot';
import { SpacingTactics } from '../tactics/SpacingTactics';
import { DefensiveTactics } from '../tactics/DefensiveTactics';

export class TacticianBot extends AdvancedScriptedBot {
  private spacingTactics: SpacingTactics;
  private defensiveTactics: DefensiveTactics;
  private readonly optimalDistance: number = 250; // Pixels - projectile sweet spot
  private readonly projectileRate: number;
  private readonly pokeRate: number;

  constructor(difficulty: number = 5) {
    const config: BotConfig = {
      name: 'Tactician',
      style: 'zoner',
      difficulty,
      blockProbability: 0.35 + (difficulty * 0.03), // 38% at diff 1, 65% at diff 10
      antiAirAccuracy: 0.35 + (difficulty * 0.03),   // 38% at diff 1, 65% at diff 10
    };
    
    super(config);
    this.spacingTactics = new SpacingTactics(this.stateReader, this.frameAnalyzer);
    this.defensiveTactics = new DefensiveTactics(this.stateReader, this.frameAnalyzer);
    
    // Scale zoning capabilities with difficulty
    this.projectileRate = 0.3 + (difficulty * 0.05); // 35% at diff 1, 80% at diff 10
    this.pokeRate = 0.2 + (difficulty * 0.03);       // 23% at diff 1, 50% at diff 10
  }

  /**
   * Core decision logic for TacticianBot
   * 
   * Decision tree:
   * 1. Escape corner if trapped
   * 2. Anti-approach if opponent closing in
   * 3. Whiff punish opportunities
   * 4. Fire projectiles at range
   * 5. Defensive actions if pressured
   * 6. Maintain zoning distance
   */
  protected makeDecision(state: GameState, actorId: string, targetId: string): ActionBundle {
    const actor = this.stateReader.getEntity(state, actorId);
    const opponent = this.stateReader.getEntity(state, targetId);
    
    if (!actor || !opponent) {
      return this.getIdleAction();
    }

    // Can't act if stunned
    if (!this.stateReader.canAct(actor)) {
      return this.getIdleAction();
    }

    const distance = this.stateReader.getDistance(actor, opponent);

    // Priority 1: Use spacing tactics
    const spacingAction = this.spacingTactics.getSpacingPriority(
      state,
      actor,
      opponent,
      {
        optimalDistance: this.optimalDistance,
        projectileRate: this.projectileRate,
        pokeRate: this.pokeRate,
      }
    );

    if (spacingAction) {
      return spacingAction;
    }

    // Priority 2: Defensive actions if opponent gets in
    if (distance < 150) {
      const defensiveAction = this.defensiveTactics.getDefensivePriority(
        state,
        actor,
        opponent,
        {
          blockProbability: this.config.blockProbability!,
          antiAirAccuracy: this.config.antiAirAccuracy!,
        }
      );

      if (defensiveAction) {
        return defensiveAction;
      }
    }

    // Priority 3: Reset to optimal distance
    return this.spacingTactics.maintainZoneDistance(
      state,
      actor,
      opponent,
      this.optimalDistance
    );
  }

  /**
   * Get optimal zoning distance
   */
  public getOptimalDistance(): number {
    return this.optimalDistance;
  }

  /**
   * Get projectile rate
   */
  public getProjectileRate(): number {
    return this.projectileRate;
  }

  /**
   * Get poke rate
   */
  public getPokeRate(): number {
    return this.pokeRate;
  }

  /**
   * Reset bot state
   */
  public reset(): void {
    super.reset();
    this.spacingTactics.reset();
  }
}
