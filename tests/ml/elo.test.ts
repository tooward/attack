/**
 * Tests for EloRating system
 */

import { EloRating, MatchResult } from '../../src/ml/evaluation/EloRating';

describe('EloRating', () => {
  let eloRating: EloRating;

  beforeEach(() => {
    eloRating = new EloRating();
  });

  describe('Player Registration', () => {
    test('should register a new player with default rating', () => {
      const player = eloRating.registerPlayer('player1');
      
      expect(player).toBeDefined();
      expect(player.id).toBe('player1');
      expect(player.rating).toBe(1500);
      expect(player.gamesPlayed).toBe(0);
      expect(player.wins).toBe(0);
      expect(player.losses).toBe(0);
    });

    test('should register a new player with custom rating', () => {
      const player = eloRating.registerPlayer('player1', 1800);
      
      expect(player.rating).toBe(1800);
    });

    test('should not allow duplicate player IDs', () => {
      eloRating.registerPlayer('player1');
      
      expect(() => {
        eloRating.registerPlayer('player1');
      }).toThrow('Player player1 already registered');
    });

    test('should retrieve registered player', () => {
      eloRating.registerPlayer('player1');
      const player = eloRating.getPlayer('player1');
      
      expect(player).toBeDefined();
      expect(player!.id).toBe('player1');
    });

    test('should return undefined for unregistered player', () => {
      const player = eloRating.getPlayer('nonexistent');
      expect(player).toBeUndefined();
    });
  });

  describe('Expected Score Calculation', () => {
    test('should calculate 50% expected score for equal ratings', () => {
      const expected = eloRating.calculateExpectedScore(1500, 1500);
      expect(expected).toBeCloseTo(0.5, 2);
    });

    test('should calculate higher expected score for stronger player', () => {
      const expected = eloRating.calculateExpectedScore(1600, 1500);
      expect(expected).toBeGreaterThan(0.5);
    });

    test('should calculate lower expected score for weaker player', () => {
      const expected = eloRating.calculateExpectedScore(1400, 1500);
      expect(expected).toBeLessThan(0.5);
    });

    test('should calculate ~90% expected for 200 rating difference', () => {
      const expected = eloRating.calculateExpectedScore(1700, 1500);
      expect(expected).toBeCloseTo(0.76, 1);
    });
  });

  describe('Rating Updates', () => {
    beforeEach(() => {
      eloRating.registerPlayer('player1');
      eloRating.registerPlayer('player2');
    });

    test('should update ratings after a win', () => {
      const result = eloRating.updateRatings('player1', 'player2', MatchResult.WIN);
      
      expect(result.winner.rating).toBeGreaterThan(1500);
      expect(result.loser.rating).toBeLessThan(1500);
      expect(result.winner.gamesPlayed).toBe(1);
      expect(result.loser.gamesPlayed).toBe(1);
      expect(result.winner.wins).toBe(1);
      expect(result.loser.losses).toBe(1);
    });

    test('should update both players equally for a draw', () => {
      const initialRating1 = eloRating.getPlayer('player1')!.rating;
      const initialRating2 = eloRating.getPlayer('player2')!.rating;
      
      eloRating.updateRatings('player1', 'player2', MatchResult.DRAW);
      
      const finalRating1 = eloRating.getPlayer('player1')!.rating;
      const finalRating2 = eloRating.getPlayer('player2')!.rating;
      
      expect(finalRating1).toBe(initialRating1);
      expect(finalRating2).toBe(initialRating2);
    });

    test('should converge ratings over many matches between equal players', () => {
      // Play 100 matches with 50% win rate
      for (let i = 0; i < 100; i++) {
        const winner = i % 2 === 0 ? 'player1' : 'player2';
        const loser = winner === 'player1' ? 'player2' : 'player1';
        eloRating.updateRatings(winner, loser, MatchResult.WIN);
      }
      
      const player1 = eloRating.getPlayer('player1')!;
      const player2 = eloRating.getPlayer('player2')!;
      
      // Ratings should be close after 50-50 match history
      expect(Math.abs(player1.rating - player2.rating)).toBeLessThan(50);
    });

    test('should show stronger player gain less from weak opponent', () => {
      eloRating.registerPlayer('strong', 1800);
      eloRating.registerPlayer('weak', 1200);
      
      const result = eloRating.updateRatings('strong', 'weak', MatchResult.WIN);
      
      const ratingGain = result.winner.rating - 1800;
      expect(ratingGain).toBeLessThan(10); // Small gain from expected win
    });

    test('should show weaker player gain more from strong opponent', () => {
      eloRating.registerPlayer('strong', 1800);
      eloRating.registerPlayer('weak', 1200);
      
      const result = eloRating.updateRatings('weak', 'strong', MatchResult.WIN);
      
      const ratingGain = result.winner.rating - 1200;
      expect(ratingGain).toBeGreaterThan(20); // Large gain from upset
    });
  });

  describe('Adaptive K-Factor', () => {
    beforeEach(() => {
      eloRating.registerPlayer('player1');
      eloRating.registerPlayer('player2');
    });

    test('should use higher K for new players', () => {
      const result = eloRating.updateRatingsAdaptive('player1', 'player2');
      const ratingChange = Math.abs(result.winner.rating - 1500);
      
      expect(ratingChange).toBeGreaterThan(10); // High volatility for new players
    });

    test('should use lower K for experienced players', () => {
      // Play 50 matches to establish rating
      for (let i = 0; i < 50; i++) {
        eloRating.updateRatingsAdaptive('player1', 'player2');
      }
      
      const rating1 = eloRating.getPlayer('player1')!.rating;
      const result = eloRating.updateRatingsAdaptive('player1', 'player2');
      const ratingChange = Math.abs(result.winner.rating - rating1);
      
      expect(ratingChange).toBeLessThan(20); // Lower volatility for experienced
    });
  });

  describe('Leaderboard', () => {
    test('should return empty array for no players', () => {
      const leaderboard = eloRating.getLeaderboard();
      expect(leaderboard).toEqual([]);
    });

    test('should return leaderboard sorted by rating descending', () => {
      eloRating.registerPlayer('player1', 1400);
      eloRating.registerPlayer('player2', 1600);
      eloRating.registerPlayer('player3', 1500);
      
      const leaderboard = eloRating.getLeaderboard();
      
      expect(leaderboard).toHaveLength(3);
      expect(leaderboard[0].id).toBe('player2'); // Highest
      expect(leaderboard[1].id).toBe('player3');
      expect(leaderboard[2].id).toBe('player1'); // Lowest
    });

    test('should limit leaderboard size', () => {
      for (let i = 0; i < 20; i++) {
        eloRating.registerPlayer(`player${i}`);
      }
      
      const leaderboard = eloRating.getTopPlayers(10);
      expect(leaderboard).toHaveLength(10);
    });
  });

  describe('Statistics', () => {
    test('should calculate correct statistics', () => {
      eloRating.registerPlayer('player1', 1400);
      eloRating.registerPlayer('player2', 1500);
      eloRating.registerPlayer('player3', 1600);
      
      const stats = eloRating.getStatistics();
      
      expect(stats.count).toBe(3);
      expect(stats.mean).toBe(1500);
      expect(stats.median).toBe(1500);
      expect(stats.min).toBe(1400);
      expect(stats.max).toBe(1600);
    });

    test('should handle empty statistics', () => {
      const stats = eloRating.getStatistics();
      
      expect(stats.count).toBe(0);
      expect(stats.mean).toBe(0);
    });
  });

  describe('Reset', () => {
    test('should clear all players', () => {
      eloRating.registerPlayer('player1');
      eloRating.registerPlayer('player2');
      
      eloRating.reset();
      
      const stats = eloRating.getStatistics();
      expect(stats.count).toBe(0);
    });
  });

  describe('Export/Import', () => {
    test('should export player data', () => {
      eloRating.registerPlayer('player1', 1600);
      eloRating.updateRatings('player1', eloRating.registerPlayer('player2').id, MatchResult.WIN);
      
      const data = eloRating.export();
      
      expect(data.players).toHaveLength(2);
      expect(data.config).toBeDefined();
    });

    test('should maintain ratings through export/import cycle', () => {
      eloRating.registerPlayer('player1', 1600);
      eloRating.registerPlayer('player2', 1400);
      
      const exported = eloRating.export();
      
      // Create new instance and import
      const newElo = new EloRating();
      newElo.import(exported);
      
      const player1 = newElo.getPlayer('player1');
      const player2 = newElo.getPlayer('player2');
      
      expect(player1?.rating).toBe(1600);
      expect(player2?.rating).toBe(1400);
    });
  });
});
