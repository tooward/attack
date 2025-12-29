/**
 * Personality Bot
 * AI that makes decisions based on personality parameters
 */

import { Observation } from './Observation';
import { AIAction } from './ActionSpace';
import { AIPersonality } from '../interfaces/types';

export class PersonalityBot {
  private lastActionFrame: number = 0;
  private currentAction: AIAction = AIAction.IDLE;
  private actionDuration: number = 0;

  constructor(private personality: AIPersonality) {}

  /**
   * Select action based on personality and observation
   */
  selectAction(observation: Observation, currentFrame: number): AIAction {
    // Can't act if stunned
    if (observation.selfStunFrames > 0) {
      return AIAction.IDLE;
    }

    // Continue current action for its duration
    if (this.actionDuration > 0) {
      this.actionDuration--;
      return this.currentAction;
    }

    // Check if low on stamina (energy) - force rest period
    if (observation.selfEnergy < 20) {
      // Wait for energy to recover before attacking again
      const restChance = 1.0 - (observation.selfEnergy / 20);
      if (Math.random() < restChance) {
        return AIAction.IDLE;
      }
    }

    // Apply reaction time delay (discipline affects reaction)
    // Increased minimum cooldown to prevent button mashing
    const reactionDelay = Math.floor((1 - this.personality.discipline) * 15) + 5;
    if (currentFrame - this.lastActionFrame < reactionDelay) {
      return AIAction.IDLE;
    }

    // Make decision based on observation and personality
    const action = this.decideAction(observation);

    // Set action duration
    this.actionDuration = this.getActionDuration(action);
    this.currentAction = action;
    this.lastActionFrame = currentFrame;

    return action;
  }

  /**
   * Decide action based on personality
   */
  private decideAction(obs: Observation): AIAction {
    const distance = obs.distanceToOpponent;
    const healthRatio = obs.selfHealth;
    const opponentHealth = obs.opponentHealth;
    const damageTaken = 1.0 - healthRatio;

    // Check for tilt (becoming reckless when damaged)
    const isTilted = damageTaken > this.personality.tiltThreshold;

    // If opponent is in hitstun/blockstun, aggressive fighters press advantage
    if (obs.opponentStunFrames > 0 && Math.random() < this.personality.aggression) {
      return this.chooseAttack();
    }

    // Defensive behavior when low health (unless tilted)
    if (healthRatio < 0.3 && Math.random() < this.personality.defenseBias && !isTilted) {
      return Math.random() < 0.5 ? AIAction.BLOCK : AIAction.WALK_BACKWARD;
    }

    // Risk tolerance: attack when at disadvantage
    if (
      opponentHealth > healthRatio &&
      Math.random() > this.personality.riskTolerance
    ) {
      return AIAction.BLOCK;
    }

    // Distance-based decisions with better spacing
    if (distance > 0.5) {
      // Far away - approach or wait in neutral
      if (Math.random() < this.personality.aggression * 0.6) {
        return Math.random() < this.personality.jumpRate 
          ? AIAction.JUMP_FORWARD 
          : AIAction.WALK_FORWARD;
      }
      // Sometimes just wait and observe
      return AIAction.IDLE;
    } else if (distance > 0.35) {
      // Outside attack range - approach cautiously or use spacing tools
      if (Math.random() < this.personality.aggression * 0.5) {
        return AIAction.WALK_FORWARD;
      } else if (Math.random() < 0.3) {
        // Maintain spacing
        return AIAction.WALK_BACKWARD;
      }
      return AIAction.IDLE;
    } else if (distance < 0.1) {
      // Too close - create space or attack
      if (obs.selfEnergy < 30) {
        // Low stamina - retreat to recover
        return Math.random() < 0.7 ? AIAction.WALK_BACKWARD : AIAction.BLOCK;
      } else if (Math.random() < this.personality.aggression * 0.7) {
        return this.chooseAttack();
      } else {
        // Defensive retreat
        return AIAction.WALK_BACKWARD;
      }
    } else if (distance < 0.3) {
      // Mid range - optimal attack range, but respect stamina
      if (obs.selfEnergy < 40 && Math.random() < 0.5) {
        // Low stamina - be cautious
        return Math.random() < 0.6 ? AIAction.IDLE : AIAction.WALK_BACKWARD;
      } else if (Math.random() < this.personality.aggression * 0.6) {
        return this.chooseAttack();
      }
      
      // Use jump occasionally
      if (Math.random() < this.personality.jumpRate) {
        const options = [
          AIAction.JUMP,
          AIAction.JUMP_FORWARD,
          AIAction.JUMP_BACKWARD,
        ];
        return options[Math.floor(Math.random() * options.length)];
      }
      
      return AIAction.IDLE;
    }

    // Default: slight forward pressure or idle
    return Math.random() < 0.3 ? AIAction.WALK_FORWARD : AIAction.IDLE;
  }

  /**
   * Choose an attack based on personality and situation
   */
  private chooseAttack(): AIAction {
    // Weighted attack selection based on personality
    const rand = Math.random();
    
    // High combo ambition = more heavy attacks
    if (rand < this.personality.comboAmbition * 0.3) {
      return AIAction.HEAVY_PUNCH;
    } else if (rand < this.personality.comboAmbition * 0.5) {
      return AIAction.HEAVY_KICK;
    } else if (rand < 0.7) {
      return AIAction.LIGHT_PUNCH;
    } else {
      return AIAction.LIGHT_KICK;
    }
  }

  /**
   * Get how long to hold an action
   */
  private getActionDuration(action: AIAction): number {
    switch (action) {
      case AIAction.WALK_FORWARD:
      case AIAction.WALK_BACKWARD:
        return Math.floor(Math.random() * 30) + 10; // 10-40 frames

      case AIAction.BLOCK:
        return Math.floor(Math.random() * 20) + 15; // 15-35 frames

      case AIAction.CROUCH:
        return Math.floor(Math.random() * 15) + 5; // 5-20 frames

      case AIAction.LIGHT_PUNCH:
      case AIAction.HEAVY_PUNCH:
      case AIAction.LIGHT_KICK:
      case AIAction.HEAVY_KICK:
        return 3; // Just press for a few frames

      case AIAction.JUMP:
      case AIAction.JUMP_FORWARD:
      case AIAction.JUMP_BACKWARD:
        return 1; // Single frame input

      default:
        return 1;
    }
  }

  /**
   * Reset bot state (for new round)
   */
  reset(): void {
    this.lastActionFrame = 0;
    this.currentAction = AIAction.IDLE;
    this.actionDuration = 0;
  }

  /**
   * Update personality (for adaptation)
   */
  updatePersonality(newPersonality: Partial<AIPersonality>): void {
    this.personality = { ...this.personality, ...newPersonality };
  }
}
