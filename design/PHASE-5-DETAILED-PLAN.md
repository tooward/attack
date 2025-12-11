# Phase 5: Special Moves & Combos - DETAILED PLAN

## Overview

**Goal:** Add depth to combat with special moves, combo system, and super meter mechanics.

**Duration:** 1 week

**Dependencies:** Phases 1-4 complete ✅

---

## What We're Building

### 1. Input Buffer System
Store input history and detect motion inputs (quarter-circle, dragon punch, etc.)

### 2. Projectile System
Add fireball-type moves that create separate entities

### 3. Special Moves
Musashi gets two special moves: Hadoken-style projectile and Shoryuken-style anti-air

### 4. Combo System
- Move canceling (normal → special → super)
- Combo counter tracking
- Damage scaling
- Hitstun decay

### 5. Super Meter System
- Meter builds on hit/block/damage taken
- Super move costs meter
- Visual meter display

---

## Technical Design

### Input Buffer (`/src/core/systems/InputBuffer.ts`)

**Purpose:** Detect complex motion inputs from recent input history.

**Data Structure:**
```typescript
interface InputHistory {
  frames: InputFrame[];      // Last 60 frames
  maxSize: number;           // Buffer size (60 = 1 second at 60fps)
}

interface MotionInput {
  id: string;                // e.g., "236P" (quarter-circle forward + punch)
  name: string;              // e.g., "Hadoken"
  directions: InputAction[]; // [DOWN, DOWN_FORWARD, FORWARD]
  button: InputAction;       // Punch or Kick
  leniency: number;          // Max frames between inputs (default: 10)
}
```

**Key Functions:**
```typescript
// Add new input to buffer
function addInput(buffer: InputHistory, input: InputFrame): InputHistory

// Check if motion input was performed
function checkMotion(buffer: InputHistory, motion: MotionInput): boolean

// Get most recent button press
function getLastPressed(buffer: InputHistory, action: InputAction): number | null

// Clear buffer (on round reset)
function clearBuffer(buffer: InputHistory): InputHistory
```

**Motion Detection Algorithm:**
```typescript
// Example: Quarter-circle forward (236P)
// DOWN → DOWN_FORWARD → FORWARD + PUNCH
// Within 10 frames

function checkMotion(buffer: InputHistory, motion: MotionInput): boolean {
  const buttonFrame = getLastPressed(buffer, motion.button);
  if (buttonFrame === null) return false;
  
  // Work backwards from button press
  let directionIndex = motion.directions.length - 1;
  let frameIndex = buffer.frames.length - 1;
  
  while (directionIndex >= 0 && frameIndex >= 0) {
    const frame = buffer.frames[frameIndex];
    const requiredDirection = motion.directions[directionIndex];
    
    if (frame.actions.includes(requiredDirection)) {
      directionIndex--;
      
      // Check leniency
      if (buttonFrame - frame.frame > motion.leniency) {
        return false;
      }
    }
    
    frameIndex--;
  }
  
  return directionIndex < 0; // All directions found
}
```

**Standard Motion Inputs:**
- `236P/K` - Quarter-circle forward (Hadoken)
- `623P/K` - Dragon punch (Shoryuken)
- `214P/K` - Quarter-circle back
- `236236P` - Double quarter-circle (Super)
- `41236P` - Half-circle forward
- `63214P` - Half-circle back

---

### Projectile System (`/src/core/entities/Projectile.ts`)

**Purpose:** Separate entities for fireballs, energy blasts, etc.

**Data Structure:**
```typescript
interface ProjectileState {
  id: string;
  ownerId: string;           // Fighter who created it
  teamId: number;
  position: Vector2;
  velocity: Vector2;
  
  // Properties
  damage: number;
  chipDamage: number;
  hitstun: number;
  knockback: Vector2;
  
  // Hitbox
  hitbox: Rect;
  
  // Lifetime
  lifespan: number;          // Max frames before dissipates
  frameCreated: number;
  active: boolean;           // Hit something, now dissipating
}

interface ProjectileDefinition {
  id: string;
  name: string;
  
  // Movement
  speed: number;
  gravity: number;           // 0 for straight projectiles
  acceleration: number;      // Speeding up/slowing down
  
  // Hit properties
  damage: number;
  chipDamage: number;
  hitstun: number;
  knockback: Vector2;
  
  // Lifetime
  lifespan: number;          // Frames before auto-dissipate
  hitLimit: number;          // Max hits (1 for single-hit, 5 for multi-hit)
  
  // Collision
  hitbox: Rect;
  destroyOnHit: boolean;     // False for multi-hit projectiles
}
```

**Key Functions:**
```typescript
// Create projectile from fighter
function createProjectile(
  def: ProjectileDefinition,
  owner: FighterState,
  currentFrame: number
): ProjectileState

// Update all projectiles
function updateProjectiles(
  projectiles: ProjectileState[],
  currentFrame: number
): ProjectileState[]

// Check projectile hits on fighters
function checkProjectileHits(
  projectiles: ProjectileState[],
  fighters: FighterState[]
): { projectile: ProjectileState, fighter: FighterState }[]

// Apply projectile hit
function applyProjectileHit(
  projectile: ProjectileState,
  fighter: FighterState
): [ProjectileState, FighterState]
```

**Integration with GameState:**
```typescript
interface GameState {
  frame: number;
  entities: FighterState[];
  projectiles: ProjectileState[];  // NEW
  round: RoundState;
  match: MatchState;
  // ... rest unchanged
}
```

---

### Special Move Definitions (Update `MoveDefinition`)

**Enhanced Move Definition:**
```typescript
interface MoveDefinition {
  // ... existing fields ...
  
  // NEW: Special move properties
  isSpecial: boolean;
  motionInput?: MotionInput;     // Required motion (e.g., 236P)
  projectile?: ProjectileDefinition; // Spawns projectile
  invincible?: {                 // Invincibility frames
    start: number;
    duration: number;
  };
  
  // NEW: Cancel properties
  cancellableInto: string[];     // Move IDs this can cancel into
  cancellableFrames: {           // When canceling is allowed
    start: number;               // Frame cancel window opens
    end: number;                 // Frame cancel window closes
  };
  cancellableOnHit: boolean;
  cancellableOnBlock: boolean;
  cancellableOnWhiff: boolean;
  
  // NEW: Resource costs
  energyCost: number;            // Energy required
  superMeterCost: number;        // Super meter required
  superMeterGain: {              // Meter gained
    onHit: number;
    onBlock: number;
    onWhiff: number;
  };
}
```

---

### Musashi Special Moves

#### 1. Hadoken - "Spiritual Wave"
```typescript
const MUSASHI_HADOKEN: MoveDefinition = {
  id: 'hadoken',
  name: 'Spiritual Wave',
  
  // Input
  isSpecial: true,
  motionInput: {
    id: '236P',
    name: 'Quarter-Circle Forward + Punch',
    directions: [InputAction.DOWN, InputAction.DOWN | InputAction.RIGHT, InputAction.RIGHT],
    button: InputAction.LIGHT_PUNCH, // or HEAVY_PUNCH for EX version
    leniency: 10
  },
  
  // Frame data
  startup: 12,
  active: 0,        // Projectile is active, not fighter
  recovery: 18,
  totalFrames: 30,
  
  // Properties
  damage: 0,        // Projectile does damage
  chipDamage: 0,
  hitstun: 0,
  blockstun: 8,     // On block, push back
  knockback: { x: 0, y: 0 },
  
  // Projectile
  projectile: {
    id: 'hadoken_projectile',
    name: 'Spiritual Wave Projectile',
    speed: 8,       // Pixels per frame
    gravity: 0,
    acceleration: 0,
    damage: 15,
    chipDamage: 3,
    hitstun: 18,
    knockback: { x: 4, y: 0 },
    lifespan: 120,  // 2 seconds
    hitLimit: 1,
    hitbox: { x: 0, y: 0, width: 32, height: 32 },
    destroyOnHit: true
  },
  
  // Resources
  energyCost: 25,
  superMeterCost: 0,
  superMeterGain: {
    onHit: 10,
    onBlock: 5,
    onWhiff: 0
  },
  
  // Cancels
  cancellableInto: ['super_combo'],
  cancellableFrames: { start: 0, end: 0 }, // Not cancellable
  cancellableOnHit: false,
  cancellableOnBlock: false,
  cancellableOnWhiff: false,
  
  // State
  requiresGrounded: true,
  requiresAirborne: false,
  canCrossup: false,
  
  // Hitboxes (fighter hitbox during startup)
  hitboxFrames: new Map()
};
```

#### 2. Shoryuken - "Dragon Ascent"
```typescript
const MUSASHI_SHORYUKEN: MoveDefinition = {
  id: 'shoryuken',
  name: 'Dragon Ascent',
  
  // Input
  isSpecial: true,
  motionInput: {
    id: '623P',
    name: 'Dragon Punch + Punch',
    directions: [InputAction.RIGHT, InputAction.DOWN, InputAction.DOWN | InputAction.RIGHT],
    button: InputAction.HEAVY_PUNCH,
    leniency: 10
  },
  
  // Frame data
  startup: 3,       // VERY fast
  active: 8,
  recovery: 25,     // VERY punishable
  totalFrames: 36,
  
  // Properties
  damage: 35,       // High damage
  chipDamage: 0,    // Can't be blocked (throw)
  hitstun: 30,
  blockstun: 0,
  knockback: { x: 2, y: -12 }, // Launch upward
  
  // Invincibility
  invincible: {
    start: 1,
    duration: 8     // Fully invincible during active frames
  },
  
  // Hitboxes (large vertical hitbox)
  hitboxFrames: new Map([
    [3, [{ x: 10, y: -40, width: 40, height: 80 }]],
    [4, [{ x: 10, y: -60, width: 40, height: 100 }]],
    [5, [{ x: 10, y: -80, width: 40, height: 120 }]],
    [6, [{ x: 10, y: -80, width: 40, height: 120 }]],
    [7, [{ x: 10, y: -60, width: 40, height: 100 }]],
    [8, [{ x: 10, y: -40, width: 40, height: 80 }]]
  ]),
  
  // Resources
  energyCost: 50,
  superMeterCost: 0,
  superMeterGain: {
    onHit: 20,
    onBlock: 0,
    onWhiff: 0
  },
  
  // Cancels
  cancellableInto: ['super_combo'],
  cancellableFrames: { start: 8, end: 11 },
  cancellableOnHit: true,
  cancellableOnBlock: false,
  cancellableOnWhiff: false,
  
  // State
  requiresGrounded: true,
  requiresAirborne: false,
  canCrossup: false
};
```

#### 3. Super Combo - "Five Rings Barrage"
```typescript
const MUSASHI_SUPER: MoveDefinition = {
  id: 'super_combo',
  name: 'Five Rings Barrage',
  
  // Input
  isSpecial: true,
  motionInput: {
    id: '236236P',
    name: 'Double Quarter-Circle Forward + Punch',
    directions: [
      InputAction.DOWN,
      InputAction.DOWN | InputAction.RIGHT,
      InputAction.RIGHT,
      InputAction.DOWN,
      InputAction.DOWN | InputAction.RIGHT,
      InputAction.RIGHT
    ],
    button: InputAction.HEAVY_PUNCH,
    leniency: 15    // More lenient for super
  },
  
  // Frame data
  startup: 5,
  active: 60,      // Long cinematic attack
  recovery: 15,
  totalFrames: 80,
  
  // Properties
  damage: 80,      // MASSIVE damage (multi-hit internally)
  chipDamage: 20,
  hitstun: 60,
  blockstun: 40,
  knockback: { x: 8, y: -4 },
  
  // Invincibility
  invincible: {
    start: 1,
    duration: 20   // Invincible through most startup
  },
  
  // Resources
  energyCost: 0,
  superMeterCost: 100,  // Full meter
  superMeterGain: {
    onHit: 0,
    onBlock: 0,
    onWhiff: 0
  },
  
  // Cancels
  cancellableInto: [],
  cancellableFrames: { start: 0, end: 0 },
  cancellableOnHit: false,
  cancellableOnBlock: false,
  cancellableOnWhiff: false,
  
  // State
  requiresGrounded: true,
  requiresAirborne: false,
  canCrossup: false,
  
  // Hitboxes (covers whole screen)
  hitboxFrames: new Map([
    [5, [{ x: 0, y: -100, width: 200, height: 200 }]]
  ])
};
```

---

### Combo System Updates

**Enhanced FighterState:**
```typescript
interface FighterState {
  // ... existing fields ...
  
  // NEW: Combo tracking
  comboCount: number;           // Already exists
  comboScaling: number;         // Damage multiplier (starts at 1.0)
  comboStartFrame: number;      // When combo began
  
  // NEW: Cancel tracking
  cancelAvailable: boolean;     // Can cancel current move?
  lastCancelFrame: number;      // Frame of last cancel (prevent loops)
}
```

**Damage Scaling Formula:**
```typescript
function calculateComboScaling(comboCount: number): number {
  if (comboCount === 0) return 1.0;
  
  // First hit: 100%
  // Second hit: 90%
  // Third hit: 80%
  // Fourth+ hit: 70%
  const scaling = 1.0 - Math.min(comboCount - 1, 3) * 0.1;
  return Math.max(scaling, 0.5); // Minimum 50% scaling
}
```

**Hitstun Decay Formula:**
```typescript
function calculateHitstunDecay(baseHistun: number, comboCount: number): number {
  if (comboCount === 0) return baseHistun;
  
  // Hitstun decreases by 10% per hit in combo
  const decay = 1.0 - Math.min(comboCount - 1, 5) * 0.1;
  return Math.floor(baseHistun * Math.max(decay, 0.5));
}
```

**Cancel Logic:**
```typescript
function canCancel(
  fighter: FighterState,
  targetMoveId: string,
  currentFrame: number
): boolean {
  if (!fighter.currentMove) return false;
  
  const move = getMoveDefinition(fighter.characterId, fighter.currentMove);
  if (!move) return false;
  
  // Check if target move is in cancellable list
  if (!move.cancellableInto.includes(targetMoveId)) return false;
  
  // Check if within cancel window
  const moveFrame = fighter.moveFrame;
  if (moveFrame < move.cancellableFrames.start) return false;
  if (moveFrame > move.cancellableFrames.end) return false;
  
  // Check hit/block/whiff conditions
  if (fighter.status === 'attacking') {
    if (!move.cancellableOnWhiff) return false;
  }
  
  // Check resources for target move
  const targetMove = getMoveDefinition(fighter.characterId, targetMoveId);
  if (targetMove.energyCost > fighter.energy) return false;
  if (targetMove.superMeterCost > fighter.superMeter) return false;
  
  return true;
}
```

---

### Super Meter System

**Meter Gain Formula:**
```typescript
function calculateMeterGain(action: string, damage: number): number {
  const BASE_GAIN = {
    onHit: damage * 0.5,        // 50% of damage dealt
    onBlock: damage * 0.25,     // 25% of damage dealt
    onDamage: damage * 0.75,    // 75% of damage taken
    onWhiff: 0
  };
  
  return Math.floor(BASE_GAIN[action]);
}
```

**Meter Properties:**
```typescript
interface FighterState {
  // ... existing ...
  superMeter: number;           // Already exists
  maxSuperMeter: number;        // Already exists (default: 100)
  
  // NEW: Meter management
  meterBuildRate: number;       // Multiplier (1.0 = normal)
  canBuildMeter: boolean;       // Can gain meter?
}
```

---

## Implementation Steps

### Step 5.1: Input Buffer System
**Files to Create:**
- `/src/core/systems/InputBuffer.ts` - Buffer management + motion detection
- `/tests/core/InputBuffer.test.ts` - Unit tests

**Tests:**
1. Add inputs to buffer
2. Detect quarter-circle forward
3. Detect dragon punch motion
4. Detect double quarter-circle
5. Leniency window (10 frames)
6. Buffer overflow (keep last 60)

### Step 5.2: Projectile System
**Files to Create:**
- `/src/core/entities/Projectile.ts` - Projectile state + updates
- `/tests/core/Projectile.test.ts` - Unit tests

**Files to Modify:**
- `/src/core/interfaces/types.ts` - Add ProjectileState, ProjectileDefinition
- `/src/core/Game.ts` - Update tick() to handle projectiles

**Tests:**
1. Create projectile from fighter
2. Update projectile position
3. Projectile lifespan expiration
4. Projectile hit detection
5. Multi-hit projectiles

### Step 5.3: Special Move Integration
**Files to Modify:**
- `/src/core/data/musashi.ts` - Add Hadoken, Shoryuken, Super
- `/src/core/entities/Fighter.ts` - Check motion inputs, handle cancels
- `/src/core/Game.ts` - Integrate motion detection into tick()

**Tests:**
1. Detect motion input and execute special
2. Energy cost deduction
3. Projectile spawn from Hadoken
4. Invincibility frames on Shoryuken
5. Super meter requirement check

### Step 5.4: Combo System
**Files to Modify:**
- `/src/core/systems/Combat.ts` - Add damage scaling, hitstun decay
- `/src/core/entities/Fighter.ts` - Cancel window checking

**Tests:**
1. Combo counter increment
2. Damage scaling (90% → 80% → 70%)
3. Hitstun decay
4. Cancel from normal to special
5. Cancel from special to super
6. Cancel blocked if not in window

### Step 5.5: Super Meter
**Files to Modify:**
- `/src/core/systems/Combat.ts` - Meter gain on hit/block/damage
- `/src/core/entities/Fighter.ts` - Super meter cost check

**Tests:**
1. Meter gain on hit
2. Meter gain on block
3. Meter gain on taking damage
4. Meter cap at 100
5. Super cost deduction
6. Can't use super without meter

### Step 5.6: Phaser Integration
**Files to Modify:**
- `/src/phaser/FighterSprite.ts` - Render projectiles
- `/src/scenes/PhaserGameScene.ts` - Display super meter, combo counter
- `/src/scenes/UIScene.ts` - Super meter UI

**Visual Updates:**
1. Super meter bar under health
2. Combo counter (large text on successful combo)
3. Projectile sprites (placeholder circles for now)
4. Screen flash on super activation

---

## Testing Plan

### Unit Tests
- `InputBuffer.test.ts` - 8 tests
- `Projectile.test.ts` - 6 tests
- `SpecialMoves.test.ts` - 10 tests
- `Combo.test.ts` - 8 tests
- `SuperMeter.test.ts` - 6 tests

**Target: 38 new tests (131 total)**

### Integration Tests
1. Full combo: Light Punch → Heavy Punch → Hadoken → Super
2. Shoryuken anti-air catches jump attack
3. Projectile vs projectile collision
4. Blocked special builds meter
5. Super on round-winning hit

### Manual Testing
1. Practice motion inputs (feel, leniency)
2. Combo timing (cancel windows)
3. Damage scaling visual feedback
4. Super meter gain rates
5. Projectile behavior (speed, lifespan)

---

## Asset Requirements

### Animations (Musashi)
- [ ] Hadoken startup (6-8 frames)
- [ ] Hadoken projectile (4-frame loop)
- [ ] Hadoken impact effect
- [ ] Shoryuken (10-12 frames)
- [ ] Super combo startup (8 frames)
- [ ] Super combo active (12-15 frames)
- [ ] Super flash effect

### UI Elements
- [ ] Super meter frame
- [ ] Super meter fill gradient
- [ ] Combo counter font/graphic
- [ ] "SUPER!" announcement text
- [ ] Motion input display (for training mode)

### Audio (Future Phase 6+)
- [ ] Hadoken whoosh sound
- [ ] Hadoken impact sound
- [ ] Shoryuken launch sound
- [ ] Super activation sound
- [ ] Announcer: "SUPER COMBO!"

---

## Success Criteria

Phase 5 complete when:
1. ✅ Input buffer detects motion inputs (236, 623, 236236)
2. ✅ Hadoken spawns projectile that travels and hits
3. ✅ Shoryuken has invincibility and anti-airs
4. ✅ Super combo costs meter and deals big damage
5. ✅ Combos scale damage properly
6. ✅ Normals cancel into specials, specials cancel into super
7. ✅ Super meter builds on hit/block/damage
8. ✅ 38 new tests passing (131 total)
9. ✅ Phaser displays combo counter and super meter

---

## Future Enhancements (Phase 6+)

- **EX Moves:** Spend 25 meter for enhanced specials
- **Counter Supers:** Parry into super
- **Custom Combos:** Free-form cancel system
- **Projectile Clashing:** Fireballs collide and cancel out
- **Chip Kill:** Chip damage can win rounds
- **Guard Crush:** Blocking too much breaks guard
- **V-Trigger System:** Comeback mechanic

---

## Timeline

| Day | Task | Hours |
|-----|------|-------|
| 1 | Input Buffer + Tests | 3-4h |
| 2 | Projectile System + Tests | 3-4h |
| 3 | Special Move Integration + Tests | 4-5h |
| 4 | Combo System + Tests | 3-4h |
| 5 | Super Meter + Tests | 2-3h |
| 6 | Phaser Integration (visuals) | 3-4h |
| 7 | Manual Testing + Polish | 2-3h |

**Total: ~20-25 hours**

---

Ready to begin Phase 5 implementation! 🥋⚡
