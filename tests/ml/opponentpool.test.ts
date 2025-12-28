/**
 * Tests for OpponentPool
 */

import { OpponentPool, OpponentSnapshot, DEFAULT_POOL_CONFIG } from '../../src/ml/training/OpponentPool';
import { ActorCriticPolicy } from '../../src/ml/training/PPOTrainer';
import * as fs from 'fs';
import * as path from 'path';

describe('OpponentPool', () => {
  let pool: OpponentPool;
  const testSavePath = './test_opponent_pool';

  beforeEach(() => {
    // Create pool with test save path
    pool = new OpponentPool({
      ...DEFAULT_POOL_CONFIG,
      savePath: testSavePath,
      maxSnapshots: 10,
    });
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testSavePath)) {
      fs.rmSync(testSavePath, { recursive: true, force: true });
    }
  });

  describe('Snapshot Management', () => {
    test('should add snapshot to pool', () => {
      const policy = new ActorCriticPolicy(43, 10);
      const snapshot = pool.addSnapshot(policy, {
        checkpoint: 1000,
        timestamp: Date.now(),
      });

      expect(snapshot).toBeDefined();
      expect(snapshot.id).toContain('snapshot_');
      expect(snapshot.elo).toBe(1500); // Default Elo
      expect(snapshot.metadata.checkpoint).toBe(1000);
    });

    test('should retrieve snapshot by ID', () => {
      const policy = new ActorCriticPolicy(43, 10);
      const snapshot = pool.addSnapshot(policy, {
        checkpoint: 1000,
        timestamp: Date.now(),
      });

      const retrieved = pool.getSnapshot(snapshot.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(snapshot.id);
    });

    test('should return all snapshots', () => {
      const policy = new ActorCriticPolicy(43, 10);
      
      pool.addSnapshot(policy, { checkpoint: 1000, timestamp: Date.now() });
      pool.addSnapshot(policy, { checkpoint: 2000, timestamp: Date.now() });
      pool.addSnapshot(policy, { checkpoint: 3000, timestamp: Date.now() });

      const snapshots = pool.getAllSnapshots();
      expect(snapshots).toHaveLength(3);
    });

    test('should filter snapshots by style', () => {
      const policy = new ActorCriticPolicy(43, 10);
      
      pool.addSnapshot(policy, { checkpoint: 1000, timestamp: Date.now(), style: 'rushdown' });
      pool.addSnapshot(policy, { checkpoint: 2000, timestamp: Date.now(), style: 'zoner' });
      pool.addSnapshot(policy, { checkpoint: 3000, timestamp: Date.now(), style: 'rushdown' });

      const rushdownSnapshots = pool.getSnapshotsByStyle('rushdown');
      expect(rushdownSnapshots).toHaveLength(2);
    });

    test('should filter snapshots by Elo range', () => {
      const policy = new ActorCriticPolicy(43, 10);
      
      const s1 = pool.addSnapshot(policy, { checkpoint: 1000, timestamp: Date.now() });
      const s2 = pool.addSnapshot(policy, { checkpoint: 2000, timestamp: Date.now() });
      const s3 = pool.addSnapshot(policy, { checkpoint: 3000, timestamp: Date.now() });

      // Manually set Elo ratings
      s1.elo = 1300;
      s2.elo = 1500;
      s3.elo = 1700;

      const midRange = pool.getSnapshotsInEloRange(1400, 1600);
      expect(midRange).toHaveLength(1);
      expect(midRange[0].elo).toBe(1500);
    });
  });

  describe('Pruning', () => {
    test('should prune old snapshots when pool exceeds max size', () => {
      const policy = new ActorCriticPolicy(43, 10);
      
      // Add more snapshots than max
      for (let i = 0; i < 15; i++) {
        pool.addSnapshot(policy, {
          checkpoint: (i + 1) * 1000,
          timestamp: Date.now(),
        });
      }

      const snapshots = pool.getAllSnapshots();
      expect(snapshots.length).toBeLessThanOrEqual(10); // Should be pruned to max
    });

    test('should keep best snapshots during pruning', () => {
      const policy = new ActorCriticPolicy(43, 10);
      
      // Add snapshots and simulate Elo updates
      const snapshots: OpponentSnapshot[] = [];
      for (let i = 0; i < 15; i++) {
        const snapshot = pool.addSnapshot(policy, {
          checkpoint: (i + 1) * 1000,
          timestamp: Date.now(),
        });
        snapshot.elo = 1400 + i * 20; // Increasing Elo
        snapshots.push(snapshot);
      }

      // After pruning, best snapshots should remain
      const remaining = pool.getAllSnapshots();
      const leaderboard = pool.getLeaderboard();
      
      // Top snapshots should be in remaining
      expect(leaderboard[0].elo).toBeGreaterThan(1600);
    });

    test('should keep recent snapshots during pruning', () => {
      const policy = new ActorCriticPolicy(43, 10);
      
      for (let i = 0; i < 15; i++) {
        pool.addSnapshot(policy, {
          checkpoint: (i + 1) * 1000,
          timestamp: Date.now() + i * 1000,
        });
      }

      const remaining = pool.getAllSnapshots();
      
      // Most recent checkpoints should be in remaining
      const latestCheckpoint = Math.max(...remaining.map(s => s.metadata.checkpoint));
      expect(latestCheckpoint).toBe(15000);
    });

    test('should keep baseline snapshots during pruning', () => {
      const policy = new ActorCriticPolicy(43, 10);
      
      // Add baseline snapshot
      pool.addSnapshot(policy, {
        checkpoint: 1000,
        timestamp: Date.now(),
        notes: 'baseline',
      });

      // Add many other snapshots
      for (let i = 0; i < 15; i++) {
        pool.addSnapshot(policy, {
          checkpoint: (i + 2) * 1000,
          timestamp: Date.now(),
        });
      }

      // Baseline should still be present
      const remaining = pool.getAllSnapshots();
      const baseline = remaining.find(s => s.metadata.notes === 'baseline');
      expect(baseline).toBeDefined();
    });
  });

  describe('Sampling Strategies', () => {
    beforeEach(() => {
      const policy = new ActorCriticPolicy(43, 10);
      
      // Add diverse snapshots
      for (let i = 0; i < 10; i++) {
        const snapshot = pool.addSnapshot(policy, {
          checkpoint: (i + 1) * 1000,
          timestamp: Date.now(),
        });
        snapshot.elo = 1300 + i * 50; // Range: 1300-1750
      }
    });

    test('should sample from pool', () => {
      const opponent = pool.sampleOpponent();
      expect(opponent).toBeDefined();
      expect(opponent.policy).toBeDefined();
    });

    test('should throw error when sampling empty pool', () => {
      const emptyPool = new OpponentPool();
      
      expect(() => {
        emptyPool.sampleOpponent();
      }).toThrow('Opponent pool is empty');
    });

    test('should use uniform strategy', () => {
      const samples: string[] = [];
      for (let i = 0; i < 100; i++) {
        samples.push(pool.sampleOpponent('uniform').id);
      }

      // Should have variety in samples
      const uniqueSamples = new Set(samples);
      expect(uniqueSamples.size).toBeGreaterThan(1);
    });

    test('should use strong sampling strategy', () => {
      const samples: OpponentSnapshot[] = [];
      for (let i = 0; i < 100; i++) {
        samples.push(pool.sampleOpponent('strong'));
      }

      // Should mostly sample from upper half of Elo
      const avgElo = samples.reduce((sum, s) => sum + s.elo, 0) / samples.length;
      const poolAvgElo = pool.getStatistics().avgElo;
      
      expect(avgElo).toBeGreaterThan(poolAvgElo);
    });

    test('should use weak sampling strategy', () => {
      const samples: OpponentSnapshot[] = [];
      for (let i = 0; i < 100; i++) {
        samples.push(pool.sampleOpponent('weak'));
      }

      // Should mostly sample from lower half of Elo
      const avgElo = samples.reduce((sum, s) => sum + s.elo, 0) / samples.length;
      const poolAvgElo = pool.getStatistics().avgElo;
      
      expect(avgElo).toBeLessThan(poolAvgElo);
    });

    test('should use recent sampling strategy', () => {
      const samples: OpponentSnapshot[] = [];
      for (let i = 0; i < 100; i++) {
        samples.push(pool.sampleOpponent('recent'));
      }

      // Should mostly sample from recent checkpoints
      const avgCheckpoint = samples.reduce((sum, s) => sum + s.metadata.checkpoint, 0) / samples.length;
      
      // Average checkpoint should be > 7000 (favoring recent)
      expect(avgCheckpoint).toBeGreaterThan(7000);
    });
  });

  describe('Elo Updates', () => {
    let snapshot1: OpponentSnapshot;
    let snapshot2: OpponentSnapshot;

    beforeEach(() => {
      const policy = new ActorCriticPolicy(43, 10);
      snapshot1 = pool.addSnapshot(policy, { checkpoint: 1000, timestamp: Date.now() });
      snapshot2 = pool.addSnapshot(policy, { checkpoint: 2000, timestamp: Date.now() });
    });

    test('should update Elo after match', () => {
      const initialElo1 = snapshot1.elo;
      const initialElo2 = snapshot2.elo;

      pool.updateElo(snapshot1.id, snapshot2.id);

      expect(snapshot1.elo).not.toBe(initialElo1);
      expect(snapshot2.elo).not.toBe(initialElo2);
      expect(snapshot1.elo).toBeGreaterThan(snapshot2.elo);
    });

    test('should update games played', () => {
      pool.updateElo(snapshot1.id, snapshot2.id);

      expect(snapshot1.gamesPlayed).toBe(1);
      expect(snapshot2.gamesPlayed).toBe(1);
    });

    test('should update win rate', () => {
      // Play multiple matches
      pool.updateElo(snapshot1.id, snapshot2.id);
      pool.updateElo(snapshot1.id, snapshot2.id);
      pool.updateElo(snapshot2.id, snapshot1.id);

      expect(snapshot1.gamesPlayed).toBe(3);
      expect(snapshot1.winRate).toBeGreaterThan(0);
      expect(snapshot1.winRate).toBeLessThan(1);
    });
  });

  describe('Leaderboard', () => {
    test('should return empty leaderboard for empty pool', () => {
      const leaderboard = pool.getLeaderboard();
      expect(leaderboard).toEqual([]);
    });

    test('should return leaderboard sorted by Elo', () => {
      const policy = new ActorCriticPolicy(43, 10);
      
      const s1 = pool.addSnapshot(policy, { checkpoint: 1000, timestamp: Date.now() });
      const s2 = pool.addSnapshot(policy, { checkpoint: 2000, timestamp: Date.now() });
      const s3 = pool.addSnapshot(policy, { checkpoint: 3000, timestamp: Date.now() });

      s1.elo = 1400;
      s2.elo = 1600;
      s3.elo = 1500;

      const leaderboard = pool.getLeaderboard();
      
      expect(leaderboard[0].id).toBe(s2.id); // Highest Elo
      expect(leaderboard[1].id).toBe(s3.id);
      expect(leaderboard[2].id).toBe(s1.id); // Lowest Elo
    });
  });

  describe('Statistics', () => {
    test('should calculate pool statistics', () => {
      const policy = new ActorCriticPolicy(43, 10);
      
      pool.addSnapshot(policy, { checkpoint: 1000, timestamp: Date.now(), style: 'rushdown' });
      pool.addSnapshot(policy, { checkpoint: 2000, timestamp: Date.now(), style: 'zoner' });
      pool.addSnapshot(policy, { checkpoint: 3000, timestamp: Date.now(), style: 'rushdown' });

      const stats = pool.getStatistics();
      
      expect(stats.count).toBe(3);
      expect(stats.avgElo).toBe(1500);
      expect(stats.minElo).toBe(1500);
      expect(stats.maxElo).toBe(1500);
      expect(stats.styleDistribution['rushdown']).toBe(2);
      expect(stats.styleDistribution['zoner']).toBe(1);
    });

    test('should handle empty pool statistics', () => {
      const stats = pool.getStatistics();
      
      expect(stats.count).toBe(0);
      expect(stats.avgElo).toBe(0);
    });
  });

  describe('Export/Import', () => {
    test('should export pool state', () => {
      const policy = new ActorCriticPolicy(43, 10);
      
      pool.addSnapshot(policy, { checkpoint: 1000, timestamp: Date.now() });
      pool.addSnapshot(policy, { checkpoint: 2000, timestamp: Date.now() });

      const exported = pool.export();
      
      expect(exported.config).toBeDefined();
      expect(exported.snapshots).toHaveLength(2);
      expect(exported.eloData).toBeDefined();
    });
  });

  describe('Clear', () => {
    test('should clear all snapshots', () => {
      const policy = new ActorCriticPolicy(43, 10);
      
      pool.addSnapshot(policy, { checkpoint: 1000, timestamp: Date.now() });
      pool.addSnapshot(policy, { checkpoint: 2000, timestamp: Date.now() });

      pool.clear();

      expect(pool.getAllSnapshots()).toHaveLength(0);
      expect(pool.getStatistics().count).toBe(0);
    });
  });
});
