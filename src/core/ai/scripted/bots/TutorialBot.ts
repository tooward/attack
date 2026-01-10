/**
 * TutorialBot - Beginner-Friendly Teaching Bot
 * 
 * Style: Passive / Educational
 * Behavior:
 * - Slow, telegraphed attacks for learning
 * - Punishable on block to teach blocking
 * - Leaves openings to teach spacing
 * - Scales up difficulty as player improves
 * - Rewards good fundamentals
 * 
 * Difficulty scaling:
 * - 1-3: Very passive, large openings
 * - 4-6: Moderate pressure, clear patterns
 * - 7-10: Advanced teaching (frame traps, mind games)
 */

import { GameState } from '../../../interfaces/types';
import { ActionBundle } from '../../../../ml/core/Environment';
import { AdvancedScriptedBot, BotConfig } from '../AdvancedScriptedBot';
import { DefensiveTactics } from '../tactics/DefensiveTactics';

type TeachingPhase = 'blocking' | 'anti-air' | 'spacing' | 'punishing' | 'pressure';

export class TutorialBot extends AdvancedScriptedBot {
  private defensiveTactics: DefensiveTactics;
  
  private currentPhase: TeachingPhase = 'blocking';
  private phaseStartFrame: number = 0;
  private phaseDuration: number = 600; // 10 seconds per phase
  private attackCooldown: number = 0;
  private lastPunishedFrame: number = 0;
  private consecutivePlayerHits: number = 0;

  constructor(difficulty: number = 1) {
    const config: BotConfig = {
      name: 'Tutorial',
      style: 'tutorial',
      difficulty,
      blockProbability: 0.1 + (difficulty * 0.05), // 15% at diff 1, 60% at diff 10
      antiAirAccuracy: 0.2 + (difficulty * 0.04),   // 24% at diff 1, 60% at diff 10
    };
    
    super(config);
    this.defensiveTactics = new DefensiveTactics(this.stateReader, this.frameAnalyzer);
  }

  /**
   * Core decision logic for TutorialBot
   * 
   * Decision tree:
   * 1. Check if in recovery (vulnerable state for teaching punishing)
   * 2. Reward player success (back off when punished)
   * 3. Execute teaching phase tactics
   * 4. Advance to next phase if duration elapsed
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

    // Track player success
    this.trackPlayerPerformance(state, opponent);

    // Reward player for punishing
    if (this.shouldRewardPlayer(state)) {
      return this.rewardPlayerSuccess(state, actor, opponent, distance);
    }

    // Advance to next teaching phase
    if (state.frame - this.phaseStartFrame > this.phaseDuration) {
      this.advancePhase();
      this.phaseStartFrame = state.frame;
    }

    // Execute current teaching phase
    return this.executeTeachingPhase(state, actor, opponent, distance);
  }

  /**
   * Execute tactics for current teaching phase
   */
  private executeTeachingPhase(
    state: any,
    actor: any,
    opponent: any,
    distance: number
  ): ActionBundle {
    switch (this.currentPhase) {
      case 'blocking':
        return this.teachBlocking(state, actor, opponent, distance);
      
      case 'anti-air':
        return this.teachAntiAir(state, actor, opponent, distance);
      
      case 'spacing':
        return this.teachSpacing(state, actor, opponent, distance);
      
      case 'punishing':
        return this.teachPunishing(state, actor, opponent, distance);
      
      case 'pressure':
        return this.teachPressureDefense(state, actor, opponent, distance);
      
      default:
        return this.getIdleAction();
    }
  }

  /**
   * Teach blocking fundamentals
   * - Slow predictable attacks
   * - Unsafe on block for easy punishes
   */
  private teachBlocking(state: any, actor: any, opponent: any, distance: number): ActionBundle {
    if (this.attackCooldown > 0) {
      this.attackCooldown--;
      return this.getIdleAction();
    }

    if (distance > 300) {
      return this.moveTowards(state, actor, opponent);
    }

    // Telegraph attack with pause
    if (distance < 150 && Math.random() < 0.3) {
      this.attackCooldown = 60; // 1 second cooldown
      return { direction: 'neutral', button: 'hp', holdDuration: 0 }; // Heavy punch - unsafe
    }

    return this.getIdleAction();
  }

  /**
   * Teach anti-air fundamentals
   * - Jump at predictable times
   * - Pause before jumping
   */
  private teachAntiAir(state: any, actor: any, opponent: any, distance: number): ActionBundle {
    if (this.attackCooldown > 0) {
      this.attackCooldown--;
      return this.getIdleAction();
    }

    if (distance > 300) {
      return this.moveTowards(state, actor, opponent);
    }

    // Telegraph jump with pause
    if (distance < 200 && Math.random() < 0.25) {
      this.attackCooldown = 90; // 1.5 second cooldown
      return { direction: 'up', button: 'none', holdDuration: 30 }; // Jump
    }

    return this.getIdleAction();
  }

  /**
   * Teach spacing fundamentals
   * - Whiff attacks at range
   * - Reward good spacing with vulnerability
   */
  private teachSpacing(state: any, actor: any, opponent: any, distance: number): ActionBundle {
    if (this.attackCooldown > 0) {
      this.attackCooldown--;
      return this.getIdleAction();
    }

    // Whiff attack if opponent is out of range
    if (distance > 120 && distance < 200 && Math.random() < 0.4) {
      this.attackCooldown = 45; // Leave opening
      return { direction: 'neutral', button: 'hk', holdDuration: 0 }; // Heavy kick - whiffs
    }

    // Move to mid range
    if (distance > 250) {
      return this.moveTowards(state, actor, opponent);
    } else if (distance < 100) {
      return this.moveAway(state, actor, opponent);
    }

    return this.getIdleAction();
  }

  /**
   * Teach punishing fundamentals
   * - Do unsafe moves frequently
   * - Leave large recovery windows
   */
  private teachPunishing(state: any, actor: any, opponent: any, distance: number): ActionBundle {
    if (this.attackCooldown > 0) {
      this.attackCooldown--;
      return this.getIdleAction();
    }

    if (distance > 300) {
      return this.moveTowards(state, actor, opponent);
    }

    // Do unsafe special moves
    if (distance < 150 && Math.random() < 0.35) {
      this.attackCooldown = 60; // Large punish window
      return { direction: 'down', button: 'hk', holdDuration: 5 }; // Unsafe special
    }

    return this.getIdleAction();
  }

  /**
   * Teach pressure defense
   * - Apply pressure strings
   * - Leave small gaps for escape
   */
  private teachPressureDefense(state: any, actor: any, opponent: any, distance: number): ActionBundle {
    if (this.attackCooldown > 0) {
      this.attackCooldown--;
      return this.getIdleAction();
    }

    if (distance > 300) {
      return this.moveTowards(state, actor, opponent);
    }

    // Simple pressure string with gaps
    if (distance < 100 && Math.random() < 0.5) {
      const attacks = ['lp', 'lp', 'hp'];
      const index = state.frame % attacks.length;
      this.attackCooldown = 15; // Small gap between attacks
      return { direction: 'neutral', button: attacks[index] as any, holdDuration: 0 };
    }

    return this.getIdleAction();
  }

  /**
   * Track player's performance
   */
  private trackPlayerPerformance(state: any, opponent: any): void {
    const opponentAttacking = this.stateReader.isAttacking(opponent);
    
    if (opponentAttacking) {
      this.consecutivePlayerHits++;
    } else {
      this.consecutivePlayerHits = 0;
    }
  }

  /**
   * Check if should reward player for good play
   */
  private shouldRewardPlayer(state: any): boolean {
    // Player landed a punish recently
    const recentlyPunished = state.frame - this.lastPunishedFrame < 30;
    
    // Player is doing well
    const playerDoingWell = this.consecutivePlayerHits >= 3;
    
    return recentlyPunished || playerDoingWell;
  }

  /**
   * Reward player by backing off and being passive
   */
  private rewardPlayerSuccess(state: any, actor: any, opponent: any, distance: number): ActionBundle {
    // Back away to give player space
    if (distance < 200) {
      return this.moveAway(state, actor, opponent);
    }

    // Block occasionally to show defensive option
    if (Math.random() < 0.3) {
      return { direction: 'neutral', button: 'block', holdDuration: 10 };
    }

    return this.getIdleAction();
  }

  /**
   * Advance to next teaching phase
   */
  private advancePhase(): void {
    const phases: TeachingPhase[] = ['blocking', 'anti-air', 'spacing', 'punishing', 'pressure'];
    const currentIndex = phases.indexOf(this.currentPhase);
    const nextIndex = (currentIndex + 1) % phases.length;
    this.currentPhase = phases[nextIndex];
    this.attackCooldown = 60; // Pause before new phase
  }

  /**
   * Move towards opponent
   */
  private moveTowards(state: any, actor: any, opponent: any): ActionBundle {
    const actorX = actor.position?.x || 0;
    const opponentX = opponent.position?.x || 0;
    
    return {
      direction: actorX < opponentX ? 'right' : 'left',
      button: 'none',
      holdDuration: 0,
    };
  }

  /**
   * Move away from opponent
   */
  private moveAway(state: any, actor: any, opponent: any): ActionBundle {
    const actorX = actor.position?.x || 0;
    const opponentX = opponent.position?.x || 0;
    
    return {
      direction: actorX < opponentX ? 'left' : 'right',
      button: 'none',
      holdDuration: 0,
    };
  }

  /**
   * Get current teaching phase
   */
  public getCurrentPhase(): TeachingPhase {
    return this.currentPhase;
  }

  /**
   * Set specific teaching phase
   */
  public setPhase(phase: TeachingPhase): void {
    this.currentPhase = phase;
    this.phaseStartFrame = 0;
  }

  /**
   * Reset bot state
   */
  public reset(): void {
    super.reset();
    this.currentPhase = 'blocking';
    this.phaseStartFrame = 0;
    this.attackCooldown = 0;
    this.lastPunishedFrame = 0;
    this.consecutivePlayerHits = 0;
  }
}
