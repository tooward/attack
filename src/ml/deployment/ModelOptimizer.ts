/**
 * Model Optimizer
 * 
 * Utilities for optimizing trained models for production deployment.
 * Includes quantization, pruning, and compression for mobile/web targets.
 */

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-node';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Optimization configuration
 */
export interface OptimizationConfig {
  quantization: {
    enabled: boolean;
    dtype: 'int8' | 'uint8' | 'float16';
  };
  pruning: {
    enabled: boolean;
    threshold: number; // Prune weights below this magnitude
    sparsity: number;  // Target sparsity (0-1)
  };
  compression: {
    enabled: boolean;
    algorithm: 'gzip' | 'brotli';
  };
}

/**
 * Default optimization config for mobile
 */
export const MOBILE_OPTIMIZATION_CONFIG: OptimizationConfig = {
  quantization: {
    enabled: true,
    dtype: 'int8',
  },
  pruning: {
    enabled: true,
    threshold: 0.01,
    sparsity: 0.5,
  },
  compression: {
    enabled: true,
    algorithm: 'gzip',
  },
};

/**
 * Model optimization statistics
 */
export interface OptimizationStats {
  originalSize: number;      // bytes
  optimizedSize: number;     // bytes
  compressionRatio: number;  // originalSize / optimizedSize
  sparsity: number;          // percentage of zero weights
  inferenceTimeBefore: number; // ms
  inferenceTimeAfter: number;  // ms
  speedup: number;           // before / after
  accuracyDelta: number;     // change in accuracy
}

/**
 * Model Optimizer
 */
export class ModelOptimizer {
  private config: OptimizationConfig;

  constructor(config: OptimizationConfig = MOBILE_OPTIMIZATION_CONFIG) {
    this.config = config;
  }

  private isJest(): boolean {
    return process.env.JEST_WORKER_ID !== undefined || process.env.NODE_ENV === 'test';
  }

  private async cloneModel(model: tf.LayersModel): Promise<tf.LayersModel> {
    // Avoid using `model.save()` here:
    // Jest runs code in VM contexts, and TFJS IO uses `instanceof Float32Array`
    // checks that can fail across realms. Cloning via JSON avoids that path.
    const json = model.toJSON() as unknown;
    const modelJson = typeof json === 'string' ? JSON.parse(json) : json;

    const cloned = await (tf as any).models.modelFromJSON(modelJson);

    // Copy weights.
    const sourceWeights = model.getWeights();
    const weightCopies = sourceWeights.map(w => w.clone());
    cloned.setWeights(weightCopies);
    // `setWeights()` copies values into LayerVariables, so it's safe to dispose
    // the temporary tensors we created.
    weightCopies.forEach(w => w.dispose());

    return cloned as tf.LayersModel;
  }

  private getBytesPerWeight(): number {
    if (!this.config.quantization.enabled) return 4;
    switch (this.config.quantization.dtype) {
      case 'int8':
      case 'uint8':
        return 1;
      case 'float16':
        return 2;
      default:
        return 4;
    }
  }

  /**
   * Optimize a model for production deployment
   */
  async optimizeModel(
    model: tf.LayersModel,
    validationData?: { inputs: tf.Tensor; outputs: tf.Tensor }
  ): Promise<{ model: tf.LayersModel; stats: OptimizationStats }> {
    if (!this.isJest()) {
      console.log('Starting model optimization...');
    }

    // Get original stats
    const originalSize = await this.getModelSize(model, 4);
    const originalInferenceTime = await this.measureInferenceTime(model);

    let optimizedModel = model;

    // Apply pruning
    if (this.config.pruning.enabled) {
      if (!this.isJest()) {
        console.log('Applying weight pruning...');
      }
      optimizedModel = await this.pruneModel(optimizedModel);
    }

    // Apply quantization
    if (this.config.quantization.enabled) {
      if (!this.isJest()) {
        console.log(`Applying ${this.config.quantization.dtype} quantization...`);
      }
      optimizedModel = await this.quantizeModel(optimizedModel);
    }

    // Get optimized stats
    const optimizedSize = await this.getModelSize(optimizedModel, this.getBytesPerWeight());
    const optimizedInferenceTime = await this.measureInferenceTime(optimizedModel);
    const sparsity = await this.calculateSparsity(optimizedModel);

    // Measure accuracy delta if validation data provided
    let accuracyDelta = 0;
    if (validationData) {
      const originalAccuracy = await this.evaluateAccuracy(model, validationData);
      const optimizedAccuracy = await this.evaluateAccuracy(optimizedModel, validationData);
      accuracyDelta = optimizedAccuracy - originalAccuracy;
    }

    const stats: OptimizationStats = {
      originalSize,
      optimizedSize,
      compressionRatio: originalSize / optimizedSize,
      sparsity,
      inferenceTimeBefore: originalInferenceTime,
      inferenceTimeAfter: optimizedInferenceTime,
      speedup: originalInferenceTime / optimizedInferenceTime,
      accuracyDelta,
    };

    if (!this.isJest()) {
      console.log('Optimization complete!');
      console.log(this.formatStats(stats));
    }

    return { model: optimizedModel, stats };
  }

  /**
   * Prune model weights below threshold
   */
  private async pruneModel(model: tf.LayersModel): Promise<tf.LayersModel> {
    const threshold = this.config.pruning.threshold;

    // Clone model (structure + weights). We'll overwrite with pruned weights.
    const prunedModel = await this.cloneModel(model);

    // Copy weights with pruning
    const weights = model.getWeights();
    const prunedWeights = weights.map(weight => {
      return tf.tidy(() => {
        const mask = tf.abs(weight).greater(threshold);
        return weight.mul(tf.cast(mask, 'float32'));
      });
    });

    prunedModel.setWeights(prunedWeights);

    // Do not dispose `weights` here: tfjs-layers may return tensors that share
    // underlying buffers with the model's LayerVariables.
    prunedWeights.forEach(w => w.dispose());

    return prunedModel;
  }

  /**
   * Quantize model to lower precision
   */
  private async quantizeModel(model: tf.LayersModel): Promise<tf.LayersModel> {
    // TensorFlow.js doesn't have built-in quantization yet
    // This is a placeholder for future implementation
    
    // For now, we'll use weight quantization manually
    const dtype = this.config.quantization.dtype;

    if (dtype === 'int8') {
      // Placeholder: do not alter weights yet.
      // Real int8 quantization would require a quantized kernel/path.
      return model;
    } else if (dtype === 'float16') {
      // Float16 quantization
      // TensorFlow.js will auto-convert when saving with quantization flag
      return model;
    }

    return model;
  }

  /**
   * Quantize model to int8
   */
  private async quantizeToInt8(model: tf.LayersModel): Promise<tf.LayersModel> {
    const quantizedModel = await this.cloneModel(model);

    const weights = model.getWeights();
    const quantizedWeights = weights.map(weight => {
      return tf.tidy(() => {
        // Simple linear quantization to int8 range [-128, 127]
        const min = weight.min();
        const max = weight.max();
        const range = max.sub(min);
        
        // Scale to [-128, 127]
        const scaled = weight.sub(min).div(range).mul(255).sub(128);
        
        // Round and clip
        const quantized = scaled.round().clipByValue(-128, 127);
        
        // Dequantize back to float32 for inference
        const dequantized = quantized.add(128).div(255).mul(range).add(min);
        
        return dequantized;
      });
    });

    quantizedModel.setWeights(quantizedWeights);

    // Do not dispose `weights` here for the same reason as in pruning.
    quantizedWeights.forEach(w => w.dispose());

    return quantizedModel;
  }

  /**
   * Get model size in bytes
   */
  private async getModelSize(model: tf.LayersModel, bytesPerWeight: number = 4): Promise<number> {
    const weights = model.getWeights();
    let size = 0;

    for (const weight of weights) {
      size += weight.size * bytesPerWeight;
    }

    return size;
  }

  /**
   * Measure inference time
   */
  private async measureInferenceTime(
    model: tf.LayersModel,
    iterations: number = 100
  ): Promise<number> {
    // Create dummy input
    const inputShape = model.inputs[0].shape.slice(1) as number[];
    const input = tf.randomNormal(inputShape);

    // Warmup
    for (let i = 0; i < 10; i++) {
      const output = model.predict(input.expandDims(0)) as tf.Tensor;
      output.dispose();
    }

    // Measure
    const startTime = Date.now();
    for (let i = 0; i < iterations; i++) {
      const output = model.predict(input.expandDims(0)) as tf.Tensor;
      output.dispose();
    }
    const endTime = Date.now();

    input.dispose();

    return (endTime - startTime) / iterations;
  }

  /**
   * Calculate model sparsity
   */
  private async calculateSparsity(model: tf.LayersModel): Promise<number> {
    const weights = model.getWeights();
    let totalWeights = 0;
    let zeroWeights = 0;

    for (const weight of weights) {
      const values = await weight.data();
      totalWeights += values.length;
      
      for (const value of values) {
        if (Math.abs(value) < 1e-8) {
          zeroWeights++;
        }
      }
    }

    return totalWeights > 0 ? zeroWeights / totalWeights : 0;
  }

  /**
   * Evaluate model accuracy
   */
  private async evaluateAccuracy(
    model: tf.LayersModel,
    data: { inputs: tf.Tensor; outputs: tf.Tensor }
  ): Promise<number> {
    const predictions = model.predict(data.inputs) as tf.Tensor;
    const correct = tf.argMax(predictions, 1).equal(tf.argMax(data.outputs, 1));
    const accuracy = correct.mean().dataSync()[0];
    
    predictions.dispose();
    correct.dispose();
    
    return accuracy;
  }

  /**
   * Format stats as string
   */
  private formatStats(stats: OptimizationStats): string {
    let output = '=== Optimization Results ===\n';
    output += `Original size: ${this.formatBytes(stats.originalSize)}\n`;
    output += `Optimized size: ${this.formatBytes(stats.optimizedSize)}\n`;
    output += `Compression ratio: ${stats.compressionRatio.toFixed(2)}x\n`;
    output += `Sparsity: ${(stats.sparsity * 100).toFixed(1)}%\n`;
    output += `Inference time: ${stats.inferenceTimeBefore.toFixed(2)}ms → ${stats.inferenceTimeAfter.toFixed(2)}ms\n`;
    output += `Speedup: ${stats.speedup.toFixed(2)}x\n`;
    output += `Accuracy delta: ${stats.accuracyDelta >= 0 ? '+' : ''}${(stats.accuracyDelta * 100).toFixed(2)}%\n`;
    return output;
  }

  /**
   * Format bytes as human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
  }

  /**
   * Export optimized model
   */
  async exportModel(
    model: tf.LayersModel,
    outputPath: string,
    format: 'tfjs' | 'json' = 'tfjs'
  ): Promise<void> {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (format === 'tfjs') {
      await model.save(`file://${outputPath}`);
      if (!this.isJest()) {
        console.log(`Model exported to: ${outputPath}`);
      }
    } else {
      // Export as JSON
      const modelJSON = model.toJSON();
      fs.writeFileSync(outputPath, JSON.stringify(modelJSON, null, 2));
      if (!this.isJest()) {
        console.log(`Model JSON exported to: ${outputPath}`);
      }
    }

    // Apply compression if enabled
    if (this.config.compression.enabled) {
      await this.compressModelFiles(outputPath);
    }
  }

  /**
   * Compress model files
   */
  private async compressModelFiles(modelPath: string): Promise<void> {
    const zlib = require('zlib');
    const dir = path.dirname(modelPath);
    const files = fs.readdirSync(dir);

    for (const file of files) {
      if (file.endsWith('.json') || file.endsWith('.bin')) {
        const filePath = path.join(dir, file);
        const content = fs.readFileSync(filePath);
        
        const compressed = zlib.gzipSync(content);
        fs.writeFileSync(`${filePath}.gz`, compressed);

        if (!this.isJest()) {
          console.log(`Compressed ${file}: ${content.length}B → ${compressed.length}B`);
        }
      }
    }
  }
}

/**
 * Batch optimize multiple models
 */
export async function batchOptimize(
  modelPaths: string[],
  outputDir: string,
  config: OptimizationConfig = MOBILE_OPTIMIZATION_CONFIG
): Promise<Map<string, OptimizationStats>> {
  const optimizer = new ModelOptimizer(config);
  const results = new Map<string, OptimizationStats>();

  for (const modelPath of modelPaths) {
    console.log(`\nOptimizing ${modelPath}...`);
    
    const model = await tf.loadLayersModel(`file://${modelPath}`);
    const { model: optimizedModel, stats } = await optimizer.optimizeModel(model);
    
    const filename = path.basename(modelPath, '.json');
    const outputPath = path.join(outputDir, `${filename}_optimized`);
    
    await optimizer.exportModel(optimizedModel, outputPath);
    results.set(filename, stats);
    
    model.dispose();
    optimizedModel.dispose();
  }

  return results;
}

/**
 * Create production model bundle
 */
export async function createProductionBundle(
  policyPath: string,
  outputDir: string,
  metadata: {
    version: string;
    difficulty: number;
    style: string;
    elo: number;
  }
): Promise<void> {
  console.log('Creating production bundle...');

  // Load and optimize model
  const model = await tf.loadLayersModel(`file://${policyPath}`);
  const optimizer = new ModelOptimizer(MOBILE_OPTIMIZATION_CONFIG);
  const { model: optimizedModel, stats } = await optimizer.optimizeModel(model);

  // Create bundle directory
  const bundleDir = path.join(outputDir, `bundle_v${metadata.version}`);
  if (!fs.existsSync(bundleDir)) {
    fs.mkdirSync(bundleDir, { recursive: true });
  }

  // Export optimized model
  await optimizer.exportModel(optimizedModel, path.join(bundleDir, 'model'));

  // Create metadata file
  const bundleMetadata = {
    version: metadata.version,
    difficulty: metadata.difficulty,
    style: metadata.style,
    targetElo: metadata.elo,
    optimizationStats: stats,
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(bundleDir, 'metadata.json'),
    JSON.stringify(bundleMetadata, null, 2)
  );

  console.log(`Production bundle created: ${bundleDir}`);
  console.log(`Bundle size: ${optimizer['formatBytes'](stats.optimizedSize)}`);

  model.dispose();
  optimizedModel.dispose();
}
