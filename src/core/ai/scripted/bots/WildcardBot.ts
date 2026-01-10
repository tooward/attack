/**
 * WildcardBot - Adaptive Mixup Bot
 * 
 * Style: Unpredictable / Adaptive
 * Behavior:
 * - No fixed pattern - randomizes tactics
 * - Style switching every 5-10 seconds
 * - Reads opponent behavior and exploits patterns
 * - High execution - uses optimal combos
 * - Mind games - baits reactions
 * 
 * Difficulty scaling:
 * - 1-3: Random tactics, basic adaptation
 * - 4-6: Better pattern recognition, style variety
 * - 7-10: Advanced exploitation, optimal execution
 */

import { GameState } from '../../../interfaces/types';
import { ActionBundle } from '../../../../ml/core/Environment';
import { AdvancedScriptedBot, BotConfig } from '../AdvancedScriptedBot';
import { DefensiveTactics } from '../tactics/DefensiveTactics';
import { OffensiveTactics } from '../tactics/OffensiveTactics';
import { SpacingTactics } from '../tactics/SpacingTactics';
import { PatternRecognition } from '../systems/PatternRecognition';

type ActiveStyle = 'defensive' | 'aggressive' | 'zoner' | 'random';

export class WildcardBot extends AdvancedScriptedBot {
  private defensiveTactics: DefensiveTactics;
  private offensiveTactics: OffensiveTactics;
  private spacingTactics: SpacingTactics;
  private patternRecognition: PatternRecognition;
  
  private activeStyle: ActiveStyle = 'random';
  private lastStyleChangeFrame: number = 0;
  private styleChangeCooldown: number = 300; // 5 seconds
  private pressurePhase: number = 0;

  constructor(difficulty: number = 5) {
    const config: BotConfig = {
      name: 'Wildcard',
      style: 'mixup',
      difficulty,
      blockProbability: 0.3 + (difficulty * 0.03), // 33% at diff 1, 60% at diff 10
      antiAirAccuracy: 0.4 + (difficulty * 0.03),   // 43% at diff 1, 70% at diff 10
    };
    
    super(config);
    this.defensiveTactics = new DefensiveTactics(this.stateReader, this.frameAnalyzer);
    this.offensiveTactics = new OffensiveTactics(this.stateReader, this.frameAnalyzer);
    this.spacingTactics = new SpacingTactics(this.stateReader, this.frameAnalyzer);
    this.patternRecognition = new PatternRecognition();
  }

  /**
   * Core decision logic for WildcardBot
   * 
   * Decision tree:
   * 1. Analyze opponent patterns
   * 2. Switch style if cooldown elapsed
   * 3. Execute tactics based on active style
   * 4. Exploit detected patterns
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

    // Record opponent's current action for pattern analysis
    const opponentAction = this.stateReader.getLastAction(opponent);
    this.patternRecognition.recordAction(opponentAction);

    const distance = this.stateReader.getDistance(actor, opponent);

    // Check if should switch style
    if (state.frame - this.lastStyleChangeFrame > this.styleChangeCooldown) {
      this.switchStyle(state);
      this.lastStyleChangeFrame = state.frame;
    }

    // Analyze opponent patterns and exploit
    const pattern = this.patternRecognition.detectPattern();
    if (this.shouldExploitPattern(pattern)) {
      const exploit = this.exploitPattern(state, actor, opponent, pattern);
      if (exploit) return exploit;
    }

    // Execute tactics based on active style
    return this.executeStyleTactics(state, actor, opponent, distance);
  }

  /**
   * Switch to a new fighting style
   */
  private switchStyle(state: GameState): void {
    const pattern = this.patternRecognition.detectPattern();
    
    // Counter-pick opponent's style
    if (pattern.isDefensive && Math.random() < 0.6) {
      this.activeStyle = 'aggressive'; // Pressure defensive opponents
    } else if (pattern.isAggressive && Math.random() < 0.6) {
      this.activeStyle = 'defensive'; // Counter aggressive opponents
    } else {
      // Random style selection
      const styles: ActiveStyle[] = ['defensive', 'aggressive', 'zoner', 'random'];
      this.activeStyle = styles[Math.floor(Math.random() * styles.length)];
    }
  }

  /**
   * Execute tactics based on active style
   */
  private executeStyleTactics(
    state: GameState,
    actor: any,
    opponent: any,
    distance: number
  ): ActionBundle {
    switch (this.activeStyle) {
      case 'defensive':
        return this.executeDefensiveStyle(state, actor, opponent, distance);
      
      case 'aggressive':
        return this.executeAggressiveStyle(state, actor, opponent, distance);
      
      case 'zoner':
        return this.executeZonerStyle(state, actor, opponent, distance);
      
      case 'random':
      default:
        // Completely random
        return this.executeRandomStyle(state, actor, opponent, distance);
    }
  }

  /**
   * Execute defensive style tactics
   */
  private executeDefensiveStyle(state: any, actor: any, opponent: any, distance: number): ActionBundle {
    const defensiveAction = this.defensiveTactics.getDefensivePriority(
      state,
      actor,
      opponent,
      {
        blockProbability: 0.7,
        antiAirAccuracy: this.config.antiAirAccuracy!,
      }
    );

    if (defensiveAction) return defensiveAction;

    return this.defensiveTactics.maintainSpacing(state, actor, opponent, 150);
  }

  /**
   * Execute aggressive style tactics
   */
  private executeAggressiveStyle(state: any, actor: any, opponent: any, distance: number): ActionBundle {
    if (distance > 200) {
      return this.offensiveTactics.aggressiveApproach(state, actor, opponent);
    }

    const offensiveAction = this.offensiveTactics.getOffensivePriority(
      state,
      actor,
      opponent,
      {
        frameTrapRate: 0.7,
        throwRate: 0.4,
        mixupRate: 0.8,
      }
    );

    if (offensiveAction) {
      this.pressurePhase++;
      return offensiveAction;
    }

    this.pressurePhase++;
    return this.offensiveTactics.pressureString(this.pressurePhase);
  }

  /**
   * Execute zoner style tactics
   */
  private executeZonerStyle(state: any, actor: any, opponent: any, distance: number): ActionBundle {
    const spacingAction = this.spacingTactics.getSpacingPriority(
      state,
      actor,
      opponent,
      {
        optimalDistance: 250,
        projectileRate: 0.8,
        pokeRate: 0.5,
      }
    );

    if (spacingAction) return spacingAction;

    return this.spacingTactics.maintainZoneDistance(state, actor, opponent, 250);
  }

  /**
   * Execute random style (completely unpredictable)
   */
  private executeRandomStyle(state: any, actor: any, opponent: any, distance: number): ActionBundle {
    const rand = Math.random();
    
    if (rand < 0.4) {
      // Offensive
      return this.executeAggressiveStyle(state, actor, opponent, distance);
    } else if (rand < 0.7) {
      // Defensive
      return this.executeDefensiveStyle(state, actor, opponent, distance);
    } else {
      // Zoning
      return this.executeZonerStyle(state, actor, opponent, distance);
    }
  }

  /**
   * Check if should exploit detected pattern
   */
  private shouldExploitPattern(pattern: any): boolean {
    return pattern.isPredictable && pattern.exploitRecommendation !== 'none';
  }

  /**
   * Exploit opponent's pattern
   */
  private exploitPattern(
    state: any,
    actor: any,
    opponent: any,
    pattern: any
  ): ActionBundle | null {
    const distance = this.stateReader.getDistance(actor, opponent);

    switch (pattern.exploitRecommendation) {
      case 'throw':
        // Opponent blocks too much
        if (distance < 60) {
          return { direction: 'neutral', button: 'lp', holdDuration: 0 };
        }
        break;
      
      case 'overhead':
        // Opponent crouches too much
        return this.offensiveTactics.overheadAttack();
      
      case 'pressure':
        // Opponent is too passive
        return this.executeAggressiveStyle(state, actor, opponent, distance);
      
      case 'bait':
        // Opponent is predictable - bait and punish
        if (distance < 200) {
          return this.defensiveTactics.safeAttack(distance);
        }
        break;
      
      case 'low':
        // Opponent always blocks high
        return { direction: 'down', button: 'lk', holdDuration: 0 };
    }

    return null;
  }

  /**
   * Get current active style
   */
  public getActiveStyle(): ActiveStyle {
    return this.activeStyle;
  }

  /**
   * Get pattern analysis
   */
  public getPatternAnalysis() {
    return this.patternRecognition.detectPattern();
  }

  /**
   * Reset bot state
   */
  public reset(): void {
    super.reset();
    this.pressurePhase = 0;
    this.lastStyleChangeFrame = 0;
    this.activeStyle = 'random';
    this.defensiveTactics = new DefensiveTactics(this.stateReader, this.frameAnalyzer);
    this.offensiveTactics.reset();
    this.spacingTactics.reset();
    this.patternRecognition.reset();
  }
}
