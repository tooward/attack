/**
 * AggressorBot - Rushdown Bot
 * 
 * Style: Rushdown / Pressure
 * Behavior:
 * - Constant pressure with frame traps
 * - Mix-up heavy (high/low/throw)
 * - Combo chains when landing hits
 * - Reads and adapts to opponent's defensive habits
 * - Risk-taking for momentum
 * 
 * Difficulty scaling:
 * - 1-3: Basic pressure, predictable mix-ups
 * - 4-6: Frame traps, varied mix-ups
 * - 7-10: Complex patterns, reads opponent habits
 */

import { GameState } from '../../../interfaces/types';
import { ActionBundle } from '../../../../ml/core/Environment';
import { AdvancedScriptedBot, BotConfig } from '../AdvancedScriptedBot';
import { OffensiveTactics } from '../tactics/OffensiveTactics';

export class AggressorBot extends AdvancedScriptedBot {
  private offensiveTactics: OffensiveTactics;
  private pressurePhase: number = 0;
  private readonly frameTrapRate: number;
  private readonly throwRate: number;
  private readonly mixupRate: number;

  constructor(difficulty: number = 5) {
    const config: BotConfig = {
      name: 'Aggressor',
      style: 'rushdown',
      difficulty,
      blockProbability: 0.1 + (difficulty * 0.01), // 11% at diff 1, 20% at diff 10 (rarely blocks)
      antiAirAccuracy: 0.3 + (difficulty * 0.02),   // 32% at diff 1, 50% at diff 10
    };
    
    super(config);
    this.offensiveTactics = new OffensiveTactics(this.stateReader, this.frameAnalyzer);
    
    // Scale offensive capabilities with difficulty
    this.frameTrapRate = 0.3 + (difficulty * 0.04); // 34% at diff 1, 70% at diff 10
    this.throwRate = 0.2 + (difficulty * 0.02);     // 22% at diff 1, 40% at diff 10
    this.mixupRate = 0.3 + (difficulty * 0.05);     // 35% at diff 1, 80% at diff 10
  }

  /**
   * Core decision logic for AggressorBot
   * 
   * Decision tree:
   * 1. Approach if far
   * 2. Frame trap if opponent in blockstun
   * 3. Throw mix-up if close and blocking
   * 4. Combo if already hitting
   * 5. Pressure string / mix-up attack
   * 6. Aggressive approach
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
    const range = this.stateReader.getRange(distance);

    // Priority 1: Close distance if far
    if (range === 'far') {
      return this.offensiveTactics.aggressiveApproach(state, actor, opponent);
    }

    // Priority 2: Use offensive priority system
    const offensiveAction = this.offensiveTactics.getOffensivePriority(
      state,
      actor,
      opponent,
      {
        frameTrapRate: this.frameTrapRate,
        throwRate: this.throwRate,
        mixupRate: this.mixupRate,
      }
    );

    if (offensiveAction) {
      this.pressurePhase++;
      return offensiveAction;
    }

    // Priority 3: Continue pressure string if mid-range
    if (range === 'mid') {
      this.pressurePhase++;
      return this.offensiveTactics.pressureString(this.pressurePhase);
    }

    // Priority 4: Aggressive approach to get back in
    if (range !== 'close') {
      return this.offensiveTactics.aggressiveApproach(state, actor, opponent);
    }

    // Priority 5: Close range pressure
    this.pressurePhase++;
    return this.offensiveTactics.mixupAttack(distance, this.mixupRate);
  }

  /**
   * Get frame trap rate
   */
  public getFrameTrapRate(): number {
    return this.frameTrapRate;
  }

  /**
   * Get throw rate
   */
  public getThrowRate(): number {
    return this.throwRate;
  }

  /**
   * Get mix-up rate
   */
  public getMixupRate(): number {
    return this.mixupRate;
  }

  /**
   * Reset bot state
   */
  public reset(): void {
    super.reset();
    this.pressurePhase = 0;
    this.offensiveTactics.reset();
  }
}
