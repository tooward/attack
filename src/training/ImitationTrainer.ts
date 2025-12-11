/**
 * Imitation Learning Trainer
 * 
 * Train neural network policy from expert demonstrations (replays).
 * Uses supervised learning with cross-entropy loss.
 */

import { NeuralPolicy } from '../core/ai/NeuralPolicy';
import { Replay } from '../core/ai/ReplayRecorder';
import { Observation } from '../core/ai/Observation';
import { AIAction } from '../core/ai/ActionSpace';

/**
 * Training metrics
 */
export interface TrainingMetrics {
  epochs: number;
  trainLoss: number[];
  trainAccuracy: number[];
  valLoss?: number[];
  valAccuracy?: number[];
  bestEpoch?: number;
  bestValAccuracy?: number;
}

/**
 * Evaluation metrics
 */
export interface EvaluationMetrics {
  accuracy: number;
  loss: number;
  actionDistribution: Map<AIAction, number>;
  confusionMatrix: number[][];
}

/**
 * Training configuration
 */
export interface TrainingConfig {
  batchSize: number;
  epochs: number;
  validationSplit: number;
  shuffle: boolean;
  verbose: boolean;
}

/**
 * Default training configuration
 */
export const DEFAULT_TRAINING_CONFIG: TrainingConfig = {
  batchSize: 32,
  epochs: 50,
  validationSplit: 0.2,
  shuffle: true,
  verbose: true,
};

/**
 * Trainer for imitation learning
 */
export class ImitationTrainer {
  private policy: NeuralPolicy;

  constructor(policy: NeuralPolicy) {
    this.policy = policy;
  }

  /**
   * Train policy from replay files
   */
  async train(
    replays: Replay[],
    config: TrainingConfig = DEFAULT_TRAINING_CONFIG
  ): Promise<TrainingMetrics> {
    // Extract observations and actions from replays
    const { observations, actions } = this.extractData(replays);

    console.log(
      `Training on ${observations.length} samples from ${replays.length} replays`
    );

    // Shuffle data
    if (config.shuffle) {
      this.shuffleData(observations, actions);
    }

    // Split into train/validation
    const splitIndex = Math.floor(
      observations.length * (1 - config.validationSplit)
    );
    const trainObs = observations.slice(0, splitIndex);
    const trainActions = actions.slice(0, splitIndex);
    const valObs = observations.slice(splitIndex);
    const valActions = actions.slice(splitIndex);

    console.log(`Train: ${trainObs.length}, Validation: ${valObs.length}`);

    // Training metrics
    const metrics: TrainingMetrics = {
      epochs: config.epochs,
      trainLoss: [],
      trainAccuracy: [],
      valLoss: [],
      valAccuracy: [],
    };

    let bestValAccuracy = 0;
    let bestEpoch = 0;

    // Training loop
    for (let epoch = 0; epoch < config.epochs; epoch++) {
      // Shuffle each epoch
      if (config.shuffle) {
        this.shuffleData(trainObs, trainActions);
      }

      // Train in batches
      let epochLoss = 0;
      let epochAccuracy = 0;
      const numBatches = Math.ceil(trainObs.length / config.batchSize);

      for (let batch = 0; batch < numBatches; batch++) {
        const start = batch * config.batchSize;
        const end = Math.min(start + config.batchSize, trainObs.length);

        const batchObs = trainObs.slice(start, end);
        const batchActions = trainActions.slice(start, end);

        const result = await this.policy.trainBatch(batchObs, batchActions);
        epochLoss += result.loss;
        epochAccuracy += result.accuracy;
      }

      epochLoss /= numBatches;
      epochAccuracy /= numBatches;

      metrics.trainLoss.push(epochLoss);
      metrics.trainAccuracy.push(epochAccuracy);

      // Validation
      if (valObs.length > 0) {
        const valMetrics = await this.evaluate(valObs, valActions);
        metrics.valLoss!.push(valMetrics.loss);
        metrics.valAccuracy!.push(valMetrics.accuracy);

        if (valMetrics.accuracy > bestValAccuracy) {
          bestValAccuracy = valMetrics.accuracy;
          bestEpoch = epoch;
        }

        if (config.verbose) {
          console.log(
            `Epoch ${epoch + 1}/${config.epochs} - ` +
            `Loss: ${epochLoss.toFixed(4)} - ` +
            `Acc: ${(epochAccuracy * 100).toFixed(2)}% - ` +
            `Val Loss: ${valMetrics.loss.toFixed(4)} - ` +
            `Val Acc: ${(valMetrics.accuracy * 100).toFixed(2)}%`
          );
        }
      } else {
        if (config.verbose) {
          console.log(
            `Epoch ${epoch + 1}/${config.epochs} - ` +
            `Loss: ${epochLoss.toFixed(4)} - ` +
            `Acc: ${(epochAccuracy * 100).toFixed(2)}%`
          );
        }
      }
    }

    metrics.bestEpoch = bestEpoch;
    metrics.bestValAccuracy = bestValAccuracy;

    console.log(
      `\nTraining complete! Best validation accuracy: ${(bestValAccuracy * 100).toFixed(2)}% at epoch ${bestEpoch + 1}`
    );

    return metrics;
  }

  /**
   * Evaluate policy on validation data
   */
  private async evaluate(
    observations: Observation[],
    actions: AIAction[]
  ): Promise<{ loss: number; accuracy: number }> {
    let totalLoss = 0;
    let correct = 0;

    for (let i = 0; i < observations.length; i++) {
      const probs = await this.policy.predict(observations[i]);
      const predictedAction = probs.indexOf(Math.max(...probs));

      // Cross-entropy loss for single sample
      const loss = -Math.log(probs[actions[i]] + 1e-10);
      totalLoss += loss;

      if (predictedAction === actions[i]) {
        correct++;
      }
    }

    return {
      loss: totalLoss / observations.length,
      accuracy: correct / observations.length,
    };
  }

  /**
   * Extract observations and actions from replays
   */
  private extractData(replays: Replay[]): {
    observations: Observation[];
    actions: AIAction[];
  } {
    const observations: Observation[] = [];
    const actions: AIAction[] = [];

    for (const replay of replays) {
      for (const step of replay.steps) {
        // Convert ObservationData back to Observation
        const obs: Observation = {
          selfX: step.observation.selfX,
          selfY: step.observation.selfY,
          selfHealth: step.observation.selfHealth,
          selfEnergy: step.observation.selfEnergy,
          selfSuperMeter: step.observation.selfSuperMeter,
          selfIsGrounded: step.observation.selfStunFrames <= 0 ? 1 : 0, // Approximation
          selfFacing: step.observation.facingRight ? 1 : -1,
          selfStatus: step.observation.selfStatus,
          selfMoveFrame: 0, // Not in ObservationData
          selfStunFrames: step.observation.selfStunFrames,
          selfComboCount: 0, // Not in ObservationData
          opponentRelativeX: step.observation.opponentX - step.observation.selfX,
          opponentRelativeY: step.observation.opponentY - step.observation.selfY,
          opponentHealth: step.observation.opponentHealth,
          opponentEnergy: step.observation.opponentEnergy,
          opponentSuperMeter: step.observation.opponentSuperMeter,
          opponentIsGrounded: step.observation.opponentStunFrames <= 0 ? 1 : 0,
          opponentStatus: step.observation.opponentStatus,
          opponentMoveFrame: 0,
          opponentStunFrames: step.observation.opponentStunFrames,
          opponentComboCount: 0,
          roundTime: step.observation.roundTimeRemaining,
          distanceToOpponent: step.observation.distanceToOpponent,
        };

        observations.push(obs);
        actions.push(step.action);
      }
    }

    return { observations, actions };
  }

  /**
   * Shuffle observations and actions together
   */
  private shuffleData(observations: Observation[], actions: AIAction[]): void {
    for (let i = observations.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [observations[i], observations[j]] = [observations[j], observations[i]];
      [actions[i], actions[j]] = [actions[j], actions[i]];
    }
  }
}
