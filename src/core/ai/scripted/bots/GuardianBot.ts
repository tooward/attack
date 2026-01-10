/**
 * GuardianBot - Defensive Bot
 * 
 * Style: Turtle / Counter-puncher
 * Behavior:
 * - Blocks 60-70% of attacks (scales with difficulty)
 * - Punishes unsafe moves consistently
 * - Anti-airs jumps with 40-70% success rate
 * - Cautious offense - only attacks when safe
 * - Maintains optimal spacing for defense
 * 
 * Difficulty scaling:
 * - 1-3: Tutorial/Easy - Slow reactions, low block rate
 * - 4-6: Medium - Balanced defense and reactions
 * - 7-10: Hard - Fast reactions, high block rate, consistent punishes
 */

import { GameState } from '../../../interfaces/types';
import { ActionBundle } from '../../../../ml/core/Environment';
import { AdvancedScriptedBot, BotConfig } from '../AdvancedScriptedBot';
import { DefensiveTactics } from '../tactics/DefensiveTactics';

export class GuardianBot extends AdvancedScriptedBot {
  private defensiveTactics: DefensiveTactics;
  private readonly optimalRange: number = 150; // Pixels - preferred fighting distance

  constructor(difficulty: number = 5) {
    const config: BotConfig = {
      name: 'Guardian',
      style: 'defensive',
      difficulty,
      blockProbability: 0.4 + (difficulty * 0.03), // 43% at diff 1, 70% at diff 10
      antiAirAccuracy: 0.4 + (difficulty * 0.03),   // 43% at diff 1, 70% at diff 10
    };
    
    super(config);
    this.defensiveTactics = new DefensiveTactics(this.stateReader, this.frameAnalyzer);
  }

  /**
   * Core decision logic for GuardianBot
   * 
   * Decision tree:
   * 1. Punish opponent's recovery
   * 2. Anti-air if opponent is jumping
   * 3. Block if opponent is attacking
   * 4. Safe offense if at advantage
   * 5. Maintain spacing
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

    // Priority 1: Punish opponent's recovery
    if (this.frameAnalyzer.isOpponentInRecovery(opponent)) {
      const recovery = this.frameAnalyzer.getOpponentRecoveryFrames(opponent);
      const punish = this.defensiveTactics.calculatePunish(recovery, distance);
      if (punish) {
        return punish;
      }
    }

    // Priority 2: Anti-air if opponent is jumping (with probability based on difficulty)
    if (this.defensiveTactics.shouldAntiAir(opponent, this.config.antiAirAccuracy!)) {
      const antiAir = this.defensiveTactics.antiAir(state, actor, opponent);
      if (antiAir) {
        return antiAir;
      }
    }

    // Priority 3: Block if opponent is attacking (with probability based on difficulty)
    if (this.defensiveTactics.shouldBlock(state, actor, opponent, this.config.blockProbability!)) {
      return this.defensiveTactics.block(opponent);
    }

    // Priority 4: Safe offense if at advantage
    const situation = this.getTacticalSituation();
    if (situation === 'offense') {
      // Only attack if we have frame advantage
      if (this.frameAnalyzer.hasFrameAdvantage()) {
        return this.defensiveTactics.safeAttack(distance);
      }
    }

    // Priority 5: Escape if under pressure and cornered
    if (situation === 'defense' && this.stateReader.isCornered(state, actor)) {
      return this.defensiveTactics.escapePressure(state, actor, opponent);
    }

    // Priority 6: Whiff punish opportunity
    if (this.frameAnalyzer.willMoveWhiff(state, opponent, actor)) {
      const whiffPunish = this.defensiveTactics.whiffPunish(state, actor, opponent);
      if (whiffPunish) {
        return whiffPunish;
      }
    }

    // Priority 7: Maintain spacing (default behavior)
    return this.defensiveTactics.maintainSpacing(state, actor, opponent, this.optimalRange);
  }

  /**
   * Get optimal spacing range for Guardian
   */
  public getOptimalRange(): number {
    return this.optimalRange;
  }

  /**
   * Get current block probability
   */
  public getBlockProbability(): number {
    return this.config.blockProbability!;
  }

  /**
   * Get current anti-air accuracy
   */
  public getAntiAirAccuracy(): number {
    return this.config.antiAirAccuracy!;
  }
}
