/**
 * Scripted Bot
 *
 * A deterministic-ish rule bot intended for playtesting and baseline evaluation.
 * This is separate from the ML pipeline and is selectable in-game via the F2 AI cycle.
 */

import { Observation } from './Observation';
import { AIAction } from './ActionSpace';

export type ScriptedBotVariant = 'easy' | 'tight';

export class ScriptedBot {
  constructor(private variant: ScriptedBotVariant = 'tight') {}

  setVariant(variant: ScriptedBotVariant): void {
    this.variant = variant;
  }

  selectAction(observation: Observation, currentFrame: number): AIAction {
    // Can't act if stunned
    if (observation.selfStunFrames > 0) {
      return AIAction.IDLE;
    }

    return this.variant === 'easy'
      ? this.selectEasy(observation, currentFrame)
      : this.selectTight(observation, currentFrame);
  }

  reset(): void {
    // Stateless; kept for parity with other bots.
  }

  private selectEasy(obs: Observation, currentFrame: number): AIAction {
    const distance = obs.distanceToOpponent;

    // Far: slowly approach.
    if (distance > 0.45) {
      return AIAction.WALK_FORWARD;
    }

    // Mid: approach a bit, otherwise idle.
    if (distance > 0.25) {
      return currentFrame % 10 < 4 ? AIAction.WALK_FORWARD : AIAction.IDLE;
    }

    // Close: mostly block/idle, rare jab.
    const phase = currentFrame % 40;
    if (phase < 6) return AIAction.BLOCK;
    if (phase === 10) return AIAction.LIGHT_PUNCH;
    return AIAction.IDLE;
  }

  private selectTight(obs: Observation, currentFrame: number): AIAction {
    const distance = obs.distanceToOpponent;
    const grounded = obs.selfIsGrounded > 0.5;

    // Far: chase. Occasional jump-in.
    if (distance > 0.40) {
      if (grounded && currentFrame % 120 === 0) {
        return AIAction.JUMP_FORWARD;
      }
      return AIAction.WALK_FORWARD;
    }

    // Mid: walk in + poke string.
    if (distance > 0.22) {
      const phase = currentFrame % 20;
      if (phase < 6) return AIAction.WALK_FORWARD;
      if (phase < 10) return AIAction.LIGHT_KICK;
      if (grounded && phase === 10) return AIAction.JUMP_FORWARD;
      return AIAction.WALK_FORWARD;
    }

    // Close: pressure string.
    const close = currentFrame % 16;
    if (close < 4) return AIAction.LIGHT_PUNCH;
    if (close < 7) return AIAction.LIGHT_KICK;
    if (close < 10) return AIAction.HEAVY_PUNCH;
    if (close < 12) return AIAction.HEAVY_KICK;
    return AIAction.WALK_FORWARD;
  }
}
