/**
 * GuardianBot - Defensive/Counter-puncher Bot
 * 
 * Behavior:
 * - Blocks 60-70% of incoming attacks
 * - Punishes unsafe moves (recovery > 15 frames)
 * - Anti-airs jumps with 70% accuracy
 * - Cautious offense - only attacks when safe
 * - Maintains optimal spacing
 * 
 * Difficulty Range: 3-7 (Medium to Hard)
 */

import { GameState, FighterStatus } from '../../../interfaces/types';
import { ActionBundle } from '../../../../ml/core/Environment';
import { AdvancedScriptedBot, BotConfig } from '../AdvancedScriptedBot';

export class GuardianBot extends AdvancedScriptedBot {
  private consecutiveBlocks: number = 0;
  
  constructor(difficulty: number = 5) {
    const config: BotConfig = {
      name: 'Guardian',
      style: 'defensive',
      difficulty,
      blockProbability: 0.4 + (difficulty * 0.03),        // 43% at diff 1, 70% at diff 10
      antiAirAccuracy: 0.4 + (difficulty * 0.03),         // 43% at diff 1, 70% at diff 10
    };
    
    super(config);
  }

  /**
   * Core decision logic for GuardianBot
   * Overrides AdvancedScriptedBot.makeDecision()
   */
  protected makeDecision(state: GameState, actorId: string, targetId: string): ActionBundle {
    const actor = this.stateReader.getEntity(state, actorId);
    const opponent = this.stateReader.getEntity(state, targetId);
    
    if (!actor || !opponent) {
      return { direction: 'neutral', button: 'none', holdDuration: 0 };
    }
    
    const distance = this.stateReader.getDistance(actor, opponent);
    const closeRange = distance < 150;
    const midRange = distance >= 150 && distance < 300;
    const farRange = distance >= 300;

    // Priority 1: Punish recovery (opponent stuck in move recovery)
    if (this.isOpponentRecovering(opponent)) {
      const punish = this.calculatePunish(distance);
      if (punish) {
        return punish;
      }
    }

    // Priority 2: Anti-air (opponent jumping)
    if (this.isOpponentJumping(opponent)) {
      const shouldAntiAir = Math.random() < (this.config.antiAirAccuracy || 0.5);
      if (shouldAntiAir && closeRange) {
        // Use HP as anti-air
        return { direction: 'neutral', button: 'hp', holdDuration: 8 };
      }
    }

    // Priority 3: Block incoming attacks
    if (this.isOpponentAttacking(opponent) && closeRange) {
      const shouldBlock = Math.random() < (this.config.blockProbability || 0.5);
      if (shouldBlock) {
        this.consecutiveBlocks++;
        return { direction: 'neutral', button: 'block', holdDuration: 10 };
      }
    }

    // Priority 4: Safe offense when at advantage
    if (this.consecutiveBlocks >= 2 && closeRange) {
      // After blocking 2+ attacks, throw (using LK as placeholder)
      this.consecutiveBlocks = 0;
      return { direction: 'neutral', button: 'lk', holdDuration: 6 };
    }

    const frameAdvantage = this.estimateFrameAdvantage(opponent);
    if (frameAdvantage > 0 && closeRange) {
      // Safe to attack - use light attacks
      const attackChoice = Math.random() < 0.7 ? 'lp' : 'lk';
      return { direction: 'neutral', button: attackChoice, holdDuration: 8 };
    }

    // Priority 5: Maintain spacing
    if (closeRange && frameAdvantage <= 0) {
      // Back away if not at advantage
      const backDir = actor.facing === 1 ? 'left' : 'right';
      return { direction: backDir, button: 'none', holdDuration: 15 };
    }

    if (midRange || farRange) {
      // Walk toward opponent to close distance
      const opponentRelativeX = opponent.position.x - actor.position.x;
      const forwardDir = opponentRelativeX > 0 ? 'right' : 'left';
      return { direction: forwardDir, button: 'none', holdDuration: 10 };
    }

    return { direction: 'neutral', button: 'none', holdDuration: 0 };
  }

  /**
   * Detect if opponent is in recovery frames
   */
  private isOpponentRecovering(opponent: any): boolean {
    // Opponent is in hitstun or blockstun - can't act
    if (opponent.stunFramesRemaining > 0) {
      return false;
    }

    // Check if opponent is in recovery phase of an attack
    // Status ATTACK and moveFrame > active frames means recovery
    if (opponent.status === FighterStatus.ATTACK) {
      // Estimate: if moveFrame > 10, likely in recovery
      return opponent.moveFrame > 10;
    }

    return false;
  }

  /**
   * Detect if opponent is jumping
   */
  private isOpponentJumping(opponent: any): boolean {
    return opponent.status === FighterStatus.JUMP;
  }

  /**
   * Detect if opponent is currently attacking
   */
  private isOpponentAttacking(opponent: any): boolean {
    return opponent.status === FighterStatus.ATTACK && opponent.moveFrame < 10;
  }

  /**
   * Calculate optimal punish based on distance
   */
  private calculatePunish(distance: number): ActionBundle | null {
    // Close range: Heavy punch for max damage
    if (distance < 150) {
      return { direction: 'neutral', button: 'hp', holdDuration: 8 };
    }

    // Medium range: Light punch reaches
    if (distance < 250) {
      return { direction: 'neutral', button: 'lp', holdDuration: 8 };
    }

    // Too far to punish
    return null;
  }

  /**
   * Estimate frame advantage (positive = advantage, negative = disadvantage)
   */
  private estimateFrameAdvantage(opponent: any): number {
    // If opponent is stunned, we have advantage
    if (opponent.stunFramesRemaining > 0) {
      return opponent.stunFramesRemaining;
    }

    // Neutral situation (would need to track action history for accurate frame advantage)
    return 0;
  }

  /**
   * Get bot statistics (for testing/debugging)
   */
  getStats() {
    return {
      name: 'GuardianBot',
      difficulty: this.config.difficulty,
      blockProbability: this.config.blockProbability,
      antiAirAccuracy: this.config.antiAirAccuracy,
      consecutiveBlocks: this.consecutiveBlocks,
    };
  }
}
