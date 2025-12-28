/**
 * Style-Conditioned Training Integration
 * 
 * Integrates fighting styles with the training pipeline.
 * Enables style-specific reward shaping and opponent sampling.
 */

import { RewardWeights } from '../core/RewardFunction';
import { OpponentPool, OpponentSnapshot } from '../training/OpponentPool';
import { FightingStyle, StyleConfig, getStyleConfig, getAllStyles, sampleRandomStyle } from '../inference/StyleConfig';

/**
 * Apply style-specific reward modifiers
 * 
 * Note: Currently returns base weights as-is. Style differentiation is
 * achieved through the style vector in observations rather than reward shaping.
 * This allows the single reward function to work across all styles.
 */
export function applyStyleRewardModifiers(
  baseWeights: RewardWeights,
  style: FightingStyle
): RewardWeights {
  // Style is encoded in observations; return unmodified weights
  // This allows a single reward function to work for all styles
  return { ...baseWeights };
}

/**
 * Sample opponent with style diversity
 */
export function sampleStyleDiverseOpponent(
  pool: OpponentPool,
  currentStyle: FightingStyle,
  diversityWeight: number = 0.3
): OpponentSnapshot {
  const allSnapshots = pool.getAllSnapshots();
  
  if (allSnapshots.length === 0) {
    throw new Error('Opponent pool is empty');
  }
  
  // If no diversity weight, use standard sampling
  if (diversityWeight === 0) {
    return pool.sampleOpponent();
  }
  
  // Separate by style
  const sameStyle = allSnapshots.filter(s => s.metadata.style === currentStyle);
  const diffStyle = allSnapshots.filter(s => s.metadata.style !== currentStyle);
  
  // Sample with diversity bias
  if (Math.random() < diversityWeight && diffStyle.length > 0) {
    return diffStyle[Math.floor(Math.random() * diffStyle.length)];
  } else if (sameStyle.length > 0) {
    return sameStyle[Math.floor(Math.random() * sameStyle.length)];
  } else {
    return pool.sampleOpponent();
  }
}

/**
 * Create balanced style training schedule
 */
export function createStyleTrainingSchedule(
  totalSteps: number,
  stylesPerRound: number = 4
): Map<number, FightingStyle> {
  const schedule = new Map<number, FightingStyle>();
  const styles = getAllStyles();
  const stepsPerStyle = Math.floor(totalSteps / (styles.length * stylesPerRound));
  
  let currentStep = 0;
  for (let round = 0; round < stylesPerRound; round++) {
    for (const style of styles) {
      schedule.set(currentStep, style);
      currentStep += stepsPerStyle;
    }
  }
  
  return schedule;
}

/**
 * Get style for training step
 */
export function getStyleForStep(
  step: number,
  schedule: Map<number, FightingStyle>
): FightingStyle {
  // Find the largest key less than or equal to step
  let currentStyle: FightingStyle = 'mixup';
  
  const keys = Array.from(schedule.keys()).sort((a, b) => a - b);
  for (const key of keys) {
    if (key <= step) {
      currentStyle = schedule.get(key)!;
    } else {
      break;
    }
  }
  
  return currentStyle;
}

/**
 * Style training statistics
 */
export interface StyleTrainingStats {
  style: FightingStyle;
  stepsTraining: number;
  avgReward: number;
  winRate: number;
  snapshotCount: number;
}

/**
 * Track style training progress
 */
export class StyleTrainingTracker {
  private stats: Map<FightingStyle, StyleTrainingStats>;
  
  constructor() {
    this.stats = new Map();
    
    // Initialize all styles
    for (const style of getAllStyles()) {
      this.stats.set(style, {
        style,
        stepsTraining: 0,
        avgReward: 0,
        winRate: 0,
        snapshotCount: 0,
      });
    }
  }
  
  /**
   * Record training step (called once per rollout, not per actual step)
   */
  recordStep(style: FightingStyle, reward: number): void {
    const stats = this.stats.get(style)!;
    stats.stepsTraining++;
    
    // Exponential moving average with higher alpha since we're called per rollout
    const alpha = 0.1; // Increased from 0.01 to respond faster
    stats.avgReward = stats.avgReward * (1 - alpha) + reward * alpha;
  }
  
  /**
   * Record match result
   */
  recordMatch(style: FightingStyle, won: boolean): void {
    const stats = this.stats.get(style)!;
    
    // Exponential moving average
    const alpha = 0.1;
    const result = won ? 1.0 : 0.0;
    stats.winRate = stats.winRate * (1 - alpha) + result * alpha;
  }
  
  /**
   * Record snapshot
   */
  recordSnapshot(style: FightingStyle): void {
    const stats = this.stats.get(style)!;
    stats.snapshotCount++;
  }
  
  /**
   * Get stats for style
   */
  getStats(style: FightingStyle): StyleTrainingStats {
    return { ...this.stats.get(style)! };
  }
  
  /**
   * Get all stats
   */
  getAllStats(): StyleTrainingStats[] {
    return Array.from(this.stats.values());
  }
  
  /**
   * Format stats as string
   */
  formatStats(): string {
    let output = '=== Style Training Statistics ===\n';
    
    for (const stats of this.stats.values()) {
      output += `\n${stats.style.toUpperCase()}:\n`;
      output += `  Rollouts: ${stats.stepsTraining}\n`;
      output += `  Avg Reward: ${stats.avgReward.toFixed(2)}\n`;
      output += `  Win Rate: ${(stats.winRate * 100).toFixed(1)}%\n`;
      output += `  Snapshots: ${stats.snapshotCount}\n`;
    }
    
    return output;
  }
}

/**
 * Validate style distribution in opponent pool
 */
export function validateStyleDistribution(pool: OpponentPool): {
  isBalanced: boolean;
  distribution: Map<FightingStyle, number>;
  message: string;
} {
  const snapshots = pool.getAllSnapshots();
  const distribution = new Map<FightingStyle, number>();

  if (snapshots.length === 0) {
    for (const style of getAllStyles()) {
      distribution.set(style, 0);
    }

    return {
      isBalanced: true,
      distribution,
      message: 'No opponent snapshots yet; style distribution will populate as snapshots are created.',
    };
  }
  
  // Count snapshots per style
  for (const style of getAllStyles()) {
    distribution.set(style, 0);
  }
  
  for (const snapshot of snapshots) {
    const style = snapshot.metadata.style as FightingStyle;
    if (style && distribution.has(style)) {
      distribution.set(style, distribution.get(style)! + 1);
    }
  }

  const totalSnapshots = snapshots.length;
  const coveredStyles = Array.from(distribution.values()).filter(c => c > 0).length;
  
  // Check balance (each style should have at least 1 snapshot).
  // Before all styles are represented at least once, report as "building" rather
  // than flagging as unbalanced.
  const minCount = Math.min(...Array.from(distribution.values()));
  const maxCount = Math.max(...Array.from(distribution.values()));
  const hasAllStyles = minCount > 0;
  const isBalanced = hasAllStyles && maxCount / Math.max(minCount, 1) <= 3;
  
  const counts = Array.from(distribution.entries())
    .map(([style, count]) => `${style}: ${count}`)
    .join(', ');
  
  const message = isBalanced
    ? `Style distribution is balanced: ${counts}`
    : hasAllStyles
      ? `Style distribution is UNBALANCED: ${counts}`
      : `Style distribution is building (${coveredStyles}/4 styles, ${totalSnapshots} snapshots): ${counts}`;
  
  return { isBalanced, distribution, message };
}

/**
 * Recommend style for next training phase
 */
export function recommendNextStyle(pool: OpponentPool): FightingStyle {
  const validation = validateStyleDistribution(pool);
  const distribution = validation.distribution;
  
  // Find style with fewest snapshots
  let minStyle: FightingStyle = 'mixup';
  let minCount = Infinity;
  
  for (const [style, count] of distribution.entries()) {
    if (count < minCount) {
      minCount = count;
      minStyle = style;
    }
  }
  
  return minStyle;
}

/**
 * Create style-specific training configuration
 */
export interface StyleTrainingConfig {
  style: FightingStyle;
  baseRewardWeights: RewardWeights;
  modifiedWeights: RewardWeights;
  diversityWeight: number;
  snapshotFrequency: number;
}

/**
 * Build training config for style
 */
export function buildStyleTrainingConfig(
  style: FightingStyle,
  baseWeights: RewardWeights,
  diversityWeight: number = 0.3
): StyleTrainingConfig {
  return {
    style,
    baseRewardWeights: baseWeights,
    modifiedWeights: applyStyleRewardModifiers(baseWeights, style),
    diversityWeight,
    snapshotFrequency: 100_000, // Snapshot every 100k steps
  };
}
