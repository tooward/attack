/**
 * PPO Trainer
 * 
 * Proximal Policy Optimization implementation for fighting game bot training.
 * Uses actor-critic architecture with GAE for advantage estimation.
 */

import * as tf from '@tensorflow/tfjs-node';
import * as nodePath from 'path';
import { FightingGameEnv, ActionBundle } from '../core/Environment';
import { ObservationEncoder } from '../core/ObservationEncoder';
import { RewardFunction, RewardWeights } from '../core/RewardFunction';
import { OpponentPool, OpponentSnapshot } from './OpponentPool';
import { CurriculumManager } from './CurriculumManager';
import { BehaviorAnalyzer } from '../evaluation/BehaviorAnalysis';

/**
 * PPO Configuration
 */
export interface PPOConfig {
  // Learning
  learningRate: number;          // 3e-4
  gamma: number;                 // 0.99 (discount factor)
  lambda: number;                // 0.95 (GAE lambda)

  // PPO specific
  clipRange: number;             // 0.2
  entropyCoef: number;           // 0.01
  valueCoef: number;             // 0.5
  maxGradNorm: number;           // 0.5

  // Training
  batchSize: number;             // 2048 steps
  minibatchSize: number;         // 256 steps
  epochsPerBatch: number;        // 4

  // Environment
  stepsPerRollout: number;       // 2048
}

/**
 * Default PPO configuration
 */
export const DEFAULT_PPO_CONFIG: PPOConfig = {
  learningRate: 0.00005,
  gamma: 0.99,
  lambda: 0.95,
  clipRange: 0.2,
  entropyCoef: 0.01,
  valueCoef: 0.5,
  maxGradNorm: 0.5,
  batchSize: 64,
  minibatchSize: 64,
  epochsPerBatch: 4,
  stepsPerRollout: 2048,
};

/**
 * Training metrics
 */
export interface TrainingMetrics {
  step: number;
  avgReward: number;
  avgEpisodeLength: number;
  policyLoss: number;
  valueLoss: number;
  entropy: number;
  clipFraction: number;
  explainedVariance: number;
  episodeRewards: number[];

  // Rollout summary (computed from true episode ends inside collectRollout)
  episodes?: number;
  wins?: number;
  losses?: number;
  draws?: number;

  // Engagement metrics (helps detect "no interaction" collapse)
  anyDamageRate?: number; // fraction of episodes where player1 dealt any damage
  firstHitRate?: number;  // fraction of episodes where player1 landed first hit
  avgDamageDealt?: number;
  avgDamageTaken?: number;
  avgDistanceClosed?: number; // average pixels closed per episode
}

type RolloutEpisodeStats = {
  episodes: number;
  wins: number;
  losses: number;
  draws: number;
  anyDamageRate: number;
  firstHitRate: number;
  avgDamageDealt: number;
  avgDamageTaken: number;
  avgDistanceClosed: number;
};

type RolloutEngagementStats = {
  damageDealt: number;
  damageTaken: number;
  distanceClosed: number;
  anyDamage: boolean;
  firstHitDealt: boolean;
  proxyOutcome: 'win' | 'loss' | 'draw';
  finalHealthDiff: number; // player1Health - player2Health
};

/**
 * Rollout buffer for storing experience
 */
interface RolloutBuffer {
  observations: number[][];
  actions: number[];
  rewards: number[];
  dones: boolean[];
  values: number[];
  logProbs: number[];
}

/**
 * Actor-Critic Policy Network
 */
export class ActorCriticPolicy {
  private model: tf.LayersModel;
  private obsSize: number;
  private actionSize: number;
  private optimizer: tf.Optimizer;

  constructor(obsSize: number, actionSize: number, learningRate: number = 0.0003) {
    this.obsSize = obsSize;
    this.actionSize = actionSize;
    this.optimizer = tf.train.adam(learningRate);
    this.model = this.buildModel();
  }

  /**
   * Build actor-critic network
   */
  private buildModel(): tf.LayersModel {
    // Input
    const input = tf.input({ shape: [this.obsSize] });

    // Shared trunk
    let x = tf.layers.dense({
      units: 128,
      activation: 'relu',
      kernelInitializer: 'heNormal',
    }).apply(input) as tf.SymbolicTensor;

    x = tf.layers.dense({
      units: 128,
      activation: 'relu',
      kernelInitializer: 'heNormal',
    }).apply(x) as tf.SymbolicTensor;

    // Policy head (actor)
    const policyHead = tf.layers.dense({
      units: this.actionSize,
      activation: 'softmax',
      name: 'policy',
      kernelInitializer: 'orthogonal',
    }).apply(x) as tf.SymbolicTensor;

    // Value head (critic)
    const valueHead = tf.layers.dense({
      units: 1,
      activation: 'linear',
      name: 'value',
      kernelInitializer: 'orthogonal',
    }).apply(x) as tf.SymbolicTensor;

    // Build model
    const model = tf.model({
      inputs: input,
      outputs: [policyHead, valueHead],
    });

    return model;
  }

  /**
   * Forward pass through network
   */
  predict(observation: number[]): { policy: number[]; value: number } {
    return tf.tidy(() => {
      const obsTensor = tf.tensor2d([observation]);
      const [policyTensor, valueTensor] = this.model.predict(obsTensor) as [tf.Tensor, tf.Tensor];

      const policy = Array.from(policyTensor.dataSync());
      const value = valueTensor.dataSync()[0];

      return { policy, value };
    });
  }

  /**
   * Sample action from policy
   */
  sampleAction(
    observation: number[],
    temperature: number = 1.0,
    forcedAction?: number
  ): {
    action: number;
    logProb: number;
    value: number;
  } {
    const { policy, value } = this.predict(observation);

    // Apply temperature
    let probs = policy.map(p => Math.pow(p, 1 / temperature));
    const sum = probs.reduce((a, b) => a + b, 0);
    probs = probs.map(p => p / sum);

    // Sample or force action
    const action =
      forcedAction !== undefined
        ? Math.max(0, Math.min(probs.length - 1, forcedAction))
        : this.categoricalSample(probs);
    const logProb = Math.log(probs[action] + 1e-8);

    return { action, logProb, value };
  }

  /**
   * Get best action (greedy)
   */
  selectBestAction(observation: number[]): number {
    const { policy } = this.predict(observation);
    return policy.indexOf(Math.max(...policy));
  }

  /**
   * Update policy with PPO
   */
  async update(
    buffer: RolloutBuffer,
    config: PPOConfig
  ): Promise<{ policyLoss: number; valueLoss: number; entropy: number; clipFraction: number }> {
    // Compute advantages
    const { advantages, returns } = this.computeAdvantages(
      buffer.rewards,
      buffer.values,
      buffer.dones,
      config.gamma,
      config.lambda
    );

    // Normalize advantages
    const advMean = advantages.reduce((a, b) => a + b, 0) / advantages.length;
    const advStd = Math.sqrt(
      advantages.reduce((sum, a) => sum + Math.pow(a - advMean, 2), 0) / advantages.length
    );
    const normalizedAdv = advantages.map(a => (a - advMean) / (advStd + 1e-8));

    // Training metrics
    let totalPolicyLoss = 0;
    let totalValueLoss = 0;
    let totalEntropy = 0;
    let totalClipFraction = 0;
    let updateCount = 0;

    // Multiple epochs over the data
    for (let epoch = 0; epoch < config.epochsPerBatch; epoch++) {
      // Shuffle and create minibatches
      const indices = this.shuffleIndices(buffer.observations.length);

      for (let start = 0; start < buffer.observations.length; start += config.minibatchSize) {
        const end = Math.min(start + config.minibatchSize, buffer.observations.length);
        const batchIndices = indices.slice(start, end);

        // Extract minibatch
        const batchObs = batchIndices.map(i => buffer.observations[i]);
        const batchActions = batchIndices.map(i => buffer.actions[i]);
        const batchAdv = batchIndices.map(i => normalizedAdv[i]);
        const batchReturns = batchIndices.map(i => returns[i]);
        const batchOldLogProbs = batchIndices.map(i => buffer.logProbs[i]);

        // Update
        const metrics = await this.updateMinibatch(
          batchObs,
          batchActions,
          batchAdv,
          batchReturns,
          batchOldLogProbs,
          config
        );

        totalPolicyLoss += metrics.policyLoss;
        totalValueLoss += metrics.valueLoss;
        totalEntropy += metrics.entropy;
        totalClipFraction += metrics.clipFraction;
        updateCount++;
      }
    }

    return {
      policyLoss: totalPolicyLoss / updateCount,
      valueLoss: totalValueLoss / updateCount,
      entropy: totalEntropy / updateCount,
      clipFraction: totalClipFraction / updateCount,
    };
  }

  /**
   * Update on a minibatch
   */
  private async updateMinibatch(
    observations: number[][],
    actions: number[],
    advantages: number[],
    returns: number[],
    oldLogProbs: number[],
    config: PPOConfig
  ): Promise<{ policyLoss: number; valueLoss: number; entropy: number; clipFraction: number }> {
    return tf.tidy(() => {
      const obsTensor = tf.tensor2d(observations);
      const actionsTensor = tf.tensor1d(actions, 'int32');
      const advTensor = tf.tensor1d(advantages);
      const returnsTensor = tf.tensor1d(returns);
      const oldLogProbsTensor = tf.tensor1d(oldLogProbs);

      // Forward + loss + grads
      const { value: loss, grads } = tf.variableGrads(() => {
        const [policyLogits, values] = this.model.predict(obsTensor) as [tf.Tensor2D, tf.Tensor2D];

        // Policy loss (PPO clip)
        const logProbs = this.getLogProbs(policyLogits, actionsTensor);
        const ratio = tf.exp(tf.sub(logProbs, oldLogProbsTensor));
        const clippedRatio = tf.clipByValue(ratio, 1 - config.clipRange, 1 + config.clipRange);

        const surr1 = tf.mul(ratio, advTensor);
        const surr2 = tf.mul(clippedRatio, advTensor);
        const policyLoss = tf.neg(tf.mean(tf.minimum(surr1, surr2)));

        // Value loss
        const valueLoss = tf.mean(tf.square(tf.sub(tf.squeeze(values), returnsTensor)));

        // Entropy bonus
        const entropy = this.computeEntropy(policyLogits);
        const entropyLoss = tf.mul(tf.scalar(-config.entropyCoef), entropy);

        // Total loss
        const totalLoss = tf.add(tf.add(policyLoss, tf.mul(tf.scalar(config.valueCoef), valueLoss)), entropyLoss);
        return totalLoss as tf.Scalar;
      });

      // Apply gradients
      this.optimizer.applyGradients(grads as { [name: string]: tf.Tensor });

      // Calculate metrics
      const [policyLogits, values] = this.model.predict(obsTensor) as [tf.Tensor2D, tf.Tensor2D];
      const logProbs = this.getLogProbs(policyLogits, actionsTensor);
      const ratio = tf.exp(tf.sub(logProbs, oldLogProbsTensor));

      const clippedMask = tf.logicalOr(
        tf.less(ratio, 1 - config.clipRange),
        tf.greater(ratio, 1 + config.clipRange)
      );
      const clipFraction = tf.mean(tf.cast(clippedMask, 'float32')).dataSync()[0];

      const policyLoss = loss.dataSync()[0];
      const valueLoss = tf.mean(tf.square(tf.sub(tf.squeeze(values), returnsTensor))).dataSync()[0];
      const entropy = this.computeEntropy(policyLogits).dataSync()[0];

      return { policyLoss, valueLoss, entropy, clipFraction };
    });
  }

  /**
   * Compute GAE advantages
   */
  private computeAdvantages(
    rewards: number[],
    values: number[],
    dones: boolean[],
    gamma: number,
    lambda: number
  ): { advantages: number[]; returns: number[] } {
    const advantages: number[] = [];
    const returns: number[] = [];

    let lastAdvantage = 0;

    for (let t = rewards.length - 1; t >= 0; t--) {
      const nextValue = t < rewards.length - 1 && !dones[t] ? values[t + 1] : 0;
      const delta = rewards[t] + gamma * nextValue - values[t];
      const advantage = delta + gamma * lambda * lastAdvantage * (dones[t] ? 0 : 1);

      advantages[t] = advantage;
      returns[t] = advantage + values[t];
      lastAdvantage = advantage;
    }

    return { advantages, returns };
  }

  /**
   * Get log probabilities for actions
   */
  private getLogProbs(policyLogits: tf.Tensor2D, actions: tf.Tensor1D): tf.Tensor1D {
    return tf.tidy(() => {
      const logProbs = tf.log(tf.add(policyLogits, 1e-8));
      const actionMask = tf.oneHot(actions, this.actionSize);
      return tf.sum(tf.mul(logProbs, actionMask), 1);
    });
  }

  /**
   * Compute policy entropy
   */
  private computeEntropy(policyLogits: tf.Tensor2D): tf.Scalar {
    return tf.tidy(() => {
      const logProbs = tf.log(tf.add(policyLogits, 1e-8));
      return tf.mean(tf.sum(tf.mul(tf.neg(policyLogits), logProbs), 1));
    });
  }

  /**
   * Sample from categorical distribution
   */
  private categoricalSample(probs: number[]): number {
    const r = Math.random();
    let cumulative = 0;

    for (let i = 0; i < probs.length; i++) {
      cumulative += probs[i];
      if (r < cumulative) {
        return i;
      }
    }

    return probs.length - 1;
  }

  /**
   * Shuffle array indices
   */
  private shuffleIndices(length: number): number[] {
    const indices = Array.from({ length }, (_, i) => i);
    
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    return indices;
  }

  /**
   * Save model
   */
  async save(path: string): Promise<void> {
    const absPath = nodePath.resolve(path);
    await this.model.save(`file://${absPath}`);
  }

  /**
   * Load model
   */
  async load(path: string): Promise<void> {
    const absPath = nodePath.resolve(path);
    this.model = await tf.loadLayersModel(`file://${absPath}/model.json`);
  }

  /**
   * Clone policy
   */
  clone(): ActorCriticPolicy {
    const cloned = new ActorCriticPolicy(this.obsSize, this.actionSize);
    // Copy weights
    const weights = this.model.getWeights();
    cloned.model.setWeights(weights);
    return cloned;
  }
}

/**
 * PPO Trainer
 */
export class PPOTrainer {
  private env: FightingGameEnv;
  private policy: ActorCriticPolicy;
  private obsEncoder: ObservationEncoder;
  private rewardFn: RewardFunction;
  private config: PPOConfig;
  private totalSteps: number = 0;
  private opponentPool?: OpponentPool;
  private currentOpponent?: OpponentSnapshot;
  private matchWins: number = 0;
  private matchLosses: number = 0;
  private matchDraws: number = 0;
  private lastRolloutEpisodeStats: RolloutEpisodeStats | null = null;
  private lastRolloutEngagementStats: RolloutEngagementStats | null = null;
  private curriculum?: CurriculumManager;
  private behaviorAnalyzer: BehaviorAnalyzer;
  private lastSnapshotStep: number;
  private opponentMode: 'auto' | 'scripted-easy' | 'scripted-tight' | 'pool' = 'auto';
  private scriptedOpponentMixProb: number = 0;
  private scriptedMinEpisodesPerRollout: number = 0;
  private scriptedVariant: 'easy' | 'tight' = 'tight';
  private customBotActionFn?: (state: any, actorId: string, targetId: string) => ActionBundle;
  private bootstrapMirrorFrames: number = 0;
  private bootstrapProb: number = 0;
  private maxEpisodeFrames: number = 0;
  private swapRoleProb: number = 0;
  private p2ScriptedMinEpisodesPerRollout: number = 0;

  constructor(
    env: FightingGameEnv,
    policy: ActorCriticPolicy,
    obsEncoder: ObservationEncoder,
    rewardFn: RewardFunction,
    config: PPOConfig = DEFAULT_PPO_CONFIG,
    opponentPool?: OpponentPool,
    curriculum?: CurriculumManager
  ) {
    this.env = env;
    this.policy = policy;
    this.obsEncoder = obsEncoder;
    this.rewardFn = rewardFn;
    this.config = config;
    this.opponentPool = opponentPool;
    this.curriculum = curriculum;
    this.behaviorAnalyzer = new BehaviorAnalyzer();
    this.lastSnapshotStep = 0;
  }

  /**
   * Override opponent selection.
   * - auto: current behavior (sample from pool if it has snapshots, otherwise scripted)
   * - scripted-easy: always use easy scripted opponent
   * - scripted-tight: always use tight scripted opponent
   * - pool: always sample from opponent pool (if available)
   */
  setOpponentMode(mode: 'auto' | 'scripted-easy' | 'scripted-tight' | 'pool'): void {
    this.opponentMode = mode;
  }

  /**
   * In non-forced modes, mix in scripted opponents even when snapshot opponents exist.
   * This helps prevent catastrophic forgetting against the scripted baseline.
   */
  setScriptedOpponentMix(probability: number): void {
    this.scriptedOpponentMixProb = Math.max(0, Math.min(1, probability));
  }

  /**
   * Guarantee a minimum number of scripted episodes are started per rollout.
   * Useful to prevent catastrophic forgetting vs scripted baselines when using an opponent pool.
   */
  setScriptedMinEpisodesPerRollout(minEpisodes: number): void {
    this.scriptedMinEpisodesPerRollout = Math.max(0, Math.trunc(minEpisodes));
  }

  /**
   * Choose which scripted variant to use when mixing scripted episodes in auto/pool modes.
   */
  setScriptedVariant(variant: 'easy' | 'tight'): void {
    this.scriptedVariant = variant;
  }

  /**
   * Set custom bot action function for advanced scripted opponents.
   * When set, this will be used instead of the built-in easy/tight variants.
   */
  setCustomBotActionFn(fn: ((state: any, actorId: string, targetId: string) => ActionBundle) | null): void {
    this.customBotActionFn = fn ?? undefined;
  }

  /**
   * Bootstrap learning by mirroring the opponent's opening moves.
   *
   * For the first N frames of each episode, player1 will (with probability p)
   * take an action derived from the opponent's action (mirrored relative to
   * player1), while still logging the on-policy logProb for PPO.
   */
  setBootstrap(mirrorFrames: number, probability: number): void {
    this.bootstrapMirrorFrames = Math.max(0, Math.trunc(mirrorFrames));
    this.bootstrapProb = Math.max(0, Math.min(1, probability));
  }

  /**
   * Optional safety cap to force episode boundaries during training rollouts.
   * When > 0, an episode is truncated after this many frames and treated as terminal.
   */
  setMaxEpisodeFrames(frames: number): void {
    this.maxEpisodeFrames = Math.max(0, Math.trunc(frames));
  }

  /**
   * Randomly swap roles during training episodes.
   * With probability p, the policy plays as player2 and the opponent as player1.
   * This teaches the bot to respond to pressure, not just initiate.
   */
  setSwapRoleProbability(probability: number): void {
    this.swapRoleProb = Math.max(0, Math.min(1, probability));
  }

  setP2ScriptedMinEpisodesPerRollout(minEpisodes: number): void {
    this.p2ScriptedMinEpisodesPerRollout = Math.max(0, Math.trunc(minEpisodes));
  }

  /**
   * Train for a specified number of steps
   */
  async train(numSteps: number): Promise<TrainingMetrics[]> {
    const metricsHistory: TrainingMetrics[] = [];
    let episodeRewards: number[] = [];
    let episodeLengths: number[] = [];

    while (this.totalSteps < numSteps) {
      // Collect rollout
      const buffer = await this.collectRollout();

      // Update policy
      const updateMetrics = await this.policy.update(buffer, this.config);

      // Calculate episode metrics
      const avgReward = episodeRewards.length > 0
        ? episodeRewards.reduce((a, b) => a + b, 0) / episodeRewards.length
        : 0;

      const avgEpisodeLength = episodeLengths.length > 0
        ? episodeLengths.reduce((a, b) => a + b, 0) / episodeLengths.length
        : 0;

      // Store metrics
      const metrics: TrainingMetrics = {
        step: this.totalSteps,
        avgReward,
        avgEpisodeLength,
        policyLoss: updateMetrics.policyLoss,
        valueLoss: updateMetrics.valueLoss,
        entropy: updateMetrics.entropy,
        clipFraction: updateMetrics.clipFraction,
        explainedVariance: 0, // TODO: Calculate
        episodeRewards: [...episodeRewards],
      };

      metricsHistory.push(metrics);

      // Log progress
      console.log(
        `Step ${this.totalSteps} | Reward: ${avgReward.toFixed(2)} | ` +
        `Policy Loss: ${updateMetrics.policyLoss.toFixed(4)} | ` +
        `Value Loss: ${updateMetrics.valueLoss.toFixed(4)} | ` +
        `Entropy: ${updateMetrics.entropy.toFixed(4)}`
      );

      // Create snapshot if needed
      if (this.shouldCreateSnapshot()) {
        this.createSnapshot(avgReward);
        
        // Log pool statistics
        const poolStats = this.opponentPool?.getStatistics();
        if (poolStats) {
          console.log(
            `  Pool: ${poolStats.count} snapshots | ` +
            `Avg Elo: ${poolStats.avgElo.toFixed(0)} | ` +
            `Win rate: ${(this.getStatistics().winRate * 100).toFixed(1)}%`
          );
        }
      }

      // Check curriculum progression
      if (this.curriculum && !this.curriculum.isComplete()) {
        const behaviorReport = this.behaviorAnalyzer.generateReport(10);
        const won = this.matchWins > this.matchLosses;
        
        this.curriculum.recordMatch(
          won,
          avgReward,
          behaviorReport.stalling.stallingRate,
          behaviorReport.diversity.entropy
        );

        // Try to advance curriculum stage
        const advanced = this.curriculum.tryAdvance();
        if (advanced) {
          // Update reward weights for new stage
          const baseWeights = this.rewardFn.getWeights();
          const stageWeights = this.curriculum.getRewardWeights(baseWeights);
          this.rewardFn.updateWeights(stageWeights);
          
          // Reset behavior analyzer
          this.behaviorAnalyzer.reset();
        }
      }

      // Clear episode buffers
      episodeRewards = [];
      episodeLengths = [];
    }

    return metricsHistory;
  }

  /**
   * Train a single rollout with style support
   */
  async trainStep(style?: string): Promise<TrainingMetrics> {
    // Collect rollout (pass style to observation encoder)
    const buffer = await this.collectRollout(style);

    // Update policy
    const updateMetrics = await this.policy.update(buffer, this.config);

    // Calculate episode metrics from buffer
    let episodeReward = 0;
    let episodeCount = 0;
    let currentEpisodeReward = 0;
    
    for (let i = 0; i < buffer.rewards.length; i++) {
      currentEpisodeReward += buffer.rewards[i];
      if (buffer.dones[i]) {
        episodeReward += currentEpisodeReward;
        episodeCount++;
        currentEpisodeReward = 0;
      }
    }
    
    // Use per-step average instead of per-episode to show dense reward signals
    const totalReward = buffer.rewards.reduce((a, b) => a + b, 0);
    const avgReward = buffer.rewards.length > 0 ? totalReward / buffer.rewards.length : 0;
    const avgEpisodeLength = episodeCount > 0 ? buffer.rewards.length / episodeCount : 0;

    // Store metrics
    const metrics: TrainingMetrics = {
      step: this.totalSteps,
      avgReward,
      avgEpisodeLength,
      policyLoss: updateMetrics.policyLoss,
      valueLoss: updateMetrics.valueLoss,
      entropy: updateMetrics.entropy,
      clipFraction: updateMetrics.clipFraction,
      explainedVariance: 0,
      episodeRewards: [],
    };

    return metrics;
  }

  /**
   * Collect rollout experience
   */
  private async collectRollout(style?: string): Promise<RolloutBuffer> {
    const buffer: RolloutBuffer = {
      observations: [],
      actions: [],
      rewards: [],
      dones: [],
      values: [],
      logProbs: [],
    };

    const debugEnabled = process.env.ML_DEBUG === '1' && process.env.NODE_ENV !== 'test';

    // Reset environment
    let state = this.env.reset();
    this.rewardFn.reset(state);

    let useScriptedThisEpisode = false;
    let scriptedEpisodesScheduledThisRollout = 0;
    let p2ScriptedEpisodesScheduledThisRollout = 0;
    let forceScriptedTightThisEpisode = false;
    const selectOpponentForEpisode = () => {
      // Forced scripted modes always use scripted.
      if (this.opponentMode === 'scripted-easy' || this.opponentMode === 'scripted-tight') {
        this.currentOpponent = undefined;
        useScriptedThisEpisode = true;
        return;
      }

      // Hard guarantee: schedule a minimum number of scripted episodes per rollout.
      if (scriptedEpisodesScheduledThisRollout < this.scriptedMinEpisodesPerRollout) {
        this.currentOpponent = undefined;
        useScriptedThisEpisode = true;
        scriptedEpisodesScheduledThisRollout++;
        return;
      }

      // In pool/auto modes, sample a snapshot if available.
      if (this.opponentPool && this.opponentPool.getAllSnapshots().length > 0) {
        this.currentOpponent = this.opponentPool.sampleOpponent();
      } else {
        this.currentOpponent = undefined;
      }

      // If no snapshot exists, fall back to scripted.
      if (!this.currentOpponent) {
        useScriptedThisEpisode = true;
        return;
      }

      // Otherwise, mix in scripted episodes with configured probability.
      useScriptedThisEpisode = Math.random() < this.scriptedOpponentMixProb;
    };

    // Decide the episode configuration (role + opponent), with an optional guarantee
    // that we train some "policy as player2 vs scripted-tight" episodes every rollout.
    let policyIsPlayer2 = false;
    const configureEpisode = () => {
      forceScriptedTightThisEpisode = false;

      // Default role distribution.
      policyIsPlayer2 = Math.random() < this.swapRoleProb;

      // Hard guarantee: schedule some episodes where policy is player2 and the
      // opponent is scripted-tight (aggressive), regardless of snapshot pool state.
      if (p2ScriptedEpisodesScheduledThisRollout < this.p2ScriptedMinEpisodesPerRollout) {
        policyIsPlayer2 = true;
        this.currentOpponent = undefined;
        useScriptedThisEpisode = true;
        forceScriptedTightThisEpisode = true;
        p2ScriptedEpisodesScheduledThisRollout++;
        return;
      }

      // Otherwise choose opponent normally.
      selectOpponentForEpisode();
    };

    // Configure the starting episode.
    configureEpisode();

    let episodeReward = 0;
    let episodeLength = 0;
    let episodeFrame = 0;

    // Episode/engagement stats for this rollout
    let episodes = 0;
    let wins = 0;
    let losses = 0;
    let draws = 0;
    let sumDamageDealt = 0;
    let sumDamageTaken = 0;
    let sumDistanceClosed = 0;
    let episodesWithAnyDamage = 0;
    let episodesFirstHit = 0;

    let episodeDamageDealt = 0;
    let episodeDamageTaken = 0;
    let episodeDistanceClosed = 0;
    let episodeAnyDamage = false;
    let episodeFirstHitResolved = false;
    let episodeFirstHitDealt = false;

    // Rollout-level engagement (always available even if an episode doesn't end)
    let rolloutDamageDealt = 0;
    let rolloutDamageTaken = 0;
    let rolloutDistanceClosed = 0;
    let rolloutAnyDamage = false;
    let rolloutFirstHitResolved = false;
    let rolloutFirstHitDealt = false;

    for (let step = 0; step < this.config.stepsPerRollout; step++) {
      // Determine which player is the policy and which is opponent
      const policyPlayerId = policyIsPlayer2 ? 'player2' : 'player1';
      const opponentPlayerId = policyIsPlayer2 ? 'player1' : 'player2';

      // Get observation for policy
      const obs = this.obsEncoder.encodeCanonical(state, policyPlayerId, style);

      // Get opponent action
      let opponentAction: ActionBundle;
      if (this.currentOpponent && !useScriptedThisEpisode) {
        // If the observation encoder includes a style vector, we must always
        // pass a style string; otherwise the observation length won't match the
        // opponent snapshot policy's expected input shape.
        const opponentStyle =
          (this.currentOpponent.metadata?.style ?? style ?? 'mixup') as string;
        const opponentObs = this.obsEncoder.encodeCanonical(state, opponentPlayerId, opponentStyle);
        const { action: oppAction } = this.currentOpponent.policy.sampleAction(opponentObs);
        opponentAction = this.uncanonicalizeBundleForEntity(state, opponentPlayerId, this.actionToBundle(oppAction));
      } else {
        // Use scripted opponent behavior to provide learning signal
        if (this.customBotActionFn) {
          // Use custom bot action function (advanced bots)
          opponentAction = this.customBotActionFn(state, opponentPlayerId, policyPlayerId);
        } else {
          // Use legacy easy/tight variants
          const variant: 'easy' | 'tight' =
            forceScriptedTightThisEpisode
              ? 'tight'
              : this.opponentMode === 'scripted-easy'
                ? 'easy'
                : this.opponentMode === 'scripted-tight'
                  ? 'tight'
                  : this.scriptedVariant;

          opponentAction =
            variant === 'easy'
              ? this.getScriptedOpponentActionEasy(state, opponentPlayerId, policyPlayerId)
              : this.getScriptedOpponentActionTight(state, opponentPlayerId, policyPlayerId);
        }
        
        // Debug: Log scripted action first 10 steps
        if (debugEnabled && step < 10) {
          console.log(`[Step ${this.totalSteps}] Scripted action:`, opponentAction);
        }
      }

      // Bootstrap: mirror opponent opening moves (optional, only when policy is player1)
      let forcedAction: number | undefined;
      if (
        !policyIsPlayer2 &&
        this.bootstrapMirrorFrames > 0 &&
        episodeFrame < this.bootstrapMirrorFrames &&
        Math.random() < this.bootstrapProb
      ) {
        const mirrored = this.mirrorActionForPlayer1(state, opponentAction);
        forcedAction = this.bundleToActionIndex(mirrored);
      }

      // Select action for policy (optionally forced for bootstrap)
      const { action, logProb, value } = this.policy.sampleAction(obs, 1.0, forcedAction);

      // Convert action to ActionBundle
      const actionBundle = this.uncanonicalizeBundleForEntity(state, policyPlayerId, this.actionToBundle(action));

      // Step environment
      const actions = new Map<string, ActionBundle>();
      actions.set(policyPlayerId, actionBundle);
      actions.set(opponentPlayerId, opponentAction);

      const stepResult = this.env.step(actions);
      
      // Get current state and calculate reward using RewardFunction
      const prevState = state;
      state = this.env.getState();
      const rewardBreakdown = this.rewardFn.calculateRewardBreakdown(prevState, state, policyPlayerId, stepResult.info.events);

      const forceDone = this.maxEpisodeFrames > 0 && (episodeFrame + 1) >= this.maxEpisodeFrames;
      const episodeDone = stepResult.done || forceDone;

      // If we forced an episode boundary (frame cap), apply timeout penalty.
      // Otherwise, agents can learn a stalemate equilibrium that simply runs out the cap.
      let reward = rewardBreakdown.total;
      if (forceDone && !stepResult.done) {
        reward += this.rewardFn.getWeights().timeoutPenalty;
      }

      // Debug: Log significant rewards early in training
      if (debugEnabled && this.totalSteps < 1000 && Math.abs(reward) > 1.0) {
        console.log(`[Step ${this.totalSteps}] Significant reward: ${reward.toFixed(2)}`);
        console.log('  Breakdown:', {
          damage: rewardBreakdown.damageDealt.toFixed(2),
          damageTaken: rewardBreakdown.damageTaken.toFixed(2),
          hitConfirm: rewardBreakdown.hitConfirm.toFixed(2),
          block: rewardBreakdown.successfulBlock.toFixed(2),
          knockdown: rewardBreakdown.knockdown.toFixed(2),
        });
      }

      // Store experience
      buffer.observations.push(obs);
      buffer.actions.push(action);
      buffer.rewards.push(reward);
      buffer.dones.push(episodeDone);
      buffer.values.push(value);
      buffer.logProbs.push(logProb);

      // Record for behavior analysis (only sample to prevent memory bloat)
      if (this.totalSteps % 100 === 0) {
        this.behaviorAnalyzer.recordState(state, step);
        this.behaviorAnalyzer.recordAction(action);
      }

      episodeReward += reward;
      episodeLength++;
      episodeFrame++;
      this.totalSteps++;

      // Engagement tracking (per-episode)
      const dmgDealtDelta = stepResult.info.damageDealt.get(policyPlayerId) ?? 0;
      const dmgTakenDelta = stepResult.info.damageTaken.get(policyPlayerId) ?? 0;
      if (dmgDealtDelta > 0) {
        episodeDamageDealt += dmgDealtDelta;
        episodeAnyDamage = true;
        rolloutDamageDealt += dmgDealtDelta;
        rolloutAnyDamage = true;
      }
      if (dmgTakenDelta > 0) {
        episodeDamageTaken += dmgTakenDelta;
        rolloutDamageTaken += dmgTakenDelta;
      }

      // First hit: first non-simultaneous damage event decides.
      if (!episodeFirstHitResolved) {
        if (dmgDealtDelta > 0 && dmgTakenDelta === 0) {
          episodeFirstHitResolved = true;
          episodeFirstHitDealt = true;
        } else if (dmgTakenDelta > 0 && dmgDealtDelta === 0) {
          episodeFirstHitResolved = true;
          episodeFirstHitDealt = false;
        }
      }

      if (!rolloutFirstHitResolved) {
        if (dmgDealtDelta > 0 && dmgTakenDelta === 0) {
          rolloutFirstHitResolved = true;
          rolloutFirstHitDealt = true;
        } else if (dmgTakenDelta > 0 && dmgDealtDelta === 0) {
          rolloutFirstHitResolved = true;
          rolloutFirstHitDealt = false;
        }
      }

      // Distance closing
      const prevPolicy = prevState.entities.find((e: any) => e.id === policyPlayerId);
      const prevOpp = prevState.entities.find((e: any) => e.id === opponentPlayerId);
      const currPolicy = state.entities.find((e: any) => e.id === policyPlayerId);
      const currOpp = state.entities.find((e: any) => e.id === opponentPlayerId);
      if (prevPolicy && prevOpp && currPolicy && currOpp) {
        const prevDist = Math.abs(prevPolicy.position.x - prevOpp.position.x);
        const currDist = Math.abs(currPolicy.position.x - currOpp.position.x);
        const closed = Math.max(0, prevDist - currDist);
        episodeDistanceClosed += closed;
        rolloutDistanceClosed += closed;
      }

      // Handle episode end
      if (episodeDone) {
        // Determine outcome from policy player perspective.
        episodes++;
        const winner = stepResult.done ? stepResult.info.winner : null;
        const policyWon = winner === policyPlayerId;
        const policyLost = winner === opponentPlayerId;

        // If we truncated the episode, infer a proxy outcome from current health.
        const policyEntity = state.entities.find((e: any) => e.id === policyPlayerId);
        const oppEntity = state.entities.find((e: any) => e.id === opponentPlayerId);
        const healthDiff = (policyEntity?.health ?? 0) - (oppEntity?.health ?? 0);

        if (policyWon || (!stepResult.done && healthDiff > 0)) {
          wins++;
          this.matchWins++;
        } else if (policyLost || (!stepResult.done && healthDiff < 0)) {
          losses++;
          this.matchLosses++;
        } else {
          draws++;
          this.matchDraws++;
        }

        sumDamageDealt += episodeDamageDealt;
        sumDamageTaken += episodeDamageTaken;
        sumDistanceClosed += episodeDistanceClosed;
        if (episodeAnyDamage) episodesWithAnyDamage++;
        if (episodeFirstHitResolved && episodeFirstHitDealt) episodesFirstHit++;

        // Reset episode trackers
        episodeDamageDealt = 0;
        episodeDamageTaken = 0;
        episodeDistanceClosed = 0;
        episodeAnyDamage = false;
        episodeFirstHitResolved = false;
        episodeFirstHitDealt = false;

        state = this.env.reset();
        this.rewardFn.reset(state);

        // Configure next episode (role + opponent).
        configureEpisode();
        
        episodeReward = 0;
        episodeLength = 0;
        episodeFrame = 0;
      }
    }

    // Store last rollout stats for consumers (e.g. train.ts logging)
    if (episodes > 0) {
      this.lastRolloutEpisodeStats = {
        episodes,
        wins,
        losses,
        draws,
        anyDamageRate: episodesWithAnyDamage / episodes,
        firstHitRate: episodesFirstHit / episodes,
        avgDamageDealt: sumDamageDealt / episodes,
        avgDamageTaken: sumDamageTaken / episodes,
        avgDistanceClosed: sumDistanceClosed / episodes,
      };
    } else {
      this.lastRolloutEpisodeStats = null;
    }

    // Always store rollout-level engagement + proxy outcome.
    const policyPlayerId = policyIsPlayer2 ? 'player2' : 'player1';
    const opponentPlayerId = policyIsPlayer2 ? 'player1' : 'player2';
    const endPolicy = state.entities.find((e: any) => e.id === policyPlayerId);
    const endOpp = state.entities.find((e: any) => e.id === opponentPlayerId);
    const endPolicyHealth = endPolicy?.health ?? 0;
    const endOppHealth = endOpp?.health ?? 0;
    const finalHealthDiff = endPolicyHealth - endOppHealth;
    const proxyOutcome: 'win' | 'loss' | 'draw' =
      finalHealthDiff > 0 ? 'win' : finalHealthDiff < 0 ? 'loss' : 'draw';

    this.lastRolloutEngagementStats = {
      damageDealt: rolloutDamageDealt,
      damageTaken: rolloutDamageTaken,
      distanceClosed: rolloutDistanceClosed,
      anyDamage: rolloutAnyDamage,
      firstHitDealt: rolloutFirstHitResolved ? rolloutFirstHitDealt : false,
      proxyOutcome,
      finalHealthDiff,
    };

    return buffer;
  }

  /**
   * Convert discrete action to ActionBundle (placeholder)
   */
  private actionToBundle(action: number): ActionBundle {
    // Simplified mapping - will be expanded
    const actions: ActionBundle[] = [
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

  private uncanonicalizeBundleForEntity(state: any, entityId: string, bundle: ActionBundle): ActionBundle {
    const entity = state.entities?.find((e: any) => e.id === entityId);
    const facing = entity?.facing ?? 1;
    if (facing !== -1) return { ...bundle, holdDuration: 0 };

    if (bundle.direction === 'left') return { ...bundle, direction: 'right', holdDuration: 0 };
    if (bundle.direction === 'right') return { ...bundle, direction: 'left', holdDuration: 0 };
    return { ...bundle, holdDuration: 0 };
  }

  private bundleToActionIndex(bundle: ActionBundle): number {
    // Map arbitrary bundle to the nearest discrete action we support.
    // We ignore holdDuration because the current action space doesn't encode it.
    const normalized: ActionBundle = {
      direction: bundle.direction,
      button: bundle.button,
      holdDuration: 0,
    };

    const actions: ActionBundle[] = [
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

    const idx = actions.findIndex(
      a => a.direction === normalized.direction && a.button === normalized.button
    );

    if (idx >= 0) return idx;

    // Fallback: preserve directional intent if possible.
    if (normalized.button !== 'none') {
      const b = actions.findIndex(a => a.direction === 'neutral' && a.button === normalized.button);
      if (b >= 0) return b;
    }
    if (normalized.direction !== 'neutral') {
      const d = actions.findIndex(a => a.direction === normalized.direction && a.button === 'none');
      if (d >= 0) return d;
    }
    return 0;
  }

  private mirrorActionForPlayer1(state: any, opponentAction: ActionBundle): ActionBundle {
    // Convert opponentAction into player1-relative intent (toward/away)
    // then re-express that intent for player1.
    const p1 = state.entities?.find((e: any) => e.id === 'player1');
    const p2 = state.entities?.find((e: any) => e.id === 'player2');
    if (!p1 || !p2) {
      return { ...opponentAction, holdDuration: 0 };
    }

    const p1Toward: ActionBundle['direction'] = p2.position.x >= p1.position.x ? 'right' : 'left';
    const p2Toward: ActionBundle['direction'] = p1.position.x >= p2.position.x ? 'right' : 'left';

    const toIntent = (dir: ActionBundle['direction']): 'toward' | 'away' | 'neutral' | 'other' => {
      if (dir === 'neutral') return 'neutral';
      if (dir === 'left' || dir === 'right') {
        if (dir === p2Toward) return 'toward';
        return 'away';
      }
      return 'other';
    };

    const intent = toIntent(opponentAction.direction);
    let mappedDir: ActionBundle['direction'] = opponentAction.direction;
    if (intent === 'toward') mappedDir = p1Toward;
    else if (intent === 'away') mappedDir = p1Toward === 'right' ? 'left' : 'right';

    return {
      direction: mappedDir,
      button: opponentAction.button,
      holdDuration: 0,
    };
  }

  /**
   * Create snapshot and add to opponent pool
   */
  createSnapshot(avgReward?: number, style?: string, difficulty?: number): void {
    if (!this.opponentPool) {
      console.warn('Cannot create snapshot: No opponent pool configured');
      return;
    }

    const metadata = {
      checkpoint: this.totalSteps,
      timestamp: Date.now(),
      style,
      difficulty,
      trainingTime: 0, // TODO: Track training time
      avgReward,
      notes: '',
    };

    this.opponentPool.addSnapshot(this.policy, metadata);
    console.log(`Created snapshot at step ${this.totalSteps}`);

    this.lastSnapshotStep = this.totalSteps;

    // Reset match statistics
    this.matchWins = 0;
    this.matchLosses = 0;
  }

  /**
   * Tight scripted opponent action (aggressive pressure bot)
   */
  private getScriptedOpponentActionTight(state: any, actorId: string, targetId: string): ActionBundle {
    const actor = state.entities.find((e: any) => e.id === actorId);
    const target = state.entities.find((e: any) => e.id === targetId);
    if (!actor || !target) return { direction: 'neutral', button: 'none', holdDuration: 0 };

    const dx = target.position.x - actor.position.x;
    const distance = Math.abs(dx);
    const inAir = !(actor?.isGrounded ?? true);
    const toward: ActionBundle['direction'] = dx > 0 ? 'right' : 'left';

    if (distance > 140) {
      if (!inAir && state.frame % 120 === 0) {
        return { direction: 'up', button: 'lp', holdDuration: 0 };
      }
      return { direction: toward, button: 'none', holdDuration: 0 };
    }

    if (distance > 80) {
      const phase = state.frame % 20;
      if (phase < 6) {
        return { direction: toward, button: 'none', holdDuration: 0 };
      }
      if (phase < 10) {
        return { direction: 'neutral', button: 'lk', holdDuration: 0 };
      }
      if (!inAir && phase === 10) {
        return { direction: 'up', button: 'lp', holdDuration: 0 };
      }
      return { direction: toward, button: 'none', holdDuration: 0 };
    }

    const closePhase = state.frame % 16;
    if (closePhase < 4) return { direction: 'neutral', button: 'lp', holdDuration: 0 };
    if (closePhase < 7) return { direction: 'neutral', button: 'lk', holdDuration: 0 };
    if (closePhase < 10) return { direction: toward, button: 'hp', holdDuration: 0 };
    if (closePhase < 12) return { direction: 'neutral', button: 'hk', holdDuration: 0 };
    return { direction: toward, button: 'none', holdDuration: 0 };
  }

  /**
   * Easy scripted opponent action (curriculum bootstrapping)
   */
  private getScriptedOpponentActionEasy(state: any, actorId: string, targetId: string): ActionBundle {
    const actor = state.entities.find((e: any) => e.id === actorId);
    const target = state.entities.find((e: any) => e.id === targetId);
    if (!actor || !target) return { direction: 'neutral', button: 'none', holdDuration: 0 };

    const dx = target.position.x - actor.position.x;
    const distance = Math.abs(dx);
    const toward: ActionBundle['direction'] = dx > 0 ? 'right' : 'left';

    if (distance > 170) {
      return { direction: toward, button: 'none', holdDuration: 0 };
    }

    if (distance > 90) {
      if (state.frame % 10 < 4) {
        return { direction: toward, button: 'none', holdDuration: 0 };
      }
      return { direction: 'neutral', button: 'none', holdDuration: 0 };
    }

    const phase = state.frame % 40;
    if (phase < 6) return { direction: 'neutral', button: 'block', holdDuration: 3 };
    if (phase === 10) return { direction: 'neutral', button: 'lp', holdDuration: 0 };
    return { direction: 'neutral', button: 'none', holdDuration: 0 };
  }

  /**
   * Check if snapshot should be created
   */
  shouldCreateSnapshot(): boolean {
    if (!this.opponentPool) {
      return false;
    }

    const frequency = this.opponentPool['config'].snapshotFrequency;
    if (this.totalSteps <= 0) return false;

    // We only check snapshot creation at rollout boundaries; because rollouts
    // advance in chunks (e.g. 2048 steps), an exact modulo check can miss.
    // Instead, create a snapshot once we've crossed the next frequency window.
    return (this.totalSteps - this.lastSnapshotStep) >= frequency;
  }

  /**
   * Get training statistics
   */
  getStatistics(): {
    totalSteps: number;
    matchWins: number;
    matchLosses: number;
    matchDraws: number;
    winRate: number;
    poolStats?: any;
  } {
    const totalMatches = this.matchWins + this.matchLosses + this.matchDraws;
    const stats = {
      totalSteps: this.totalSteps,
      matchWins: this.matchWins,
      matchLosses: this.matchLosses,
      matchDraws: this.matchDraws,
      winRate: totalMatches > 0
        ? this.matchWins / totalMatches
        : 0,
      poolStats: this.opponentPool?.getStatistics(),
    };

    return stats;
  }

  /**
   * Get episode/engagement stats computed during the most recent rollout.
   */
  getLastRolloutEpisodeStats(): RolloutEpisodeStats | null {
    return this.lastRolloutEpisodeStats ? { ...this.lastRolloutEpisodeStats } : null;
  }

  /**
   * Get rollout-level engagement stats (available even if no episode ended).
   */
  getLastRolloutEngagementStats(): RolloutEngagementStats | null {
    return this.lastRolloutEngagementStats ? { ...this.lastRolloutEngagementStats } : null;
  }
}
