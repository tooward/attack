/**
 * PatternRecognition Module
 * 
 * Tracks and analyzes opponent behavior patterns to enable adaptive tactics:
 * - Action frequency analysis
 * - Defensive bias detection
 * - Attack pattern recognition
 * - Exploit recommendations
 */

import { FighterState } from '../../../interfaces/types';

export interface BehaviorStats {
  blockRate: number;       // 0-1: How often opponent blocks
  attackRate: number;      // 0-1: How often opponent attacks
  jumpRate: number;        // 0-1: How often opponent jumps
  forwardRate: number;     // 0-1: How often opponent moves forward
  backwardRate: number;    // 0-1: How often opponent moves backward
  crouchRate: number;      // 0-1: How often opponent crouches
  totalActions: number;    // Total actions recorded
}

export interface PatternAnalysis {
  isDefensive: boolean;    // Opponent blocks/backs up frequently
  isAggressive: boolean;   // Opponent attacks/advances frequently
  isPredictable: boolean;  // Opponent repeats same actions
  isZoner: boolean;        // Opponent uses projectiles and spacing
  isJumper: boolean;       // Opponent jumps frequently
  dominantAction: string;  // Most common action
  totalActions: number;    // Total actions recorded
  exploitRecommendation: 'throw' | 'overhead' | 'low' | 'bait' | 'pressure' | 'none';
}

export class PatternRecognition {
  private actionHistory: string[] = [];
  private maxHistorySize: number = 60; // Track last 60 actions (1 second)
  
  constructor() {}

  /**
   * Record opponent action
   */
  public recordAction(action: string): void {
    this.actionHistory.push(action);
    
    // Keep history size limited
    if (this.actionHistory.length > this.maxHistorySize) {
      this.actionHistory.shift();
    }
  }

  /**
   * Analyze behavior statistics
   */
  public analyzeBehavior(): BehaviorStats {
    if (this.actionHistory.length === 0) {
      return {
        blockRate: 0,
        attackRate: 0,
        jumpRate: 0,
        forwardRate: 0,
        backwardRate: 0,
        crouchRate: 0,
        totalActions: 0,
      };
    }

    const total = this.actionHistory.length;
    const counts = {
      block: 0,
      attack: 0,
      jump: 0,
      forward: 0,
      backward: 0,
      crouch: 0,
    };

    for (const action of this.actionHistory) {
      if (action.includes('block')) counts.block++;
      if (action.includes('attack') || action.includes('punch') || action.includes('kick') || action.includes('projectile')) {
        counts.attack++;
      }
      if (action.includes('jump')) counts.jump++;
      if (action.includes('forward') || action.includes('right')) counts.forward++;
      if (action.includes('backward') || action.includes('left') || action.includes('back')) counts.backward++;
      if (action.includes('crouch') || action.includes('down')) counts.crouch++;
    }

    return {
      blockRate: counts.block / total,
      attackRate: counts.attack / total,
      jumpRate: counts.jump / total,
      forwardRate: counts.forward / total,
      backwardRate: counts.backward / total,
      crouchRate: counts.crouch / total,
      totalActions: total,
    };
  }

  /**
   * Detect if opponent has a pattern (repeating actions)
   */
  public detectPattern(): PatternAnalysis {
    const stats = this.analyzeBehavior();
    const actionCounts = new Map<string, number>();

    // Count action frequencies
    for (const action of this.actionHistory) {
      actionCounts.set(action, (actionCounts.get(action) || 0) + 1);
    }

    // Find most common action
    let dominantAction = 'none';
    let maxCount = 0;
    for (const [action, count] of actionCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        dominantAction = action;
      }
    }

    const total = this.actionHistory.length;
    const dominantRate = maxCount / Math.max(total, 1);

    // Behavior classification
    const isDefensive = stats.blockRate > 0.4 || stats.backwardRate > 0.3;
    const isAggressive = stats.attackRate > 0.5 || stats.forwardRate > 0.4;
    const isPredictable = dominantRate > 0.4; // Single action >40% of time
    const isZoner = (stats.backwardRate >= 0.3 || dominantAction.includes('back')) && 
                    (stats.attackRate >= 0.3 || dominantAction.includes('projectile'));
    const isJumper = stats.jumpRate > 0.3;

    // Exploit recommendation (ordered by priority)
    let exploitRecommendation: PatternAnalysis['exploitRecommendation'] = 'none';

    if (stats.blockRate > 0.5) {
      // Opponent blocks too much → throw them
      exploitRecommendation = 'throw';
    } else if (stats.crouchRate > 0.4) {
      // Opponent crouches too much → overhead
      exploitRecommendation = 'overhead';
    } else if (stats.crouchRate < 0.2 && stats.blockRate > 0.3) {
      // Opponent stands and blocks → low attacks
      exploitRecommendation = 'low';
    } else if (stats.attackRate < 0.1 && stats.forwardRate < 0.1) {
      // Opponent very passive (not attacking or advancing) → apply pressure
      exploitRecommendation = 'pressure';
    } else if (isDefensive) {
      // Opponent is defensive → apply pressure
      exploitRecommendation = 'pressure';
    } else if (stats.jumpRate > 0.3) {
      // Opponent jumps too much → bait and anti-air
      exploitRecommendation = 'bait';
    } else if (isPredictable && !dominantAction.includes('block')) {
      // Opponent mashes buttons → bait and punish
      exploitRecommendation = 'bait';
    }

    return {
      isDefensive,
      isAggressive,
      isPredictable,
      isZoner,
      isJumper,
      dominantAction,
      totalActions: total,
      exploitRecommendation,
    };
  }

  /**
   * Check if opponent always does specific action
   */
  public alwaysDoes(action: string, threshold: number = 0.6): boolean {
    if (this.actionHistory.length < 10) return false;

    const count = this.actionHistory.filter(a => a.includes(action)).length;
    return count / this.actionHistory.length >= threshold;
  }

  /**
   * Get recent action frequency
   */
  public getActionFrequency(action: string, lastN: number = 20): number {
    const recent = this.actionHistory.slice(-lastN);
    if (recent.length === 0) return 0;

    const count = recent.filter(a => a.includes(action)).length;
    return count / recent.length;
  }

  /**
   * Detect if opponent is repeating a specific sequence
   */
  public detectSequence(sequence: string[]): boolean {
    if (this.actionHistory.length < sequence.length * 2) return false;

    // Check if the sequence appears at least twice in recent history
    let occurrences = 0;
    for (let i = 0; i <= this.actionHistory.length - sequence.length; i++) {
      let matches = true;
      for (let j = 0; j < sequence.length; j++) {
        if (this.actionHistory[i + j] !== sequence[j]) {
          matches = false;
          break;
        }
      }
      if (matches) occurrences++;
    }

    return occurrences >= 2;
  }

  /**
   * Reset pattern recognition
   */
  public reset(): void {
    this.actionHistory = [];
  }

  /**
   * Get history size
   */
  public getHistorySize(): number {
    return this.actionHistory.length;
  }
}
