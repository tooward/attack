/**
 * Behavior Analysis
 * 
 * Detects degenerate strategies like stalling, move loops, and low diversity.
 * Provides metrics for curriculum gating and reward penalties.
 */

import { GameState, FighterState } from '../../core/interfaces/types';

/**
 * Game state snapshot for history tracking
 */
export interface GameStateSnapshot {
  frame: number;
  p1: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    health: number;
    state: string;
    attacking: boolean;
  };
  p2: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    health: number;
    state: string;
    attacking: boolean;
  };
  distance: number;
}

/**
 * Loop detection result
 */
export interface LoopReport {
  detectedLoops: boolean;
  loopRate: number;              // 0-1, higher = more repetitive
  mostCommonSequence: [string, number] | undefined;
  maxRepeats: number;
}

/**
 * Stalling analysis result
 */
export interface StallingReport {
  stallingRate: number;          // 0-1, fraction of time stalling
  stallingFrames: number;
  totalFrames: number;
  longestStallingStreak: number;
}

/**
 * Diversity analysis result
 */
export interface DiversityReport {
  entropy: number;               // 0-1, normalized entropy
  actionCounts: Map<number, number>;
  uniqueActions: number;
  totalActions: number;
  dominantAction: number;
  dominantActionRate: number;
}

/**
 * Comprehensive behavior report
 */
export interface BehaviorReport {
  stalling: StallingReport;
  loops: LoopReport;
  diversity: DiversityReport;
  engagement: number;            // 0-1, how often in combat range
  aggression: number;            // 0-1, how often attacking
  mobility: number;              // 0-1, average movement speed
}

/**
 * Behavior Analysis Configuration
 */
export interface BehaviorConfig {
  stallingDistanceThreshold: number;  // 400 pixels
  stallingMinFrames: number;          // 60 frames (1 second)
  loopWindowSize: number;             // 30 actions
  loopSequenceLength: number;         // 3 actions
  loopThreshold: number;              // 5 repeats
  engagementDistance: number;         // 300 pixels
}

/**
 * Default behavior analysis configuration
 */
export const DEFAULT_BEHAVIOR_CONFIG: BehaviorConfig = {
  stallingDistanceThreshold: 400,
  stallingMinFrames: 60,
  loopWindowSize: 30,
  loopSequenceLength: 3,
  loopThreshold: 5,
  engagementDistance: 300,
};

/**
 * Behavior Analyzer
 */
export class BehaviorAnalyzer {
  private config: BehaviorConfig;
  private stateHistory: GameStateSnapshot[] = [];
  private actionHistory: number[] = [];

  constructor(config: BehaviorConfig = DEFAULT_BEHAVIOR_CONFIG) {
    this.config = config;
  }

  /**
   * Record game state
   */
  recordState(state: GameState, frame: number): void {
    const p1 = state.entities.find(e => e.id === 'player1' || e.id === '1');
    const p2 = state.entities.find(e => e.id === 'player2' || e.id === '2');

    if (!p1 || !p2) return;

    const snapshot: GameStateSnapshot = {
      frame,
      p1: {
        x: p1.position.x,
        y: p1.position.y,
        vx: p1.velocity.x,
        vy: p1.velocity.y,
        health: p1.health,
        state: p1.status,
        attacking: p1.status.toString().includes('attack') || (p1.currentMove?.includes('special') || false),
      },
      p2: {
        x: p2.position.x,
        y: p2.position.y,
        vx: p2.velocity.x,
        vy: p2.velocity.y,
        health: p2.health,
        state: p2.status,
        attacking: p2.status.toString().includes('attack') || (p2.currentMove?.includes('special') || false),
      },
      distance: Math.abs(p1.position.x - p2.position.x),
    };

    this.stateHistory.push(snapshot);
  }

  /**
   * Record action
   */
  recordAction(action: number): void {
    this.actionHistory.push(action);
  }

  /**
   * Detect stalling behavior
   */
  detectStalling(): StallingReport {
    if (this.stateHistory.length === 0) {
      return {
        stallingRate: 0,
        stallingFrames: 0,
        totalFrames: 0,
        longestStallingStreak: 0,
      };
    }

    let stallingFrames = 0;
    let currentStreak = 0;
    let longestStreak = 0;

    for (let i = 1; i < this.stateHistory.length; i++) {
      const prev = this.stateHistory[i - 1];
      const curr = this.stateHistory[i];

      // Check if stalling: far apart, not attacking, not moving much
      const isFar = curr.distance > this.config.stallingDistanceThreshold;
      const notAttacking = !curr.p1.attacking && !curr.p2.attacking;
      const notMoving = Math.abs(curr.p1.vx) < 0.5 && Math.abs(curr.p2.vx) < 0.5;

      if (isFar && notAttacking && notMoving) {
        stallingFrames++;
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    return {
      stallingRate: stallingFrames / this.stateHistory.length,
      stallingFrames,
      totalFrames: this.stateHistory.length,
      longestStallingStreak: longestStreak,
    };
  }

  /**
   * Detect move loops
   */
  detectLoops(): LoopReport {
    if (this.actionHistory.length < this.config.loopSequenceLength) {
      return {
        detectedLoops: false,
        loopRate: 0,
        mostCommonSequence: undefined,
        maxRepeats: 0,
      };
    }

    const sequences = new Map<string, number>();
    const seqLength = this.config.loopSequenceLength;

    // Extract all sequences
    for (let i = 0; i <= this.actionHistory.length - seqLength; i++) {
      const seq = this.actionHistory.slice(i, i + seqLength).join(',');
      sequences.set(seq, (sequences.get(seq) || 0) + 1);
    }

    // Find most common
    let maxRepeats = 0;
    let mostCommon: [string, number] | undefined;

    for (const [seq, count] of sequences.entries()) {
      if (count > maxRepeats) {
        maxRepeats = count;
        mostCommon = [seq, count];
      }
    }

    const loopRate = maxRepeats / (this.actionHistory.length - seqLength + 1);
    const detectedLoops = maxRepeats > this.config.loopThreshold;

    return {
      detectedLoops,
      loopRate,
      mostCommonSequence: mostCommon,
      maxRepeats,
    };
  }

  /**
   * Compute action diversity
   */
  computeDiversity(numActions: number): DiversityReport {
    if (this.actionHistory.length === 0) {
      return {
        entropy: 0,
        actionCounts: new Map(),
        uniqueActions: 0,
        totalActions: 0,
        dominantAction: 0,
        dominantActionRate: 0,
      };
    }

    // Count actions
    const actionCounts = new Map<number, number>();
    for (const action of this.actionHistory) {
      actionCounts.set(action, (actionCounts.get(action) || 0) + 1);
    }

    // Compute entropy
    const probs: number[] = [];
    for (let i = 0; i < numActions; i++) {
      const count = actionCounts.get(i) || 0;
      probs.push(count / this.actionHistory.length);
    }

    let entropy = 0;
    for (const p of probs) {
      if (p > 0) {
        entropy -= p * Math.log2(p);
      }
    }

    // Normalize to [0, 1]
    const maxEntropy = Math.log2(numActions);
    const normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0;

    // Find dominant action
    let dominantAction = 0;
    let dominantCount = 0;
    for (const [action, count] of actionCounts.entries()) {
      if (count > dominantCount) {
        dominantAction = action;
        dominantCount = count;
      }
    }

    return {
      entropy: normalizedEntropy,
      actionCounts,
      uniqueActions: actionCounts.size,
      totalActions: this.actionHistory.length,
      dominantAction,
      dominantActionRate: dominantCount / this.actionHistory.length,
    };
  }

  /**
   * Compute engagement rate (time spent in combat range)
   */
  computeEngagement(): number {
    if (this.stateHistory.length === 0) return 0;

    let engagedFrames = 0;
    for (const snapshot of this.stateHistory) {
      if (snapshot.distance <= this.config.engagementDistance) {
        engagedFrames++;
      }
    }

    return engagedFrames / this.stateHistory.length;
  }

  /**
   * Compute aggression (time spent attacking)
   */
  computeAggression(): number {
    if (this.stateHistory.length === 0) return 0;

    let attackingFrames = 0;
    for (const snapshot of this.stateHistory) {
      if (snapshot.p1.attacking) {
        attackingFrames++;
      }
    }

    return attackingFrames / this.stateHistory.length;
  }

  /**
   * Compute mobility (average movement speed)
   */
  computeMobility(): number {
    if (this.stateHistory.length === 0) return 0;

    let totalSpeed = 0;
    for (const snapshot of this.stateHistory) {
      const speed = Math.sqrt(snapshot.p1.vx ** 2 + snapshot.p1.vy ** 2);
      totalSpeed += speed;
    }

    // Normalize by typical max speed (assume 10)
    const avgSpeed = totalSpeed / this.stateHistory.length;
    return Math.min(avgSpeed / 10, 1);
  }

  /**
   * Generate comprehensive behavior report
   */
  generateReport(numActions: number): BehaviorReport {
    return {
      stalling: this.detectStalling(),
      loops: this.detectLoops(),
      diversity: this.computeDiversity(numActions),
      engagement: this.computeEngagement(),
      aggression: this.computeAggression(),
      mobility: this.computeMobility(),
    };
  }

  /**
   * Reset analyzer
   */
  reset(): void {
    this.stateHistory = [];
    this.actionHistory = [];
  }

  /**
   * Get state history
   */
  getStateHistory(): GameStateSnapshot[] {
    return [...this.stateHistory];
  }

  /**
   * Get action history
   */
  getActionHistory(): number[] {
    return [...this.actionHistory];
  }

  /**
   * Export analyzer state
   */
  export(): {
    stateHistory: GameStateSnapshot[];
    actionHistory: number[];
    config: BehaviorConfig;
  } {
    return {
      stateHistory: this.stateHistory,
      actionHistory: this.actionHistory,
      config: this.config,
    };
  }
}

/**
 * Helper: Check if behavior is degenerate
 */
export function isDegenerateBehavior(
  report: BehaviorReport,
  thresholds: {
    maxStalling?: number;      // 0.2 = 20%
    maxLoopRate?: number;      // 0.3 = 30%
    minDiversity?: number;     // 0.4
    minEngagement?: number;    // 0.3
  }
): { degenerate: boolean; reasons: string[] } {
  const reasons: string[] = [];
  let degenerate = false;

  if (thresholds.maxStalling && report.stalling.stallingRate > thresholds.maxStalling) {
    reasons.push(`High stalling: ${(report.stalling.stallingRate * 100).toFixed(1)}%`);
    degenerate = true;
  }

  if (thresholds.maxLoopRate && report.loops.loopRate > thresholds.maxLoopRate) {
    reasons.push(`Repetitive moves: ${(report.loops.loopRate * 100).toFixed(1)}%`);
    degenerate = true;
  }

  if (thresholds.minDiversity && report.diversity.entropy < thresholds.minDiversity) {
    reasons.push(`Low diversity: ${report.diversity.entropy.toFixed(2)}`);
    degenerate = true;
  }

  if (thresholds.minEngagement && report.engagement < thresholds.minEngagement) {
    reasons.push(`Low engagement: ${(report.engagement * 100).toFixed(1)}%`);
    degenerate = true;
  }

  return { degenerate, reasons };
}

/**
 * Helper: Format behavior report as string
 */
export function formatBehaviorReport(report: BehaviorReport): string {
  let output = '=== Behavior Analysis ===\n';
  
  output += '\nStalling:\n';
  output += `  Rate: ${(report.stalling.stallingRate * 100).toFixed(1)}%\n`;
  output += `  Frames: ${report.stalling.stallingFrames}/${report.stalling.totalFrames}\n`;
  output += `  Longest streak: ${report.stalling.longestStallingStreak} frames\n`;

  output += '\nMove Loops:\n';
  output += `  Detected: ${report.loops.detectedLoops ? 'YES' : 'NO'}\n`;
  output += `  Loop rate: ${(report.loops.loopRate * 100).toFixed(1)}%\n`;
  output += `  Max repeats: ${report.loops.maxRepeats}\n`;
  if (report.loops.mostCommonSequence) {
    output += `  Most common: [${report.loops.mostCommonSequence[0]}] x${report.loops.mostCommonSequence[1]}\n`;
  }

  output += '\nAction Diversity:\n';
  output += `  Entropy: ${report.diversity.entropy.toFixed(3)} (0=repetitive, 1=diverse)\n`;
  output += `  Unique actions: ${report.diversity.uniqueActions}/${report.diversity.totalActions}\n`;
  output += `  Dominant action: ${report.diversity.dominantAction} (${(report.diversity.dominantActionRate * 100).toFixed(1)}%)\n`;

  output += '\nOther Metrics:\n';
  output += `  Engagement: ${(report.engagement * 100).toFixed(1)}%\n`;
  output += `  Aggression: ${(report.aggression * 100).toFixed(1)}%\n`;
  output += `  Mobility: ${(report.mobility * 100).toFixed(1)}%\n`;

  return output;
}
