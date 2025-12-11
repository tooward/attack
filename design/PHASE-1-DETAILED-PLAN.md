# Phase 1 Detailed Implementation Plan: Core Engine

**Goal:** Build a pure TypeScript, headless fighting game engine. It must be deterministic, testable, and capable of running thousands of frames per second for future AI training.

**Output:** A `core/` module that can simulate a fight between two entities without any graphics.

---

## 1. Project Structure & Setup

**Objective:** Establish the workspace for the core engine, ensuring strict separation from Phaser.

- [ ] **Folder Structure Creation**
  - Create `src/core/`
  - Create `src/core/interfaces/` (Types)
  - Create `src/core/systems/` (Physics, Combat, Input)
  - Create `src/core/entities/` (Fighter, State)
  - Create `src/core/data/` (Move definitions, Character stats)
  - Create `tests/core/` (Mirror structure for tests)

- [ ] **Tooling Configuration**
  - Install `jest`, `ts-jest`, `@types/jest`.
  - Configure `jest.config.js` to map `@core/*` paths.
  - Create a `tsconfig.core.json` (optional but good practice) to ensure `core` doesn't import `phaser`.

- [ ] **Type Definitions (`src/core/interfaces/types.ts`)**
  - Define `Vector2` { x, y }.
  - Define `Rect` { x, y, w, h }.
  - Define `InputFrame` (map of buttons pressed).
  - Define `FighterState` (position, velocity, health, action state).
  - Define `GameState` (frame count, entities array, arena bounds).

---

## 2. The Game Loop & State Management

**Objective:** Create the heartbeat of the engine. It takes a state + inputs and returns a NEW state (immutability).

- [ ] **Game State Interface**
  - Define the "Source of Truth" object structure.
  - Ensure it contains *everything* needed to render a frame (no hidden state).

- [ ] **The Tick Function (`src/core/Game.ts`)**
  - Implement `tick(currentState: GameState, inputs: Map<string, InputFrame>): GameState`.
  - **Pipeline:**
    1.  **Input Processing:** Parse raw inputs into intents (e.g., "down" + "forward" + "punch" = "hadouken").
    2.  **State Update:** Update timers, cooldowns, energy.
    3.  **Physics Step:** Apply gravity, velocity, friction.
    4.  **Collision Step:** Resolve wall/ground/entity collisions.
    5.  **Combat Step:** Check hitboxes vs hurtboxes.
    6.  **Resolution:** Apply damage, hitstun, knockback.
  - **Test:** Write a test that runs `tick` 60 times and asserts the frame count increases.

---

## 3. Physics System (Deterministic)

**Objective:** Implement "Fighting Game Physics" (not real-world physics).

- [ ] **Movement Logic (`src/core/systems/Physics.ts`)**
  - `applyGravity(entity)`: Constant downward force if `!isGrounded`.
  - `applyFriction(entity)`: Decelerate x-velocity when on ground and not moving.
  - `move(entity, direction)`: Set target velocity based on walk speed.

- [ ] **Collision Resolution**
  - `keepInBounds(entity, arena)`: Clamp X position.
  - `resolveGround(entity, groundY)`: If y > groundY, set y = groundY, vy = 0, isGrounded = true.
  - `pushBox(entityA, entityB)`: If players overlap, push them apart (essential for spacing).

- [ ] **Testing**
  - Test: Gravity accelerates a falling object.
  - Test: Player stops when hitting the ground.
  - Test: Players cannot walk through each other.

---

## 4. Fighter State Machine

**Objective:** Manage what a character is doing (Idle, Walk, Attack, Stun).

- [ ] **State Definitions**
  - Enum: `IDLE`, `WALK`, `JUMP`, `CROUCH`, `ATTACK`, `BLOCK`, `HITSTUN`, `WAKEUP`.

- [ ] **State Transitions (`src/core/entities/Fighter.ts`)**
  - Implement `updateFighterState(fighter, input)`
  - Logic:
    - If `IDLE` and input `RIGHT` -> `WALK`.
    - If `WALK` and input `UP` -> `JUMP`.
    - If `ATTACK` -> Wait for animation frames to end -> `IDLE`.
    - If `HITSTUN` -> Wait for stun frames -> `IDLE`.

- [ ] **Move Execution**
  - Define a simple move (e.g., "Jab": 5 frame startup, 3 active, 10 recovery).
  - When `ATTACK` starts, set `currentMove` and `moveFrame = 0`.
  - Increment `moveFrame` each tick.

---

## 5. Combat System (Hitboxes)

**Objective:** The core "game" part.

- [ ] **Hitbox/Hurtbox Definitions**
  - Define `Hurtbox` (where I can be hit).
  - Define `Hitbox` (where I hit you).
  - These should be relative to the character's position and facing direction.

- [ ] **Collision Check (`src/core/systems/Combat.ts`)**
  - `checkHits(entities)`: Loop through all entities.
  - If Entity A's *active* Hitbox overlaps Entity B's Hurtbox:
    - Register Hit.
    - Apply Damage.
    - Apply Hitstun (put Entity B in `HITSTUN` state).
    - Apply Knockback (set Entity B velocity).

- [ ] **Testing**
  - Test: Jab connects when in range.
  - Test: Jab misses when out of range.
  - Test: Being hit transitions state to `HITSTUN`.

---

## 6. Input Buffer (The "Feel")

**Objective:** Make controls responsive and support special moves.

- [ ] **Input Buffer Queue**
  - Store the last ~60 frames of inputs for each player.

- [ ] **Motion Detection (Simple)**
  - Detect "Hadouken" (Down -> DownForward -> Forward + Punch).
  - *Note for Phase 1:* Start with simple button presses, add complex motions in Phase 5.

---

## 7. AI Readiness Check

**Objective:** Ensure the engine is ready for ML.

- [ ] **Observation Function**
  - Create `getObservation(gameState, playerId)` that returns a normalized array of numbers (e.g., `[myHealth/100, enemyDist/1000, ...]`).
  - This is what the Neural Network will "see".

- [ ] **Action Masking**
  - Create `getValidActions(gameState, playerId)` that returns which buttons actually do something (optional, but helps training).

---

## 8. Integration Test (The "Headless Match")

- [ ] **Simulate a Match**
  - Write a script that:
    1. Initializes a game.
    2. Simulates 600 frames (10 seconds).
    3. Player 1 walks forward and punches.
    4. Player 2 stands still.
    5. Assert Player 2 took damage and moved back.
  - This proves the engine works before we write a single line of Phaser code.
