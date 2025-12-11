# Five Rings: Fighting Game MVP Plan

## Vision

Transform "Five Rings" into a **Street Fighter-style 1v1 fighting game** as an MVP, with architecture designed to:
1. Create compelling, skill-based combat gameplay
2. Enable AI bot training via TensorFlow.js reinforcement learning
3. Serve as the foundation for the original side-scrolling adventure vision

The fighting mechanics developed here become the **combat system** for the full game, and the trained AI bots become **enemies and sparring partners** throughout Musashi's journey.

---

## Architectural Principles

### 1. **Separation of Concerns: Core vs. Rendering**

```
┌─────────────────────────────────────────────────────────────┐
│                      PHASER LAYER                           │
│  (Rendering, Input Capture, Audio, Visual Effects)          │
│  - Reads from GameState                                     │
│  - Sends inputs to Core                                     │
│  - Never modifies game state directly                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      CORE LAYER                             │
│  (Pure TypeScript - Zero external dependencies)             │
│  - Deterministic game logic                                 │
│  - Frame-based simulation                                   │
│  - Collision detection                                      │
│  - State management                                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      AI TRAINING LAYER                      │
│  (TensorFlow.js - Optional dependency)                      │
│  - Runs Core without Phaser                                 │
│  - Thousands of simulations per second                      │
│  - Reward calculation and policy updates                    │
└─────────────────────────────────────────────────────────────┘
```

**Why:** AI training requires running millions of game frames. Phaser adds ~16ms per frame minimum. Pure TypeScript core can run 10,000+ frames per second.

### 2. **Deterministic Simulation**

- Same inputs + same initial state = identical outcome
- No `Math.random()` in core (use seeded PRNG if randomness needed)
- Frame-based timing (not delta-time) for fighting game precision
- All state changes go through a single `tick()` function

**Why:** Determinism enables replays, debugging, and consistent AI training.

### 3. **Immutable State Updates**

```typescript
// BAD: Mutating state
fighter.health -= damage;

// GOOD: Return new state
function applyDamage(fighter: FighterState, damage: number): FighterState {
  return { ...fighter, health: fighter.health - damage };
}
```

**Why:** Makes state changes trackable, enables time-travel debugging, prevents bugs from shared references.

### 4. **Data-Driven Design**

- Characters defined as data (JSON/TypeScript objects), not classes
- Moves, hitboxes, frame data all configurable
- Easy to add new characters without code changes
- Balancing through data tweaks, not code rewrites

### 5. **Modularity & Testability**

- Each module has a single responsibility
- All core functions are pure (output depends only on input)
- No global state
- Every system unit-testable in isolation

### 6. **Progressive Enhancement**

- MVP works with minimal features
- Each phase adds capabilities without breaking existing functionality
- AI training optional—game playable without TensorFlow.js
- Side-scroller expansion uses same core combat system

---

## Project Structure

```
src/
├── core/                       # PURE TYPESCRIPT - No dependencies
│   ├── types.ts                # All type definitions
│   ├── constants.ts            # Game constants (arena size, etc.)
│   ├── FightingGame.ts         # Main game loop and state management
│   ├── Fighter.ts              # Fighter state transitions
│   ├── Physics.ts              # Movement, gravity, collision
│   ├── Combat.ts               # Hit detection, damage calculation
│   ├── InputBuffer.ts          # Input queue, combo detection
│   └── Actions.ts              # Move definitions, frame data
│
├── characters/                 # Character data definitions
│   ├── types.ts                # Character type definitions
│   ├── musashi.ts              # Musashi's moves, stats, hitboxes
│   ├── ronin.ts                # Generic ronin enemy
│   └── ninja.ts                # Fast, combo-focused character
│
├── ai/                         # AI Training infrastructure
│   ├── Environment.ts          # OpenAI Gym-style wrapper
│   ├── StateEncoder.ts         # Game state → tensor conversion
│   ├── RewardFunction.ts       # Reward shaping for RL
│   ├── agents/
│   │   ├── RandomAgent.ts      # Baseline random actions
│   │   ├── ScriptedAgent.ts    # Rule-based bot (difficulty levels)
│   │   └── RLAgent.ts          # TensorFlow.js trained agent
│   └── training/
│       ├── Trainer.ts          # Training loop orchestration
│       └── config.ts           # Hyperparameters
│
├── phaser/                     # Phaser rendering layer
│   ├── scenes/
│   │   ├── BootScene.ts        # Asset loading
│   │   ├── MenuScene.ts        # Main menu
│   │   ├── FightScene.ts       # Main gameplay scene
│   │   ├── CharacterSelectScene.ts
│   │   └── TrainingScene.ts    # AI training visualization
│   ├── sprites/
│   │   ├── FighterSprite.ts    # Fighter visual representation
│   │   └── EffectsManager.ts   # Particles, screen shake
│   ├── ui/
│   │   ├── HealthBar.ts
│   │   ├── EnergyMeter.ts
│   │   ├── RoundIndicator.ts
│   │   └── Timer.ts
│   └── input/
│       └── InputManager.ts     # Keyboard/gamepad → core input
│
├── config/
│   └── gameConfig.ts           # Phaser configuration
│
├── utils/
│   ├── PRNG.ts                 # Seeded random number generator
│   └── Logger.ts               # Debug logging utility
│
├── main.ts                     # Entry point (Phaser game)
└── train.ts                    # Entry point (headless training)
```

---

## Type Definitions (Core Contract)

```typescript
// core/types.ts

// === INPUT ===
export enum InputAction {
  NONE = 0,
  LEFT = 1,
  RIGHT = 2,
  UP = 3,        // Jump
  DOWN = 4,      // Crouch
  LP = 5,        // Light Punch
  HP = 6,        // Heavy Punch
  LK = 7,        // Light Kick
  HK = 8,        // Heavy Kick
  BLOCK = 9,
  SPECIAL_1 = 10,
  SPECIAL_2 = 11,
  SUPER = 12,
}

export interface InputFrame {
  actions: InputAction[];  // Multiple buttons can be pressed
  frame: number;
}

// === FIGHTER STATE ===
export type FighterStatus = 
  | 'idle' 
  | 'walking' 
  | 'jumping' 
  | 'crouching'
  | 'attacking' 
  | 'blocking' 
  | 'hitstun' 
  | 'blockstun'
  | 'knockdown'
  | 'getting_up';

export interface Position {
  x: number;
  y: number;
}

export interface Velocity {
  x: number;
  y: number;
}

export interface Rectangle {
  x: number;      // Relative to fighter position
  y: number;
  width: number;
  height: number;
}

export interface FighterState {
  id: string;                  // Unique instance ID (e.g., "player_1", "enemy_5")
  characterId: string;         // Data definition ID (e.g., "musashi", "ronin")
  teamId: number;              // 0 = player, 1 = enemy (enables 1vMany later)
  position: Position;
  velocity: Velocity;
  facing: 1 | -1;              // 1 = right, -1 = left
  
  // Resources
  health: number;
  maxHealth: number;
  energy: number;              // For special moves
  maxEnergy: number;
  superMeter: number;          // For super combos
  maxSuperMeter: number;
  
  // State
  status: FighterStatus;
  isGrounded: boolean;
  
  // Current action
  currentMove: string | null;  // Move ID being executed
  moveFrame: number;           // Current frame of the move
  
  // Combat tracking
  comboCount: number;
  lastHitFrame: number;
  
  // Hitboxes (updated per frame based on current move)
  hurtboxes: Rectangle[];      // Where fighter can be hit
  hitboxes: Rectangle[];       // Where fighter's attack lands
}

// === MOVE DEFINITIONS ===
export interface MoveDefinition {
  id: string;
  name: string;
  
  // Input
  input: InputAction[];        // Required inputs
  motionInput?: string;        // e.g., "236P" for quarter-circle + punch
  
  // Frame data
  startup: number;             // Frames before hitbox active
  active: number;              // Frames hitbox is active
  recovery: number;            // Frames after hitbox ends
  totalFrames: number;         // startup + active + recovery
  
  // Properties
  damage: number;
  chipDamage: number;          // Damage when blocked
  hitstun: number;             // Frames opponent in hitstun
  blockstun: number;           // Frames opponent in blockstun
  knockback: Velocity;         // Push on hit
  
  // Hitbox data per frame
  hitboxFrames: Map<number, Rectangle[]>;
  
  // Resource costs
  energyCost: number;
  superMeterGain: number;      // Meter gained on hit
  
  // Cancels
  cancellableInto: string[];   // Move IDs this can cancel into
  cancellableOnHit: boolean;
  cancellableOnBlock: boolean;
  
  // State requirements
  requiresGrounded: boolean;
  requiresAirborne: boolean;
  canCrossup: boolean;
}

// === CHARACTER DEFINITION ===
export interface CharacterDefinition {
  id: string;
  name: string;
  
  // Base stats
  walkSpeed: number;
  jumpForce: number;
  gravity: number;
  maxHealth: number;
  maxEnergy: number;
  
  // Collision
  standingHurtbox: Rectangle;
  crouchingHurtbox: Rectangle;
  airborneHurtbox: Rectangle;
  
  // Moves
  moves: Map<string, MoveDefinition>;
  
  // Unlockable moves (for progression)
  moveUnlockLevels: Map<string, number>;
}

// === GAME STATE ===
export interface RoundState {
  roundNumber: number;
  timeRemaining: number;       // In frames (60fps = 99 seconds max)
  winner: string | null;       // Winner ID
}

export interface MatchState {
  wins: Record<string, number>; // Map of fighter ID to win count
  roundsToWin: number;
  matchWinner: string | null;
}

export interface GameState {
  frame: number;
  entities: FighterState[];    // Array of all active fighters (supports 1v1 or 1vMany)
  round: RoundState;
  match: MatchState;
  
  // Arena / World
  worldWidth: number;          // Total world size (can be larger than view)
  worldHeight: number;
  cameraPosition: Position;    // For side-scroller expansion
  groundLevel: number;         // MVP: flat ground. Future: Array of platforms.
  
  // Game flow
  isPaused: boolean;
  isRoundOver: boolean;
  isMatchOver: boolean;
}

// === AI TRAINING ===
export interface Observation {
  // Flattened array for neural network input
  // All values normalized to [-1, 1] or [0, 1]
  features: number[];
}

export interface TrainingConfig {
  learningRate: number;
  discountFactor: number;
  batchSize: number;
  replayBufferSize: number;
  epsilon: number;             // Exploration rate
  epsilonDecay: number;
}
```

---

## Implementation Phases

### Phase 1: Core Foundation (Week 1-2)

**Goal:** Pure TypeScript fighting game engine that runs without Phaser.

#### Step 1.1: Project Setup
- [ ] Create new folder structure alongside existing code
- [ ] Set up TypeScript paths for clean imports
- [ ] Add Jest for unit testing
- [ ] Create `core/types.ts` with all type definitions

#### Step 1.2: Basic Physics
- [ ] Implement `Physics.ts`:
  - `applyGravity(fighter, delta): FighterState`
  - `applyMovement(fighter, input): FighterState`
  - `checkGrounded(fighter, groundLevel): boolean`
  - `resolveWallCollision(fighter, worldWidth): FighterState`
  - `resolveEntityCollisions(entities): FighterState[]` (Push-box logic)

#### Step 1.3: State Management
- [ ] Implement `Fighter.ts`:
  - `createFighter(characterId, instanceId, teamId, position): FighterState`
  - `updateFighterStatus(fighter, input): FighterState`
  - `canExecuteMove(fighter, moveId): boolean`
  - `startMove(fighter, moveId): FighterState`
  - `advanceMoveFrame(fighter): FighterState`

#### Step 1.4: Combat System
- [ ] Implement `Combat.ts`:
  - `checkHit(attacker, defender): HitResult | null`
  - `applyHit(attacker, defender, hitResult): [FighterState, FighterState]`
  - `applyBlock(attacker, defender, hitResult): [FighterState, FighterState]`
  - `calculateDamage(move, comboCount): number`
  - `scanForHits(entities): GameState` (Handle N-way combat)

#### Step 1.5: Game Loop
- [ ] Implement `FightingGame.ts`:
  - `createInitialState(config): GameState`
  - `tick(state, inputs): GameState` (inputs is Map<string, InputFrame>)
  - `checkRoundEnd(state): GameState`
  - `checkMatchEnd(state): GameState`

#### Step 1.6: Unit Tests
- [ ] Physics tests (gravity, movement, collisions)
- [ ] Combat tests (hit detection, damage)
- [ ] State transition tests
- [ ] Full game loop tests

**Deliverable:** Headless game that can simulate fights via `tick()` function.

---

### Phase 2: First Character (Week 2-3)

**Goal:** Complete Musashi character with basic moves.

#### Step 2.1: Character Data Structure
- [ ] Implement `characters/types.ts`
- [ ] Create `characters/musashi.ts` with:
  - Base stats (health, speed, etc.)
  - Standing/crouching/airborne hurtboxes

#### Step 2.2: Basic Moves
- [ ] Standing Light Punch
  - 4 startup, 3 active, 6 recovery
  - Low damage, fast, safe
- [ ] Standing Heavy Punch  
  - 8 startup, 4 active, 14 recovery
  - High damage, slow, punishable
- [ ] Standing Light Kick
  - 5 startup, 3 active, 8 recovery
  - Medium range poke
- [ ] Standing Heavy Kick
  - 10 startup, 5 active, 18 recovery
  - Long range, knockdown on hit

#### Step 2.3: Movement Moves
- [ ] Jump (neutral, forward, backward)
- [ ] Crouch
- [ ] Walk forward/backward
- [ ] Blocking (standing and crouching)

#### Step 2.4: Jumping Attacks
- [ ] Jump Light Punch
- [ ] Jump Heavy Kick

**🎨 ASSET REQUIREMENT:**
> Need sprite sheets for Musashi with the following animations:
> - Idle (4-6 frames)
> - Walk forward (6-8 frames)
> - Walk backward (6-8 frames)  
> - Jump (3 frames: launch, peak, fall)
> - Crouch (2-3 frames)
> - Standing block (2 frames)
> - Crouching block (2 frames)
> - Light punch (4-5 frames)
> - Heavy punch (6-8 frames)
> - Light kick (5-6 frames)
> - Heavy kick (8-10 frames)
> - Jump attack (4-5 frames)
> - Hit reaction (2-3 frames)
> - Knockdown (4-6 frames)
> - Getting up (3-4 frames)
> 
> **Sprite size recommendation:** 128x128 or 192x192 pixels per frame
> **Format:** PNG sprite sheet with transparent background

---

### Phase 3: Phaser Integration (Week 3-4)

**Goal:** Render the core game state with Phaser.

#### Step 3.1: Scene Setup
- [ ] Create `FightScene.ts`:
  - Initialize core `GameState`
  - Set up fixed camera (no scrolling)
  - Create arena background

#### Step 3.2: Fighter Sprites
- [ ] Create `FighterSprite.ts`:
  - Map `FighterState.status` → animation key
  - Map `FighterState.currentMove` → attack animation
  - Handle sprite flipping based on `facing`
  - Position sprite based on `position`

#### Step 3.3: Input Bridge
- [ ] Create `InputManager.ts`:
  - Capture keyboard/gamepad input
  - Convert to `InputAction[]`
  - Feed to core `tick()` function

#### Step 3.4: UI Elements
- [ ] Health bars (two, mirrored)
- [ ] Round timer
- [ ] Round indicator (dots)
- [ ] "ROUND 1", "FIGHT!", "K.O." announcements

#### Step 3.5: Game Flow
- [ ] Round start sequence
- [ ] Round end detection
- [ ] Match end / continue screen
- [ ] Return to menu

**🎨 ASSET REQUIREMENT:**
> Need the following UI and background assets:
> - Arena background (single screen, ~1280x720)
> - Health bar frame and fill graphics
> - Energy meter graphics
> - Round indicator dots
> - "ROUND 1/2/3", "FIGHT!", "K.O.", "YOU WIN", "YOU LOSE" text/graphics
> - Hit spark effects (small sprite sheet)
> - Block spark effects

---

### Phase 4: Second Character & Bot (Week 4-5)

**Goal:** Add opponent character and basic AI.

#### Step 4.1: Ronin Character
- [ ] Create `characters/ronin.ts`:
  - Different stats than Musashi (slower, more damage)
  - Different hitbox sizes
  - Same basic move set (can share animations initially)

#### Step 4.2: Scripted AI
- [ ] Create `ai/agents/ScriptedAgent.ts`:
  - Rule-based decision making
  - Difficulty levels:
    - **Easy:** Slow reactions, no combos, walks into attacks
    - **Medium:** Basic blocking, simple punishes
    - **Hard:** Optimal punishes, reads jump-ins

#### Step 4.3: AI Integration
- [ ] Create `ai/Environment.ts`:
  - `reset(): Observation`
  - `step(action): { observation, reward, done }`
  - `getValidActions(): InputAction[]`

#### Step 4.4: Character Select
- [ ] Create `CharacterSelectScene.ts`:
  - Display available characters
  - Show character stats preview
  - Select opponent difficulty

**🎨 ASSET REQUIREMENT:**
> Need Ronin sprite sheet (can be palette swap of Musashi initially):
> - Same animation set as Musashi
> - Different color scheme
> - Character select portrait (128x128)

---

### Phase 5: Special Moves & Combos (Week 5-6)

**Goal:** Add depth with special moves and combo system.

#### Step 5.1: Input Buffer System
- [ ] Implement `InputBuffer.ts`:
  - Store last 60 frames of input
  - Motion detection (quarter-circle, dragon punch, etc.)
  - Negative edge support (button release)

#### Step 5.2: Musashi Special Moves
- [ ] **Fireball** (Quarter-circle forward + Punch):
  - Projectile that travels across screen
  - 20 startup, travels at fixed speed
  - Dissipates on hit or edge of screen
- [ ] **Dragon Uppercut** (Forward, Down, Down-Forward + Punch):
  - Anti-air, invincible startup
  - High damage but very punishable
  - Launches opponent

#### Step 5.3: Combo System
- [ ] Implement cancel windows
- [ ] Track combo counter
- [ ] Damage scaling (each hit in combo does less %)
- [ ] Hitstun decay (longer combos = less hitstun)

#### Step 5.4: Super Meter & Super Move
- [ ] Meter builds on hit/block
- [ ] **Super Combo** (Double quarter-circle + Punch):
  - 3-bar cost
  - Cinematic multi-hit attack
  - Invincible startup

**🎨 ASSET REQUIREMENT:**
> Need additional animation frames:
> - Fireball projectile (4-frame loop)
> - Fireball impact effect
> - Dragon uppercut (8-10 frames)
> - Super combo (15-20 frames, can be multi-part)
> - Super flash/freeze effect
> - Combo counter UI element

---

### Phase 6: AI Training Infrastructure (Week 6-8)

**Goal:** Enable TensorFlow.js reinforcement learning.

#### Step 6.1: State Encoder
- [ ] Implement `StateEncoder.ts`:
  ```typescript
  function encodeState(state: GameState, playerId: 'player1' | 'player2'): Observation {
    // Normalize all values to [-1, 1]
    // Return flat array for neural network
  }
  ```

#### Step 6.2: Reward Function
- [ ] Implement `RewardFunction.ts`:
  - Damage dealt: +0.01 per point
  - Damage taken: -0.01 per point
  - Round win: +1.0
  - Round loss: -1.0
  - Time penalty: -0.0001 per frame (encourage aggression)
  - Combo bonus: +0.001 per hit in combo

#### Step 6.3: Training Loop
- [ ] Implement `Trainer.ts`:
  - PPO (Proximal Policy Optimization) or DQN
  - Self-play training
  - Save/load model checkpoints
  - Training metrics logging

#### Step 6.4: Headless Training Script
- [ ] Create `train.ts`:
  - Run without Phaser
  - Command-line arguments for config
  - Progress reporting
  - Model export to JSON

#### Step 6.5: Training Visualization
- [ ] Create `TrainingScene.ts`:
  - Watch AI vs AI in real-time
  - Display training metrics
  - Slow-motion replay of interesting moments

**Dependencies:**
```json
{
  "@tensorflow/tfjs": "^4.x",
  "@tensorflow/tfjs-node": "^4.x"  // For faster training
}
```

### Bot Personality Matrix (Scripted + RL Hybrid)

"All bots share the same brain architecture, but each bot has a different tuning and a few quirks."

#### 1. Personality Config
Define a "personality config" for each bot with these knobs:
- **Aggression:** How often they advance/attack vs wait/retreat.
- **Risk:** Chance to pick unsafe but high-reward moves.
- **Defense focus:** Preference for guard, backdash, parry.
- **Spacing preference:** Ideal distance (rushdown vs zoner).
- **Combo ambition:** Go for simple confirms vs longer strings.
- **Counter-tendency:** How likely to attack after blocking/whiff punish.
- **Feint / fake rate:** How often they whiff safe moves to bait you.
- **Adaptivity:** How much they change based on recent success/failure.
- **Discipline:** How much they respect frame disadvantage (don't mash).

#### 2. Map Personality → Decision Logic
Our `getAIAction(state, personality)` function becomes a series of weighted decisions:
- **Rule-based AI:** Use knobs to weight the probability of selecting specific branches in the behavior tree.
- **RL Policy:** Use knobs as inputs to the policy network or to select between different trained policies.

#### 3. Building in Weaknesses Deliberately
A "personality" isn't just playstyle, it's also blind spots and quirks the player can learn and exploit.
- **Pattern Addiction:**
  - *Example:* Fire bot loves "jump-in → heavy → special" and overuses it.
  - *Implement:* Track its last N successful sequences and bias towards them more than is optimal.
- **Range Blindness:**
  - *Example:* Earth bot is great at close defense but bad vs full-screen projectiles.
  - *Implement:* If distance > some threshold, cap its effective reaction or lower its correct response probability.
- **Tilt:**
  - *Example:* After taking a big combo, some bots become more reckless.
  - *Implement:* When `recentDamage > threshold`, temporarily bump `riskTaking` and lower `discipline`.
- **Over-respect / Under-respect:**
  - *Example:* High-discipline bot rarely challenges minus frames (safe to throw). Low-discipline bot mashes jab after everything (baitable).

---

### Phase 7: Polish & Game Feel (Week 8-9)

**Goal:** Make the game feel responsive and satisfying.

#### Step 7.1: Visual Feedback
- [ ] Hit freeze (3-5 frame pause on hit)
- [ ] Screen shake on heavy hits
- [ ] Hit sparks and effects
- [ ] Character flash on hit

#### Step 7.2: Audio
- [ ] Hit sounds (light, medium, heavy)
- [ ] Block sounds
- [ ] Whoosh sounds for attacks
- [ ] Voice clips (optional)
- [ ] Background music

#### Step 7.3: Animation Polish
- [ ] Smooth animation transitions
- [ ] Anticipation frames
- [ ] Impact frames
- [ ] Recovery poses

#### Step 7.4: Quality of Life
- [ ] Button config screen
- [ ] Training mode:
  - Dummy recording/playback
  - Hitbox display toggle
  - Frame data display
- [ ] Pause menu

**🎨 ASSET REQUIREMENT:**
> - Hit spark variations (3-4 types)
> - Block spark effect
> - Dust/landing effects
> - Background animated elements (flags, torches, etc.)
> 
> **🔊 AUDIO REQUIREMENT:**
> - Light hit sound
> - Medium hit sound  
> - Heavy hit sound
> - Block sound
> - Whoosh sounds (3-4 variations)
> - Announcer clips: "Round 1", "Round 2", "Final Round", "Fight!", "K.O."
> - Background music track (looping, ~2-3 minutes)

---

### Phase 8: Third Character & Balance (Week 9-10)

**Goal:** Add variety and balance the roster.

#### Step 8.1: Ninja Character
- [ ] Create `characters/ninja.ts`:
  - Fast movement, low health
  - Quick attacks, long combos
  - Teleport special move
  - Different playstyle than Musashi/Ronin

#### Step 8.2: Balance Pass
- [ ] Analyze AI training data for imbalances
- [ ] Adjust frame data based on win rates
- [ ] Tune damage values
- [ ] Ensure all characters viable

#### Step 8.3: Difficulty Tuning
- [ ] Create AI difficulty levels from trained models:
  - Easy: Early training checkpoint + random noise
  - Medium: Mid-training checkpoint
  - Hard: Fully trained model

**🎨 ASSET REQUIREMENT:**
> Ninja sprite sheet with same animation set, unique style:
> - Faster, more fluid animations
> - Unique special move animations (teleport smoke, etc.)
> - Character select portrait

---

## Future Expansion: Side-Scroller Integration

Once the MVP is complete, the fighting system integrates into the adventure game:

### Combat Encounters
- Random encounters trigger `FightScene` with enemy bots
- Difficulty based on story progression
- Special story boss fights with unique AI

### Character Progression
- XP earned from fights
- Unlock new moves at level thresholds
- Stat increases affect core `CharacterDefinition`

### Multiple Enemy Types
- Each enemy type is a `CharacterDefinition`
- Trained AI models for each character
- Mix of scripted and RL-trained behaviors

### World Integration
- `GameScene` (side-scroller) detects combat triggers
- Transition animation to `FightScene`
- Return to world after victory/defeat
- Health/resources persist between fights

### Architecture Bridge
```typescript
// In side-scroller GameScene
handleCombatEncounter(enemyType: string) {
  // 1. Pause World Update
  // 2. Initialize Fight Core with current player stats
  const fightState = FightingGame.createInitialState({
    entities: [
      createFighter('musashi', 'player', 0, playerPos),
      createFighter(enemyType, 'enemy1', 1, enemyPos)
    ],
    worldWidth: 2000, // Allow scrolling if needed
    cameraPosition: cameraPos
  });
  
  // 3. Run Fight Loop (Phaser renders based on fightState)
}
```

### Future-Proofing Checklist
- [ ] **Entity System:** `GameState` uses arrays of entities, not hardcoded slots.
- [ ] **Team Logic:** `teamId` allows for 1v1, 2v2, or 1vMany (Beat 'em up style).
- [ ] **World Physics:** `Physics.ts` designed to accept platform data, not just floor y-value.
- [ ] **Input Decoupling:** Input system handles map of inputs `{ "player": inputs, "enemy1": inputs }`.
- [ ] **Camera Awareness:** State includes camera position to support scrolling levels later.

---

## Testing Strategy

### Unit Tests (Jest)
```
tests/
├── core/
│   ├── physics.test.ts
│   ├── combat.test.ts
│   ├── fighter.test.ts
│   └── game.test.ts
├── characters/
│   └── validation.test.ts    # Ensure all characters valid
└── ai/
    ├── environment.test.ts
    └── stateEncoder.test.ts
```

### Integration Tests
- Full round simulation
- Input → state → render pipeline
- AI training loop (short run)

### Manual Testing
- Frame data verification with training mode
- Hitbox visualization
- Combo verification

---

## Development Environment

### Package.json Additions
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "jest",
    "test:watch": "jest --watch",
    "train": "ts-node src/train.ts",
    "train:watch": "ts-node src/train.ts --visualize"
  },
  "dependencies": {
    "phaser": "^3.88.2",
    "@tensorflow/tfjs": "^4.17.0"
  },
  "devDependencies": {
    "typescript": "^5.8.3",
    "vite": "^5.4.19",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.2",
    "@types/jest": "^29.5.12",
    "ts-node": "^10.9.2"
  }
}
```

### TypeScript Paths
```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@core/*": ["src/core/*"],
      "@characters/*": ["src/characters/*"],
      "@ai/*": ["src/ai/*"],
      "@phaser/*": ["src/phaser/*"]
    }
  }
}
```

### Mobile Deployment & TS Stack Notes
- **All TypeScript end-to-end:** core (headless), Phaser layer, AI (TensorFlow.js), tests (Jest/ts-jest).
- **PWA first:** add manifest + service worker; test on mid-tier Android for perf; cap canvas resolution per device profile.
- **Capacitor/Cordova option:** wrap web build for iOS/Android; use WKWebView; lock landscape; expose haptics if desired.
- **Controls:** on-screen buttons + optional gestures; enable remapping; lenient motion detection and input buffering for touch.
- **Performance:** texture atlases, object pools, limit particle counts, LQ/MQ/HQ presets; avoid large canvas on low-end devices; compressed audio (ogg), lazy-load arenas.


---

## Timeline Summary

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| 1. Core Foundation | 2 weeks | Headless game engine |
| 2. First Character | 1 week | Musashi with basic moves |
| 3. Phaser Integration | 1 week | Playable single-player |
| 4. Second Character & Bot | 1 week | VS mode with AI opponent |
| 5. Special Moves & Combos | 1 week | Depth and strategy |
| 6. AI Training | 2 weeks | TensorFlow.js RL pipeline |
| 7. Polish | 1 week | Game feel and audio |
| 8. Third Character | 1 week | Roster variety and balance |

**Total MVP: ~10 weeks**

---

## Asset Checklist Summary

### Sprites Needed
- [ ] Musashi full animation set (15+ animations)
- [ ] Ronin full animation set (can be palette swap)
- [ ] Ninja full animation set (unique)
- [ ] Projectile sprites
- [ ] Effect sprites (hit sparks, dust, etc.)

### UI Assets Needed
- [ ] Health bar graphics
- [ ] Energy/super meter graphics
- [ ] Round indicators
- [ ] Announcement text graphics
- [ ] Character select portraits
- [ ] Menu backgrounds

### Audio Needed
- [ ] Hit sounds (3+ variations)
- [ ] Block sounds
- [ ] Attack whoosh sounds
- [ ] Announcer voice clips
- [ ] Background music (1-2 tracks)

### Backgrounds Needed
- [ ] Training dojo arena
- [ ] Temple courtyard arena (optional second stage)

---

## Success Criteria

### MVP Complete When:
1. ✅ Player can fight AI opponent in 1v1 match
2. ✅ 2+ playable characters with distinct moves
3. ✅ Special moves with motion inputs
4. ✅ Combo system with cancels
5. ✅ 3 AI difficulty levels
6. ✅ Training mode with hitbox display
7. ✅ Full round/match flow with UI

### AI Training Complete When:
1. ✅ Headless training runs 1000+ games/minute
2. ✅ Trained bot beats scripted "Hard" AI 70%+ of the time
3. ✅ Multiple difficulty checkpoints saved
4. ✅ Bot exhibits human-like patterns (footsies, anti-airs, punishes)

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Frame data balancing is hard | Start conservative, iterate with data |
| AI training takes too long | Use simpler DQN before PPO, cloud training |
| Sprite art delays | Use placeholder rectangles, parallelize |
| Combo system too complex | Start with simple 2-hit chains, expand |
| Core/Phaser sync issues | Strict separation, integration tests |

---

## Next Steps

1. **Approve this plan** and clarify any questions
2. **Gather/commission sprite assets** (can start with placeholders)
3. **Set up project structure** with new folders
4. **Begin Phase 1** - Core Foundation implementation

Ready to begin implementation on your approval.
