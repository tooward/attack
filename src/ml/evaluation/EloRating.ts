/**
 * Elo Rating System
 * 
 * Implements Elo-based skill rating for opponent ranking and matchmaking.
 * Used to track relative skill levels in the opponent pool.
 */

/**
 * Elo configuration
 */
export interface EloConfig {
  initialRating: number;  // Starting Elo (default: 1500)
  kFactor: number;        // Sensitivity to wins/losses (default: 32)
  minRating: number;      // Minimum allowed rating (default: 0)
  maxRating: number;      // Maximum allowed rating (default: 5000)
}

/**
 * Default Elo configuration
 */
export const DEFAULT_ELO_CONFIG: EloConfig = {
  initialRating: 1500,
  kFactor: 32,
  minRating: 0,
  maxRating: 5000,
};

/**
 * Match result
 */
export enum MatchResult {
  WIN = 1.0,
  LOSS = 0.0,
  DRAW = 0.5,
}

/**
 * Player with Elo rating
 */
export interface RatedPlayer {
  id: string;
  rating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
}

/**
 * Elo Rating System
 */
export class EloRating {
  private config: EloConfig;
  private players: Map<string, RatedPlayer>;

  constructor(config: EloConfig = DEFAULT_ELO_CONFIG) {
    this.config = config;
    this.players = new Map();
  }

  /**
   * Register a new player
   */
  registerPlayer(playerId: string, initialRating?: number): RatedPlayer {
    if (this.players.has(playerId)) {
      throw new Error(`Player ${playerId} already registered`);
    }

    const player: RatedPlayer = {
      id: playerId,
      rating: initialRating ?? this.config.initialRating,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
    };

    this.players.set(playerId, player);
    return player;
  }

  /**
   * Get player by ID
   */
  getPlayer(playerId: string): RatedPlayer | undefined {
    return this.players.get(playerId);
  }

  /**
   * Get all players
   */
  getAllPlayers(): RatedPlayer[] {
    return Array.from(this.players.values());
  }

  /**
   * Get players sorted by rating (descending)
   */
  getLeaderboard(): RatedPlayer[] {
    return this.getAllPlayers().sort((a, b) => b.rating - a.rating);
  }

  /**
   * Calculate expected score for player A vs player B
   */
  calculateExpectedScore(ratingA: number, ratingB: number): number {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  }

  /**
   * Update ratings after a match
   */
  updateRatings(
    winnerId: string,
    loserId: string,
    result: MatchResult = MatchResult.WIN
  ): { winner: RatedPlayer; loser: RatedPlayer } {
    // Get or create players
    let winner = this.players.get(winnerId);
    let loser = this.players.get(loserId);

    if (!winner) {
      winner = this.registerPlayer(winnerId);
    }
    if (!loser) {
      loser = this.registerPlayer(loserId);
    }

    // Calculate expected scores
    const expectedWinner = this.calculateExpectedScore(winner.rating, loser.rating);
    const expectedLoser = this.calculateExpectedScore(loser.rating, winner.rating);

    // Calculate rating changes
    const actualWinner = result === MatchResult.WIN ? 1.0 : result === MatchResult.DRAW ? 0.5 : 0.0;
    const actualLoser = 1.0 - actualWinner;

    const winnerChange = this.config.kFactor * (actualWinner - expectedWinner);
    const loserChange = this.config.kFactor * (actualLoser - expectedLoser);

    // Update ratings
    winner.rating = this.clampRating(winner.rating + winnerChange);
    loser.rating = this.clampRating(loser.rating + loserChange);

    // Update stats
    winner.gamesPlayed++;
    loser.gamesPlayed++;

    if (result === MatchResult.WIN) {
      winner.wins++;
      loser.losses++;
    } else if (result === MatchResult.LOSS) {
      winner.losses++;
      loser.wins++;
    } else {
      winner.draws++;
      loser.draws++;
    }

    return { winner, loser };
  }

  /**
   * Get win probability for player A vs player B
   */
  getWinProbability(playerA: string, playerB: string): number {
    const ratingA = this.players.get(playerA)?.rating ?? this.config.initialRating;
    const ratingB = this.players.get(playerB)?.rating ?? this.config.initialRating;

    return this.calculateExpectedScore(ratingA, ratingB);
  }

  /**
   * Get rating difference between two players
   */
  getRatingDifference(playerA: string, playerB: string): number {
    const ratingA = this.players.get(playerA)?.rating ?? this.config.initialRating;
    const ratingB = this.players.get(playerB)?.rating ?? this.config.initialRating;

    return ratingA - ratingB;
  }

  /**
   * Get players within a rating range
   */
  getPlayersInRange(minRating: number, maxRating: number): RatedPlayer[] {
    return this.getAllPlayers().filter(
      (player) => player.rating >= minRating && player.rating <= maxRating
    );
  }

  /**
   * Get top N players
   */
  getTopPlayers(n: number): RatedPlayer[] {
    return this.getLeaderboard().slice(0, n);
  }

  /**
   * Calculate K-factor based on games played (adaptive K)
   */
  calculateAdaptiveK(gamesPlayed: number): number {
    // Higher K for new players (faster rating adjustment)
    // Lower K for experienced players (more stable)
    if (gamesPlayed < 20) {
      return 64; // High K for new players
    } else if (gamesPlayed < 100) {
      return 32; // Medium K for developing players
    } else {
      return 16; // Low K for established players
    }
  }

  /**
   * Update ratings with adaptive K-factor
   */
  updateRatingsAdaptive(
    winnerId: string,
    loserId: string,
    result: MatchResult = MatchResult.WIN
  ): { winner: RatedPlayer; loser: RatedPlayer } {
    // Temporarily adjust K-factor based on games played
    const winner = this.players.get(winnerId);
    const loser = this.players.get(loserId);

    if (!winner || !loser) {
      return this.updateRatings(winnerId, loserId, result);
    }

    // Use average adaptive K
    const originalK = this.config.kFactor;
    const adaptiveK = (
      this.calculateAdaptiveK(winner.gamesPlayed) +
      this.calculateAdaptiveK(loser.gamesPlayed)
    ) / 2;

    this.config.kFactor = adaptiveK;
    const updated = this.updateRatings(winnerId, loserId, result);
    this.config.kFactor = originalK; // Restore original K

    return updated;
  }

  /**
   * Clamp rating to valid range
   */
  private clampRating(rating: number): number {
    return Math.max(
      this.config.minRating,
      Math.min(this.config.maxRating, rating)
    );
  }

  /**
   * Reset all ratings
   */
  reset(): void {
    this.players.clear();
  }

  /**
   * Export player data
   */
  export(): { config: EloConfig; players: RatedPlayer[] } {
    return {
      config: this.config,
      players: this.getAllPlayers(),
    };
  }

  /**
   * Import player data
   */
  import(data: { config: EloConfig; players: RatedPlayer[] }): void {
    this.config = data.config;
    this.players.clear();
    
    for (const player of data.players) {
      this.players.set(player.id, player);
    }
  }

  /**
   * Calculate rating statistics
   */
  getStatistics(): {
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
    count: number;
  } {
    const players = this.getAllPlayers();
    
    if (players.length === 0) {
      return { mean: 0, median: 0, stdDev: 0, min: 0, max: 0, count: 0 };
    }

    const ratings = players.map(p => p.rating);
    const sorted = ratings.sort((a, b) => a - b);
    
    const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const variance = ratings.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / ratings.length;
    const stdDev = Math.sqrt(variance);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    return { mean, median, stdDev, min, max, count: players.length };
  }
}
