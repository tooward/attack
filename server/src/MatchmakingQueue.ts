export interface QueueEntry {
  clientId: string;
  userId: string;
  elo: number;
  region: string;
  joinTime: number;
}

export interface MatchmakingConfig {
  baseEloDiff: number;          // Starting Elo tolerance (default: 200)
  eloRelaxPerSecond: number;    // How much to relax per second (default: 10)
  maxWaitTime: number;          // Max wait before matching anyone (default: 60s)
  checkInterval: number;        // How often to check for matches (default: 2s)
}

export class MatchmakingQueue {
  private queue: QueueEntry[] = [];
  private matchCheckInterval: NodeJS.Timeout;
  private config: MatchmakingConfig;
  private onMatchFound: (p1: QueueEntry, p2: QueueEntry) => void;

  constructor(
    onMatchFound: (p1: QueueEntry, p2: QueueEntry) => void,
    config: Partial<MatchmakingConfig> = {}
  ) {
    this.onMatchFound = onMatchFound;
    this.config = {
      baseEloDiff: config.baseEloDiff || 200,
      eloRelaxPerSecond: config.eloRelaxPerSecond || 10,
      maxWaitTime: config.maxWaitTime || 60000, // 60 seconds
      checkInterval: config.checkInterval || 2000 // 2 seconds
    };

    // Check for matches periodically
    this.matchCheckInterval = setInterval(
      () => this.tryMatchPlayers(),
      this.config.checkInterval
    );

    console.log('Matchmaking queue initialized');
  }

  addPlayer(clientId: string, userId: string, elo: number = 1000, region: string = 'global') {
    // Check if player already in queue by clientId
    if (this.queue.find(e => e.clientId === clientId)) {
      console.warn(`Player ${clientId} already in queue`);
      return;
    }

    // Check if same userId is already in queue (different tab/connection)
    const existingUserEntry = this.queue.find(e => e.userId === userId);
    if (existingUserEntry) {
      console.warn(`User ${userId} already in queue from another connection, removing old entry`);
      this.removePlayer(existingUserEntry.clientId);
    }

    const entry: QueueEntry = {
      clientId,
      userId,
      elo,
      region,
      joinTime: Date.now()
    };

    this.queue.push(entry);
    console.log(`Player added to queue: ${userId} (Elo: ${elo}, Region: ${region}), Queue size: ${this.queue.length}`);

    // Try immediate match
    this.tryMatchPlayers();
  }

  removePlayer(clientId: string) {
    const before = this.queue.length;
    this.queue = this.queue.filter(e => e.clientId !== clientId);
    const after = this.queue.length;

    if (before > after) {
      console.log(`Player removed from queue: ${clientId}, Queue size: ${after}`);
    }
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  getPlayerPosition(clientId: string): number | null {
    const index = this.queue.findIndex(e => e.clientId === clientId);
    return index >= 0 ? index + 1 : null;
  }

  private tryMatchPlayers() {
    if (this.queue.length < 2) return;

    // Sort by join time (FIFO)
    this.queue.sort((a, b) => a.joinTime - b.joinTime);

    // Try to match pairs
    for (let i = 0; i < this.queue.length; i++) {
      for (let j = i + 1; j < this.queue.length; j++) {
        if (this.isGoodMatch(this.queue[i], this.queue[j])) {
          const p1 = this.queue[i];
          const p2 = this.queue[j];

          console.log(`Match found: ${p1.userId} (${p1.elo}) vs ${p2.userId} (${p2.elo})`);
          console.log(`  Elo diff: ${Math.abs(p1.elo - p2.elo)}, Wait time: ${((Date.now() - p1.joinTime) / 1000).toFixed(1)}s`);

          // Remove from queue
          this.queue.splice(j, 1);
          this.queue.splice(i, 1);

          // Create match
          this.onMatchFound(p1, p2);

          // Try to match remaining players
          this.tryMatchPlayers();
          return;
        }
      }
    }
  }

  private isGoodMatch(p1: QueueEntry, p2: QueueEntry): boolean {
    // Never match a player against themselves (same userId from different tabs/connections)
    if (p1.userId === p2.userId) {
      return false;
    }

    // Same region preference (can be relaxed later)
    if (p1.region !== p2.region && p1.region !== 'global' && p2.region !== 'global') {
      const waitTime = Date.now() - Math.min(p1.joinTime, p2.joinTime);
      // After 30 seconds, allow cross-region
      if (waitTime < 30000) {
        return false;
      }
    }

    // Calculate Elo tolerance based on wait time
    const eloDiff = Math.abs(p1.elo - p2.elo);
    const waitTime = Date.now() - Math.min(p1.joinTime, p2.joinTime);

    // Start with base tolerance, relax over time
    const maxEloDiff = this.config.baseEloDiff + (waitTime / 1000) * this.config.eloRelaxPerSecond;

    // After max wait time, match with anyone
    if (waitTime > this.config.maxWaitTime) {
      console.log(`Max wait time exceeded for ${p1.userId} and ${p2.userId}, forcing match`);
      return true;
    }

    return eloDiff < maxEloDiff;
  }

  cleanup() {
    if (this.matchCheckInterval) {
      clearInterval(this.matchCheckInterval);
    }
  }

  // Get queue stats for monitoring
  getStats() {
    const now = Date.now();
    const waitTimes = this.queue.map(e => now - e.joinTime);
    const avgWaitTime = waitTimes.length > 0
      ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length
      : 0;

    return {
      queueSize: this.queue.length,
      avgWaitTime: Math.round(avgWaitTime / 1000),
      longestWait: waitTimes.length > 0 ? Math.round(Math.max(...waitTimes) / 1000) : 0,
      regionBreakdown: this.getRegionBreakdown()
    };
  }

  private getRegionBreakdown(): Record<string, number> {
    const breakdown: Record<string, number> = {};
    for (const entry of this.queue) {
      breakdown[entry.region] = (breakdown[entry.region] || 0) + 1;
    }
    return breakdown;
  }
}
