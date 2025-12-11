# Phase 3: AI Foundation

## Goal
Create the infrastructure for AI-controlled fighters. Build observation/action interfaces, implement basic bots (random + personality-based), and add replay recording for future training data collection.

## Architecture Overview

```
GameState → Observation (normalized state)
              ↓
         AI Agent (bot logic)
              ↓
         Action → InputFrame
              ↓
         tick() → New GameState
```

## Implementation Steps

### Step 1: Observation System
**File:** `src/core/ai/Observation.ts`

Convert GameState into normalized observation for AI:

```typescript
export interface Observation {
  // Self state (normalized 0-1)
  selfX: number;           // Position normalized to arena
  selfY: number;
  selfHealth: number;      // 0-1
  selfEnergy: number;      // 0-1
  selfSuperMeter: number;  // 0-1
  selfIsGrounded: boolean;
  selfFacing: number;      // -1 or 1
  selfStatus: number;      // Encoded status enum
  selfMoveFrame: number;   // 0-1 normalized
  selfStunFrames: number;  // 0-1 normalized
  
  // Opponent state (relative)
  opponentRelativeX: number;  // -1 to 1
  opponentRelativeY: number;  // -1 to 1
  opponentHealth: number;
  opponentEnergy: number;
  opponentSuperMeter: number;
  opponentIsGrounded: boolean;
  opponentStatus: number;
  opponentMoveFrame: number;
  opponentStunFrames: number;
  
  // Game state
  roundTime: number;       // 0-1 normalized
  distanceToOpponent: number; // 0-1 normalized
  
  // Total: ~25 floats
}

export function generateObservation(
  state: GameState,
  entityId: string
): Observation {
  const self = state.entities.find(e => e.id === entityId);
  const opponent = state.entities.find(e => e.id !== entityId);
  // ... normalize and return
}
```

### Step 2: Action Space
**File:** `src/core/ai/ActionSpace.ts`

Define discrete actions AI can take:

```typescript
export enum AIAction {
  IDLE = 0,
  WALK_FORWARD = 1,
  WALK_BACKWARD = 2,
  JUMP = 3,
  CROUCH = 4,
  LIGHT_PUNCH = 5,
  HEAVY_PUNCH = 6,
  LIGHT_KICK = 7,
  HEAVY_KICK = 8,
  BLOCK = 9,
  JUMP_FORWARD = 10,
  JUMP_BACKWARD = 11,
}

export function actionToInputFrame(
  action: AIAction,
  facing: number,
  timestamp: number
): InputFrame {
  const actions = new Set<InputAction>();
  
  switch (action) {
    case AIAction.WALK_FORWARD:
      actions.add(facing === 1 ? InputAction.RIGHT : InputAction.LEFT);
      break;
    case AIAction.WALK_BACKWARD:
      actions.add(facing === 1 ? InputAction.LEFT : InputAction.RIGHT);
      break;
    // ... etc
  }
  
  return { actions, timestamp };
}
```

### Step 3: Random Bot
**File:** `src/core/ai/RandomBot.ts`

Simplest bot - random actions with basic constraints:

```typescript
export class RandomBot {
  private lastActionFrame: number = 0;
  private actionCooldown: number = 10; // Min frames between actions
  
  selectAction(observation: Observation, currentFrame: number): AIAction {
    // Don't act if in hitstun/blockstun
    if (observation.selfStunFrames > 0) {
      return AIAction.IDLE;
    }
    
    // Cooldown check
    if (currentFrame - this.lastActionFrame < this.actionCooldown) {
      return AIAction.IDLE;
    }
    
    // Random action
    const actions = [
      AIAction.IDLE,
      AIAction.WALK_FORWARD,
      AIAction.WALK_BACKWARD,
      AIAction.JUMP,
      AIAction.LIGHT_PUNCH,
      AIAction.HEAVY_PUNCH,
      AIAction.LIGHT_KICK,
      AIAction.HEAVY_KICK,
      AIAction.BLOCK,
    ];
    
    const action = actions[Math.floor(Math.random() * actions.length)];
    this.lastActionFrame = currentFrame;
    return action;
  }
}
```

### Step 4: Personality Bot
**File:** `src/core/ai/PersonalityBot.ts`

Bot that uses AIPersonality to make decisions:

```typescript
export class PersonalityBot {
  constructor(private personality: AIPersonality) {}
  
  selectAction(observation: Observation, currentFrame: number): AIAction {
    // Can't act if stunned
    if (observation.selfStunFrames > 0) {
      return AIAction.IDLE;
    }
    
    const distance = Math.abs(observation.distanceToOpponent);
    const healthRatio = observation.selfHealth;
    
    // Decide action based on personality
    
    // If far away and aggressive, move forward
    if (distance > 0.3 && Math.random() < this.personality.aggression) {
      return AIAction.WALK_FORWARD;
    }
    
    // If close and defensive, block or retreat
    if (distance < 0.2 && Math.random() < this.personality.defensiveness) {
      return Math.random() < 0.5 ? AIAction.BLOCK : AIAction.WALK_BACKWARD;
    }
    
    // If low health and risk-averse, play safer
    if (healthRatio < 0.3 && Math.random() < this.personality.riskAversion) {
      return AIAction.BLOCK;
    }
    
    // Attack at preferred range
    if (distance < 0.25 && Math.random() < this.personality.aggression) {
      // Choose attack based on move preference
      const moves = [AIAction.LIGHT_PUNCH, AIAction.HEAVY_PUNCH, 
                     AIAction.LIGHT_KICK, AIAction.HEAVY_KICK];
      return moves[Math.floor(Math.random() * moves.length)];
    }
    
    // Technical fighters jump more
    if (Math.random() < this.personality.technicalSkill * 0.1) {
      return AIAction.JUMP;
    }
    
    return AIAction.IDLE;
  }
}
```

### Step 5: Replay Recording
**File:** `src/core/ai/ReplayRecorder.ts`

Record matches for training data:

```typescript
export interface ReplayFrame {
  frame: number;
  observation: Observation;
  action: AIAction;
  reward: number;        // Score change this frame
  nextObservation: Observation;
  done: boolean;         // Round/match ended
}

export interface Replay {
  metadata: {
    timestamp: Date;
    matchWinner: string | null;
    totalFrames: number;
    player1Character: string;
    player2Character: string;
  };
  frames: ReplayFrame[];
}

export class ReplayRecorder {
  private frames: ReplayFrame[] = [];
  private previousScore: Map<string, number> = new Map();
  
  recordFrame(
    state: GameState,
    entityId: string,
    action: AIAction
  ): void {
    const observation = generateObservation(state, entityId);
    const fighter = state.entities.find(e => e.id === entityId);
    
    // Calculate reward (health delta + combo bonus)
    const currentScore = fighter ? fighter.health + fighter.comboCount * 5 : 0;
    const previousScore = this.previousScore.get(entityId) || 0;
    const reward = currentScore - previousScore;
    
    this.frames.push({
      frame: state.frame,
      observation,
      action,
      reward,
      nextObservation: observation, // Will be updated next frame
      done: state.isRoundOver || state.isMatchOver,
    });
    
    this.previousScore.set(entityId, currentScore);
  }
  
  exportReplay(state: GameState): Replay {
    const player1 = state.entities[0];
    const player2 = state.entities[1];
    
    return {
      metadata: {
        timestamp: new Date(),
        matchWinner: state.match.matchWinner,
        totalFrames: state.frame,
        player1Character: player1.characterId,
        player2Character: player2.characterId,
      },
      frames: this.frames,
    };
  }
  
  saveToFile(replay: Replay, filename: string): void {
    // JSON export for training
    const json = JSON.stringify(replay, null, 2);
    // In browser: trigger download
    // In Node: fs.writeFileSync
  }
}
```

### Step 6: Integration with PhaserGameScene
Update scene to use AI for Player 2:

```typescript
export default class PhaserGameScene extends Scene {
  private aiBot!: PersonalityBot;
  private replayRecorder?: ReplayRecorder;
  
  create(): void {
    // ... existing setup
    
    // Create AI bot with personality
    const personality: AIPersonality = {
      aggression: 0.7,
      defensiveness: 0.3,
      technicalSkill: 0.5,
      riskAversion: 0.4,
      adaptability: 0.6,
      reactionTime: 0.8,
      movePreferences: new Map([
        ['light_punch', 0.4],
        ['heavy_punch', 0.2],
        ['light_kick', 0.3],
        ['heavy_kick', 0.1],
      ]),
      antiAirProbability: 0.3,
      throwAttemptDistance: 0.15,
    };
    
    this.aiBot = new PersonalityBot(personality);
    
    // Optional: enable replay recording
    if (ENABLE_REPLAY_RECORDING) {
      this.replayRecorder = new ReplayRecorder();
    }
  }
  
  update(time: number, delta: number): void {
    // ... capture player 1 input
    
    // AI selects action for player 2
    const observation = generateObservation(this.gameState, 'player2');
    const aiAction = this.aiBot.selectAction(observation, this.gameState.frame);
    const player2Input = actionToInputFrame(
      aiAction,
      this.gameState.entities[1].facing,
      this.gameState.frame
    );
    
    // Record frame if recording
    if (this.replayRecorder) {
      this.replayRecorder.recordFrame(this.gameState, 'player2', aiAction);
    }
    
    // Tick core engine
    this.gameState = tick(this.gameState, inputs, this.characterDefs);
    
    // ... render
  }
}
```

## Testing Strategy

### Unit Tests
1. **Observation generation** - Verify normalization (0-1 ranges)
2. **Action space** - Test all actions convert to correct InputFrames
3. **Random bot** - Verify cooldowns and constraints
4. **Personality bot** - Test personality parameters affect decisions
5. **Replay recording** - Verify frame capture and export

### Integration Tests
1. AI vs AI match runs without errors
2. Replay file exports valid JSON
3. Bot respects game rules (can't act in hitstun)
4. Personality differences produce different playstyles

### Manual Testing
1. Play against random bot (should be very beatable)
2. Play against aggressive personality (attacks frequently)
3. Play against defensive personality (blocks more, retreats)
4. Verify bot difficulty feels appropriate

## Success Criteria

- [ ] Observation generates 25 normalized values from GameState
- [ ] Action space covers all basic moves
- [ ] Random bot provides basic opposition
- [ ] Personality bot shows distinct behaviors
- [ ] Replay recording captures full matches
- [ ] Player 2 AI fights autonomously
- [ ] Bot respects game constraints
- [ ] Different personalities feel different
- [ ] Foundation ready for TensorFlow.js in Phase 4

## Timeline
- Observation/Action space: 1 hour
- Random bot: 30 min
- Personality bot: 1.5 hours
- Replay recording: 1 hour
- Integration + testing: 1 hour
- **Total: ~5 hours**

Let's build the AI foundation!
