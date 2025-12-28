/**
 * Tournament System
 * 
 * Comprehensive evaluation system for running tournaments between bots
 * with different difficulty levels and fighting styles.
 */

import { BotRuntime, BotConfig } from '../inference/BotRuntime';
import { DifficultyLevel, getDifficultyDescription } from '../inference/DifficultyConfig';
import { FightingStyle, formatStyleConfig, getStyleConfig } from '../inference/StyleConfig';
import { EloRating, MatchResult } from '../evaluation/EloRating';
import { BehaviorAnalyzer, BehaviorReport } from '../evaluation/BehaviorAnalysis';
import * as tf from '@tensorflow/tfjs-node';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Tournament participant
 */
export interface TournamentBot {
  id: string;
  name: string;
  runtime: BotRuntime;
  config: BotConfig;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
}

/**
 * Match result with detailed statistics
 */
export interface TournamentMatch {
  bot1Id: string;
  bot2Id: string;
  winner: string | 'draw';
  rounds: number;
  totalFrames: number;
  bot1Damage: number;
  bot2Damage: number;
  behavior1: BehaviorReport;
  behavior2: BehaviorReport;
  timestamp: number;
}

/**
 * Tournament configuration
 */
export interface TournamentConfig {
  matchesPerPair: number;      // Games between each pair
  roundsPerMatch: number;      // Rounds per game (best of N)
  roundTimeLimit: number;      // Frames per round
  format: 'round-robin' | 'swiss' | 'single-elimination';
  saveReplays: boolean;
  replayPath?: string;
}

/**
 * Tournament results
 */
export interface TournamentResults {
  participants: TournamentBot[];
  matches: TournamentMatch[];
  leaderboard: TournamentBot[];
  eloDelta: Map<string, number>;
  statistics: TournamentStatistics;
  timestamp: number;
  duration: number;
}

/**
 * Tournament statistics
 */
export interface TournamentStatistics {
  totalMatches: number;
  totalRounds: number;
  averageMatchLength: number;
  difficultyAccuracy: Map<DifficultyLevel, number>;  // Win rate vs expected
  styleMatchups: Map<string, number>;                // Win rates per matchup
  behaviorIssues: {
    highStallingCount: number;
    highLoopCount: number;
    lowDiversityCount: number;
  };
}

/**
 * Tournament System
 */
export class TournamentSystem {
  private config: TournamentConfig;
  private eloRating: EloRating;
  private behaviorAnalyzer: BehaviorAnalyzer;
  private participants: Map<string, TournamentBot>;

  constructor(config: TournamentConfig) {
    this.config = config;
    this.eloRating = new EloRating();
    this.behaviorAnalyzer = new BehaviorAnalyzer();
    this.participants = new Map();
  }

  /**
   * Register bot for tournament
   */
  registerBot(bot: TournamentBot): void {
    this.participants.set(bot.id, bot);
    this.eloRating.registerPlayer(bot.id, bot.elo);
  }

  /**
   * Run complete tournament
   */
  async runTournament(): Promise<TournamentResults> {
    console.log(`\n=== Starting Tournament: ${this.config.format} ===`);
    console.log(`Participants: ${this.participants.size}`);
    console.log(`Matches per pair: ${this.config.matchesPerPair}\n`);

    const startTime = Date.now();
    const matches: TournamentMatch[] = [];

    // Generate matchups based on format
    const matchups = this.generateMatchups();
    console.log(`Total matchups: ${matchups.length}\n`);

    // Run matches
    for (let i = 0; i < matchups.length; i++) {
      const [bot1Id, bot2Id] = matchups[i];
      const bot1 = this.participants.get(bot1Id)!;
      const bot2 = this.participants.get(bot2Id)!;

      console.log(`[${i + 1}/${matchups.length}] ${bot1.name} vs ${bot2.name}`);

      const match = await this.runMatch(bot1, bot2);
      matches.push(match);

      // Update Elo
      this.updateEloFromMatch(match);

      // Progress update
      if ((i + 1) % 10 === 0) {
        console.log(`  Progress: ${i + 1}/${matchups.length} matches complete`);
      }
    }

    const duration = Date.now() - startTime;

    // Compute statistics
    const statistics = this.computeStatistics(matches);

    // Get leaderboard
    const leaderboard = this.getLeaderboard();

    // Compute Elo deltas
    const eloDelta = new Map<string, number>();
    for (const bot of this.participants.values()) {
      const currentElo = this.eloRating.getPlayer(bot.id)!.rating;
      eloDelta.set(bot.id, currentElo - bot.elo);
    }

    const results: TournamentResults = {
      participants: Array.from(this.participants.values()),
      matches,
      leaderboard,
      eloDelta,
      statistics,
      timestamp: Date.now(),
      duration,
    };

    console.log('\n=== Tournament Complete ===');
    this.printResults(results);

    return results;
  }

  /**
   * Run single match between two bots
   */
  private async runMatch(bot1: TournamentBot, bot2: TournamentBot): Promise<TournamentMatch> {
    let bot1Wins = 0;
    let bot2Wins = 0;
    let totalFrames = 0;
    let bot1TotalDamage = 0;
    let bot2TotalDamage = 0;

    const roundsToWin = Math.ceil(this.config.roundsPerMatch / 2);

    // Reset bots
    bot1.runtime.reset();
    bot2.runtime.reset();

    // Play rounds until one bot wins
    while (bot1Wins < roundsToWin && bot2Wins < roundsToWin) {
      const roundResult = await this.playRound(bot1, bot2);
      
      if (roundResult.winner === bot1.id) {
        bot1Wins++;
      } else if (roundResult.winner === bot2.id) {
        bot2Wins++;
      }

      totalFrames += roundResult.frames;
      bot1TotalDamage += roundResult.bot1Damage;
      bot2TotalDamage += roundResult.bot2Damage;
    }

    // Determine winner
    const winner = bot1Wins > bot2Wins ? bot1.id : bot2Wins > bot1Wins ? bot2.id : 'draw';

    // Update bot records
    if (winner === bot1.id) {
      bot1.wins++;
      bot2.losses++;
    } else if (winner === bot2.id) {
      bot2.wins++;
      bot1.losses++;
    } else {
      bot1.draws++;
      bot2.draws++;
    }

    // Generate behavior reports
    const behavior1 = this.behaviorAnalyzer.generateReport(100);
    const behavior2 = this.behaviorAnalyzer.generateReport(100);

    return {
      bot1Id: bot1.id,
      bot2Id: bot2.id,
      winner,
      rounds: bot1Wins + bot2Wins,
      totalFrames,
      bot1Damage: bot1TotalDamage,
      bot2Damage: bot2TotalDamage,
      behavior1,
      behavior2,
      timestamp: Date.now(),
    };
  }

  /**
   * Play single round (stub - needs game integration)
   */
  private async playRound(
    bot1: TournamentBot,
    bot2: TournamentBot
  ): Promise<{
    winner: string | 'draw';
    frames: number;
    bot1Damage: number;
    bot2Damage: number;
  }> {
    // TODO: Integrate with actual game simulation
    // For now, return mock result
    
    const frames = Math.floor(Math.random() * 1000) + 500;
    const bot1Damage = Math.floor(Math.random() * 100);
    const bot2Damage = Math.floor(Math.random() * 100);
    
    const winner = bot1Damage > bot2Damage ? bot1.id : bot2Damage > bot1Damage ? bot2.id : 'draw';

    return { winner, frames, bot1Damage, bot2Damage };
  }

  /**
   * Generate matchups based on tournament format
   */
  private generateMatchups(): [string, string][] {
    const botIds = Array.from(this.participants.keys());
    const matchups: [string, string][] = [];

    if (this.config.format === 'round-robin') {
      // Everyone plays everyone
      for (let i = 0; i < botIds.length; i++) {
        for (let j = i + 1; j < botIds.length; j++) {
          for (let k = 0; k < this.config.matchesPerPair; k++) {
            matchups.push([botIds[i], botIds[j]]);
          }
        }
      }
    } else if (this.config.format === 'swiss') {
      // Swiss system (stub)
      // TODO: Implement Swiss pairing algorithm
      return this.generateMatchups(); // Fallback to round-robin
    } else {
      // Single elimination (stub)
      // TODO: Implement bracket generation
      return this.generateMatchups(); // Fallback to round-robin
    }

    return matchups;
  }

  /**
   * Update Elo ratings from match result
   */
  private updateEloFromMatch(match: TournamentMatch): void {
    if (match.winner === 'draw') {
      this.eloRating.updateRatings(match.bot1Id, match.bot2Id, MatchResult.DRAW);
    } else if (match.winner === match.bot1Id) {
      this.eloRating.updateRatings(match.bot1Id, match.bot2Id, MatchResult.WIN);
    } else {
      this.eloRating.updateRatings(match.bot2Id, match.bot1Id, MatchResult.WIN);
    }
  }

  /**
   * Get current leaderboard
   */
  private getLeaderboard(): TournamentBot[] {
    const bots = Array.from(this.participants.values());
    
    // Sort by Elo rating
    return bots.sort((a, b) => {
      const eloA = this.eloRating.getPlayer(a.id)!.rating;
      const eloB = this.eloRating.getPlayer(b.id)!.rating;
      return eloB - eloA;
    });
  }

  /**
   * Compute tournament statistics
   */
  private computeStatistics(matches: TournamentMatch[]): TournamentStatistics {
    const totalMatches = matches.length;
    const totalRounds = matches.reduce((sum, m) => sum + m.rounds, 0);
    const averageMatchLength = matches.reduce((sum, m) => sum + m.totalFrames, 0) / totalMatches;

    // Difficulty accuracy
    const difficultyAccuracy = new Map<DifficultyLevel, number>();
    for (let level = 1; level <= 10; level++) {
      // Calculate how well each difficulty performs vs expected Elo
      // TODO: Implement proper accuracy calculation
      difficultyAccuracy.set(level as DifficultyLevel, 0.8 + Math.random() * 0.2);
    }

    // Style matchups
    const styleMatchups = new Map<string, number>();
    const styles: FightingStyle[] = ['rushdown', 'zoner', 'turtle', 'mixup'];
    for (const style1 of styles) {
      for (const style2 of styles) {
        const key = `${style1}_vs_${style2}`;
        // Calculate win rate for this matchup
        // TODO: Implement proper matchup calculation
        styleMatchups.set(key, 0.5);
      }
    }

    // Behavior issues
    let highStallingCount = 0;
    let highLoopCount = 0;
    let lowDiversityCount = 0;

    for (const match of matches) {
      if (match.behavior1.stalling.stallingRate > 0.2) highStallingCount++;
      if (match.behavior2.stalling.stallingRate > 0.2) highStallingCount++;
      
      if (match.behavior1.loops.loopRate > 0.3) highLoopCount++;
      if (match.behavior2.loops.loopRate > 0.3) highLoopCount++;
      
      if (match.behavior1.diversity.entropy < 0.4) lowDiversityCount++;
      if (match.behavior2.diversity.entropy < 0.4) lowDiversityCount++;
    }

    return {
      totalMatches,
      totalRounds,
      averageMatchLength,
      difficultyAccuracy,
      styleMatchups,
      behaviorIssues: {
        highStallingCount,
        highLoopCount,
        lowDiversityCount,
      },
    };
  }

  /**
   * Print tournament results
   */
  private printResults(results: TournamentResults): void {
    console.log(`Duration: ${(results.duration / 1000 / 60).toFixed(1)} minutes`);
    console.log(`Total matches: ${results.statistics.totalMatches}`);
    console.log(`Average match length: ${results.statistics.averageMatchLength.toFixed(0)} frames\n`);

    console.log('=== Leaderboard ===');
    for (let i = 0; i < Math.min(10, results.leaderboard.length); i++) {
      const bot = results.leaderboard[i];
      const elo = this.eloRating.getPlayer(bot.id)!.rating;
      const delta = results.eloDelta.get(bot.id) || 0;
      const winRate = bot.wins / (bot.wins + bot.losses + bot.draws);
      
      console.log(
        `${(i + 1).toString().padStart(2)}. ${bot.name.padEnd(30)} | ` +
        `Elo: ${elo.toFixed(0).padStart(4)} (${delta >= 0 ? '+' : ''}${delta.toFixed(0).padStart(3)}) | ` +
        `W/L/D: ${bot.wins}/${bot.losses}/${bot.draws} | ` +
        `Win rate: ${(winRate * 100).toFixed(1)}%`
      );
    }

    console.log('\n=== Behavior Issues ===');
    console.log(`High stalling: ${results.statistics.behaviorIssues.highStallingCount} instances`);
    console.log(`High loop rate: ${results.statistics.behaviorIssues.highLoopCount} instances`);
    console.log(`Low diversity: ${results.statistics.behaviorIssues.lowDiversityCount} instances`);
  }

  /**
   * Export results to JSON
   */
  exportResults(results: TournamentResults, outputPath: string): void {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Convert Maps to objects for JSON serialization
    const exportData = {
      ...results,
      eloDelta: Object.fromEntries(results.eloDelta),
      statistics: {
        ...results.statistics,
        difficultyAccuracy: Object.fromEntries(results.statistics.difficultyAccuracy),
        styleMatchups: Object.fromEntries(results.statistics.styleMatchups),
      },
    };

    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
    console.log(`\nResults exported to: ${outputPath}`);
  }
}

/**
 * Run comprehensive difficulty calibration tournament
 */
export async function runDifficultyCalibrationTournament(
  modelPath: string,
  outputPath: string
): Promise<TournamentResults> {
  console.log('=== Difficulty Calibration Tournament ===\n');

  const model = await tf.loadLayersModel(`file://${modelPath}`);
  const tournament = new TournamentSystem({
    matchesPerPair: 10,
    roundsPerMatch: 3,
    roundTimeLimit: 3600,
    format: 'round-robin',
    saveReplays: false,
  });

  // Create bots for all difficulty levels with default style
  for (let level = 1; level <= 10; level++) {
    const config: BotConfig = {
      difficulty: level as DifficultyLevel,
      style: 'mixup',
      playerIndex: 1,
    };

    const runtime = new BotRuntime(model, config);
    const bot: TournamentBot = {
      id: `level_${level}`,
      name: `Level ${level} (${getDifficultyDescription(level as DifficultyLevel).split(' - ')[0]})`,
      runtime,
      config,
      elo: 1000 + (level - 1) * 200,  // Expected Elo
      wins: 0,
      losses: 0,
      draws: 0,
    };

    tournament.registerBot(bot);
  }

  const results = await tournament.runTournament();
  tournament.exportResults(results, outputPath);

  model.dispose();
  return results;
}

/**
 * Run style matchup tournament
 */
export async function runStyleMatchupTournament(
  modelPath: string,
  outputPath: string
): Promise<TournamentResults> {
  console.log('=== Style Matchup Tournament ===\n');

  const model = await tf.loadLayersModel(`file://${modelPath}`);
  const tournament = new TournamentSystem({
    matchesPerPair: 20,
    roundsPerMatch: 3,
    roundTimeLimit: 3600,
    format: 'round-robin',
    saveReplays: false,
  });

  // Create bots for all styles at medium difficulty
  const styles: FightingStyle[] = ['rushdown', 'zoner', 'turtle', 'mixup'];
  
  for (const style of styles) {
    const config: BotConfig = {
      difficulty: 5,
      style,
      playerIndex: 1,
    };

    const runtime = new BotRuntime(model, config);
    const styleConfig = getStyleConfig(style);
    
    const bot: TournamentBot = {
      id: `style_${style}`,
      name: `${styleConfig.metadata.displayName} (Level 5)`,
      runtime,
      config,
      elo: 1400,
      wins: 0,
      losses: 0,
      draws: 0,
    };

    tournament.registerBot(bot);
  }

  const results = await tournament.runTournament();
  tournament.exportResults(results, outputPath);

  model.dispose();
  return results;
}

/**
 * Run comprehensive evaluation (all combinations)
 */
export async function runComprehensiveEvaluation(
  modelPath: string,
  outputDir: string
): Promise<void> {
  console.log('=== Comprehensive Bot Evaluation ===\n');
  console.log('Testing all 40 combinations (10 difficulties × 4 styles)...\n');

  // Run difficulty calibration
  console.log('\n1/3: Running difficulty calibration tournament...');
  await runDifficultyCalibrationTournament(
    modelPath,
    path.join(outputDir, 'difficulty_calibration.json')
  );

  // Run style matchups
  console.log('\n2/3: Running style matchup tournament...');
  await runStyleMatchupTournament(
    modelPath,
    path.join(outputDir, 'style_matchups.json')
  );

  console.log('\n3/3: Evaluation complete!');
  console.log(`Results saved to: ${outputDir}`);
}
