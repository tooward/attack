/**
 * Neural Network Policy
 * 
 * Uses TensorFlow.js to create a neural network that maps observations to actions.
 * Supports both inference (prediction) and training.
 */

import * as tf from '@tensorflow/tfjs';
import { Observation } from './Observation';
import { AIAction, getAllActions } from './ActionSpace';

/**
 * Configuration for neural network architecture
 */
export interface PolicyConfig {
  inputSize: number;      // Observation vector size (23)
  hiddenLayers: number[]; // Hidden layer sizes [128, 64]
  outputSize: number;     // Number of actions (14)
  learningRate: number;   // Adam optimizer learning rate
}

/**
 * Default configuration
 */
export const DEFAULT_POLICY_CONFIG: PolicyConfig = {
  inputSize: 23,
  hiddenLayers: [128, 64],
  outputSize: 14,
  learningRate: 0.001,
};

/**
 * Neural network policy for action selection
 */
export class NeuralPolicy {
  private model: tf.LayersModel;
  private config: PolicyConfig;

  /**
   * Create a new policy or load from file
   */
  constructor(config: PolicyConfig = DEFAULT_POLICY_CONFIG) {
    this.config = config;
    this.model = this.buildModel();
  }

  /**
   * Build neural network model
   */
  private buildModel(): tf.LayersModel {
    const model = tf.sequential();

    // Input layer
    model.add(
      tf.layers.dense({
        units: this.config.hiddenLayers[0],
        activation: 'relu',
        inputShape: [this.config.inputSize],
        kernelInitializer: 'heNormal',
      })
    );

    // Hidden layers
    for (let i = 1; i < this.config.hiddenLayers.length; i++) {
      model.add(
        tf.layers.dense({
          units: this.config.hiddenLayers[i],
          activation: 'relu',
          kernelInitializer: 'heNormal',
        })
      );
    }

    // Output layer (action probabilities)
    model.add(
      tf.layers.dense({
        units: this.config.outputSize,
        activation: 'softmax',
        kernelInitializer: 'glorotNormal',
      })
    );

    // Compile model
    model.compile({
      optimizer: tf.train.adam(this.config.learningRate),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });

    return model;
  }

  /**
   * Convert observation to tensor
   */
  private observationToTensor(observation: Observation): tf.Tensor2D {
    const features = [
      observation.selfX,
      observation.selfY,
      observation.selfHealth,
      observation.selfEnergy,
      observation.selfSuperMeter,
      observation.selfIsGrounded,
      observation.selfFacing,
      observation.selfStatus,
      observation.selfMoveFrame,
      observation.selfStunFrames,
      observation.selfComboCount,
      observation.opponentRelativeX,
      observation.opponentRelativeY,
      observation.opponentHealth,
      observation.opponentEnergy,
      observation.opponentSuperMeter,
      observation.opponentIsGrounded,
      observation.opponentStatus,
      observation.opponentMoveFrame,
      observation.opponentStunFrames,
      observation.opponentComboCount,
      observation.roundTime,
      observation.distanceToOpponent,
    ];

    return tf.tensor2d([features], [1, this.config.inputSize]);
  }

  /**
   * Predict action probabilities from observation
   */
  async predict(observation: Observation): Promise<number[]> {
    const inputTensor = this.observationToTensor(observation);

    const prediction = this.model.predict(inputTensor) as tf.Tensor;
    const probabilities = await prediction.data();

    // Clean up tensors
    inputTensor.dispose();
    prediction.dispose();

    return Array.from(probabilities);
  }

  /**
   * Select action from observation (using probability distribution)
   */
  async selectAction(
    observation: Observation,
    temperature: number = 1.0
  ): Promise<AIAction> {
    const probabilities = await this.predict(observation);

    // Apply temperature for exploration
    const scaledProbs = probabilities.map(p => Math.pow(p, 1 / temperature));
    const sum = scaledProbs.reduce((a, b) => a + b, 0);
    const normalizedProbs = scaledProbs.map(p => p / sum);

    // Sample from distribution
    const random = Math.random();
    let cumulative = 0;

    for (let i = 0; i < normalizedProbs.length; i++) {
      cumulative += normalizedProbs[i];
      if (random < cumulative) {
        return i as AIAction;
      }
    }

    // Fallback (shouldn't reach here)
    return AIAction.IDLE;
  }

  /**
   * Select best action (greedy, no exploration)
   */
  async selectBestAction(observation: Observation): Promise<AIAction> {
    const probabilities = await this.predict(observation);
    const maxIndex = probabilities.indexOf(Math.max(...probabilities));
    return maxIndex as AIAction;
  }

  /**
   * Train on batch of (observation, action) pairs
   */
  async trainBatch(
    observations: Observation[],
    actions: AIAction[]
  ): Promise<{ loss: number; accuracy: number }> {
    if (observations.length !== actions.length) {
      throw new Error('Observations and actions must have same length');
    }

    // Convert to tensors
    const inputFeatures = observations.map(obs => [
      obs.selfX,
      obs.selfY,
      obs.selfHealth,
      obs.selfEnergy,
      obs.selfSuperMeter,
      obs.selfIsGrounded,
      obs.selfFacing,
      obs.selfStatus,
      obs.selfMoveFrame,
      obs.selfStunFrames,
      obs.selfComboCount,
      obs.opponentRelativeX,
      obs.opponentRelativeY,
      obs.opponentHealth,
      obs.opponentEnergy,
      obs.opponentSuperMeter,
      obs.opponentIsGrounded,
      obs.opponentStatus,
      obs.opponentMoveFrame,
      obs.opponentStunFrames,
      obs.opponentComboCount,
      obs.roundTime,
      obs.distanceToOpponent,
    ]);

    const xs = tf.tensor2d(inputFeatures);

    // One-hot encode actions
    const ys = tf.oneHot(actions, this.config.outputSize);

    // Train
    const history = await this.model.fit(xs, ys, {
      epochs: 1,
      verbose: 0,
    });

    const loss = history.history.loss[0] as number;
    const accuracy = history.history.acc?.[0] as number || 0;

    // Clean up
    xs.dispose();
    ys.dispose();

    return { loss, accuracy };
  }

  /**
   * Save model to file system (IndexedDB in browser, file in Node)
   */
  async save(path: string): Promise<void> {
    // Use the path as-is - caller should specify correct scheme
    // (file:// for Node.js, localstorage:// for browser)
    await this.model.save(path);
  }

  /**
   * Load model from file system
   */
  async load(path: string): Promise<void> {
    // Use the path as-is - caller should specify correct scheme
    this.model = await tf.loadLayersModel(path) as tf.LayersModel;
  }

  /**
   * Get the underlying TensorFlow model
   */
  getModel(): tf.LayersModel {
    return this.model;
  }

  /**
   * Get model summary
   */
  summary(): void {
    this.model.summary();
  }

  /**
   * Dispose of model and free memory
   */
  dispose(): void {
    this.model.dispose();
  }

  /**
   * Create a copy of this policy
   */
  async clone(): Promise<NeuralPolicy> {
    const newPolicy = new NeuralPolicy(this.config);
    
    // Copy weights
    const weights = this.model.getWeights();
    newPolicy.model.setWeights(weights);
    
    return newPolicy;
  }
}
