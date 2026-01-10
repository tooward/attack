/**
 * FrameDataAnalyzer System
 * 
 * Tracks frame advantage, recovery states, and combat timing.
 * Essential for making frame-perfect decisions and punish opportunities.
 */

import { GameState, FighterState } from '../../../interfaces/types';
import { StateReader } from '../utils/StateReader';

export class FrameDataAnalyzer {
  private stateReader: StateReader;
  private lastState: GameState | null = null;
  private frameAdvantageCache: Map<string, number> = new Map();

  constructor() {
    this.stateReader = new StateReader();
  }

  /**
   * Update analyzer with new state
   */
  update(state: GameState, actorId: string, targetId: string): void {
    this.lastState = state;
    this.updateFrameAdvantage(state, actorId, targetId);
  }

  /**
   * Calculate and cache frame advantage
   */
  private updateFrameAdvantage(state: GameState, actorId: string, targetId: string): void {
    const actor = this.stateReader.getEntity(state, actorId);
    const target = this.stateReader.getEntity(state, targetId);
    
    if (!actor || !target) return;

    const advantage = this.stateReader.getFrameAdvantage(actor, target);
    this.frameAdvantageCache.set(`${actorId}_vs_${targetId}`, advantage);
  }

  /**
   * Get current frame advantage
   */
  getFrameAdvantage(): number {
    const entries = Array.from(this.frameAdvantageCache.values());
    return entries.length > 0 ? entries[0] : 0;
  }

  /**
   * Check if opponent is in recovery
   */
  isOpponentInRecovery(opponent: FighterState): boolean {
    return this.stateReader.isInRecovery(opponent);
  }

  /**
   * Get opponent's recovery frames
   */
  getOpponentRecoveryFrames(opponent: FighterState): number {
    return this.stateReader.getRecoveryFrames(opponent);
  }

  /**
   * Check if this is a punish opportunity
   */
  isPunishable(opponent: FighterState, distance: number): boolean {
    const recovery = this.getOpponentRecoveryFrames(opponent);
    
    // Punishable if:
    // 1. Opponent has significant recovery (>6 frames)
    // 2. We're in range
    return recovery > 6 && distance < 150;
  }

  /**
   * Get optimal punish type based on recovery and distance
   */
  getPunishSeverity(recoveryFrames: number, distance: number): 'heavy' | 'medium' | 'light' | 'none' {
    if (recoveryFrames >= 15 && distance < 80) {
      return 'heavy'; // Big punish
    }
    if (recoveryFrames >= 10 && distance < 100) {
      return 'medium'; // Medium punish
    }
    if (recoveryFrames >= 6 && distance < 120) {
      return 'light'; // Light punish
    }
    return 'none';
  }

  /**
   * Check if we're at frame advantage (our turn to act)
   */
  hasFrameAdvantage(): boolean {
    return this.getFrameAdvantage() > 0;
  }

  /**
   * Check if opponent has frame advantage
   */
  opponentHasAdvantage(): boolean {
    return this.getFrameAdvantage() < -2;
  }

  /**
   * Check if in neutral (no one has significant advantage)
   */
  isNeutral(): boolean {
    const advantage = this.getFrameAdvantage();
    return advantage >= -2 && advantage <= 2;
  }

  /**
   * Estimate blockstun remaining for entity
   */
  getBlockstunFrames(entity: FighterState): number {
    if (!this.stateReader.isBlocking(entity)) {
      return 0;
    }
    return entity.stunFramesRemaining;
  }

  /**
   * Estimate hitstun remaining for entity
   */
  getHitstunFrames(entity: FighterState): number {
    if (!this.stateReader.isStunned(entity) || this.stateReader.isBlocking(entity)) {
      return 0;
    }
    return entity.stunFramesRemaining;
  }

  /**
   * Check if this is a counter-hit opportunity
   * (opponent is starting an attack, vulnerable to interruption)
   */
  isCounterHitOpportunity(opponent: FighterState): boolean {
    // Opponent is attacking but hitboxes not yet active (startup frames)
    return opponent.currentMove !== null && 
           opponent.status === 'attack' &&
           opponent.hitboxes.length === 0 &&
           opponent.moveFrame < 10; // Within startup window
  }

  /**
   * Check if opponent's move is likely to whiff (miss)
   */
  willMoveWhiff(state: GameState, attacker: FighterState, defender: FighterState): boolean {
    if (!attacker.currentMove || attacker.hitboxes.length === 0) {
      return false;
    }

    const distance = this.stateReader.getDistance(attacker, defender);
    
    // Simple heuristic: if distance is large and attacker is using close-range move
    const range = this.stateReader.getRange(distance);
    const isCloseRangeMove = attacker.currentMove.includes('lp') || 
                             attacker.currentMove.includes('lk');
    
    return range !== 'close' && isCloseRangeMove;
  }

  /**
   * Get move startup estimate (how many frames until attack is active)
   */
  getStartupFrames(entity: FighterState): number {
    if (!entity.currentMove || entity.hitboxes.length > 0) {
      return 0; // Already active or not attacking
    }
    
    // Rough estimates based on move type
    const move = entity.currentMove;
    if (move.includes('lp') || move.includes('lk')) return 4;
    if (move.includes('hp') || move.includes('hk')) return 8;
    if (move.includes('special')) return 12;
    
    return 6; // Default
  }

  /**
   * Calculate time to impact (frames until opponent's attack hits)
   */
  getTimeToImpact(state: GameState, attacker: FighterState, defender: FighterState): number {
    if (!attacker.currentMove) {
      return 999; // Not attacking
    }

    const startup = this.getStartupFrames(attacker);
    const distance = this.stateReader.getDistance(attacker, defender);
    
    // If hitboxes already active, immediate threat
    if (attacker.hitboxes.length > 0) {
      return 1;
    }

    // Factor in distance - projectiles and long-range moves need less startup
    const distanceFactor = distance < 100 ? 0 : Math.floor(distance / 50);
    
    return startup + distanceFactor;
  }

  /**
   * Reset analyzer state
   */
  reset(): void {
    this.lastState = null;
    this.frameAdvantageCache.clear();
  }
}
