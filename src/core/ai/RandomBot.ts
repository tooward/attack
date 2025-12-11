/**
 * Random Bot
 * Simple AI that takes random actions with basic constraints
 */

import { Observation } from './Observation';
import { AIAction, getAllActions } from './ActionSpace';

export class RandomBot {
  private lastActionFrame: number = 0;
  private actionCooldown: number = 10; // Min frames between actions
  private currentAction: AIAction = AIAction.IDLE;
  private actionDuration: number = 0;

  /**
   * Select next action based on observation
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

    // Cooldown check
    if (currentFrame - this.lastActionFrame < this.actionCooldown) {
      return AIAction.IDLE;
    }

    // Pick random action
    const allActions = getAllActions();
    const action = allActions[Math.floor(Math.random() * allActions.length)];

    // Set action duration (hold for random frames)
    this.actionDuration = Math.floor(Math.random() * 15) + 5; // 5-20 frames
    this.currentAction = action;
    this.lastActionFrame = currentFrame;

    return action;
  }

  /**
   * Reset bot state (for new round)
   */
  reset(): void {
    this.lastActionFrame = 0;
    this.currentAction = AIAction.IDLE;
    this.actionDuration = 0;
  }
}
