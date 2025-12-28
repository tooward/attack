/**
 * Opponent Pool Manager
 * 
 * Manages a pool of opponent policy snapshots with Elo ranking.
 * Provides sampling strategies to ensure diverse training opponents.
 */

import { ActorCriticPolicy } from '../training/PPOTrainer';
import { EloRating, RatedPlayer, MatchResult } from '../evaluation/EloRating';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Opponent snapshot metadata
 */
export interface OpponentMetadata {
  checkpoint: number;        // Training step when snapshot was taken
  timestamp: number;         // Unix timestamp
  style?: string;            // Fighting style (rushdown, zoner, etc.)
  difficulty?: number;       // Intended difficulty level (1-10)
  trainingTime?: number;     // Total training time in ms
  avgReward?: number;        // Average reward at checkpoint
  notes?: string;            // Optional notes
}

/**
 * Opponent snapshot
 */
export interface OpponentSnapshot {
  id: string;
  policy: ActorCriticPolicy;
  elo: number;
  gamesPlayed: number;
  winRate: number;
  metadata: OpponentMetadata;
}

/**
 * Sampling strategy
 */
export type SamplingStrategy = 'recent' | 'mixed' | 'strong' | 'weak' | 'curriculum' | 'uniform';

/**
 * Opponent pool configuration
 */
export interface OpponentPoolConfig {
  maxSnapshots: number;          // Maximum pool size (default: 18)
  snapshotFrequency: number;     // Steps between snapshots (default: 100k)
  samplingStrategy: SamplingStrategy;
  keepBest: number;              // Always keep top N by Elo (default: 5)
  keepRecent: number;            // Always keep last N (default: 5)
  keepBaselines: number;         // Keep scripted baselines (default: 3)
  savePath: string;              // Directory to save snapshots
}

/**
 * Default opponent pool configuration
 */
export const DEFAULT_POOL_CONFIG: OpponentPoolConfig = {
  maxSnapshots: 18,
  snapshotFrequency: 100_000,
  samplingStrategy: 'mixed',
  keepBest: 5,
  keepRecent: 5,
  keepBaselines: 3,
  savePath: './models/opponent_pool',
};

/**
 * Opponent Pool Manager
 */
export class OpponentPool {
  private config: OpponentPoolConfig;
  private snapshots: OpponentSnapshot[];
  private eloRating: EloRating;
  private nextSnapshotId: number = 1;
  private saveQueue: Promise<void> = Promise.resolve();
  private inFlightSaves: Map<string, Promise<void>> = new Map();

  constructor(config: OpponentPoolConfig = DEFAULT_POOL_CONFIG) {
    this.config = config;
    this.snapshots = [];
    this.eloRating = new EloRating();

    // Create save directory
    this.ensureDirectoryExists(this.config.savePath);
  }

  /**
   * Add a new snapshot to the pool
   */
  addSnapshot(
    policy: ActorCriticPolicy,
    metadata: OpponentMetadata
  ): OpponentSnapshot {
    // Choose a unique snapshot id even if we restarted training with an existing
    // pool on disk.
    let id = `snapshot_${this.nextSnapshotId}`;
    while (
      this.snapshots.some(s => s.id === id) ||
      fs.existsSync(path.join(this.config.savePath, id))
    ) {
      this.nextSnapshotId++;
      id = `snapshot_${this.nextSnapshotId}`;
    }
    this.nextSnapshotId++;
    
    // Register in Elo system
    this.eloRating.registerPlayer(id);

    // Create snapshot
    const snapshot: OpponentSnapshot = {
      id,
      policy: policy.clone(),
      elo: this.eloRating.getPlayer(id)!.rating,
      gamesPlayed: 0,
      winRate: 0.5,
      metadata,
    };

    this.snapshots.push(snapshot);

    // Prune if over limit
    if (this.snapshots.length > this.config.maxSnapshots) {
      this.pruneSnapshots();
    }

    // Save snapshot to disk (best-effort).
    // In Jest runs, skip auto-saving to keep unit tests deterministic and quiet.
    const shouldAutoSave =
      process.env.NODE_ENV !== 'test' &&
      process.env.JEST_WORKER_ID === undefined;
    if (shouldAutoSave) {
      this.enqueueSave(snapshot);
    }

    return snapshot;
  }

  /**
   * Get snapshot by ID
   */
  getSnapshot(id: string): OpponentSnapshot | undefined {
    return this.snapshots.find(s => s.id === id);
  }

  /**
   * Get all snapshots
   */
  getAllSnapshots(): OpponentSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Sample an opponent from the pool
   */
  sampleOpponent(strategy?: SamplingStrategy): OpponentSnapshot {
    if (this.snapshots.length === 0) {
      throw new Error('Opponent pool is empty');
    }

    const samplingStrategy = strategy || this.config.samplingStrategy;

    switch (samplingStrategy) {
      case 'recent':
        return this.sampleRecent();
      case 'mixed':
        return this.sampleMixed();
      case 'strong':
        return this.sampleStrong();
      case 'weak':
        return this.sampleWeak();
      case 'curriculum':
        return this.sampleCurriculum();
      case 'uniform':
        return this.sampleUniform();
      default:
        return this.sampleUniform();
    }
  }

  /**
   * Update Elo after a match
   */
  updateElo(winnerId: string, loserId: string): void {
    const result = this.eloRating.updateRatings(winnerId, loserId, MatchResult.WIN);

    // Update snapshot Elo values
    const winnerSnapshot = this.snapshots.find(s => s.id === winnerId);
    const loserSnapshot = this.snapshots.find(s => s.id === loserId);

    if (winnerSnapshot) {
      winnerSnapshot.elo = result.winner.rating;
      winnerSnapshot.gamesPlayed++;
      winnerSnapshot.winRate = result.winner.wins / result.winner.gamesPlayed;
    }

    if (loserSnapshot) {
      loserSnapshot.elo = result.loser.rating;
      loserSnapshot.gamesPlayed++;
      loserSnapshot.winRate = loserSnapshot.gamesPlayed > 0 
        ? this.eloRating.getPlayer(loserId)!.wins / loserSnapshot.gamesPlayed
        : 0.5;
    }
  }

  /**
   * Get snapshots sorted by Elo (descending)
   */
  getLeaderboard(): OpponentSnapshot[] {
    return [...this.snapshots].sort((a, b) => b.elo - a.elo);
  }

  /**
   * Get snapshots by style
   */
  getSnapshotsByStyle(style: string): OpponentSnapshot[] {
    return this.snapshots.filter(s => s.metadata.style === style);
  }

  /**
   * Get snapshots in Elo range
   */
  getSnapshotsInEloRange(minElo: number, maxElo: number): OpponentSnapshot[] {
    return this.snapshots.filter(s => s.elo >= minElo && s.elo <= maxElo);
  }

  /**
   * Sample recent opponents (strongly favors recent checkpoints)
   */
  private sampleRecent(): OpponentSnapshot {
    const recentCount = Math.min(this.config.keepRecent, this.snapshots.length);
    const recent = this.snapshots.slice(-recentCount);

    // Recent strategy: always sample from the most recent snapshots.
    // Use 'mixed' if you want exposure to older opponents.
    return this.randomChoice(recent);
  }

  /**
   * Sample with mixed strategy (uniform across all)
   */
  private sampleMixed(): OpponentSnapshot {
    return this.randomChoice(this.snapshots);
  }

  /**
   * Sample strong opponents (80% from top 50% Elo, 20% from bottom)
   */
  private sampleStrong(): OpponentSnapshot {
    const sorted = this.getLeaderboard();
    const midpoint = Math.floor(sorted.length / 2);

    if (Math.random() < 0.8) {
      const strong = sorted.slice(0, midpoint || 1);
      return this.randomChoice(strong);
    } else {
      const weak = sorted.slice(midpoint);
      return this.randomChoice(weak);
    }
  }

  /**
   * Sample weak opponents (80% from bottom 50%, 20% from top)
   */
  private sampleWeak(): OpponentSnapshot {
    const sorted = this.getLeaderboard();
    const midpoint = Math.floor(sorted.length / 2);

    if (Math.random() < 0.8) {
      const weak = sorted.slice(midpoint);
      return this.randomChoice(weak);
    } else {
      const strong = sorted.slice(0, midpoint || 1);
      return this.randomChoice(strong);
    }
  }

  /**
   * Sample for curriculum learning (progressively harder)
   */
  private sampleCurriculum(): OpponentSnapshot {
    // This would be enhanced based on current policy strength
    // For now, use a simple heuristic
    const sorted = this.getLeaderboard().reverse(); // Weakest first
    
    // Sample from bottom 70% of pool
    const curriculumSize = Math.ceil(sorted.length * 0.7);
    const curriculum = sorted.slice(0, curriculumSize);
    
    return this.randomChoice(curriculum);
  }

  /**
   * Sample uniformly
   */
  private sampleUniform(): OpponentSnapshot {
    return this.randomChoice(this.snapshots);
  }

  /**
   * Prune snapshots when pool is full
   */
  private pruneSnapshots(): void {
    if (this.snapshots.length <= this.config.maxSnapshots) {
      return;
    }

    const toKeep = new Set<string>();

    // Keep best by Elo
    const best = this.getLeaderboard().slice(0, this.config.keepBest);
    best.forEach(s => toKeep.add(s.id));

    // Keep recent
    const recent = this.snapshots.slice(-this.config.keepRecent);
    recent.forEach(s => toKeep.add(s.id));

    // Keep baselines (those with metadata.notes === 'baseline')
    const baselines = this.snapshots
      .filter(s => s.metadata.notes === 'baseline')
      .slice(0, this.config.keepBaselines);
    baselines.forEach(s => toKeep.add(s.id));

    // Remove snapshots not in keep set
    const toRemove = this.snapshots.filter(s => !toKeep.has(s.id));
    
    // Remove oldest from the remaining
    const numToRemove = this.snapshots.length - this.config.maxSnapshots;
    const sorted = toRemove.sort((a, b) => a.metadata.checkpoint - b.metadata.checkpoint);
    const removed = sorted.slice(0, numToRemove);

    // Delete from disk
    removed.forEach(s => this.deleteSnapshot(s.id));

    // Update snapshots array
    this.snapshots = this.snapshots.filter(s => !removed.find(r => r.id === s.id));
  }

  /**
   * Save snapshot to disk
   */
  private async saveSnapshot(snapshot: OpponentSnapshot): Promise<void> {
    // The base directory may be removed between runs; recreate defensively.
    this.ensureDirectoryExists(this.config.savePath);
    const snapshotPath = path.join(this.config.savePath, snapshot.id);
    this.ensureDirectoryExists(snapshotPath);

    // Save policy
    await snapshot.policy.save(snapshotPath);

    // Save metadata
    const metadataPath = path.join(snapshotPath, 'metadata.json');
    const data = {
      id: snapshot.id,
      elo: snapshot.elo,
      gamesPlayed: snapshot.gamesPlayed,
      winRate: snapshot.winRate,
      metadata: snapshot.metadata,
    };

    fs.writeFileSync(metadataPath, JSON.stringify(data, null, 2));
  }

  private enqueueSave(snapshot: OpponentSnapshot): void {
    const task = async () => {
      try {
        await this.saveSnapshot(snapshot);
      } catch (err) {
        console.warn(`Failed to save opponent snapshot ${snapshot.id}:`, err);
      }
    };

    // Serialize saves to avoid racing with prune deletions.
    const chained = this.saveQueue.then(task, task);
    this.saveQueue = chained.then(() => undefined, () => undefined);

    // Track in-flight save by id so we can defer deletion safely.
    this.inFlightSaves.set(snapshot.id, chained);
    void chained.finally(() => {
      const current = this.inFlightSaves.get(snapshot.id);
      if (current === chained) this.inFlightSaves.delete(snapshot.id);
    });
  }

  /**
   * Load snapshot from disk
   */
  async loadSnapshot(id: string): Promise<OpponentSnapshot | null> {
    const snapshotPath = path.join(this.config.savePath, id);
    const metadataPath = path.join(snapshotPath, 'metadata.json');

    if (!fs.existsSync(metadataPath)) {
      return null;
    }

    // Load metadata
    const data = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

    // Load policy
    // Construct with minimal valid dimensions; `load()` replaces the model.
    // (Using 0 would create invalid Dense layers.)
    const policy = new ActorCriticPolicy(1, 1);
    await policy.load(snapshotPath);

    return {
      id: data.id,
      policy,
      elo: data.elo,
      gamesPlayed: data.gamesPlayed,
      winRate: data.winRate,
      metadata: data.metadata,
    };
  }

  /**
   * Load all snapshots from disk
   */
  async loadAllSnapshots(): Promise<void> {
    if (!fs.existsSync(this.config.savePath)) {
      return;
    }

    const entries = fs.readdirSync(this.config.savePath, { withFileTypes: true });
    const snapshotDirs = entries.filter(e => e.isDirectory()).map(e => e.name);

    // Keep nextSnapshotId ahead of what exists on disk.
    let maxNumericId = 0;
    for (const dir of snapshotDirs) {
      const match = /^snapshot_(\d+)$/.exec(dir);
      if (match) {
        const n = Number(match[1]);
        if (Number.isFinite(n)) {
          maxNumericId = Math.max(maxNumericId, n);
        }
      }
    }
    this.nextSnapshotId = Math.max(this.nextSnapshotId, maxNumericId + 1);

    for (const id of snapshotDirs) {
      const snapshot = await this.loadSnapshot(id);
      if (snapshot) {
        this.snapshots.push(snapshot);
        this.eloRating.registerPlayer(id, snapshot.elo);
      }
    }

    // Also advance based on loaded snapshots in case any were added in-memory
    // or names didn't match the expected pattern.
    this.nextSnapshotId = Math.max(
      this.nextSnapshotId,
      this.snapshots.length + 1
    );
  }

  /**
   * Delete snapshot from disk
   */
  private deleteSnapshot(id: string): void {
    const inflight = this.inFlightSaves.get(id);
    if (inflight) {
      // Defer deletion until any ongoing save completes to prevent ENOENT
      // during tfjs-node's filesystem writes.
      void inflight.finally(() => {
        this.deleteSnapshotNow(id);
      });
      return;
    }

    this.deleteSnapshotNow(id);
  }

  private deleteSnapshotNow(id: string): void {
    const snapshotPath = path.join(this.config.savePath, id);
    
    if (fs.existsSync(snapshotPath)) {
      fs.rmSync(snapshotPath, { recursive: true, force: true });
    }
  }

  /**
   * Ensure directory exists
   */
  private ensureDirectoryExists(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Random choice from array
   */
  private randomChoice<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /**
   * Get pool statistics
   */
  getStatistics(): {
    count: number;
    avgElo: number;
    minElo: number;
    maxElo: number;
    avgGamesPlayed: number;
    avgWinRate: number;
    styleDistribution: Record<string, number>;
  } {
    if (this.snapshots.length === 0) {
      return {
        count: 0,
        avgElo: 0,
        minElo: 0,
        maxElo: 0,
        avgGamesPlayed: 0,
        avgWinRate: 0,
        styleDistribution: {},
      };
    }

    const elos = this.snapshots.map(s => s.elo);
    const styleDistribution: Record<string, number> = {};

    for (const snapshot of this.snapshots) {
      const style = snapshot.metadata.style || 'unknown';
      styleDistribution[style] = (styleDistribution[style] || 0) + 1;
    }

    return {
      count: this.snapshots.length,
      avgElo: elos.reduce((a, b) => a + b, 0) / elos.length,
      minElo: Math.min(...elos),
      maxElo: Math.max(...elos),
      avgGamesPlayed: this.snapshots.reduce((sum, s) => sum + s.gamesPlayed, 0) / this.snapshots.length,
      avgWinRate: this.snapshots.reduce((sum, s) => sum + s.winRate, 0) / this.snapshots.length,
      styleDistribution,
    };
  }

  /**
   * Export pool state
   */
  export(): {
    config: OpponentPoolConfig;
    snapshots: Array<{ id: string; elo: number; gamesPlayed: number; metadata: OpponentMetadata }>;
    eloData: any;
  } {
    return {
      config: this.config,
      snapshots: this.snapshots.map(s => ({
        id: s.id,
        elo: s.elo,
        gamesPlayed: s.gamesPlayed,
        metadata: s.metadata,
      })),
      eloData: this.eloRating.export(),
    };
  }

  /**
   * Clear pool
   */
  clear(): void {
    this.snapshots = [];
    this.eloRating.reset();
    this.nextSnapshotId = 1;
  }
}
