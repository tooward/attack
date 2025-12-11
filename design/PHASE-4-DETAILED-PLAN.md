# Phase 4: TensorFlow.js Training - Detailed Plan

## Overview
Integrate TensorFlow.js to train neural network agents through reinforcement learning and imitation learning. Enable AI bots to learn fighting strategies through self-play and human demonstrations.

## Goals
1. ✅ Train neural networks to play the fighting game
2. ✅ Support both imitation learning (from replays) and reinforcement learning (self-play)
3. ✅ Model persistence (save/load trained models)
4. ✅ Training metrics and visualization
5. ✅ Headless training mode (fast training without rendering)

## Architecture

### Neural Network Policy
```
Input: Observation (23 floats)
  → Dense Layer (128 neurons, ReLU)
  → Dense Layer (64 neurons, ReLU)
  → Output Layer (14 neurons, Softmax)
Output: Action probabilities (14 discrete actions)
```

### Training Modes

#### 1. Imitation Learning (Supervised)
- Learn from expert replays (human or personality bot)
- Dataset: (observation, action) pairs
- Loss: Cross-entropy (classification)
- Use case: Bootstrap initial policy

#### 2. Reinforcement Learning (Self-Play)
- Bot plays against itself or other bots
- Reward: Damage dealt - damage taken
- Algorithm: REINFORCE (policy gradient)
- Use case: Improve beyond human performance

## Implementation Plan

### Step 1: TensorFlow.js Setup (~30 min)
**Files to Create:**
- None

**Dependencies:**
```bash
npm install @tensorflow/tfjs @tensorflow/tfjs-node
```

**Actions:**
- Install TensorFlow.js and Node backend
- Verify installation with simple test

---

### Step 2: Neural Network Policy (~1 hour)
**File:** `/src/core/ai/NeuralPolicy.ts`

**Key Features:**
- Create/load neural network model
- Forward pass: observation → action probabilities
- Sample action from probability distribution
- Model save/load to file system

**Interface:**
```typescript
class NeuralPolicy {
  constructor(modelPath?: string)
  async predict(observation: Observation): Promise<number[]>
  selectAction(observation: Observation): AIAction
  async save(path: string): Promise<void>
  async load(path: string): Promise<void>
  getModel(): tf.LayersModel
}
```

**Architecture:**
- Input: 23 features (observation vector)
- Hidden: 128 → 64 neurons (dense, ReLU)
- Output: 14 neurons (softmax for action probabilities)

---

### Step 3: Neural Bot (~30 min)
**File:** `/src/core/ai/NeuralBot.ts`

**Key Features:**
- Bot that uses NeuralPolicy for decisions
- Temperature parameter for exploration
- Epsilon-greedy for exploration (optional)
- Action smoothing (optional)

**Interface:**
```typescript
class NeuralBot {
  constructor(policy: NeuralPolicy, temperature?: number)
  selectAction(observation: Observation, frame: number): AIAction
  reset(): void
}
```

---

### Step 4: Imitation Learning Trainer (~1.5 hours)
**File:** `/src/training/ImitationTrainer.ts`

**Key Features:**
- Train policy from replay files
- Batch training with Adam optimizer
- Validation split
- Training metrics (accuracy, loss)

**Interface:**
```typescript
class ImitationTrainer {
  constructor(policy: NeuralPolicy)
  async train(replays: Replay[], epochs: number): Promise<TrainingMetrics>
  async evaluate(replays: Replay[]): Promise<EvaluationMetrics>
}
```

**Training Loop:**
1. Load replay files
2. Extract (observation, action) pairs
3. Shuffle and batch data
4. Train with cross-entropy loss
5. Report metrics (loss, accuracy)

---

### Step 5: Reinforcement Learning Trainer (~2 hours)
**File:** `/src/training/RLTrainer.ts`

**Key Features:**
- Self-play training loop
- REINFORCE algorithm (policy gradient)
- Advantage estimation
- Episode rollouts
- Reward shaping

**Interface:**
```typescript
class RLTrainer {
  constructor(policy: NeuralPolicy)
  async trainEpisode(characterDefs: Map<string, CharacterDefinition>): Promise<Episode>
  async train(numEpisodes: number): Promise<TrainingMetrics>
}
```

**Training Loop:**
1. Run match: bot vs bot (self-play)
2. Record episode (observations, actions, rewards)
3. Calculate returns/advantages
4. Update policy with policy gradient
5. Report metrics (average reward, win rate)

---

### Step 6: Headless Training Mode (~1 hour)
**File:** `/src/training/HeadlessTraining.ts`

**Key Features:**
- Run game without Phaser (pure core engine)
- Fast simulation (10,000+ fps)
- Parallel training (multiple workers)
- Progress reporting

**Interface:**
```typescript
class HeadlessTraining {
  constructor(characterDefs: Map<string, CharacterDefinition>)
  async runMatch(bot1: AIBot, bot2: AIBot): Promise<MatchResult>
  async collectReplays(numMatches: number): Promise<Replay[]>
}
```

---

### Step 7: Training CLI (~1 hour)
**File:** `/src/training/cli.ts`

**Key Features:**
- Command-line training interface
- Config files for hyperparameters
- Checkpoint saving
- TensorBoard integration

**Commands:**
```bash
# Train from expert replays
npm run train:imitation -- --replays ./data/replays/*.json --epochs 100

# Reinforcement learning
npm run train:rl -- --episodes 10000 --checkpoint-every 100

# Evaluate model
npm run eval -- --model ./models/best.json --matches 100
```

---

### Step 8: Training Metrics & Visualization (~1 hour)
**File:** `/src/training/Metrics.ts`

**Key Features:**
- Track training progress
- Export to TensorBoard
- Plot loss/accuracy curves
- Match outcome statistics

**Metrics:**
- Loss (cross-entropy for imitation, policy loss for RL)
- Accuracy (imitation learning only)
- Average reward per episode
- Win rate vs baseline
- Actions per minute
- Average match length

---

### Step 9: Integration & Testing (~1 hour)
**Files:**
- `/tests/training/NeuralPolicy.test.ts`
- `/tests/training/ImitationTrainer.test.ts`
- Update `/src/scenes/PhaserGameScene.ts`

**Tests:**
- Model forward pass correctness
- Action selection from probabilities
- Save/load model persistence
- Training convergence (toy problem)
- Evaluation metrics

**Phaser Integration:**
- Add model selection UI
- Toggle between RandomBot, PersonalityBot, NeuralBot
- Display win rates

---

## Timeline

| Step | Task | Time | Cumulative |
|------|------|------|------------|
| 1 | TensorFlow.js Setup | 0.5h | 0.5h |
| 2 | Neural Network Policy | 1h | 1.5h |
| 3 | Neural Bot | 0.5h | 2h |
| 4 | Imitation Learning Trainer | 1.5h | 3.5h |
| 5 | Reinforcement Learning Trainer | 2h | 5.5h |
| 6 | Headless Training Mode | 1h | 6.5h |
| 7 | Training CLI | 1h | 7.5h |
| 8 | Metrics & Visualization | 1h | 8.5h |
| 9 | Integration & Testing | 1h | 9.5h |

**Total Estimated Time: ~10 hours**

## Dependencies

```json
{
  "@tensorflow/tfjs": "^4.22.0",
  "@tensorflow/tfjs-node": "^4.22.0"
}
```

## Success Criteria

- ✅ Neural network can predict actions from observations
- ✅ Imitation learning achieves >50% accuracy on validation set
- ✅ RL agent wins >30% vs RandomBot after training
- ✅ Models can be saved and loaded
- ✅ Training runs at >1000 fps headless
- ✅ All tests pass

## Future Extensions (Phase 5+)

- Distributed training (multiple machines)
- Curriculum learning (progressive difficulty)
- Multi-agent training (team battles)
- Transfer learning (new characters)
- Opponent modeling (adapt to player style)
- Hierarchical RL (high-level strategy + low-level execution)

## Notes

- Start with imitation learning to bootstrap policy
- Use RL to improve beyond human performance
- Save checkpoints frequently
- Monitor for overfitting (train vs validation)
- Reward shaping is critical for RL success

---

Ready to implement! Let's build Phase 4! 🚀
