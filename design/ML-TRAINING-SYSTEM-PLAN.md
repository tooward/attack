# ML Training System - Comprehensive Plan

## Vision

Build a production-grade reinforcement learning training system for fighting game bots that produces **believable, human-like opponents** with distinct personalities, difficulty levels, and engaging behaviors. The system must be mobile-friendly, highly testable, and avoid degenerate strategies.

---

## Current State Assessment

### What You Have ✅
- Basic observation space (23 floats)
- Simple action space (14 discrete actions)
- Basic neural policy (MLP with supervised training)
- Replay recording system
- Imitation learning trainer
- RandomBot and PersonalityBot implementations

### Critical Gaps 🚫
- **No RL trainer** (only supervised learning)
- **No reward shaping** (only win/loss)
- **No opponent pool** (pure self-play leads to collapse)
- **No curriculum training** (bots learn bad habits from scratch)
- **No difficulty system** (no knobs for reaction delay, errors)
- **No style conditioning** (all bots play the same)
- **No evaluation metrics** (beyond accuracy)
- **No anti-degenerate safeguards** (stalling, loops)
- **Missing frame history** in observations
- **No action hold duration** support

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    TRAINING PIPELINE                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐      ┌──────────────┐                    │
│  │ Environment  │◄────►│ Opponent Pool│                    │
│  │  Wrapper     │      │  & League    │                    │
│  └──────┬───────┘      └──────────────┘                    │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────┐      ┌──────────────┐                    │
│  │ Observation  │────►│  PPO Trainer  │                    │
│  │  Encoder     │      │  (RL Loop)    │                   │
│  └──────────────┘      └──────┬───────┘                    │
│                               │                             │
│  ┌──────────────┐            │                             │
│  │   Reward     │◄───────────┘                             │
│  │  Function    │                                          │
│  └──────────────┘                                          │
│                                                             │
│  ┌──────────────┐      ┌──────────────┐                    │
│  │ Curriculum   │      │ Evaluation   │                    │
│  │  Manager     │      │  Harness     │                    │
│  └──────────────┘      └──────────────┘                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    INFERENCE LAYER                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐      ┌──────────────┐                    │
│  │ Bot Runtime  │◄────►│ Difficulty   │                    │
│  │  (Inference) │      │  Knobs       │                    │
│  └──────┬───────┘      └──────────────┘                    │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────┐      ┌──────────────┐                    │
│  │    Style     │      │    Elo       │                    │
│  │ Conditioning │      │   Ranking    │                    │
│  └──────────────┘      └──────────────┘                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Module Structure

```
src/ml/
├── core/
│   ├── Environment.ts          # RL gym interface
│   ├── ObservationEncoder.ts   # Enhanced obs with history
│   ├── ActionSpace.ts          # Action bundles with duration
│   └── RewardFunction.ts       # Dense reward shaping
│
├── training/
│   ├── PPOTrainer.ts           # Main RL trainer
│   ├── OpponentPool.ts         # League management
│   ├── CurriculumManager.ts    # Progressive training
│   ├── TrainingMetrics.ts      # Loss, rewards tracking
│   └── TrainingConfig.ts       # Hyperparameter management
│
├── evaluation/
│   ├── EvaluationHarness.ts    # Comprehensive metrics
│   ├── EloRating.ts            # Ranking system
│   ├── BehaviorAnalysis.ts     # Diversity, stalling, loops
│   └── RegressionTests.ts      # Degenerate strategy detection
│
├── inference/
│   ├── BotRuntime.ts           # Production inference
│   ├── DifficultyConfig.ts     # Level 1-10 knobs
│   └── StyleConfig.ts          # Style definitions
│
└── config/
    ├── training.yaml           # Reward weights, PPO params
    ├── curriculum.yaml         # Stage definitions
    ├── difficulty.yaml         # Level knob values
    └── styles.yaml             # Style reward modifiers
```

---

## Phase 1: Foundation (Week 1)

### Goal
Build the core RL infrastructure: environment wrapper, enhanced observations, dense rewards, and basic PPO trainer.

### 1.1 Environment Interface

**File:** `src/ml/core/Environment.ts`

**Interface:**
```typescript
export interface FightingGameEnv {
  reset(config?: EnvConfig): EnvState;
  step(actions: Map<string, ActionBundle>): StepResult;
  getObservation(entityId: string): Observation;
  getCurrentReward(entityId: string): number;
  isDone(): boolean;
  getInfo(): EnvInfo;
}

export interface ActionBundle {
  direction: 'left' | 'right' | 'up' | 'down' | 'neutral';
  button: 'lp' | 'hp' | 'lk' | 'hk' | 'block' | 'special1' | 'special2' | 'none';
  holdDuration: number;  // 0-15 frames
}

export interface StepResult {
  observations: Map<string, Observation>;
  rewards: Map<string, number>;
  done: boolean;
  info: EnvInfo;
}

export interface EnvInfo {
  frame: number;
  winner: string | null;
  damageDealt: Map<string, number>;
  combos: Map<string, number>;
  events: CombatEvent[];  // For reward debugging
}
```

**Implementation Steps:**
1. Wrap existing `tick()` function
2. Track cumulative rewards per entity
3. Detect combat events (hits, blocks, whiffs)
4. Implement curriculum constraints (move restrictions)
5. Add deterministic seeding for reproducibility

**Tests:**
- Environment resets to initial state
- Step increments frame counter correctly
- Actions map to InputFrames properly
- Multiple entities tracked independently
- Determinism (same seed = same outcome)

**Mobile Considerations:**
- Headless mode (no Phaser) for training on any device
- Lightweight state tracking (minimize memory)
- Efficient collision detection (spatial hashing)

---

### 1.2 Enhanced Observation Encoder

**File:** `src/ml/core/ObservationEncoder.ts`

**Enhanced Observation:**
```typescript
export interface EnhancedObservation {
  // Current frame state (24 floats)
  position: number[];        // [selfX, selfY, oppRelX, oppRelY] 
  velocity: number[];        // [selfVX, selfVY, oppVX, oppVY]
  health: number[];          // [selfHP, oppHP]
  resources: number[];       // [selfMeter, oppMeter, selfEnergy, oppEnergy]
  state: number[];           // [selfStatus, oppStatus, selfStun, oppStun]
  combat: number[];          // [facing, distance, rangeCategory, comboCount]
  
  // History (last 4 frames, 32 floats)
  history: {
    positions: number[];     // [4 frames × 4 values = 16 floats]
    velocities: number[];    // [4 frames × 4 values = 16 floats]
  };
  
  // Style conditioning (optional, 4 floats)
  style?: number[];          // One-hot: [rushdown, zoner, turtle, mixup]
  
  // Total: ~60 floats
}

export interface ObservationConfig {
  historyFrames: number;     // Default: 4
  includeVelocity: boolean;  // Default: true
  includeHistory: boolean;   // Default: true
  includeStyle: boolean;     // Default: false
  normalize: boolean;        // Default: true
}
```

**Implementation Steps:**
1. Extract base observation from GameState
2. Maintain rolling history buffer (ring buffer for efficiency)
3. Normalize all values to [-1, 1] or [0, 1]
4. Add style one-hot encoding
5. Flatten to single array for neural network input

**Tests:**
- Observation values in correct range
- History updates correctly each frame
- Style encoding is valid one-hot
- Normalization doesn't lose information
- Buffer efficiently handles wrapping

**Mobile Considerations:**
- Fixed-size arrays (no dynamic allocation)
- Ring buffer for history (O(1) updates)
- Optional history (can disable on low-end devices)

---

### 1.3 Dense Reward Function

**File:** `src/ml/core/RewardFunction.ts`

**Reward Components:**
```typescript
export interface RewardWeights {
  // Outcome rewards
  damageDealt: number;           // +1.0 per point
  damageTaken: number;           // -1.0 per point
  knockdown: number;             // +5.0
  roundWin: number;              // +100.0
  roundLoss: number;             // -100.0
  
  // Tactical rewards
  hitConfirm: number;            // +2.0
  successfulBlock: number;       // +0.5
  whiffPunish: number;           // +3.0
  antiAir: number;               // +2.0
  throwTech: number;             // +1.0
  
  // Positioning
  corneringOpponent: number;     // +0.1/frame
  escapingCorner: number;        // +0.2/frame
  rangeControl: number;          // +0.1/frame at optimal range
  
  // Anti-degenerate
  stalling: number;              // -0.05/frame
  moveDiversity: number;         // +0.1 per unique move (30f window)
  repetitionPenalty: number;     // -0.5 for 3x same move
  timeoutPenalty: number;        // -50.0 for round timeout
  
  // Style-specific (override per style)
  aggression: number;            // +0.2 for forward movement
  defense: number;               // +0.2 for spacing/blocking
  zoning: number;                // +0.2 for projectile control
}

export interface RewardState {
  lastDamageDealt: number;
  lastDamageTaken: number;
  lastPosition: number;
  recentMoves: string[];         // Circular buffer, size 30
  stallingFrames: number;
  lastEngagementFrame: number;
}
```

**Implementation Steps:**
1. Track delta values (damage this frame - last frame)
2. Detect combat events from GameState diff
3. Track move history for diversity calculation
4. Detect stalling (no proximity/action for N frames)
5. Compute range category (close/mid/far)
6. Apply style-specific reward modifiers

**Default Reward Weights:**
```yaml
damageDealt: 1.0
damageTaken: -1.0
knockdown: 5.0
roundWin: 100.0
hitConfirm: 2.0
successfulBlock: 0.5
stalling: -0.05
moveDiversity: 0.1
repetitionPenalty: -0.5
```

**Tests:**
- Damage delta computed correctly
- Event detection doesn't miss hits
- Stalling detected after threshold
- Move diversity calculation correct
- Reward sum matches expected value

**Mobile Considerations:**
- Efficient delta tracking (no full state copies)
- Fixed-size move history buffer
- Fast collision checks for event detection

---

### 1.4 Basic PPO Trainer

**File:** `src/ml/training/PPOTrainer.ts`

**PPO Configuration:**
```typescript
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
  envs: number;                  // 1 (parallel envs, future)
  stepsPerEnv: number;           // 2048
}

export interface RolloutBuffer {
  observations: tf.Tensor2D;     // [steps, obsSize]
  actions: tf.Tensor1D;          // [steps]
  rewards: tf.Tensor1D;          // [steps]
  dones: tf.Tensor1D;            // [steps]
  values: tf.Tensor1D;           // [steps]
  logProbs: tf.Tensor1D;         // [steps]
  advantages?: tf.Tensor1D;      // Computed via GAE
  returns?: tf.Tensor1D;         // Discounted returns
}
```

**Algorithm:**
```
1. Collect rollout (N steps)
   - Run policy on environment
   - Store (obs, action, reward, done, value, logProb)
   
2. Compute advantages
   - Calculate TD residuals: δ_t = r_t + γV(s_{t+1}) - V(s_t)
   - Compute GAE: A_t = Σ(γλ)^k δ_{t+k}
   - Normalize advantages
   
3. Compute returns
   - R_t = A_t + V(s_t)
   
4. Update policy (K epochs)
   - Sample minibatches
   - Compute PPO loss:
     - Policy loss: -min(ratio * A, clip(ratio, 1-ε, 1+ε) * A)
     - Value loss: (V_new - R)²
     - Entropy loss: -H(π)
   - Update networks with gradient descent
   
5. Log metrics
   - Average reward
   - Policy loss, value loss, entropy
   - KL divergence (for early stopping)
```

**Implementation Steps:**
1. Build actor-critic network (shared trunk, policy/value heads)
2. Implement rollout collection
3. Implement GAE computation
4. Implement PPO loss functions
5. Implement training loop with logging

**Network Architecture:**
```
Input (60 floats)
  ↓
Dense(128, ReLU)
  ↓
Dense(128, ReLU)
  ├─→ Policy Head (softmax, 14 actions)
  └─→ Value Head (linear, 1 scalar)
```

**Tests:**
- Network forward pass produces valid output
- GAE computation matches reference implementation
- PPO loss computes correctly
- Gradient updates improve policy
- Training loop completes without errors

**Mobile Considerations:**
- TensorFlow.js (runs in browser or Node)
- Small network (< 100K parameters)
- Batch processing for efficiency
- Optional: Use WASM backend for mobile

**Sane Defaults:**
```yaml
learningRate: 0.0003
gamma: 0.99
lambda: 0.95
clipRange: 0.2
entropyCoef: 0.01
batchSize: 2048
minibatchSize: 256
epochsPerBatch: 4
```

---

### 1.5 Training Script

**File:** `src/ml/training/train.ts`

**Entry Point:**
```typescript
async function main() {
  // Load config
  const config = loadTrainingConfig();
  
  // Create environment
  const env = new FightingGameEnv(config.env);
  
  // Create policy
  const policy = new ActorCriticPolicy(config.policy);
  
  // Create trainer
  const trainer = new PPOTrainer(env, policy, config.ppo);
  
  // Train
  const metrics = await trainer.train(config.totalSteps);
  
  // Save model
  await policy.save('models/policy_final');
  
  // Generate report
  generateReport(metrics);
}
```

**Deliverable:**
- Bot learns to beat RandomBot in ~500k steps
- Reward curve shows clear improvement
- Model saves/loads successfully
- Metrics logged to console/file

---

## Phase 2: Opponent Pool & League (Week 2)

### Goal
Implement diverse opponent pool with Elo ranking to prevent self-play collapse and enable skill progression.

### 2.1 Opponent Pool Manager

**File:** `src/ml/training/OpponentPool.ts`

**Interface:**
```typescript
export interface OpponentSnapshot {
  id: string;                    // Unique ID
  policy: ActorCriticPolicy;     // Trained policy
  elo: number;                   // Skill rating
  gamesPlayed: number;           // Total matches
  winRate: number;               // Overall win rate
  metadata: {
    checkpoint: number;          // Training step
    style?: string;              // Conditioning style
    difficulty?: number;         // Intended difficulty
  };
}

export interface PoolConfig {
  maxSnapshots: number;          // 18
  snapshotFrequency: number;     // Every 100k steps
  samplingStrategy: 'recent' | 'mixed' | 'strong' | 'curriculum';
  keepBest: number;              // Always keep top N by Elo
  keepRecent: number;            // Always keep last N
  keepBaselines: number;         // Always keep scripted bots
}
```

**Sampling Strategies:**
```typescript
// Recent: 70% from last 5, 30% from earlier
sampleRecent(pool: OpponentSnapshot[]): OpponentSnapshot {
  if (Math.random() < 0.7) {
    return sample(pool.slice(-5));
  }
  return sample(pool.slice(0, -5));
}

// Mixed: Uniform across all
sampleMixed(pool: OpponentSnapshot[]): OpponentSnapshot {
  return sample(pool);
}

// Strong: 80% from top 50% Elo, 20% from bottom
sampleStrong(pool: OpponentSnapshot[]): OpponentSnapshot {
  const sorted = sortByElo(pool);
  const threshold = sorted[Math.floor(sorted.length * 0.5)].elo;
  if (Math.random() < 0.8) {
    return sample(sorted.filter(s => s.elo >= threshold));
  }
  return sample(sorted.filter(s => s.elo < threshold));
}
```

**Implementation Steps:**
1. Store snapshots in array with metadata
2. Implement Elo update after each match
3. Implement sampling strategies
4. Implement snapshot pruning (keep best/recent/baselines)
5. Add save/load for full pool state

**Tests:**
- Pool correctly adds/removes snapshots
- Elo updates converge to correct values
- Sampling strategies produce expected distributions
- Pool persists and loads correctly

---

### 2.2 Elo Rating System

**File:** `src/ml/evaluation/EloRating.ts`

**Algorithm:**
```typescript
export interface EloConfig {
  initialRating: number;         // 1500
  kFactor: number;               // 32 (adjusts sensitivity)
}

export function updateElo(
  winnerElo: number,
  loserElo: number,
  config: EloConfig
): [number, number] {
  const expectedWinner = 1 / (1 + 10 ** ((loserElo - winnerElo) / 400));
  const expectedLoser = 1 - expectedWinner;
  
  const newWinnerElo = winnerElo + config.kFactor * (1 - expectedWinner);
  const newLoserElo = loserElo + config.kFactor * (0 - expectedLoser);
  
  return [newWinnerElo, newLoserElo];
}
```

**Tests:**
- Equal Elo opponents converge to 50% win rate
- Higher Elo consistently beats lower Elo
- Rating updates are symmetric
- K-factor affects convergence speed

---

### 2.3 Integration with Trainer

**Modified Training Loop:**
```typescript
async function trainWithPool(
  env: FightingGameEnv,
  policy: ActorCriticPolicy,
  pool: OpponentPool,
  config: PPOConfig
) {
  for (let step = 0; step < config.totalSteps; step++) {
    // Sample opponent
    const opponent = pool.sample(config.samplingStrategy);
    
    // Collect rollout against opponent
    const rollout = await collectRollout(env, policy, opponent.policy);
    
    // Update policy
    const metrics = await updatePolicy(policy, rollout);
    
    // Update Elo
    const winner = rollout.winner;
    if (winner === 'self') {
      pool.updateElo(policy.id, opponent.id);
    } else {
      pool.updateElo(opponent.id, policy.id);
    }
    
    // Snapshot policy
    if (step % config.snapshotFrequency === 0) {
      pool.addSnapshot(policy.clone(), { checkpoint: step });
    }
  }
}
```

**Deliverable:**
- Training runs against diverse opponents
- Elo ratings differentiate skill levels
- Pool maintains 10-18 snapshots
- No self-play collapse

---

## Phase 3: Curriculum & Anti-Degenerate (Week 3)

### Goal
Implement progressive curriculum and safeguards against degenerate strategies.

### 3.1 Curriculum Manager

**File:** `src/ml/training/CurriculumManager.ts`

**Stage Definitions:**
```typescript
export interface CurriculumStage {
  name: string;
  constraints: {
    allowedMoves?: string[];     // Whitelist of move IDs
    disableSpecials?: boolean;
    disableSupers?: boolean;
    disableAirMoves?: boolean;
    fixedRange?: 'close' | 'mid' | 'far';
    opponentType?: 'passive' | 'defensive' | 'scripted' | 'pool';
  };
  successCriteria: {
    winRate?: number;            // 0.6 = 60%
    avgReward?: number;          // Per episode
    minGames?: number;           // 100
    maxStalling?: number;        // 10% time stalling
    minDiversity?: number;       // 0.5 action entropy
  };
  rewards?: Partial<RewardWeights>;  // Override base rewards
}
```

**Example Curriculum:**
```yaml
stages:
  - name: neutral_footsies
    constraints:
      allowedMoves: ['walk', 'jump', 'lightPunch', 'lightKick', 'heavyPunch', 'block']
      disableSpecials: true
      disableSupers: true
      opponentType: 'passive'
    successCriteria:
      winRate: 0.6
      minGames: 200
      maxStalling: 0.15
    rewards:
      rangeControl: 0.3
      stalling: -0.1
      
  - name: punish_training
    constraints:
      opponentType: 'scripted'  # Bot that whiffs moves
    successCriteria:
      winRate: 0.7
      minGames: 150
      whiffPunishRate: 0.6      # Custom metric
    rewards:
      whiffPunish: 5.0
      
  - name: defense_training
    constraints:
      opponentType: 'scripted'  # Aggressive bot
    successCriteria:
      winRate: 0.5
      minGames: 200
      blockRate: 0.4
    rewards:
      successfulBlock: 1.0
      antiAir: 3.0
      
  - name: combo_practice
    constraints:
      allowedMoves: null  # Unlock specials
      disableSupers: true
    successCriteria:
      winRate: 0.6
      minGames: 300
      avgComboLength: 3.0
    rewards:
      hitConfirm: 3.0
      comboContinuation: 1.0
      
  - name: full_game
    constraints: {}
    successCriteria:
      winRate: 0.6
      minGames: 500
      maxStalling: 0.1
      minDiversity: 0.6
```

**Implementation Steps:**
1. Load curriculum from YAML config
2. Track current stage and progress
3. Evaluate success criteria after each training batch
4. Apply stage constraints to environment
5. Override reward weights per stage
6. Advance to next stage when criteria met

**Tests:**
- Stages load correctly from config
- Constraints apply to environment
- Success criteria evaluated correctly
- Progression advances stages
- Reward overrides apply

---

### 3.2 Anti-Degenerate Measures

**Stalling Detection:**
```typescript
export function detectStalling(
  history: GameStateSnapshot[],
  threshold: number = 0.2
): number {
  let stallingFrames = 0;
  
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1];
    const curr = history[i];
    
    // Check for engagement
    const distance = Math.abs(curr.p1.x - curr.p2.x);
    const attacking = curr.p1.attacking || curr.p2.attacking;
    const moving = Math.abs(curr.p1.vx) > 0.1 || Math.abs(curr.p2.vx) > 0.1;
    
    if (distance > 400 && !attacking && !moving) {
      stallingFrames++;
    }
  }
  
  return stallingFrames / history.length;
}
```

**Loop Detection:**
```typescript
export function detectMoveLoops(
  moveHistory: string[],
  windowSize: number = 30
): LoopReport {
  const sequences = new Map<string, number>();
  
  for (let i = 0; i < moveHistory.length - 3; i++) {
    const seq = moveHistory.slice(i, i + 3).join(',');
    sequences.set(seq, (sequences.get(seq) || 0) + 1);
  }
  
  const maxRepeats = Math.max(...sequences.values());
  const loopRate = maxRepeats / (moveHistory.length - 2);
  
  return {
    detectedLoops: maxRepeats > 5,
    loopRate,
    mostCommonSequence: [...sequences.entries()].sort((a, b) => b[1] - a[1])[0],
  };
}
```

**Action Diversity Metric:**
```typescript
export function computeActionEntropy(
  actions: number[],
  numActions: number
): number {
  const counts = new Array(numActions).fill(0);
  for (const action of actions) {
    counts[action]++;
  }
  
  const probs = counts.map(c => c / actions.length);
  let entropy = 0;
  for (const p of probs) {
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }
  
  // Normalize to [0, 1]
  return entropy / Math.log2(numActions);
}
```

**Integration:**
- Compute metrics after each evaluation
- Penalize stalling in reward function
- Flag policies with high loop rates
- Require minimum diversity for curriculum progression

---

## Phase 4: Difficulty & Styles (Week 4)

### Goal
Add difficulty knobs and style conditioning for diverse bot personalities.

### 4.1 Difficulty Configuration

**File:** `src/ml/inference/DifficultyConfig.ts`

**Knob Definitions:**
```typescript
export interface DifficultyKnobs {
  // Reaction time
  reactionDelay: number;         // 0-20 frames
  reactionNoise: number;         // 0-1 (random jitter)
  
  // Execution
  executionError: number;        // 0-0.5 (drop input rate)
  inputNoise: number;            // 0-1 (wrong input rate)
  
  // Decision making
  temperature: number;           // 0.5-2.0 (action sampling)
  greedyRate: number;            // 0-1 (use best action)
  
  // Capability
  disableSpecials: boolean;
  disableSupers: boolean;
  disableCancels: boolean;
  disableAdvancedCombos: boolean;
  
  // Knowledge
  reactionToOpponent: number;    // 0-1 (react to opponent state)
  prediction: number;            // 0-1 (anticipate opponent)
}
```

**Level Presets:**
```yaml
levels:
  1:  # Beginner
    reactionDelay: 20
    reactionNoise: 0.4
    executionError: 0.4
    temperature: 2.0
    greedyRate: 0.0
    disableSpecials: true
    disableSupers: true
    disableCancels: true
    reactionToOpponent: 0.3
    eloBand: [0, 800]
    
  3:  # Easy
    reactionDelay: 15
    executionError: 0.3
    temperature: 1.8
    greedyRate: 0.1
    disableSupers: true
    disableCancels: true
    reactionToOpponent: 0.5
    eloBand: [800, 1200]
    
  5:  # Medium
    reactionDelay: 10
    executionError: 0.2
    temperature: 1.2
    greedyRate: 0.3
    disableSupers: false
    reactionToOpponent: 0.7
    eloBand: [1200, 1600]
    
  7:  # Hard
    reactionDelay: 5
    executionError: 0.1
    temperature: 0.9
    greedyRate: 0.5
    reactionToOpponent: 0.85
    prediction: 0.3
    eloBand: [1600, 2000]
    
  10: # Expert
    reactionDelay: 0
    executionError: 0.0
    temperature: 0.7
    greedyRate: 0.7
    reactionToOpponent: 1.0
    prediction: 0.6
    eloBand: [2000, 3000]
```

**Implementation:**
```typescript
export class BotRuntime {
  async selectAction(
    observation: Observation,
    policy: ActorCriticPolicy,
    knobs: DifficultyKnobs
  ): Promise<ActionBundle> {
    // Apply reaction delay
    const delayedObs = this.applyReactionDelay(observation, knobs.reactionDelay);
    
    // Get action from policy
    let action: number;
    if (Math.random() < knobs.greedyRate) {
      action = await policy.selectBestAction(delayedObs);
    } else {
      action = await policy.sampleAction(delayedObs, knobs.temperature);
    }
    
    // Apply execution error
    if (Math.random() < knobs.executionError) {
      action = this.randomAction();
    }
    
    // Filter disabled capabilities
    if (this.isDisabledAction(action, knobs)) {
      action = AIAction.IDLE;
    }
    
    return actionToBundle(action);
  }
}
```

**Tests:**
- Level 1 plays poorly (loses to medium human)
- Level 10 plays well (beats intermediate human)
- Knobs affect behavior predictably
- Difficulty scales smoothly

---

### 4.2 Style Conditioning

**File:** `src/ml/inference/StyleConfig.ts`

**Style Definitions:**
```typescript
export enum FightingStyle {
  RUSHDOWN = 'rushdown',   // Aggressive close-range pressure
  ZONER = 'zoner',         // Long-range control, projectiles
  TURTLE = 'turtle',       // Defensive, reactive
  MIXUP = 'mixup',         // Unpredictable, trickster
}

export interface StyleConfig {
  rewardModifiers: Partial<RewardWeights>;
  behaviorHints: {
    preferredRange: 'close' | 'mid' | 'far';
    aggressionBias: number;      // -1 to 1
    blockFrequency: number;      // 0 to 1
    throwFrequency: number;      // 0 to 1
    jumpFrequency: number;       // 0 to 1
  };
}
```

**Style Presets:**
```yaml
styles:
  rushdown:
    rewardModifiers:
      aggression: 0.5
      defense: -0.2
      rangeControl: -0.1
      cornering: 0.3
    behaviorHints:
      preferredRange: close
      aggressionBias: 0.8
      blockFrequency: 0.3
      throwFrequency: 0.4
      
  zoner:
    rewardModifiers:
      rangeControl: 0.5
      stalling: 0.0  # Don't penalize distance
      aggression: -0.3
    behaviorHints:
      preferredRange: far
      aggressionBias: -0.5
      blockFrequency: 0.5
      
  turtle:
    rewardModifiers:
      defense: 0.5
      successfulBlock: 1.0
      whiffPunish: 4.0
      aggression: -0.4
    behaviorHints:
      preferredRange: mid
      aggressionBias: -0.7
      blockFrequency: 0.7
      
  mixup:
    rewardModifiers:
      moveDiversity: 0.5
      repetitionPenalty: -1.0
      throwTech: 2.0
    behaviorHints:
      preferredRange: close
      aggressionBias: 0.3
      throwFrequency: 0.5
      jumpFrequency: 0.4
```

**Training with Styles:**
1. Add style one-hot to observation
2. Sample style for each training episode
3. Apply style reward modifiers
4. Ensure opponent pool contains all styles
5. At inference, set style and use corresponding policy behavior

**Tests:**
- Rushdown bot stays close, attacks frequently
- Zoner bot maintains distance, uses projectiles
- Turtle bot blocks often, punishes mistakes
- Mixup bot shows high action diversity

---

## Phase 5: Evaluation & Metrics (Week 5)

### Goal
Build comprehensive evaluation harness with regression tests.

### 5.1 Evaluation Harness

**File:** `src/ml/evaluation/EvaluationHarness.ts`

**Metrics:**
```typescript
export interface EvaluationMetrics {
  // Win rates
  overallWinRate: number;
  winRateVsBaselines: Map<string, number>;
  winRateVsPool: Map<string, number>;
  
  // Elo
  currentElo: number;
  eloVsBaselines: number[];
  eloVsPool: number[];
  
  // Combat stats
  avgDamagePerRound: number;
  avgDamageTaken: number;
  avgRoundDuration: number;
  knockdownsPerRound: number;
  combosPerRound: number;
  avgComboLength: number;
  
  // Positioning
  timeInRange: {
    close: number;    // % of time
    mid: number;
    far: number;
  };
  cornerTimeAdvantage: number;  // % time cornering - % time cornered
  
  // Behavior
  actionDiversity: number;      // Entropy [0, 1]
  stallingTime: number;         // % of time stalling
  loopRate: number;             // Repetition score
  
  // Tactical
  hitConfirmRate: number;       // % of hits converted to combos
  blockRate: number;            // % of incoming attacks blocked
  whiffPunishRate: number;      // % of opponent whiffs punished
  antiAirRate: number;          // % of jumps anti-aired
}
```

**Implementation:**
```typescript
export class EvaluationHarness {
  async evaluate(
    policy: ActorCriticPolicy,
    opponents: OpponentSnapshot[],
    numGames: number = 100
  ): Promise<EvaluationMetrics> {
    const results: MatchResult[] = [];
    
    for (const opponent of opponents) {
      for (let i = 0; i < numGames / opponents.length; i++) {
        const result = await this.playMatch(policy, opponent.policy);
        results.push(result);
      }
    }
    
    return this.computeMetrics(results);
  }
  
  private computeMetrics(results: MatchResult[]): EvaluationMetrics {
    // Aggregate stats from all matches
    // ...
  }
}
```

**Tests:**
- Metrics computed correctly from match results
- Win rate matches expected value
- Behavior metrics detect anomalies

---

### 5.2 Regression Tests

**File:** `src/ml/evaluation/RegressionTests.ts`

**Test Suite:**
```typescript
export interface RegressionTest {
  name: string;
  condition: (metrics: EvaluationMetrics) => boolean;
  severity: 'error' | 'warning';
  message: string;
}

export const REGRESSION_TESTS: RegressionTest[] = [
  {
    name: 'beats_random',
    condition: (m) => m.winRateVsBaselines.get('random') > 0.9,
    severity: 'error',
    message: 'Policy should beat random bot >90%',
  },
  {
    name: 'no_excessive_stalling',
    condition: (m) => m.stallingTime < 0.2,
    severity: 'error',
    message: 'Stalling time should be <20%',
  },
  {
    name: 'sufficient_diversity',
    condition: (m) => m.actionDiversity > 0.5,
    severity: 'warning',
    message: 'Action diversity should be >0.5',
  },
  {
    name: 'no_loops',
    condition: (m) => m.loopRate < 0.3,
    severity: 'error',
    message: 'Loop rate should be <30%',
  },
  {
    name: 'reasonable_combo_rate',
    condition: (m) => m.hitConfirmRate > 0.3,
    severity: 'warning',
    message: 'Hit confirm rate should be >30%',
  },
];
```

**Integration:**
- Run regression tests after each training checkpoint
- Flag policies that fail critical tests
- Generate report with pass/fail status

---

## Mobile Deployment Architecture

### Performance Considerations

**Training:**
- Run on desktop/server (TensorFlow.js with Node backend)
- Export trained models in TensorFlow.js format
- Models should be < 1MB compressed

**Inference:**
- Run in browser/mobile app (TensorFlow.js WebGL/WASM backend)
- Use quantized models (INT8) for mobile
- Target < 16ms per inference (60fps budget)

**Network Architecture:**
```
Mobile-Optimized Policy:
  Input(60) → Dense(64, ReLU) → Dense(64, ReLU) → Output(14)
  Parameters: ~5K (< 20KB)
  Inference: ~2-5ms on mobile
```

**Optimization Strategies:**
1. **Model Quantization:** Convert float32 → int8 (4x smaller, faster)
2. **Pruning:** Remove low-weight connections (sparse model)
3. **Caching:** Cache policy outputs for repeated states
4. **Batching:** Process multiple bots in single inference call

**Storage:**
```
Packaged Bot Assets:
- policy_level1.json         (~50KB)
- policy_level5.json         (~50KB)
- policy_level10.json        (~50KB)
- style_rushdown.json        (~50KB)
- style_zoner.json           (~50KB)
- difficulty_config.json     (~5KB)
- style_config.json          (~5KB)

Total: ~265KB (acceptable for mobile)
```

---

## Testability Architecture

### Unit Testing Strategy

**Core Modules:**
```typescript
// Environment tests
describe('FightingGameEnv', () => {
  test('resets to initial state');
  test('step increments frame correctly');
  test('rewards computed correctly');
  test('done flag set on round end');
  test('deterministic with same seed');
});

// Observation tests
describe('ObservationEncoder', () => {
  test('values normalized to correct range');
  test('history buffer updates correctly');
  test('style encoding is valid one-hot');
});

// Reward tests
describe('RewardFunction', () => {
  test('damage delta computed correctly');
  test('stalling detected after threshold');
  test('move diversity calculated correctly');
  test('style modifiers apply correctly');
});

// PPO tests
describe('PPOTrainer', () => {
  test('GAE computation matches reference');
  test('PPO loss computes correctly');
  test('training improves policy');
});
```

**Integration Testing:**
```typescript
describe('Training Pipeline', () => {
  test('end-to-end training completes');
  test('policy improves over time');
  test('opponent pool maintains diversity');
  test('curriculum progresses correctly');
});

describe('Evaluation', () => {
  test('metrics computed correctly');
  test('regression tests detect issues');
  test('Elo converges to expected values');
});
```

**Snapshot Testing:**
```typescript
// Verify deterministic behavior
describe('Determinism', () => {
  test('same seed produces identical results', () => {
    const env1 = new FightingGameEnv({ seed: 42 });
    const env2 = new FightingGameEnv({ seed: 42 });
    
    const actions = [/* ... */];
    for (const action of actions) {
      const result1 = env1.step(action);
      const result2 = env2.step(action);
      expect(result1).toEqual(result2);
    }
  });
});
```

---

## Configuration Management

### YAML Config Files

**`config/training.yaml`:**
```yaml
# PPO Hyperparameters
ppo:
  learning_rate: 0.0003
  gamma: 0.99
  lambda: 0.95
  clip_range: 0.2
  entropy_coef: 0.01
  value_coef: 0.5
  batch_size: 2048
  minibatch_size: 256
  epochs_per_batch: 4
  max_grad_norm: 0.5

# Reward Weights
rewards:
  damageDealt: 1.0
  damageTaken: -1.0
  knockdown: 5.0
  roundWin: 100.0
  roundLoss: -100.0
  hitConfirm: 2.0
  successfulBlock: 0.5
  whiffPunish: 3.0
  antiAir: 2.0
  stalling: -0.05
  moveDiversity: 0.1
  repetitionPenalty: -0.5

# Opponent Pool
opponent_pool:
  max_snapshots: 18
  snapshot_frequency: 100000
  sampling_strategy: 'mixed'
  keep_best: 5
  keep_recent: 5
  keep_baselines: 3

# Training
training:
  total_steps: 10000000
  eval_frequency: 50000
  save_frequency: 100000
  log_frequency: 1000
```

**Runtime Loading:**
```typescript
import * as yaml from 'js-yaml';
import * as fs from 'fs';

export function loadTrainingConfig(): TrainingConfig {
  const configFile = fs.readFileSync('config/training.yaml', 'utf8');
  return yaml.load(configFile) as TrainingConfig;
}
```

---

## Implementation Roadmap

### Week 1: Foundation MVP
**Deliverable:** Basic RL training working

- [ ] Environment wrapper (2 days)
- [ ] Enhanced observation encoder (1 day)
- [ ] Dense reward function (1 day)
- [ ] Basic PPO trainer (2 days)
- [ ] Training script + tests (1 day)

**Success Metric:** Bot beats RandomBot >80% after 500k steps

---

### Week 2: Opponent Pool
**Deliverable:** Diverse training opponents

- [ ] OpponentPool implementation (2 days)
- [ ] Elo rating system (1 day)
- [ ] Sampling strategies (1 day)
- [ ] Pool integration with trainer (1 day)
- [ ] Snapshot save/load (1 day)
- [ ] Tests + validation (1 day)

**Success Metric:** Pool maintains 10+ snapshots with Elo spread

---

### Week 3: Curriculum & Safety
**Deliverable:** Progressive training + degenerate prevention

- [ ] CurriculumManager implementation (2 days)
- [ ] Stage definitions (1 day)
- [ ] Stalling detection (1 day)
- [ ] Loop detection (1 day)
- [ ] Action diversity metrics (1 day)
- [ ] Integration + tests (1 day)

**Success Metric:** Bot progresses through curriculum, <10% stalling

---

### Week 4: Difficulty & Styles
**Deliverable:** Production-ready bots with personalities

- [ ] DifficultyConfig + knobs (2 days)
- [ ] Level 1-10 presets (1 day)
- [ ] StyleConfig + conditioning (2 days)
- [ ] Style reward modifiers (1 day)
- [ ] BotRuntime wrapper (1 day)

**Success Metric:** 10 difficulty levels + 4 distinct styles working

---

### Week 5: Evaluation & Polish
**Deliverable:** Comprehensive metrics + regression tests

- [ ] EvaluationHarness (2 days)
- [ ] BehaviorAnalysis tools (1 day)
- [ ] Regression test suite (1 day)
- [ ] Training reports/dashboards (1 day)
- [ ] Mobile optimization (1 day)
- [ ] Documentation (1 day)

**Success Metric:** Full evaluation pipeline, bots pass regression tests

---

## Milestones & Validation

### Milestone 1: Basic RL Working
- Bot learns to beat random opponent
- Reward curve improves over time
- Policy saves and loads successfully
- Training runs without crashes

### Milestone 2: Opponent Pool Stable
- 10+ snapshots in pool
- Elo ratings differentiate skill
- No self-play collapse
- Win rates converge

### Milestone 3: Curriculum Complete
- Bot progresses through all stages
- Stalling < 10%
- Action diversity > 0.6
- No excessive loops

### Milestone 4: Styles Distinct
- Rushdown plays aggressively
- Zoner maintains distance
- Turtle blocks frequently
- Mixup shows diversity

### Milestone 5: Production Ready
- All regression tests pass
- Performance < 5ms inference on mobile
- Models < 1MB total
- Bots feel human-like in playtesting

---

## Success Metrics

### Quantitative
- **Win Rate:** Trained bot beats scripted bot >90%
- **Elo Rating:** Level 10 bot reaches 2000+ Elo
- **Stalling:** <10% of match time
- **Diversity:** Action entropy >0.6
- **Performance:** Inference <5ms on mid-tier mobile
- **Size:** Models <1MB compressed

### Qualitative
- Bots feel "human-like" in playtesting
- Different styles are recognizable
- Difficulty progression feels fair
- No obvious exploits or cheese strategies
- Players report engaging matches

---

## Future Enhancements

### Post-MVP
1. **Multi-agent training** (parallel environments)
2. **Curiosity-driven exploration** (intrinsic motivation)
3. **Hierarchical policies** (high-level strategy + low-level execution)
4. **Transfer learning** (train on one character, transfer to others)
5. **Human-in-the-loop** (learn from live matches)
6. **Advanced architectures** (transformers, attention, recurrent)

### Research Directions
- Self-play with automatic curriculum
- Meta-learning for rapid adaptation
- Imitation learning from pro players
- Style transfer between characters
- Opponent modeling and adaptation
