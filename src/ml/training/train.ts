/**
 * Training Script Entry Point
 * 
 * Main entry point for training fighting game bots using PPO.
 * Run with: npx ts-node -P tsconfig.node.json src/ml/training/train.ts
 */

import { FightingGameEnv } from '../core/Environment';
import { ObservationEncoder, DEFAULT_OBSERVATION_CONFIG } from '../core/ObservationEncoder';
import { RewardFunction, DEFAULT_REWARD_WEIGHTS } from '../core/RewardFunction';
import { PPOTrainer, ActorCriticPolicy, DEFAULT_PPO_CONFIG } from './PPOTrainer';
import { OpponentPool, DEFAULT_POOL_CONFIG } from './OpponentPool';
import { 
  createStyleTrainingSchedule, 
  getStyleForStep, 
  StyleTrainingTracker,
  applyStyleRewardModifiers,
  validateStyleDistribution 
} from './StyleIntegration';
import { getAllStyles, FightingStyle } from '../inference/StyleConfig';
import { MUSASHI } from '../../core/data/musashi';
import { evaluatePolicy, scriptedOpponentActionEasy, scriptedOpponentActionTight } from '../evaluation/evalRunner';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Training configuration
 */
interface TrainingConfig {
  // Training
  totalSteps: number;
  saveFrequency: number;
  evalFrequency: number;
  logFrequency: number;

  // Environment
  roundTime: number; // seconds

  // Output
  modelPath: string;
  logPath: string;
  progressPath: string;
}

/**
 * Default training configuration
 */
const DEFAULT_TRAINING_CONFIG: TrainingConfig = {
  totalSteps: 10_000_000,  // 10M per session for continuous training
  saveFrequency: 1_000_000,
  evalFrequency: 500_000,
  logFrequency: 10_000,
  roundTime: 99,
  modelPath: './models/policy',
  logPath: './models/training.log',
  progressPath: './models/training-progress.jsonl',
};

function parseEnvInt(key: string): number | undefined {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return undefined;

  const value = Number(raw);
  return Number.isFinite(value) ? Math.trunc(value) : undefined;
}

function parseEnvString(key: string): string | undefined {
  const raw = process.env[key];
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseEnvFloat(key: string): number | undefined {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function getTrainingConfigFromEnv(defaults: TrainingConfig): TrainingConfig {
  return {
    ...defaults,
    totalSteps: parseEnvInt('TRAIN_TOTAL_STEPS') ?? defaults.totalSteps,
    saveFrequency: parseEnvInt('TRAIN_SAVE_FREQUENCY') ?? defaults.saveFrequency,
    evalFrequency: parseEnvInt('TRAIN_EVAL_FREQUENCY') ?? defaults.evalFrequency,
    logFrequency: parseEnvInt('TRAIN_LOG_FREQUENCY') ?? defaults.logFrequency,
    roundTime: parseEnvInt('TRAIN_ROUND_TIME') ?? defaults.roundTime,
    modelPath: parseEnvString('TRAIN_MODEL_PATH') ?? defaults.modelPath,
    logPath: parseEnvString('TRAIN_LOG_PATH') ?? defaults.logPath,
    progressPath: parseEnvString('TRAIN_PROGRESS_PATH') ?? defaults.progressPath,
  };
}

function parseEnvBool(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  return raw === '1' || raw.toLowerCase() === 'true' || raw.toLowerCase() === 'yes';
}

/**
 * Main training function
 */
async function main() {
  console.log('\n=== RL Training v4 (with Styles & Difficulty) ===');
  console.log('Initializing environment and policy...\n');

  const startTime = Date.now();
  const config = getTrainingConfigFromEnv(DEFAULT_TRAINING_CONFIG);

  // Create environment
  const env = new FightingGameEnv({
    player1Character: MUSASHI,
    player2Character: MUSASHI,
    roundTime: config.roundTime,
  });

  // Create observation encoder with style support
  const obsConfig = { ...DEFAULT_OBSERVATION_CONFIG, includeStyle: true };
  const obsEncoder = new ObservationEncoder(obsConfig);
  const obsSize = obsEncoder.getObservationSize();

  // Create reward function
  const rewardWeights = {
    ...DEFAULT_REWARD_WEIGHTS,
    stalling: parseEnvFloat('TRAIN_REWARD_STALLING') ?? DEFAULT_REWARD_WEIGHTS.stalling,
    attackIntent: parseEnvFloat('TRAIN_REWARD_ATTACK_INTENT') ?? DEFAULT_REWARD_WEIGHTS.attackIntent,
    rangeControl: parseEnvFloat('TRAIN_REWARD_RANGE_CONTROL') ?? DEFAULT_REWARD_WEIGHTS.rangeControl,
  };
  const rewardFn = new RewardFunction(rewardWeights);

  // Optional: punish early-episode passivity (helps avoid "do nothing" collapse).
  // Gate it to the early *training* phase if TRAIN_EARLY_TRAINING_STEPS is set.
  const earlyEngageFrames = parseEnvInt('TRAIN_EARLY_ENGAGE_FRAMES') ?? 0;
  const earlyEngagePenalty = parseEnvFloat('TRAIN_EARLY_ENGAGE_PENALTY') ?? 0;
  const earlyTrainingSteps = parseEnvInt('TRAIN_EARLY_TRAINING_STEPS') ?? 0;
  const earlyEngageEnabled = earlyEngageFrames > 0 && earlyEngagePenalty !== 0;
  if (earlyEngageEnabled) {
    console.log(
      `[Shaping] early engage: frames=${earlyEngageFrames} penalty=${earlyEngagePenalty}` +
        (earlyTrainingSteps > 0 ? ` (for first ${earlyTrainingSteps} steps)` : '')
    );
  }
  
  // Create style training schedule
  const styleSchedule = createStyleTrainingSchedule(config.totalSteps, 4);
  const styleTracker = new StyleTrainingTracker();
  
  console.log('Style Training Schedule:');
  console.log(`  Training ${getAllStyles().length} styles over ${config.totalSteps} steps`);
  console.log(`  Each style gets trained 4 times in rotation\n`);

  // Create or load policy
  const actionSize = 10; // Simplified action space for now
  const ppoConfig = {
    ...DEFAULT_PPO_CONFIG,
    entropyCoef: parseEnvFloat('TRAIN_ENTROPY_COEF') ?? DEFAULT_PPO_CONFIG.entropyCoef,
  };
  const policy = new ActorCriticPolicy(obsSize, actionSize, ppoConfig.learningRate);
  
  // Try to load existing model to continue training
  if (fs.existsSync(path.join(config.modelPath, 'model.json'))) {
    try {
      await policy.load(config.modelPath);
      console.log('✓ Loaded existing model to continue training\n');
    } catch (error) {
      console.log('⚠ Could not load existing model, starting fresh\n');
    }
  } else {
    console.log('Starting with fresh model\n');
  }

  console.log(`Observation size: ${obsSize}`);
  console.log(`Action space size: ${actionSize}`);
  console.log(`Total parameters: ~${estimateParameters(obsSize, actionSize)}\n`);

  // Print training configuration
  console.log('='.repeat(80));
  console.log('⚙️  TRAINING CONFIGURATION');
  console.log('='.repeat(80));
  console.log('Environment:');
  console.log(`  Round time: ${config.roundTime}s`);
  console.log(`  Observation features: ${obsSize}`);
  console.log(`  Action space: ${actionSize}`);
  
  console.log('\nPPO Hyperparameters:');
  console.log(`  Learning rate: ${ppoConfig.learningRate}`);
  console.log(`  Gamma (discount): ${ppoConfig.gamma}`);
  console.log(`  Lambda (GAE): ${ppoConfig.lambda}`);
  console.log(`  Clip range: ${ppoConfig.clipRange}`);
  console.log(`  Entropy coef: ${ppoConfig.entropyCoef}`);
  console.log(`  Value coef: ${ppoConfig.valueCoef}`);
  console.log(`  Steps per rollout: ${ppoConfig.stepsPerRollout}`);
  console.log(`  Minibatch size: ${ppoConfig.minibatchSize}`);
  console.log(`  Epochs per batch: ${ppoConfig.epochsPerBatch}`);
  
  console.log('\nReward Weights:');
  console.log(`  Damage dealt: ${rewardWeights.damageDealt}`);
  console.log(`  Damage taken: ${rewardWeights.damageTaken}`);
  console.log(`  Hit confirm: ${rewardWeights.hitConfirm}`);
  console.log(`  Successful block: ${rewardWeights.successfulBlock}`);
  console.log(`  Stalling penalty: ${rewardWeights.stalling}`);
  console.log(`  Attack intent: ${rewardWeights.attackIntent}`);
  console.log(`  Range control: ${rewardWeights.rangeControl}`);
  
  console.log('\nTraining Schedule:');
  console.log(`  Total steps: ${config.totalSteps.toLocaleString()}`);
  console.log(`  Save frequency: every ${config.saveFrequency.toLocaleString()} steps`);
  console.log(`  Eval frequency: every ${config.evalFrequency.toLocaleString()} steps`);
  console.log(`  Log frequency: every ${config.logFrequency.toLocaleString()} steps`);
  
  console.log('\nOutput Paths:');
  console.log(`  Model: ${config.modelPath}`);
  console.log(`  Progress: ${config.progressPath}`);
  console.log(`  Log: ${config.logPath}`);
  console.log('='.repeat(80) + '\n');

  // Create opponent pool
  const opponentPool = new OpponentPool(DEFAULT_POOL_CONFIG);
  await opponentPool.loadAllSnapshots();
  console.log(`Opponent pool loaded with ${opponentPool.getAllSnapshots().length} snapshots\n`);

  // Create trainer
  const trainer = new PPOTrainer(env, policy, obsEncoder, rewardFn, ppoConfig, opponentPool);

  // Opponent mixing: keep some scripted episodes even when snapshots exist.
  const scriptedMixProb = parseEnvFloat('TRAIN_OPPONENT_SCRIPTED_PROB') ?? 0;
  const scriptedVariantRaw = (parseEnvString('TRAIN_OPPONENT_SCRIPTED_VARIANT') ?? 'tight').toLowerCase();
  const scriptedVariant = scriptedVariantRaw === 'easy' ? 'easy' : 'tight';
  if (scriptedMixProb > 0) {
    trainer.setScriptedOpponentMix(scriptedMixProb);
    trainer.setScriptedVariant(scriptedVariant);
    console.log(
      `[OpponentMix] scriptedProb=${scriptedMixProb} scriptedVariant=${scriptedVariant}`
    );
  }

  // Stronger safeguard: guarantee at least N scripted episodes are started each rollout.
  // This prevents scripted regression even when the opponent pool dominates sampling.
  const scriptedMinEpisodesPerRollout = parseEnvInt('TRAIN_OPPONENT_SCRIPTED_MIN_EPISODES_PER_ROLLOUT') ?? 0;
  if (scriptedMinEpisodesPerRollout > 0) {
    trainer.setScriptedMinEpisodesPerRollout(scriptedMinEpisodesPerRollout);
    console.log(`[OpponentMix] scriptedMinEpisodesPerRollout=${scriptedMinEpisodesPerRollout}`);
  }

  // Optional: force episode boundaries during training rollouts.
  // Helps produce stable W/L/D stats and prevents ultra-long non-terminal episodes.
  const maxEpisodeFrames = parseEnvInt('TRAIN_MAX_EPISODE_FRAMES') ?? 0;
  if (maxEpisodeFrames > 0) {
    trainer.setMaxEpisodeFrames(maxEpisodeFrames);
    console.log(`[Env] maxEpisodeFrames=${maxEpisodeFrames}`);
  }

  // Optional bootstrap: mirror opponent opening moves
  const bootstrapMirrorFrames = parseEnvInt('TRAIN_BOOTSTRAP_MIRROR_FRAMES') ?? 0;
  const bootstrapProb = parseEnvFloat('TRAIN_BOOTSTRAP_PROB') ?? 0;
  if (bootstrapMirrorFrames > 0 && bootstrapProb > 0) {
    trainer.setBootstrap(bootstrapMirrorFrames, bootstrapProb);
    console.log(
      `[Bootstrap] mirror-opener enabled: frames=${bootstrapMirrorFrames} prob=${bootstrapProb}`
    );
  }

  // Role swapping: randomly assign policy to player2 position to learn defensive/reactive play
  const swapRoleProb = parseEnvFloat('TRAIN_SWAP_ROLE_PROB') ?? 0;
  if (swapRoleProb > 0) {
    trainer.setSwapRoleProbability(swapRoleProb);
    console.log(`[RoleSwap] swapRoleProb=${swapRoleProb}`);
  }

  // Strongest anti-asymmetry safeguard: guarantee some episodes each rollout where
  // the policy is player2 and the opponent is scripted-tight (aggressive).
  const p2ScriptedMinEpisodesPerRollout =
    parseEnvInt('TRAIN_P2_SCRIPTED_MIN_EPISODES_PER_ROLLOUT') ?? 0;
  if (p2ScriptedMinEpisodesPerRollout > 0) {
    trainer.setP2ScriptedMinEpisodesPerRollout(p2ScriptedMinEpisodesPerRollout);
    console.log(
      `[RoleSwap] p2ScriptedMinEpisodesPerRollout=${p2ScriptedMinEpisodesPerRollout}`
    );
  }

  // Create output directories
  ensureDirectoryExists(path.dirname(config.modelPath));
  ensureDirectoryExists(path.dirname(config.progressPath));
  let currentStyle: FightingStyle = getStyleForStep(0, styleSchedule);
  let styleStepCount = 0;
  let lastEvalStep = 0;

  // Curriculum: easy scripted -> tight scripted (gated by eval avg damage dealt)
  const curriculumEnabled = parseEnvBool('TRAIN_CURRICULUM', false);
  const curriculumDamageThreshold = parseEnvInt('TRAIN_CURRICULUM_DAMAGE_THRESHOLD') ?? 20;
  const curriculumRequiredEvals = parseEnvInt('TRAIN_CURRICULUM_REQUIRED_EVALS') ?? 2;
  let curriculumPhase: 'easy' | 'tight' = curriculumEnabled ? 'easy' : 'tight';
  let curriculumStreak = 0;

  if (curriculumEnabled) {
    trainer.setOpponentMode('scripted-easy');
    console.log(
      `[Curriculum] enabled: easy -> tight | damageThreshold=${curriculumDamageThreshold} | requiredEvals=${curriculumRequiredEvals}`
    );
  }
  
  console.log(`Starting with style: ${currentStyle}\n`);

  // Initial diagnostic test
  console.log('='.repeat(80));
  console.log('🔬 INITIAL DIAGNOSTIC TEST');
  console.log('='.repeat(80));
  console.log('Running 5 test episodes to verify environment...\n');
  
  try {
    const testResults = { wins: 0, losses: 0, draws: 0, totalDamage: 0, totalFrames: 0 };
    for (let i = 0; i < 5; i++) {
      const result = env.reset();
      let isDone = false;
      let frames = 0;
      let damage = 0;
      
      while (!isDone && frames < 1800) {
        // Random actions for test
        const actions = new Map([
          ['player1', { direction: 'neutral' as const, button: Math.random() > 0.7 ? 'lp' as const : 'none' as const, holdDuration: 1 }],
          ['player2', { direction: 'neutral' as const, button: Math.random() > 0.7 ? 'lp' as const : 'none' as const, holdDuration: 1 }]
        ]);
        
        const stepResult = env.step(actions);
        isDone = stepResult.done;
        frames++;
        
        const state = env.getState();
        damage = 100 - state.entities[1].health;
      }
      
      const state = env.getState();
      const p1Health = state.entities[0].health;
      const p2Health = state.entities[1].health;
      
      if (p1Health > p2Health) testResults.wins++;
      else if (p1Health < p2Health) testResults.losses++;
      else testResults.draws++;
      
      testResults.totalDamage += damage;
      testResults.totalFrames += frames;
      
      console.log(`Test ${i + 1}: ${p1Health > p2Health ? 'WIN' : p1Health < p2Health ? 'LOSS' : 'DRAW'} | ` +
                  `Damage: ${damage.toFixed(0)} | Frames: ${frames}`);
    }
    
    console.log(`\n✅ Environment test complete:`);
    console.log(`   Avg damage: ${(testResults.totalDamage / 5).toFixed(1)}`);
    console.log(`   Avg frames: ${(testResults.totalFrames / 5).toFixed(0)}`);
    console.log(`   Random play W/L/D: ${testResults.wins}/${testResults.losses}/${testResults.draws}`);
    console.log('='.repeat(80) + '\n');
  } catch (error) {
    console.log(`⚠️  Environment test failed: ${error}`);
    console.log('Continuing with training anyway...\n');
  }

  try {
    // Custom training loop with style switching
    const allMetrics: any[] = [];
    
    let earlyEngageActive = false;
    for (let step = 0; step < config.totalSteps; step += ppoConfig.stepsPerRollout) {
      if (earlyEngageEnabled) {
        const shouldBeActive = earlyTrainingSteps > 0 ? step < earlyTrainingSteps : true;
        if (shouldBeActive !== earlyEngageActive) {
          earlyEngageActive = shouldBeActive;
          if (earlyEngageActive) {
            rewardFn.configureEarlyEngagement(earlyEngageFrames, earlyEngagePenalty);
          } else {
            rewardFn.configureEarlyEngagement(0, 0);
          }
        }
      }
      // Check if we should switch styles
      const newStyle = getStyleForStep(step, styleSchedule);
      if (newStyle !== currentStyle) {
        console.log(`\n[Step ${step}] Switching style: ${currentStyle} → ${newStyle}`);
        console.log(styleTracker.formatStats());
        currentStyle = newStyle;
        styleStepCount = 0;
        
        // Validate style distribution
        const validation = validateStyleDistribution(opponentPool);
        console.log(validation.message + '\n');
      }
      
      // Train one rollout with current style
      // Note: Style is encoded in observations; reward weights stay constant
      const metrics = await trainer.trainStep(currentStyle);
      allMetrics.push(metrics);

      // Update style win rate using true episode outcomes from the rollout
      const rolloutStats = trainer.getLastRolloutEpisodeStats();
      const rolloutEngagement = trainer.getLastRolloutEngagementStats();
      if (rolloutStats) {
        for (let i = 0; i < rolloutStats.wins; i++) styleTracker.recordMatch(currentStyle, true);
        for (let i = 0; i < rolloutStats.losses + rolloutStats.draws; i++) styleTracker.recordMatch(currentStyle, false);

        // Attach to metrics for logs and for persisted training.log
        (metrics as any).episodes = rolloutStats.episodes;
        (metrics as any).wins = rolloutStats.wins;
        (metrics as any).losses = rolloutStats.losses;
        (metrics as any).draws = rolloutStats.draws;
        (metrics as any).anyDamageRate = rolloutStats.anyDamageRate;
        (metrics as any).firstHitRate = rolloutStats.firstHitRate;
        (metrics as any).avgDamageDealt = rolloutStats.avgDamageDealt;
        (metrics as any).avgDamageTaken = rolloutStats.avgDamageTaken;
        (metrics as any).avgDistanceClosed = rolloutStats.avgDistanceClosed;
      } else if (rolloutEngagement) {
        // Fallback: if no episode ended inside this rollout, use a proxy outcome
        // based on end-of-rollout health advantage.
        styleTracker.recordMatch(currentStyle, rolloutEngagement.proxyOutcome === 'win');
        (metrics as any).proxyOutcome = rolloutEngagement.proxyOutcome;
        (metrics as any).damageDealt = rolloutEngagement.damageDealt;
        (metrics as any).damageTaken = rolloutEngagement.damageTaken;
        (metrics as any).distanceClosed = rolloutEngagement.distanceClosed;
      }

      // Create opponent pool snapshots on schedule (recorded at rollout boundaries)
      if (trainer.shouldCreateSnapshot()) {
        trainer.createSnapshot(metrics.avgReward, currentStyle);
        styleTracker.recordSnapshot(currentStyle);
      }
      
      // Keep only last 1000 metrics to prevent memory bloat
      if (allMetrics.length > 1000) {
        allMetrics.shift();
      }
      
      // Track style progress
      styleTracker.recordStep(currentStyle, metrics.avgReward);
      styleStepCount += ppoConfig.stepsPerRollout;
      
      // Enhanced logging with progress indicators
      if (step % config.logFrequency === 0) {
        const r = trainer.getLastRolloutEpisodeStats();
        const e = trainer.getLastRolloutEngagementStats();
        const engagement = r
          ? ` | W/L/D=${r.wins}/${r.losses}/${r.draws} anyDmg=${(r.anyDamageRate * 100).toFixed(0)}% firstHit=${(r.firstHitRate * 100).toFixed(0)}% dmg=${r.avgDamageDealt.toFixed(1)}/${r.avgDamageTaken.toFixed(1)} close=${r.avgDistanceClosed.toFixed(1)}`
          : e
            ? ` | proxy=${e.proxyOutcome} anyDmg=${e.anyDamage ? 'yes' : 'no'} firstHit=${e.firstHitDealt ? 'yes' : 'no'} dmg=${e.damageDealt.toFixed(1)}/${e.damageTaken.toFixed(1)} close=${e.distanceClosed.toFixed(1)} hDiff=${e.finalHealthDiff.toFixed(0)}`
            : '';
        
        // Calculate progress percentage
        const progress = ((step / config.totalSteps) * 100).toFixed(1);
        
        // Calculate win rate if available
        let winRateStr = '';
        if (r && r.episodes > 0) {
          const winRate = (r.wins / r.episodes) * 100;
          winRateStr = ` | WinRate: ${winRate.toFixed(1)}%`;
        }
        
        // Detect potential issues
        let warning = '';
        if (metrics.entropy < 0.1) {
          warning = ' ⚠️  LOW ENTROPY';
        } else if (r && r.anyDamageRate < 0.2) {
          warning = ' ⚠️  LOW ENGAGEMENT';
        } else if (metrics.avgReward < -50) {
          warning = ' ⚠️  NEGATIVE REWARDS';
        }
        
        console.log(
          `[Step ${step.toString().padStart(8)}/${config.totalSteps} (${progress}%)] ` +
          `Style: ${currentStyle.padEnd(8)} | ` +
          `Reward: ${metrics.avgReward.toFixed(2).padStart(6)} | ` +
          `P.Loss: ${metrics.policyLoss.toFixed(4)} | ` +
          `V.Loss: ${metrics.valueLoss.toFixed(4)} | ` +
          `Entropy: ${metrics.entropy.toFixed(4)}` +
          winRateStr +
          engagement +
          warning
        );
        
        // Every 50k steps, print a more detailed summary
        if (step > 0 && step % 50000 === 0) {
          console.log('\n' + '='.repeat(80));
          console.log(`📊 DETAILED PROGRESS @ ${step} steps`);
          console.log('='.repeat(80));
          
          // Calculate rolling averages (last 10 rollouts)
          const recentMetrics = allMetrics.slice(-10);
          if (recentMetrics.length > 0) {
            const avgReward = recentMetrics.reduce((sum, m) => sum + m.avgReward, 0) / recentMetrics.length;
            const avgPolicyLoss = recentMetrics.reduce((sum, m) => sum + m.policyLoss, 0) / recentMetrics.length;
            const avgValueLoss = recentMetrics.reduce((sum, m) => sum + m.valueLoss, 0) / recentMetrics.length;
            const avgEntropy = recentMetrics.reduce((sum, m) => sum + m.entropy, 0) / recentMetrics.length;
            
            console.log(`📈 Rolling Avg (last 10 rollouts):`);
            console.log(`   Reward:      ${avgReward.toFixed(3)}`);
            console.log(`   Policy Loss: ${avgPolicyLoss.toFixed(5)}`);
            console.log(`   Value Loss:  ${avgValueLoss.toFixed(5)}`);
            console.log(`   Entropy:     ${avgEntropy.toFixed(5)}`);
            
            // Calculate trend
            let trend = 0;
            if (recentMetrics.length >= 5) {
              const firstHalf = recentMetrics.slice(0, 5).reduce((sum, m) => sum + m.avgReward, 0) / 5;
              const secondHalf = recentMetrics.slice(5).reduce((sum, m) => sum + m.avgReward, 0) / 5;
              trend = secondHalf - firstHalf;
              const trendIcon = trend > 0 ? '📈' : trend < 0 ? '📉' : '➡️';
              console.log(`   Trend:       ${trendIcon} ${trend > 0 ? '+' : ''}${trend.toFixed(3)}`);
            }
            
            // Run health analysis
            analyzeTrainingHealth(allMetrics, opponentPool.getAllSnapshots().length, step);
          }
          
          // Episode statistics
          if (r) {
            const totalEpisodes = r.wins + r.losses + r.draws;
            console.log(`\n🎮 Episode Stats:`);
            console.log(`   Total:       ${totalEpisodes}`);
            console.log(`   Win Rate:    ${(r.wins / totalEpisodes * 100).toFixed(1)}%`);
            console.log(`   Engagement:  ${(r.anyDamageRate * 100).toFixed(1)}% dealt damage`);
            console.log(`   First Hit:   ${(r.firstHitRate * 100).toFixed(1)}%`);
            console.log(`   Avg Damage:  ${r.avgDamageDealt.toFixed(1)} dealt / ${r.avgDamageTaken.toFixed(1)} taken`);
            console.log(`   Distance:    ${r.avgDistanceClosed.toFixed(0)} pixels closed`);
          }
          
          // Opponent pool stats
          if (opponentPool) {
            const poolSnapshots = opponentPool.getAllSnapshots();
            if (poolSnapshots.length > 0) {
              const avgElo = poolSnapshots.reduce((sum: number, s) => sum + s.elo, 0) / poolSnapshots.length;
              const minElo = Math.min(...poolSnapshots.map(s => s.elo));
              const maxElo = Math.max(...poolSnapshots.map(s => s.elo));
              console.log(`\n🤖 Opponent Pool:`);
              console.log(`   Snapshots:   ${poolSnapshots.length}`);
              console.log(`   Avg Elo:     ${avgElo.toFixed(0)}`);
              console.log(`   Elo Range:   ${minElo.toFixed(0)} - ${maxElo.toFixed(0)}`);
            }
          }
          
          // Training health check
          console.log(`\n🏥 Health Check:`);
          
          // Calculate metrics for health check
          let healthTrend = 0;
          let avgEntropy = 0;
          let avgPolicyLoss = 0;
          if (recentMetrics.length > 0) {
            avgEntropy = recentMetrics.reduce((sum, m) => sum + m.entropy, 0) / recentMetrics.length;
            avgPolicyLoss = recentMetrics.reduce((sum, m) => sum + m.policyLoss, 0) / recentMetrics.length;
          }
          if (recentMetrics.length >= 5) {
            const firstHalf = recentMetrics.slice(0, 5).reduce((sum, m) => sum + m.avgReward, 0) / 5;
            const secondHalf = recentMetrics.slice(5).reduce((sum, m) => sum + m.avgReward, 0) / 5;
            healthTrend = secondHalf - firstHalf;
          }
          
          const healthChecks = [
            { name: 'Reward improving', pass: healthTrend > -1, status: healthTrend > 0 ? '✅' : healthTrend > -1 ? '⚠️' : '❌' },
            { name: 'Entropy adequate', pass: avgEntropy > 0.1, status: avgEntropy > 0.3 ? '✅' : avgEntropy > 0.1 ? '⚠️' : '❌' },
            { name: 'Engagement good', pass: !r || r.anyDamageRate > 0.3, status: !r || r.anyDamageRate > 0.6 ? '✅' : r.anyDamageRate > 0.3 ? '⚠️' : '❌' },
            { name: 'Losses stable', pass: avgPolicyLoss < 10, status: avgPolicyLoss < 1 ? '✅' : avgPolicyLoss < 10 ? '⚠️' : '❌' },
          ];
          
          for (const check of healthChecks) {
            console.log(`   ${check.status} ${check.name}`);
          }
          
          console.log('='.repeat(80) + '\n');
        }
      }

      // Save model checkpoint
      if (step > 0 && step % config.saveFrequency === 0) {
        await policy.save(config.modelPath);
        console.log(`\n[Checkpoint] Model saved at step ${step}\n`);
      }

      // Periodic evaluation + progress logging (JSONL)
      if (config.evalFrequency > 0 && step > 0 && step - lastEvalStep >= config.evalFrequency) {
        lastEvalStep = step;
        const evalEpisodesScripted = parseEnvInt('TRAIN_EVAL_EPISODES_SCRIPTED') ?? 30;
        const evalEpisodesSnapshots = parseEnvInt('TRAIN_EVAL_EPISODES_SNAPSHOTS') ?? 30;
        const evalMaxFrames = parseEnvInt('TRAIN_EVAL_MAX_FRAMES') ?? 1800;
        const evalGreedy = parseEnvBool('TRAIN_EVAL_GREEDY', true);
        const evalStyle = parseEnvString('TRAIN_EVAL_STYLE') ?? 'mixup';
        const scriptedOpponentAction =
          curriculumEnabled && curriculumPhase === 'easy'
            ? scriptedOpponentActionEasy
            : scriptedOpponentActionTight;

        console.log(`\n[Eval @ step ${step}] scripted=${evalEpisodesScripted}, snapshots=${evalEpisodesSnapshots}, maxFrames=${evalMaxFrames}, style=${evalStyle}, greedy=${evalGreedy ? 'yes' : 'no'}`);
        const report = await evaluatePolicy({
          policy,
          opponentPool,
          policyStyle: evalStyle,
          greedy: evalGreedy,
          maxFrames: evalMaxFrames,
          episodesVsScripted: evalEpisodesScripted,
          episodesVsSnapshots: evalEpisodesSnapshots,
          scriptedOpponentAction,
        });

        const record = {
          timestamp: Date.now(),
          step,
          style: currentStyle,
          phase: curriculumEnabled ? curriculumPhase : undefined,
          snapshotsLoaded: report.snapshotsLoaded,
          recentTrain: trainer.getLastRolloutEpisodeStats() ?? trainer.getLastRolloutEngagementStats() ?? undefined,
          scripted: report.policyVsScripted,
          snapshots: report.policyVsSnapshots ?? null,
        };
        fs.appendFileSync(config.progressPath, JSON.stringify(record) + '\n');
        const scripted = report.policyVsScripted;
        const scriptedLine = `scripted WR=${(scripted.winRate * 100).toFixed(1)}% dmg=${scripted.avgDamageDealt.toFixed(1)}/${scripted.avgDamageTaken.toFixed(1)} frames=${scripted.avgFrames.toFixed(0)}`;
        const snapshots = report.policyVsSnapshots;
        const snapshotsLine = snapshots
          ? `snapshots WR=${(snapshots.winRate * 100).toFixed(1)}% dmg=${snapshots.avgDamageDealt.toFixed(1)}/${snapshots.avgDamageTaken.toFixed(1)} frames=${snapshots.avgFrames.toFixed(0)}`
          : undefined;

        console.log(`[Eval] ${scriptedLine}${snapshotsLine ? ' | ' + snapshotsLine : ''}`);
        console.log(`[Eval] wrote ${config.progressPath}`);

        // Curriculum gating (only advances on eval checkpoints)
        if (curriculumEnabled && curriculumPhase === 'easy') {
          const dmg = report.policyVsScripted.avgDamageDealt;
          if (dmg >= curriculumDamageThreshold) {
            curriculumStreak++;
          } else {
            curriculumStreak = 0;
          }

          console.log(
            `[Curriculum] phase=easy dmg=${dmg.toFixed(1)} threshold=${curriculumDamageThreshold} streak=${curriculumStreak}/${curriculumRequiredEvals}`
          );

          if (curriculumStreak >= curriculumRequiredEvals) {
            curriculumPhase = 'tight';
            trainer.setOpponentMode('scripted-tight');
            console.log('[Curriculum] advanced to phase=tight (tight scripted opponent)');
          }
        }
      }
    }

    // Save final model
    await policy.save(config.modelPath);
    console.log('\nFinal model saved!\n');

    // Save training log
    const log = {
      config: {
        training: config,
        ppo: DEFAULT_PPO_CONFIG,
        pool: DEFAULT_POOL_CONFIG,
        observation: obsConfig,
        rewards: rewardWeights,
      },
      metrics: allMetrics,
      poolState: opponentPool.export(),
      trainerStats: trainer.getStatistics(),
      styleStats: styleTracker.getAllStats(),
      duration: Date.now() - startTime,
    };

    fs.writeFileSync(config.logPath, JSON.stringify(log, null, 2));
    console.log(`Training log saved to: ${config.logPath}`);

    // Print summary
    printTrainingSummary(allMetrics, Date.now() - startTime, trainer, styleTracker);
  } catch (error) {
    console.error('Training failed:', error);
    process.exit(1);
  }
}

/**
 * Print training summary
 */
function printTrainingSummary(
  metrics: any[], 
  duration: number, 
  trainer: PPOTrainer,
  styleTracker?: StyleTrainingTracker
) {
  console.log('\n=== Training Summary ===');
  console.log(`Total duration: ${formatDuration(duration)}`);
  console.log(`Total steps: ${metrics[metrics.length - 1]?.step || 0}`);

  if (metrics.length > 0) {
    const lastMetrics = metrics[metrics.length - 1];
    console.log(`Final average reward: ${lastMetrics.avgReward.toFixed(2)}`);
    console.log(`Final policy loss: ${lastMetrics.policyLoss.toFixed(4)}`);
    console.log(`Final value loss: ${lastMetrics.valueLoss.toFixed(4)}`);
    console.log(`Final entropy: ${lastMetrics.entropy.toFixed(4)}`);
  }

  // Print trainer statistics
  const stats = trainer.getStatistics();
  console.log(`\n=== Self-Play Statistics ===`);
  console.log(`Match wins: ${stats.matchWins}`);
  console.log(`Match losses: ${stats.matchLosses}`);
  if ('matchDraws' in stats) {
    console.log(`Match draws: ${(stats as any).matchDraws}`);
  }
  console.log(`Win rate: ${(stats.winRate * 100).toFixed(1)}%`);

  if (stats.poolStats) {
    console.log(`\n=== Opponent Pool Statistics ===`);
    console.log(`Total snapshots: ${stats.poolStats.count}`);
    console.log(`Average Elo: ${stats.poolStats.avgElo.toFixed(0)}`);
    console.log(`Elo range: ${stats.poolStats.minElo.toFixed(0)} - ${stats.poolStats.maxElo.toFixed(0)}`);
    console.log(`Average games played: ${stats.poolStats.avgGamesPlayed.toFixed(1)}`);
    
    console.log(`\nStyle distribution:`);
    for (const [style, count] of Object.entries(stats.poolStats.styleDistribution)) {
      console.log(`  ${style}: ${count}`);
    }
  }
  
  // Print style training statistics
  if (styleTracker) {
    console.log('\n' + styleTracker.formatStats());
  }

  console.log('\n✅ Training complete!');
}

/**
 * Format duration in human-readable form
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Analyze training metrics for potential issues
 */
function analyzeTrainingHealth(metrics: any[], poolSnapshots: number, currentStep: number) {
  if (metrics.length < 10) return; // Need enough data
  
  const recent = metrics.slice(-10);
  const avgReward = recent.reduce((sum, m) => sum + m.avgReward, 0) / recent.length;
  const avgEntropy = recent.reduce((sum, m) => sum + m.entropy, 0) / recent.length;
  const avgPolicyLoss = recent.reduce((sum, m) => sum + m.policyLoss, 0) / recent.length;
  
  // Check for issues
  const issues: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];
  
  // Reward not improving
  if (recent.length >= 10) {
    const firstHalf = recent.slice(0, 5).reduce((sum, m) => sum + m.avgReward, 0) / 5;
    const secondHalf = recent.slice(5).reduce((sum, m) => sum + m.avgReward, 0) / 5;
    const trend = secondHalf - firstHalf;
    
    if (currentStep > 100000 && Math.abs(trend) < 0.5 && avgReward < 0) {
      warnings.push('Reward plateauing at negative values');
      suggestions.push('Consider: 1) Adjust reward weights 2) Check if bot is learning any useful behavior');
    }
  }
  
  // Low entropy (policy becoming deterministic)
  if (avgEntropy < 0.05) {
    issues.push('Entropy very low - policy too deterministic');
    suggestions.push('Try: Increase TRAIN_ENTROPY_COEF (currently may be too low)');
  } else if (avgEntropy < 0.15) {
    warnings.push('Entropy getting low - policy may be collapsing');
  }
  
  // High losses
  if (avgPolicyLoss > 5) {
    warnings.push('Policy loss high - training may be unstable');
    suggestions.push('Consider: Lower learning rate or check for NaN values');
  }
  
  // Check engagement from recent rollouts
  const recentWithEpisodes = recent.filter(m => m.episodes > 0);
  if (recentWithEpisodes.length > 0) {
    const avgAnyDamage = recentWithEpisodes.reduce((sum, m) => sum + (m.anyDamageRate || 0), 0) / recentWithEpisodes.length;
    
    if (avgAnyDamage < 0.2) {
      issues.push('Very low engagement - bot not dealing damage');
      suggestions.push('Critical: Bot may have learned to avoid combat. Try: 1) Increase attackIntent reward 2) Add early-game engagement penalty');
    } else if (avgAnyDamage < 0.4) {
      warnings.push('Low engagement - bot needs more encouragement to attack');
    }
  }
  
  // Opponent pool
  if (currentStep > 200000 && poolSnapshots < 3) {
    warnings.push('Few opponent snapshots - may need more diversity');
  }
  
  // Print diagnostics if any issues
  if (issues.length > 0 || warnings.length > 0) {
    console.log('\n' + '⚠'.repeat(40));
    console.log('🏥 TRAINING HEALTH REPORT');
    console.log('⚠'.repeat(40));
    
    if (issues.length > 0) {
      console.log('\n❌ CRITICAL ISSUES:');
      issues.forEach(issue => console.log(`   ${issue}`));
    }
    
    if (warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      warnings.forEach(warning => console.log(`   ${warning}`));
    }
    
    if (suggestions.length > 0) {
      console.log('\n💡 SUGGESTIONS:');
      suggestions.forEach(suggestion => console.log(`   ${suggestion}`));
    }
    
    console.log('\n' + '⚠'.repeat(40) + '\n');
  }
}

/**
 * Estimate number of parameters in network
 */
function estimateParameters(obsSize: number, actionSize: number): string {
  // Input → Dense(128) → Dense(128) → [Policy(actions), Value(1)]
  const params =
    obsSize * 128 + 128 + // First layer
    128 * 128 + 128 + // Second layer
    128 * actionSize + actionSize + // Policy head
    128 * 1 + 1; // Value head

  if (params >= 1_000_000) {
    return `${(params / 1_000_000).toFixed(2)}M`;
  } else if (params >= 1_000) {
    return `${(params / 1_000).toFixed(1)}K`;
  } else {
    return params.toString();
  }
}

/**
 * Ensure directory exists
 */
function ensureDirectoryExists(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Run training
if (require.main === module) {
  main().catch(console.error);
}

export { main };
