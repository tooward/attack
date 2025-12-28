/**
 * Reward Function
 * 
 * Dense reward shaping for reinforcement learning.
 * Provides tactical signals, positioning rewards, and anti-degenerate penalties.
 */

import { GameState, FighterState, FighterStatus } from '../../core/interfaces/types';
import { CombatEvent } from './Environment';

/**
 * Reward weights configuration
 */
export interface RewardWeights {
  // Outcome rewards
  damageDealt: number;
  damageTaken: number;
  knockdown: number;
  roundWin: number;
  roundLoss: number;

  // Tactical rewards
  attackIntent: number;
  hitConfirm: number;
  successfulBlock: number;
  whiffPunish: number;
  antiAir: number;
  throwTech: number;

  // Positioning
  corneringOpponent: number;
  escapingCorner: number;
  rangeControl: number;

  // Anti-degenerate
  stalling: number;
  moveDiversity: number;
  repetitionPenalty: number;
  timeoutPenalty: number;

  // Style-specific (overrideable)
  aggression: number;
  defense: number;
  zoning: number;
}

/**
 * Default reward weights
 * 
 * Tuned to encourage active, engaging gameplay.
 * Increased rewards for offensive actions to avoid passive play.
 */
export const DEFAULT_REWARD_WEIGHTS: RewardWeights = {
  damageDealt: 10.0,           // Massive reward for damage - primary learning signal
  damageTaken: -2.0,           // Punish taking damage to encourage defense
  knockdown: 30.0,             // Huge reward for knockdowns
  roundWin: 100.0,
  roundLoss: -100.0,

  attackIntent: 0.02,          // Tiny bonus for starting an attack when close
  hitConfirm: 15.0,            // Huge reward for landing hits
  successfulBlock: 3.0,        // Good reward for blocking
  whiffPunish: 20.0,           // Massive reward for punishing whiffs
  antiAir: 12.0,               // Big reward for anti-airs
  throwTech: 5.0,              // Good reward for throw techs

  corneringOpponent: 0.1,      // Small positioning reward
  escapingCorner: 0.2,         // Small escape reward
  rangeControl: 0.05,          // Minimal range reward

  stalling: -1.0,              // Heavy penalty for stalling
  moveDiversity: 0.2,          // Small variety bonus
  repetitionPenalty: -3.0,     // Heavy repetition penalty
  timeoutPenalty: -100.0,

  aggression: 0.0,             // REMOVED - was drowning out combat signals
  defense: 0.0,
  zoning: 0.0,
};

/**
 * Reward state tracking
 */
export interface RewardState {
  lastHealth: Map<string, number>;
  lastPosition: Map<string, { x: number; y: number }>;
  lastComboCount: Map<string, number>;
  recentMoves: Map<string, string[]>; // Circular buffer of move IDs
  stallingFrames: Map<string, number>;
  lastEngagementFrame: number;
  arenaWidth: number;
  episodeStartFrame: number;
}

/**
 * Reward breakdown for debugging
 */
export interface RewardBreakdown {
  total: number;
  damageDealt: number;
  damageTaken: number;
  knockdown: number;
  roundOutcome: number;
  attackIntent: number;
  hitConfirm: number;
  successfulBlock: number;
  whiffPunish: number;
  antiAir: number;
  cornering: number;
  rangeControl: number;
  stalling: number;
  diversity: number;
  repetition: number;
  style: number;
}

/**
 * Reward Function
 */
export class RewardFunction {
  private weights: RewardWeights;
  private state: RewardState;

  // Optional shaping to reduce "do nothing" collapse early in an episode.
  // Disabled by default; configure via configureEarlyEngagement().
  private earlyEngagement: {
    frames: number;
    penalty: number; // applied per frame when passive/far
  } = { frames: 0, penalty: 0 };

  constructor(weights: RewardWeights = DEFAULT_REWARD_WEIGHTS) {
    this.weights = weights;
    this.state = this.initializeState();
  }

  /**
   * Initialize reward state
   */
  private initializeState(): RewardState {
    return {
      lastHealth: new Map(),
      lastPosition: new Map(),
      lastComboCount: new Map(),
      recentMoves: new Map(),
      stallingFrames: new Map(),
      lastEngagementFrame: 0,
      arenaWidth: 2000,
      episodeStartFrame: 0,
    };
  }

  /**
   * Reset reward state
   */
  reset(gameState: GameState): void {
    this.state = this.initializeState();
    this.state.arenaWidth = gameState.arena.rightBound - gameState.arena.leftBound;
    this.state.episodeStartFrame = gameState.frame;

    for (const entity of gameState.entities) {
      this.state.lastHealth.set(entity.id, entity.health);
      this.state.lastPosition.set(entity.id, { x: entity.position.x, y: entity.position.y });
      this.state.lastComboCount.set(entity.id, 0);
      this.state.recentMoves.set(entity.id, []);
      this.state.stallingFrames.set(entity.id, 0);
    }
  }

  /**
   * Calculate reward for a single step
   */
  calculateReward(
    prevState: GameState,
    currState: GameState,
    entityId: string,
    events: CombatEvent[]
  ): number {
    const breakdown = this.calculateRewardBreakdown(prevState, currState, entityId, events);
    return breakdown.total;
  }

  /**
   * Calculate detailed reward breakdown
   */
  calculateRewardBreakdown(
    prevState: GameState,
    currState: GameState,
    entityId: string,
    events: CombatEvent[]
  ): RewardBreakdown {
    const entity = currState.entities.find(e => e.id === entityId);
    const prevEntity = prevState.entities.find(e => e.id === entityId);
    const opponent = currState.entities.find(e => e.id !== entityId);
    const prevOpponent = prevState.entities.find(e => e.id !== entityId);

    if (!entity || !prevEntity || !opponent || !prevOpponent) {
      return this.createEmptyBreakdown();
    }

    const breakdown: RewardBreakdown = {
      total: 0,
      damageDealt: 0,
      damageTaken: 0,
      knockdown: 0,
      roundOutcome: 0,
      attackIntent: 0,
      hitConfirm: 0,
      successfulBlock: 0,
      whiffPunish: 0,
      antiAir: 0,
      cornering: 0,
      rangeControl: 0,
      stalling: 0,
      diversity: 0,
      repetition: 0,
      style: 0,
    };

    // Damage dealt
    const damageDealt = prevOpponent.health - opponent.health;
    if (damageDealt > 0) {
      breakdown.damageDealt = damageDealt * this.weights.damageDealt;
    }

    // Damage taken
    const damageTaken = prevEntity.health - entity.health;
    if (damageTaken > 0) {
      breakdown.damageTaken = damageTaken * this.weights.damageTaken;
    }

    // Knockdown
    const knockdownEvents = events.filter(
      e => e.type === 'knockdown' && e.attacker === entityId
    );
    if (knockdownEvents.length > 0) {
      breakdown.knockdown = knockdownEvents.length * this.weights.knockdown;
    }

    // Round outcome
    if (currState.round.winner === entityId) {
      breakdown.roundOutcome = this.weights.roundWin;
    } else if (currState.round.winner && currState.round.winner !== entityId) {
      breakdown.roundOutcome = this.weights.roundLoss;
    }

    // Round timeout
    if (currState.round.timeRemaining <= 0 && !currState.round.winner) {
      breakdown.roundOutcome = this.weights.timeoutPenalty;
    }

    // Hit confirm (combo started)
    const comboStarted = entity.comboCount > 0 && 
                        (this.state.lastComboCount.get(entityId) || 0) === 0;
    if (comboStarted) {
      breakdown.hitConfirm = this.weights.hitConfirm;
    }

    // Successful block
    if (entity.status === FighterStatus.BLOCKSTUN && prevEntity.status !== FighterStatus.BLOCKSTUN) {
      breakdown.successfulBlock = this.weights.successfulBlock;
    }

    // Anti-air
    const antiAirEvents = events.filter(
      e => e.type === 'antiair' && e.attacker === entityId
    );
    if (antiAirEvents.length > 0) {
      breakdown.antiAir = antiAirEvents.length * this.weights.antiAir;
    }

    // Reward initiating an attack while in engagement range.
    // One-time on the transition into ATTACK to avoid per-frame reward farming.
    if (this.weights.attackIntent !== 0) {
      const engagementDistance = this.state.arenaWidth * 0.4;
      const distance = Math.abs(entity.position.x - opponent.position.x);
      const enteredAttack = prevEntity.status !== FighterStatus.ATTACK && entity.status === FighterStatus.ATTACK;
      if (enteredAttack && distance < engagementDistance) {
        breakdown.attackIntent = this.weights.attackIntent;
      }
    }

    // Positioning rewards
    breakdown.cornering = this.calculateCorneringReward(entity, opponent);
    breakdown.rangeControl = this.calculateRangeControlReward(prevEntity, entity, prevOpponent, opponent);
    
    // Anti-degenerate penalties
    breakdown.stalling = this.calculateStallingPenalty(entity, opponent, currState.frame);
    breakdown.diversity = this.calculateDiversityReward(entity);
    breakdown.repetition = this.calculateRepetitionPenalty(entity);

    // Style-specific rewards
    breakdown.style = this.calculateStyleReward(prevEntity, entity, opponent);

    // Sum all components
    breakdown.total = 
      breakdown.damageDealt +
      breakdown.damageTaken +
      breakdown.knockdown +
      breakdown.roundOutcome +
      breakdown.attackIntent +
      breakdown.hitConfirm +
      breakdown.successfulBlock +
      breakdown.whiffPunish +
      breakdown.cornering +
      breakdown.rangeControl +
      breakdown.stalling +
      breakdown.diversity +
      breakdown.repetition +
      breakdown.style;

    // Update state
    this.updateState(entity, opponent, currState.frame);

    return breakdown;
  }

  /**
   * Update reward weights (for style conditioning)
   */
  updateWeights(newWeights: Partial<RewardWeights>): void {
    this.weights = { ...this.weights, ...newWeights };
  }

  /**
   * Get current weights
   */
  getWeights(): RewardWeights {
    return { ...this.weights };
  }

  /**
   * Configure an optional early-episode penalty that applies when the agent is
   * far and not engaging. Useful during early training to avoid passive local optima.
   *
   * Set frames=0 or penalty=0 to disable.
   */
  configureEarlyEngagement(frames: number, penalty: number): void {
    this.earlyEngagement = {
      frames: Math.max(0, Math.trunc(frames)),
      penalty: Number.isFinite(penalty) ? penalty : 0,
    };
  }

  /**
   * Calculate cornering reward
   */
  private calculateCorneringReward(self: FighterState, opponent: FighterState): number {
    const cornerThreshold = this.state.arenaWidth * 0.15; // 15% from edge
    const leftBound = 0;
    const rightBound = this.state.arenaWidth;

    let reward = 0;

    // Check if opponent is cornered
    const oppDistanceToWall = Math.min(
      opponent.position.x - leftBound,
      rightBound - opponent.position.x
    );

    if (oppDistanceToWall < cornerThreshold) {
      reward += this.weights.corneringOpponent;
    }

    // Check if self is cornered (need to escape)
    const selfDistanceToWall = Math.min(
      self.position.x - leftBound,
      rightBound - self.position.x
    );

    if (selfDistanceToWall < cornerThreshold) {
      // Reward escaping corner (moving away from wall)
      const lastPos = this.state.lastPosition.get(self.id);
      if (lastPos) {
        const wasCloserToWall = Math.min(
          lastPos.x - leftBound,
          rightBound - lastPos.x
        ) < selfDistanceToWall;

        if (wasCloserToWall) {
          reward += this.weights.escapingCorner;
        }
      }
    }

    return reward;
  }

  /**
   * Calculate a small dense reward for closing distance when fighters are far apart.
   *
   * This helps avoid the "do nothing and lose" local optimum by giving the agent
   * a gradient toward engagement even before it reliably lands hits.
   */
  private calculateRangeControlReward(
    prevSelf: FighterState,
    currSelf: FighterState,
    prevOpponent: FighterState,
    currOpponent: FighterState
  ): number {
    if (this.weights.rangeControl === 0) return 0;

    const engagementDistance = this.state.arenaWidth * 0.4;
    const prevDistance = Math.abs(prevSelf.position.x - prevOpponent.position.x);
    const currDistance = Math.abs(currSelf.position.x - currOpponent.position.x);

    // Only shape when we're far; when close, combat signals dominate.
    if (currDistance < engagementDistance) return 0;

    // Reward closing distance (clamped, normalized).
    const delta = prevDistance - currDistance; // >0 when closing
    const clamped = Math.max(0, Math.min(20, delta));
    return (clamped / 50) * this.weights.rangeControl;
  }

  /**
   * Calculate stalling penalty
   */
  private calculateStallingPenalty(
    self: FighterState,
    opponent: FighterState,
    currentFrame: number
  ): number {
    const engagementDistance = this.state.arenaWidth * 0.4; // 40% of arena width
    const distance = Math.abs(self.position.x - opponent.position.x);
    const isMoving = Math.abs(self.velocity.x) > 0.1 || Math.abs(self.velocity.y) > 0.1;
    const isAttacking = self.status === FighterStatus.ATTACK;

    const lastPos = this.state.lastPosition.get(self.id);
    const lastOppPos = this.state.lastPosition.get(opponent.id);
    const prevDistance = (lastPos && lastOppPos) ? Math.abs(lastPos.x - lastOppPos.x) : undefined;
    const closingDistance = prevDistance !== undefined ? (prevDistance - distance) > 0.5 : false;

    // Check if fighters are engaged
    const isEngaged = distance < engagementDistance || isAttacking;

    if (isEngaged) {
      this.state.lastEngagementFrame = currentFrame;
      this.state.stallingFrames.set(self.id, 0);
      return 0;
    }

    // Far and not engaging: penalize even if "moving" unless distance is actually closing.
    // This closes the loophole where jump/wiggle avoids stalling while staying far forever.
    if (distance > engagementDistance && !isAttacking && !closingDistance) {
      const stallingCount = (this.state.stallingFrames.get(self.id) || 0) + 1;
      this.state.stallingFrames.set(self.id, stallingCount);
      return this.weights.stalling;
    }

    // Not engaged - check for stalling
    if (!isMoving && !isAttacking) {
      const stallingCount = (this.state.stallingFrames.get(self.id) || 0) + 1;
      this.state.stallingFrames.set(self.id, stallingCount);
      return this.weights.stalling;
    }

    // Optional early-episode penalty for passive play at long range.
    // This is intentionally conservative: it only triggers when far AND not attacking,
    // and either standing still or increasing distance (runaway).
    if (this.earlyEngagement.frames > 0 && this.earlyEngagement.penalty !== 0) {
      const episodeFrame = currentFrame - this.state.episodeStartFrame;
      if (episodeFrame >= 0 && episodeFrame < this.earlyEngagement.frames) {
        if (distance > engagementDistance && !isAttacking) {
          if (prevDistance !== undefined) {
            const increasingDistance = distance > prevDistance + 0.5;
            const notClosing = (prevDistance - distance) <= 0.5;
            if (increasingDistance || notClosing) {
              return this.earlyEngagement.penalty;
            }
          } else if (!isMoving) {
            return this.earlyEngagement.penalty;
          }
        }
      }
    }

    return 0;
  }

  /**
   * Calculate move diversity reward
   */
  private calculateDiversityReward(self: FighterState): number {
    if (!self.currentMove) return 0;

    const recentMoves = this.state.recentMoves.get(self.id) || [];
    const windowSize = 30; // Track last 30 moves

    // Update move history
    recentMoves.push(self.currentMove);
    if (recentMoves.length > windowSize) {
      recentMoves.shift();
    }
    this.state.recentMoves.set(self.id, recentMoves);

    // Calculate unique moves in window
    const uniqueMoves = new Set(recentMoves).size;
    const diversityRatio = uniqueMoves / Math.min(recentMoves.length, 10); // Normalize to 10 moves

    return diversityRatio * this.weights.moveDiversity;
  }

  /**
   * Calculate repetition penalty
   */
  private calculateRepetitionPenalty(self: FighterState): number {
    if (!self.currentMove) return 0;

    const recentMoves = this.state.recentMoves.get(self.id) || [];
    
    // Check for same move repeated 3+ times
    if (recentMoves.length >= 3) {
      const lastThree = recentMoves.slice(-3);
      const allSame = lastThree.every(m => m === lastThree[0]);

      if (allSame) {
        return this.weights.repetitionPenalty;
      }
    }

    return 0;
  }

  /**
   * Calculate style-specific reward
   */
  private calculateStyleReward(
    prevSelf: FighterState,
    currSelf: FighterState,
    opponent: FighterState
  ): number {
    let reward = 0;

    // Aggression: reward forward movement
    if (this.weights.aggression !== 0) {
      const movedForward = currSelf.facing === 1 
        ? currSelf.position.x > prevSelf.position.x
        : currSelf.position.x < prevSelf.position.x;

      if (movedForward) {
        reward += this.weights.aggression;
      }
    }

    // Defense: reward blocking and spacing
    if (this.weights.defense !== 0) {
      if (currSelf.status === FighterStatus.BLOCK || currSelf.status === FighterStatus.BLOCKSTUN) {
        reward += this.weights.defense;
      }
    }

    // Zoning: reward maintaining distance
    if (this.weights.zoning !== 0) {
      const distance = Math.abs(currSelf.position.x - opponent.position.x);
      const optimalZoneDistance = this.state.arenaWidth * 0.5; // Mid-far range
      const isInZoneRange = distance > optimalZoneDistance * 0.7;

      if (isInZoneRange) {
        reward += this.weights.zoning;
      }
    }

    return reward;
  }

  /**
   * Update internal state
   */
  private updateState(self: FighterState, opponent: FighterState, frame: number): void {
    this.state.lastHealth.set(self.id, self.health);
    this.state.lastPosition.set(self.id, { x: self.position.x, y: self.position.y });
    this.state.lastComboCount.set(self.id, self.comboCount);
  }

  /**
   * Create empty breakdown
   */
  private createEmptyBreakdown(): RewardBreakdown {
    return {
      total: 0,
      damageDealt: 0,
      damageTaken: 0,
      knockdown: 0,
      roundOutcome: 0,
      attackIntent: 0,
      hitConfirm: 0,
      successfulBlock: 0,
      whiffPunish: 0,
      antiAir: 0,
      cornering: 0,
      rangeControl: 0,
      stalling: 0,
      diversity: 0,
      repetition: 0,
      style: 0,
    };
  }
}
