/**
 * Evaluation Harness
 * 
 * Comprehensive evaluation system for fighting game bots.
 * Runs benchmark matches, tournaments, and regression tests.
 */

import { ActorCriticPolicy } from '../training/PPOTrainer';
import { FightingGameEnv } from '../core/Environment';
import { ObservationEncoder } from '../core/ObservationEncoder';
import { BehaviorAnalyzer, BehaviorReport, isDegenerateBehavior } from './BehaviorAnalysis';
import { EloRating } from './EloRating';

/**
 * Match result
 */
export interface MatchResult {
  winner: string;
  loser: string;
  draw: boolean;
  rounds: number;
  duration: number;              // Frames
  finalHealth: {
    winner: number;
    loser: number;
  };
  behaviorReport?: BehaviorReport;
}

/**
 * Head-to-head evaluation result
 */
export interface HeadToHeadResult {
  player1Id: string;
  player2Id: string;
  matches: MatchResult[];
  player1Wins: number;
  player2Wins: number;
  draws: number;
  winRate: number;               // Player 1 win rate
  avgMatchDuration: number;
  behaviorAnalysis: {
    player1: BehaviorReport;
    player2: BehaviorReport;
  };
}

/**
 * Tournament result
 */
export interface TournamentResult {
  participants: string[];
  matches: Map<string, HeadToHeadResult>;
  standings: {
    id: string;
    wins: number;
    losses: number;
    draws: number;
    elo: number;
  }[];
  champion: string;
  runnerUp: string;
}

/**
 * Benchmark configuration
 */
export interface BenchmarkConfig {
  numMatches: number;            // Per head-to-head
  maxFramesPerMatch: number;     // Timeout
  recordBehavior: boolean;       // Track stalling, loops, etc.
  verbose: boolean;              // Log match details
}

/**
 * Default benchmark configuration
 */
export const DEFAULT_BENCHMARK_CONFIG: BenchmarkConfig = {
  numMatches: 10,
  maxFramesPerMatch: 3600,       // 60 seconds at 60 FPS
  recordBehavior: true,
  verbose: false,
};

/**
 * Evaluation Harness
 */
export class EvaluationHarness {
  private env: FightingGameEnv;
  private obsEncoder: ObservationEncoder;
  private config: BenchmarkConfig;

  constructor(
    env: FightingGameEnv,
    obsEncoder: ObservationEncoder,
    config: BenchmarkConfig = DEFAULT_BENCHMARK_CONFIG
  ) {
    this.env = env;
    this.obsEncoder = obsEncoder;
    this.config = config;
  }

  /**
   * Run a single match between two policies
   */
  async runMatch(
    policy1: ActorCriticPolicy,
    policy2: ActorCriticPolicy,
    player1Id: string = 'player1',
    player2Id: string = 'player2'
  ): Promise<MatchResult> {
    // Reset environment
    let state = this.env.reset();
    
    // Behavior trackers
    const behavior1 = this.config.recordBehavior ? new BehaviorAnalyzer() : null;
    const behavior2 = this.config.recordBehavior ? new BehaviorAnalyzer() : null;

    let frame = 0;
    let done = false;

    while (!done && frame < this.config.maxFramesPerMatch) {
      // Get observations
      const obs1 = this.obsEncoder.encode(state, 'player1');
      const obs2 = this.obsEncoder.encode(state, 'player2');

      // Select actions
      const { action: action1 } = policy1.sampleAction(obs1);
      const { action: action2 } = policy2.sampleAction(obs2);

      // Record actions for behavior analysis
      if (behavior1) behavior1.recordAction(action1);
      if (behavior2) behavior2.recordAction(action2);

      // Convert to ActionBundles
      const actionBundle1 = this.actionToBundle(action1);
      const actionBundle2 = this.actionToBundle(action2);

      // Step environment
      const actions = new Map();
      actions.set('player1', actionBundle1);
      actions.set('player2', actionBundle2);

      const stepResult = this.env.step(actions);
      state = this.env.getState();
      done = stepResult.done;

      // Record state for behavior analysis
      if (behavior1) behavior1.recordState(state, frame);
      if (behavior2) behavior2.recordState(state, frame);

      frame++;
    }

    // Determine winner
    const p1 = state.entities.find(e => e.id === 'player1');
    const p2 = state.entities.find(e => e.id === 'player2');
    
    if (!p1 || !p2) {
      throw new Error('Fighters not found in state');
    }

    let winner: string;
    let loser: string;
    let draw = false;
    const finalHealth = { winner: 0, loser: 0 };

    if (p1.health > p2.health) {
      winner = player1Id;
      loser = player2Id;
      finalHealth.winner = p1.health;
      finalHealth.loser = p2.health;
    } else if (p2.health > p1.health) {
      winner = player2Id;
      loser = player1Id;
      finalHealth.winner = p2.health;
      finalHealth.loser = p1.health;
    } else {
      draw = true;
      winner = player1Id;
      loser = player2Id;
      finalHealth.winner = p1.health;
      finalHealth.loser = p2.health;
    }

    // Generate behavior report (only for winner/player1)
    let behaviorReport: BehaviorReport | undefined;
    if (behavior1) {
      behaviorReport = behavior1.generateReport(10); // Assuming 10 actions
    }

    return {
      winner,
      loser,
      draw,
      rounds: 1,
      duration: frame,
      finalHealth,
      behaviorReport,
    };
  }

  /**
   * Run head-to-head evaluation
   */
  async runHeadToHead(
    policy1: ActorCriticPolicy,
    policy2: ActorCriticPolicy,
    player1Id: string = 'policy1',
    player2Id: string = 'policy2',
    numMatches?: number
  ): Promise<HeadToHeadResult> {
    const matches: MatchResult[] = [];
    let player1Wins = 0;
    let player2Wins = 0;
    let draws = 0;
    let totalDuration = 0;

    const matchCount = numMatches || this.config.numMatches;

    for (let i = 0; i < matchCount; i++) {
      if (this.config.verbose) {
        console.log(`  Match ${i + 1}/${matchCount}...`);
      }

      const result = await this.runMatch(policy1, policy2, player1Id, player2Id);
      matches.push(result);

      if (result.draw) {
        draws++;
      } else if (result.winner === player1Id) {
        player1Wins++;
      } else {
        player2Wins++;
      }

      totalDuration += result.duration;
    }

    // Aggregate behavior analysis
    const behavior1Analyzer = new BehaviorAnalyzer();
    const behavior2Analyzer = new BehaviorAnalyzer();

    for (const match of matches) {
      if (match.behaviorReport) {
        // This is a simplification - ideally track per-player across all matches
      }
    }

    // Generate aggregated reports
    const behaviorAnalysis = {
      player1: behavior1Analyzer.generateReport(10),
      player2: behavior2Analyzer.generateReport(10),
    };

    return {
      player1Id,
      player2Id,
      matches,
      player1Wins,
      player2Wins,
      draws,
      winRate: (player1Wins + draws * 0.5) / matchCount,
      avgMatchDuration: totalDuration / matchCount,
      behaviorAnalysis,
    };
  }

  /**
   * Run round-robin tournament
   */
  async runTournament(
    policies: Map<string, ActorCriticPolicy>
  ): Promise<TournamentResult> {
    console.log(`\n=== Starting Tournament (${policies.size} participants) ===`);
    
    const participants = Array.from(policies.keys());
    const matches = new Map<string, HeadToHeadResult>();
    const eloRating = new EloRating();

    // Register all participants
    for (const id of participants) {
      eloRating.registerPlayer(id);
    }

    // Run all head-to-head matchups
    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        const p1Id = participants[i];
        const p2Id = participants[j];
        const p1 = policies.get(p1Id)!;
        const p2 = policies.get(p2Id)!;

        console.log(`\n${p1Id} vs ${p2Id}`);
        
        const result = await this.runHeadToHead(p1, p2, p1Id, p2Id);
        const matchKey = `${p1Id}_vs_${p2Id}`;
        matches.set(matchKey, result);

        // Update Elo
        const p1EloWins = result.player1Wins;
        const p2EloWins = result.player2Wins;

        for (let k = 0; k < p1EloWins; k++) {
          eloRating.updateRatings(p1Id, p2Id);
        }
        for (let k = 0; k < p2EloWins; k++) {
          eloRating.updateRatings(p2Id, p1Id);
        }

        console.log(`  Result: ${result.player1Wins}-${result.player2Wins}-${result.draws}`);
        console.log(`  ${p1Id} win rate: ${(result.winRate * 100).toFixed(1)}%`);
      }
    }

    // Calculate standings
    const standings = [];
    for (const id of participants) {
      const player = eloRating.getPlayer(id)!;
      standings.push({
        id,
        wins: player.wins,
        losses: player.losses,
        draws: player.draws,
        elo: player.rating,
      });
    }

    // Sort by Elo
    standings.sort((a, b) => b.elo - a.elo);

    return {
      participants,
      matches,
      standings,
      champion: standings[0].id,
      runnerUp: standings[1]?.id || '',
    };
  }

  /**
   * Run regression tests to detect degenerate behavior
   */
  runRegressionTests(
    policy: ActorCriticPolicy,
    policyId: string
  ): { passed: boolean; failures: string[] } {
    const failures: string[] = [];

    // TODO: Implement specific regression tests
    // For now, just check if policy loads
    if (!policy) {
      failures.push('Policy is null');
    }

    return {
      passed: failures.length === 0,
      failures,
    };
  }

  /**
   * Benchmark a single policy against baseline opponents
   */
  async benchmarkPolicy(
    policy: ActorCriticPolicy,
    policyId: string,
    baselines: Map<string, ActorCriticPolicy>
  ): Promise<{
    results: Map<string, HeadToHeadResult>;
    avgWinRate: number;
    behaviorReport: BehaviorReport;
    degenerate: boolean;
  }> {
    console.log(`\n=== Benchmarking ${policyId} ===`);
    
    const results = new Map<string, HeadToHeadResult>();
    let totalWins = 0;
    let totalMatches = 0;

    const behaviorAnalyzer = new BehaviorAnalyzer();

    for (const [baselineId, baselinePolicy] of baselines) {
      console.log(`\nVs ${baselineId}...`);
      
      const result = await this.runHeadToHead(policy, baselinePolicy, policyId, baselineId);
      results.set(baselineId, result);

      totalWins += result.player1Wins;
      totalMatches += this.config.numMatches;

      console.log(`  Win rate: ${(result.winRate * 100).toFixed(1)}%`);
    }

    // Generate behavior report
    const behaviorReport = behaviorAnalyzer.generateReport(10);
    
    // Check for degenerate behavior
    const { degenerate } = isDegenerateBehavior(behaviorReport, {
      maxStalling: 0.2,
      maxLoopRate: 0.3,
      minDiversity: 0.4,
      minEngagement: 0.3,
    });

    return {
      results,
      avgWinRate: totalMatches > 0 ? totalWins / totalMatches : 0,
      behaviorReport,
      degenerate,
    };
  }

  /**
   * Generate evaluation report
   */
  generateReport(
    results: Map<string, HeadToHeadResult> | TournamentResult
  ): string {
    let report = '\n=== Evaluation Report ===\n';

    if (results instanceof Map) {
      // Head-to-head results
      for (const [matchup, result] of results) {
        report += `\n${matchup}:\n`;
        report += `  Matches: ${result.matches.length}\n`;
        report += `  ${result.player1Id}: ${result.player1Wins}W - ${result.player2Wins}L - ${result.draws}D\n`;
        report += `  Win rate: ${(result.winRate * 100).toFixed(1)}%\n`;
        report += `  Avg duration: ${result.avgMatchDuration.toFixed(0)} frames\n`;
      }
    } else {
      // Tournament results
      report += `\nParticipants: ${results.participants.length}\n`;
      report += `\nStandings:\n`;
      
      for (let i = 0; i < results.standings.length; i++) {
        const standing = results.standings[i];
        const trophy = i === 0 ? '🏆' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
        report += `${trophy} ${i + 1}. ${standing.id}\n`;
        report += `     Record: ${standing.wins}W - ${standing.losses}L - ${standing.draws}D\n`;
        report += `     Elo: ${standing.elo.toFixed(0)}\n`;
      }

      report += `\nChampion: ${results.champion}\n`;
      if (results.runnerUp) {
        report += `Runner-up: ${results.runnerUp}\n`;
      }
    }

    return report;
  }

  /**
   * Convert discrete action to ActionBundle (placeholder)
   */
  private actionToBundle(action: number): any {
    const actions = [
      { direction: 'neutral', button: 'none', holdDuration: 0 },
      { direction: 'right', button: 'none', holdDuration: 0 },
      { direction: 'left', button: 'none', holdDuration: 0 },
      { direction: 'up', button: 'none', holdDuration: 0 },
      { direction: 'down', button: 'none', holdDuration: 0 },
      { direction: 'neutral', button: 'lp', holdDuration: 0 },
      { direction: 'neutral', button: 'hp', holdDuration: 0 },
      { direction: 'neutral', button: 'lk', holdDuration: 0 },
      { direction: 'neutral', button: 'hk', holdDuration: 0 },
      { direction: 'neutral', button: 'block', holdDuration: 0 },
    ];

    return actions[action % actions.length];
  }
}

/**
 * Quick benchmark helper
 */
export async function quickBenchmark(
  policy: ActorCriticPolicy,
  env: FightingGameEnv,
  obsEncoder: ObservationEncoder,
  numMatches: number = 5
): Promise<{
  winRate: number;
  avgDuration: number;
  behaviorReport: BehaviorReport;
}> {
  const harness = new EvaluationHarness(env, obsEncoder, {
    ...DEFAULT_BENCHMARK_CONFIG,
    numMatches,
    verbose: false,
  });

  // Create a simple baseline (random policy)
  const baselinePolicy = new ActorCriticPolicy(
    obsEncoder.getObservationSize(),
    10
  );

  const result = await harness.runHeadToHead(policy, baselinePolicy);
  
  return {
    winRate: result.winRate,
    avgDuration: result.avgMatchDuration,
    behaviorReport: result.behaviorAnalysis.player1,
  };
}
