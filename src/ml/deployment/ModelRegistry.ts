/**
 * Model Registry
 * 
 * Production deployment infrastructure for managing model versions,
 * A/B testing, analytics, and serving.
 */

import * as tf from '@tensorflow/tfjs-node';
import * as fs from 'fs';
import * as path from 'path';
import { DifficultyLevel } from '../inference/DifficultyConfig';
import { FightingStyle } from '../inference/StyleConfig';

/**
 * Model version metadata
 */
export interface ModelVersion {
  id: string;
  version: string;
  modelPath: string;
  difficulty: DifficultyLevel;
  style: FightingStyle;
  targetElo: number;
  trainingSteps: number;
  trainingDuration: number;
  performance: {
    winRate: number;
    averageReward: number;
    eloRating: number;
    inferenceTimeMs: number;
    modelSizeKB: number;
  };
  validation: {
    stallingRate: number;
    loopRate: number;
    diversityScore: number;
    passedRegression: boolean;
  };
  deploymentStatus: 'pending' | 'staging' | 'production' | 'deprecated';
  createdAt: number;
  deployedAt?: number;
  deprecatedAt?: number;
  tags: string[];
  notes: string;
}

/**
 * A/B test configuration
 */
export interface ABTest {
  id: string;
  name: string;
  description: string;
  modelA: string;  // Version ID
  modelB: string;  // Version ID
  trafficSplit: number;  // 0-1 (% to model B)
  startDate: number;
  endDate?: number;
  metrics: {
    totalMatches: number;
    modelAWins: number;
    modelBWins: number;
    modelAPlayerSatisfaction: number;
    modelBPlayerSatisfaction: number;
  };
  status: 'active' | 'completed' | 'cancelled';
}

/**
 * Analytics event
 */
export interface AnalyticsEvent {
  eventType: 'match_start' | 'match_end' | 'player_feedback' | 'error';
  timestamp: number;
  modelVersion: string;
  difficulty: DifficultyLevel;
  style: FightingStyle;
  data: any;
}

/**
 * Model Registry
 */
export class ModelRegistry {
  private registryPath: string;
  private versions: Map<string, ModelVersion>;
  private activeTests: Map<string, ABTest>;
  private analytics: AnalyticsEvent[];

  constructor(registryPath: string = './models/registry') {
    this.registryPath = registryPath;
    this.versions = new Map();
    this.activeTests = new Map();
    this.analytics = [];

    // Ensure registry directory exists
    if (!fs.existsSync(registryPath)) {
      fs.mkdirSync(registryPath, { recursive: true });
    }

    // Load existing registry
    this.load();
  }

  /**
   * Register a new model version
   */
  registerModel(version: ModelVersion): void {
    this.versions.set(version.id, version);
    this.save();
    console.log(`Registered model version: ${version.id} (v${version.version})`);
  }

  /**
   * Get model version by ID
   */
  getVersion(id: string): ModelVersion | undefined {
    return this.versions.get(id);
  }

  /**
   * Get all versions
   */
  getAllVersions(): ModelVersion[] {
    return Array.from(this.versions.values());
  }

  /**
   * Get production model for difficulty and style
   */
  getProductionModel(difficulty: DifficultyLevel, style: FightingStyle): ModelVersion | undefined {
    return Array.from(this.versions.values()).find(
      v => v.deploymentStatus === 'production' &&
           v.difficulty === difficulty &&
           v.style === style
    );
  }

  /**
   * Promote model to production
   */
  promoteToProduction(versionId: string): void {
    const version = this.versions.get(versionId);
    if (!version) {
      throw new Error(`Version ${versionId} not found`);
    }

    // Demote current production version
    const currentProd = this.getProductionModel(version.difficulty, version.style);
    if (currentProd) {
      currentProd.deploymentStatus = 'deprecated';
      currentProd.deprecatedAt = Date.now();
    }

    // Promote new version
    version.deploymentStatus = 'production';
    version.deployedAt = Date.now();

    this.save();
    console.log(`Promoted ${versionId} to production`);
  }

  /**
   * Create A/B test
   */
  createABTest(test: ABTest): void {
    this.activeTests.set(test.id, test);
    this.save();
    console.log(`Created A/B test: ${test.name}`);
  }

  /**
   * Get A/B test results
   */
  getABTestResults(testId: string): ABTest | undefined {
    return this.activeTests.get(testId);
  }

  /**
   * Record match result for A/B test
   */
  recordABTestMatch(testId: string, modelId: string, won: boolean, playerSatisfaction?: number): void {
    const test = this.activeTests.get(testId);
    if (!test) {
      throw new Error(`A/B test ${testId} not found`);
    }

    test.metrics.totalMatches++;

    if (modelId === test.modelA) {
      if (won) test.metrics.modelAWins++;
      if (playerSatisfaction !== undefined) {
        test.metrics.modelAPlayerSatisfaction = 
          (test.metrics.modelAPlayerSatisfaction * (test.metrics.totalMatches - 1) + playerSatisfaction) / 
          test.metrics.totalMatches;
      }
    } else if (modelId === test.modelB) {
      if (won) test.metrics.modelBWins++;
      if (playerSatisfaction !== undefined) {
        test.metrics.modelBPlayerSatisfaction = 
          (test.metrics.modelBPlayerSatisfaction * (test.metrics.totalMatches - 1) + playerSatisfaction) / 
          test.metrics.totalMatches;
      }
    }

    this.save();
  }

  /**
   * Complete A/B test and select winner
   */
  completeABTest(testId: string): string {
    const test = this.activeTests.get(testId);
    if (!test) {
      throw new Error(`A/B test ${testId} not found`);
    }

    test.status = 'completed';
    test.endDate = Date.now();

    // Select winner based on win rate and satisfaction
    const aWinRate = test.metrics.modelAWins / test.metrics.totalMatches;
    const bWinRate = test.metrics.modelBWins / test.metrics.totalMatches;
    
    const aScore = aWinRate * 0.5 + test.metrics.modelAPlayerSatisfaction * 0.5;
    const bScore = bWinRate * 0.5 + test.metrics.modelBPlayerSatisfaction * 0.5;

    const winner = bScore > aScore ? test.modelB : test.modelA;

    this.save();
    console.log(`A/B test completed. Winner: ${winner}`);
    console.log(`  Model A: ${aScore.toFixed(3)} (${(aWinRate * 100).toFixed(1)}% win rate, ${test.metrics.modelAPlayerSatisfaction.toFixed(2)} satisfaction)`);
    console.log(`  Model B: ${bScore.toFixed(3)} (${(bWinRate * 100).toFixed(1)}% win rate, ${test.metrics.modelBPlayerSatisfaction.toFixed(2)} satisfaction)`);

    return winner;
  }

  /**
   * Record analytics event
   */
  recordEvent(event: AnalyticsEvent): void {
    this.analytics.push(event);

    // Keep last 10000 events
    if (this.analytics.length > 10000) {
      this.analytics = this.analytics.slice(-10000);
    }

    // Periodically flush to disk
    if (this.analytics.length % 100 === 0) {
      this.saveAnalytics();
    }
  }

  /**
   * Get analytics summary
   */
  getAnalyticsSummary(modelVersion?: string): any {
    let events = this.analytics;
    
    if (modelVersion) {
      events = events.filter(e => e.modelVersion === modelVersion);
    }

    const summary = {
      totalEvents: events.length,
      matchesPlayed: events.filter(e => e.eventType === 'match_end').length,
      errors: events.filter(e => e.eventType === 'error').length,
      byDifficulty: new Map<DifficultyLevel, number>(),
      byStyle: new Map<FightingStyle, number>(),
      averageMatchDuration: 0,
    };

    // Compute statistics
    for (const event of events) {
      if (event.eventType === 'match_end') {
        const count = summary.byDifficulty.get(event.difficulty) || 0;
        summary.byDifficulty.set(event.difficulty, count + 1);

        const styleCount = summary.byStyle.get(event.style) || 0;
        summary.byStyle.set(event.style, styleCount + 1);
      }
    }

    return summary;
  }

  /**
   * Query models by criteria
   */
  queryModels(criteria: {
    difficulty?: DifficultyLevel;
    style?: FightingStyle;
    minElo?: number;
    maxElo?: number;
    status?: ModelVersion['deploymentStatus'];
    tags?: string[];
  }): ModelVersion[] {
    let results = Array.from(this.versions.values());

    if (criteria.difficulty !== undefined) {
      results = results.filter(v => v.difficulty === criteria.difficulty);
    }

    if (criteria.style !== undefined) {
      results = results.filter(v => v.style === criteria.style);
    }

    if (criteria.minElo !== undefined) {
      results = results.filter(v => v.performance.eloRating >= criteria.minElo!);
    }

    if (criteria.maxElo !== undefined) {
      results = results.filter(v => v.performance.eloRating <= criteria.maxElo!);
    }

    if (criteria.status !== undefined) {
      results = results.filter(v => v.deploymentStatus === criteria.status);
    }

    if (criteria.tags && criteria.tags.length > 0) {
      results = results.filter(v => 
        criteria.tags!.some(tag => v.tags.includes(tag))
      );
    }

    return results;
  }

  /**
   * Load registry from disk
   */
  private load(): void {
    const registryFile = path.join(this.registryPath, 'registry.json');
    
    if (fs.existsSync(registryFile)) {
      const data = JSON.parse(fs.readFileSync(registryFile, 'utf8'));
      
      this.versions = new Map(Object.entries(data.versions || {}));
      this.activeTests = new Map(Object.entries(data.activeTests || {}));
      
      console.log(`Loaded ${this.versions.size} model versions from registry`);
    }

    // Load analytics
    const analyticsFile = path.join(this.registryPath, 'analytics.json');
    if (fs.existsSync(analyticsFile)) {
      this.analytics = JSON.parse(fs.readFileSync(analyticsFile, 'utf8'));
      console.log(`Loaded ${this.analytics.length} analytics events`);
    }
  }

  /**
   * Save registry to disk
   */
  private save(): void {
    const data = {
      versions: Object.fromEntries(this.versions),
      activeTests: Object.fromEntries(this.activeTests),
      lastUpdated: Date.now(),
    };

    const registryFile = path.join(this.registryPath, 'registry.json');
    fs.writeFileSync(registryFile, JSON.stringify(data, null, 2));
  }

  /**
   * Save analytics to disk
   */
  private saveAnalytics(): void {
    const analyticsFile = path.join(this.registryPath, 'analytics.json');
    fs.writeFileSync(analyticsFile, JSON.stringify(this.analytics, null, 2));
  }

  /**
   * Export registry report
   */
  exportReport(outputPath: string): void {
    const report = {
      summary: {
        totalVersions: this.versions.size,
        productionVersions: Array.from(this.versions.values()).filter(v => v.deploymentStatus === 'production').length,
        stagingVersions: Array.from(this.versions.values()).filter(v => v.deploymentStatus === 'staging').length,
        activeABTests: Array.from(this.activeTests.values()).filter(t => t.status === 'active').length,
      },
      versions: Array.from(this.versions.values()),
      activeTests: Array.from(this.activeTests.values()),
      analytics: this.getAnalyticsSummary(),
      generatedAt: Date.now(),
    };

    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`Registry report exported to: ${outputPath}`);
  }
}

/**
 * Create model version from training checkpoint
 */
export function createModelVersionFromCheckpoint(
  checkpointPath: string,
  metadata: {
    version: string;
    difficulty: DifficultyLevel;
    style: FightingStyle;
    targetElo: number;
    trainingSteps: number;
    trainingDuration: number;
    tags?: string[];
    notes?: string;
  }
): ModelVersion {
  const id = `model_${metadata.difficulty}_${metadata.style}_v${metadata.version}`;

  return {
    id,
    version: metadata.version,
    modelPath: checkpointPath,
    difficulty: metadata.difficulty,
    style: metadata.style,
    targetElo: metadata.targetElo,
    trainingSteps: metadata.trainingSteps,
    trainingDuration: metadata.trainingDuration,
    performance: {
      winRate: 0.5,
      averageReward: 0,
      eloRating: metadata.targetElo,
      inferenceTimeMs: 0,
      modelSizeKB: 0,
    },
    validation: {
      stallingRate: 0,
      loopRate: 0,
      diversityScore: 0,
      passedRegression: false,
    },
    deploymentStatus: 'pending',
    createdAt: Date.now(),
    tags: metadata.tags || [],
    notes: metadata.notes || '',
  };
}

/**
 * Deploy model to production with canary release
 */
export async function deployWithCanary(
  registry: ModelRegistry,
  versionId: string,
  canaryPercentage: number = 0.1,
  canaryDuration: number = 24 * 60 * 60 * 1000 // 24 hours
): Promise<void> {
  const version = registry.getVersion(versionId);
  if (!version) {
    throw new Error(`Version ${versionId} not found`);
  }

  // Get current production model
  const currentProd = registry.getProductionModel(version.difficulty, version.style);
  if (!currentProd) {
    // No current production, directly promote
    registry.promoteToProduction(versionId);
    return;
  }

  // Create A/B test
  const test: ABTest = {
    id: `canary_${versionId}_${Date.now()}`,
    name: `Canary: ${versionId} vs ${currentProd.id}`,
    description: `Canary deployment testing ${versionId} at ${canaryPercentage * 100}% traffic`,
    modelA: currentProd.id,
    modelB: versionId,
    trafficSplit: canaryPercentage,
    startDate: Date.now(),
    metrics: {
      totalMatches: 0,
      modelAWins: 0,
      modelBWins: 0,
      modelAPlayerSatisfaction: 0,
      modelBPlayerSatisfaction: 0,
    },
    status: 'active',
  };

  registry.createABTest(test);
  console.log(`Started canary deployment: ${canaryPercentage * 100}% traffic to ${versionId}`);
  console.log(`Canary will run for ${canaryDuration / (60 * 60 * 1000)} hours`);
}
