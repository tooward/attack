/**
 * Curriculum Manager
 * 
 * Manages progressive training stages with constraints, success criteria,
 * and automatic advancement. Prevents bots from learning bad habits by
 * gradually introducing complexity.
 */

import { RewardWeights } from '../core/RewardFunction';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

/**
 * Constraints applied during a curriculum stage
 */
export interface StageConstraints {
  allowedMoves?: string[];       // Whitelist of allowed moves (null = all)
  disableSpecials?: boolean;     // Disable special moves
  disableSupers?: boolean;       // Disable super moves
  disableCancels?: boolean;      // Disable move cancels
  opponentType?: 'passive' | 'scripted' | 'pool' | 'curriculum';
  opponentDifficulty?: number;   // 1-10 for scripted opponents
  maxRoundTime?: number;         // Limit round duration
  startingDistance?: number;     // Initial spacing between fighters
}

/**
 * Success criteria to advance to next stage
 */
export interface SuccessCriteria {
  winRate?: number;              // Required win rate (0-1)
  minGames?: number;             // Minimum games to play
  maxGames?: number;             // Maximum games before forced advance
  avgReward?: number;            // Minimum average reward
  maxStalling?: number;          // Maximum stalling rate (0-1)
  minDiversity?: number;         // Minimum action diversity (0-1)
  customMetric?: string;         // Custom evaluation metric
  customThreshold?: number;      // Threshold for custom metric
}

/**
 * Training stage definition
 */
export interface CurriculumStage {
  name: string;
  description?: string;
  constraints: StageConstraints;
  successCriteria: SuccessCriteria;
  rewards?: Partial<RewardWeights>;  // Override base reward weights
  estimatedSteps?: number;       // Estimated training steps
}

/**
 * Curriculum configuration
 */
export interface CurriculumConfig {
  stages: CurriculumStage[];
  allowSkipping?: boolean;       // Allow manual stage skipping
  saveCheckpoints?: boolean;     // Save model at each stage
  checkpointPath?: string;       // Where to save checkpoints
}

/**
 * Stage progress tracking
 */
export interface StageProgress {
  stageName: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  totalReward: number;
  stallingRate: number;
  diversityScore: number;
  customMetrics: Map<string, number>;
}

/**
 * Curriculum Manager
 */
export class CurriculumManager {
  private config: CurriculumConfig;
  private currentStageIndex: number = 0;
  private stageProgress: StageProgress;
  private startTime: number;

  constructor(config: CurriculumConfig) {
    this.config = config;
    this.startTime = Date.now();
    this.stageProgress = this.initializeProgress(config.stages[0].name);
  }

  /**
   * Load curriculum from YAML file
   */
  static loadFromFile(path: string): CurriculumManager {
    const content = fs.readFileSync(path, 'utf-8');
    const config = yaml.load(content) as CurriculumConfig;
    return new CurriculumManager(config);
  }

  /**
   * Get current stage
   */
  getCurrentStage(): CurriculumStage {
    return this.config.stages[this.currentStageIndex];
  }

  /**
   * Get current stage index
   */
  getCurrentStageIndex(): number {
    return this.currentStageIndex;
  }

  /**
   * Get total number of stages
   */
  getTotalStages(): number {
    return this.config.stages.length;
  }

  /**
   * Check if curriculum is complete
   */
  isComplete(): boolean {
    return this.currentStageIndex >= this.config.stages.length;
  }

  /**
   * Get current stage progress
   */
  getProgress(): StageProgress {
    return { ...this.stageProgress };
  }

  /**
   * Record match result
   */
  recordMatch(
    won: boolean,
    reward: number,
    stallingRate: number,
    diversityScore: number,
    customMetrics?: Map<string, number>
  ): void {
    this.stageProgress.gamesPlayed++;
    
    if (won) {
      this.stageProgress.wins++;
    } else {
      this.stageProgress.losses++;
    }
    
    this.stageProgress.totalReward += reward;
    this.stageProgress.stallingRate = 
      (this.stageProgress.stallingRate * (this.stageProgress.gamesPlayed - 1) + stallingRate) / 
      this.stageProgress.gamesPlayed;
    this.stageProgress.diversityScore = 
      (this.stageProgress.diversityScore * (this.stageProgress.gamesPlayed - 1) + diversityScore) / 
      this.stageProgress.gamesPlayed;

    if (customMetrics) {
      for (const [key, value] of customMetrics) {
        const current = this.stageProgress.customMetrics.get(key) || 0;
        const count = this.stageProgress.gamesPlayed;
        this.stageProgress.customMetrics.set(
          key,
          (current * (count - 1) + value) / count
        );
      }
    }
  }

  /**
   * Check if current stage success criteria are met
   */
  checkSuccessCriteria(): { met: boolean; reasons: string[] } {
    const stage = this.getCurrentStage();
    const criteria = stage.successCriteria;
    const progress = this.stageProgress;
    const reasons: string[] = [];

    // Check minimum games
    if (criteria.minGames && progress.gamesPlayed < criteria.minGames) {
      reasons.push(`Need ${criteria.minGames - progress.gamesPlayed} more games`);
      return { met: false, reasons };
    }

    // Force advance if max games reached
    if (criteria.maxGames && progress.gamesPlayed >= criteria.maxGames) {
      reasons.push(`Max games reached (${criteria.maxGames})`);
      return { met: true, reasons };
    }

    const totalGames = progress.wins + progress.losses;
    const winRate = totalGames > 0 ? progress.wins / totalGames : 0;
    const avgReward = progress.gamesPlayed > 0 ? progress.totalReward / progress.gamesPlayed : 0;

    // Check win rate
    if (criteria.winRate !== undefined) {
      if (winRate < criteria.winRate) {
        reasons.push(`Win rate ${(winRate * 100).toFixed(1)}% < ${(criteria.winRate * 100).toFixed(1)}%`);
        return { met: false, reasons };
      }
    }

    // Check average reward
    if (criteria.avgReward !== undefined) {
      if (avgReward < criteria.avgReward) {
        reasons.push(`Avg reward ${avgReward.toFixed(2)} < ${criteria.avgReward.toFixed(2)}`);
        return { met: false, reasons };
      }
    }

    // Check stalling
    if (criteria.maxStalling !== undefined) {
      if (progress.stallingRate > criteria.maxStalling) {
        reasons.push(`Stalling ${(progress.stallingRate * 100).toFixed(1)}% > ${(criteria.maxStalling * 100).toFixed(1)}%`);
        return { met: false, reasons };
      }
    }

    // Check diversity
    if (criteria.minDiversity !== undefined) {
      if (progress.diversityScore < criteria.minDiversity) {
        reasons.push(`Diversity ${progress.diversityScore.toFixed(2)} < ${criteria.minDiversity.toFixed(2)}`);
        return { met: false, reasons };
      }
    }

    // Check custom metric
    if (criteria.customMetric && criteria.customThreshold !== undefined) {
      const customValue = progress.customMetrics.get(criteria.customMetric) || 0;
      if (customValue < criteria.customThreshold) {
        reasons.push(`${criteria.customMetric} ${customValue.toFixed(2)} < ${criteria.customThreshold.toFixed(2)}`);
        return { met: false, reasons };
      }
    }

    reasons.push('All criteria met!');
    return { met: true, reasons };
  }

  /**
   * Advance to next stage
   */
  advanceStage(): boolean {
    const isJest = process.env.JEST_WORKER_ID !== undefined || process.env.NODE_ENV === 'test';
    if (this.isComplete()) {
      return false;
    }

    this.currentStageIndex++;
    
    if (!this.isComplete()) {
      const nextStage = this.getCurrentStage();
      this.stageProgress = this.initializeProgress(nextStage.name);

      if (!isJest) {
        console.log(`\n=== Advanced to Stage ${this.currentStageIndex + 1}/${this.getTotalStages()}: ${nextStage.name} ===`);
        console.log(`Description: ${nextStage.description || 'N/A'}`);
        console.log(`Estimated steps: ${nextStage.estimatedSteps || 'Unknown'}`);
      }
    } else {
      if (!isJest) {
        console.log('\n=== Curriculum Complete! ===');
      }
    }

    return true;
  }

  /**
   * Try to advance stage if criteria met
   */
  tryAdvance(): boolean {
    const isJest = process.env.JEST_WORKER_ID !== undefined || process.env.NODE_ENV === 'test';
    const { met, reasons } = this.checkSuccessCriteria();
    
    if (met) {
      if (!isJest) {
        console.log('\n✓ Stage success criteria met:');
        reasons.forEach(r => console.log(`  ${r}`));
      }
      return this.advanceStage();
    }
    
    return false;
  }

  /**
   * Force advance to next stage (for debugging)
   */
  forceAdvance(): boolean {
    const isJest = process.env.JEST_WORKER_ID !== undefined || process.env.NODE_ENV === 'test';
    if (!this.config.allowSkipping) {
      if (!isJest) {
        console.warn('Stage skipping is disabled in config');
      }
      return false;
    }
    
    return this.advanceStage();
  }

  /**
   * Get constraints for current stage
   */
  getConstraints(): StageConstraints {
    return { ...this.getCurrentStage().constraints };
  }

  /**
   * Get reward weights for current stage
   */
  getRewardWeights(baseWeights: RewardWeights): RewardWeights {
    const stage = this.getCurrentStage();
    
    if (!stage.rewards) {
      return baseWeights;
    }

    // Merge stage rewards with base weights
    return {
      ...baseWeights,
      ...stage.rewards,
    };
  }

  /**
   * Check if a move is allowed in current stage
   */
  isMoveAllowed(moveName: string): boolean {
    const constraints = this.getConstraints();
    
    // No whitelist = all allowed
    if (!constraints.allowedMoves) {
      return true;
    }

    return constraints.allowedMoves.includes(moveName);
  }

  /**
   * Get summary of all stages
   */
  getSummary(): string {
    let summary = '=== Curriculum Summary ===\n';
    summary += `Total stages: ${this.getTotalStages()}\n`;
    summary += `Current stage: ${this.currentStageIndex + 1}\n\n`;

    for (let i = 0; i < this.config.stages.length; i++) {
      const stage = this.config.stages[i];
      const marker = i === this.currentStageIndex ? '→' : i < this.currentStageIndex ? '✓' : ' ';
      summary += `${marker} Stage ${i + 1}: ${stage.name}\n`;
      
      if (stage.description) {
        summary += `  ${stage.description}\n`;
      }
      
      if (stage.estimatedSteps) {
        summary += `  Estimated steps: ${stage.estimatedSteps}\n`;
      }
    }

    return summary;
  }

  /**
   * Get progress report for current stage
   */
  getProgressReport(): string {
    const stage = this.getCurrentStage();
    const progress = this.stageProgress;
    const { met, reasons } = this.checkSuccessCriteria();
    
    const totalGames = progress.wins + progress.losses;
    const winRate = totalGames > 0 ? progress.wins / totalGames : 0;
    const avgReward = progress.gamesPlayed > 0 ? progress.totalReward / progress.gamesPlayed : 0;

    let report = `\n=== Stage Progress: ${stage.name} ===\n`;
    report += `Games played: ${progress.gamesPlayed}\n`;
    report += `Record: ${progress.wins}W - ${progress.losses}L`;
    if (progress.draws > 0) report += ` - ${progress.draws}D`;
    report += `\n`;
    report += `Win rate: ${(winRate * 100).toFixed(1)}%\n`;
    report += `Avg reward: ${avgReward.toFixed(2)}\n`;
    report += `Stalling rate: ${(progress.stallingRate * 100).toFixed(1)}%\n`;
    report += `Diversity score: ${progress.diversityScore.toFixed(2)}\n`;

    if (progress.customMetrics.size > 0) {
      report += '\nCustom metrics:\n';
      for (const [key, value] of progress.customMetrics) {
        report += `  ${key}: ${value.toFixed(2)}\n`;
      }
    }

    report += `\nSuccess criteria: ${met ? '✓ MET' : '✗ NOT MET'}\n`;
    reasons.forEach(r => report += `  ${r}\n`);

    return report;
  }

  /**
   * Export curriculum state
   */
  export(): {
    config: CurriculumConfig;
    currentStageIndex: number;
    stageProgress: StageProgress;
    startTime: number;
    elapsedTime: number;
  } {
    return {
      config: this.config,
      currentStageIndex: this.currentStageIndex,
      stageProgress: this.stageProgress,
      startTime: this.startTime,
      elapsedTime: Date.now() - this.startTime,
    };
  }

  /**
   * Reset curriculum to first stage
   */
  reset(): void {
    this.currentStageIndex = 0;
    this.startTime = Date.now();
    this.stageProgress = this.initializeProgress(this.config.stages[0].name);
  }

  /**
   * Initialize progress tracking for a stage
   */
  private initializeProgress(stageName: string): StageProgress {
    return {
      stageName,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      totalReward: 0,
      stallingRate: 0,
      diversityScore: 0,
      customMetrics: new Map(),
    };
  }
}

/**
 * Default curriculum configuration
 */
export const DEFAULT_CURRICULUM: CurriculumConfig = {
  stages: [
    {
      name: 'neutral_footsies',
      description: 'Learn basic movement and spacing',
      constraints: {
        allowedMoves: ['walk', 'jump', 'lightPunch', 'lightKick', 'heavyPunch', 'block'],
        disableSpecials: true,
        disableSupers: true,
        opponentType: 'passive',
      },
      successCriteria: {
        winRate: 0.6,
        minGames: 200,
        maxStalling: 0.15,
      },
      rewards: {
        rangeControl: 0.3,
        stalling: -0.1,
      },
      estimatedSteps: 50_000,
    },
    {
      name: 'punish_training',
      description: 'Learn to punish opponent mistakes',
      constraints: {
        opponentType: 'scripted',
        opponentDifficulty: 3,
      },
      successCriteria: {
        winRate: 0.7,
        minGames: 150,
      },
      rewards: {
        whiffPunish: 5.0,
      },
      estimatedSteps: 75_000,
    },
    {
      name: 'defense_training',
      description: 'Learn blocking and anti-airs',
      constraints: {
        opponentType: 'scripted',
        opponentDifficulty: 5,
      },
      successCriteria: {
        winRate: 0.5,
        minGames: 200,
        minDiversity: 0.4,
      },
      rewards: {
        successfulBlock: 1.0,
        antiAir: 3.0,
      },
      estimatedSteps: 100_000,
    },
    {
      name: 'combo_practice',
      description: 'Learn to chain attacks into combos',
      constraints: {
        disableSupers: true,
      },
      successCriteria: {
        winRate: 0.6,
        minGames: 300,
        customMetric: 'avgComboLength',
        customThreshold: 3.0,
      },
      rewards: {
        hitConfirm: 3.0,
        knockdown: 5.0,
      },
      estimatedSteps: 150_000,
    },
    {
      name: 'full_game',
      description: 'Full game with all mechanics',
      constraints: {
        opponentType: 'pool',
      },
      successCriteria: {
        winRate: 0.55,
        minGames: 500,
        maxStalling: 0.1,
        minDiversity: 0.6,
      },
      estimatedSteps: 200_000,
    },
  ],
  allowSkipping: false,
  saveCheckpoints: true,
  checkpointPath: './models/curriculum_checkpoints',
};
