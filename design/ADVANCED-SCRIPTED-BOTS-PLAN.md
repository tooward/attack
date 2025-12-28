# Advanced Scripted Bots - Implementation Plan

## Vision

Replace trivial scripted opponents with sophisticated, human-like bots that provide genuine challenge for ML training and serve as competitive AI opponents in PvP mode until ML models are production-ready.

---

## Problems with Current Bots

### Current "Tight" Opponent
```typescript
// Close range: LP → LK → HP → HK → repeat (every 16 frames)
if (closePhase < 4) return { button: 'lp' };
if (closePhase < 7) return { button: 'lk' };
if (closePhase < 10) return { button: 'hp' };
if (closePhase < 12) return { button: 'hk' };
```

**Issues:**
- ❌ **Frame-based patterns** - completely predictable timing
- ❌ **No blocking** - never defends, pure offense
- ❌ **No combos** - doesn't cancel normals into specials
- ❌ **No anti-air** - vulnerable to jump-ins
- ❌ **No punishing** - doesn't capitalize on opponent's unsafe moves
- ❌ **No spacing** - ignores footsies and range control
- ❌ **Result:** 100% win rate for trained policy, no learning pressure

### Current "Easy" Opponent
```typescript
// Close range: mostly idle, occasional block, rare LP
if (phase < 6) return { button: 'block' };
if (phase === 10) return { button: 'lp' };
return { button: 'none' };
```

**Issues:**
- ❌ **Punching bag** - barely fights back
- ❌ **No value** for training past early bootstrap
- ❌ **Result:** Training stagnates after 10k steps

---

## Design Philosophy

### Core Principles

1. **Human-Like Decision Making**
   - React to **game state**, not frame counters
   - Use **probabilistic actions** with context-aware weights
   - Make **tactical mistakes** at appropriate rates
   - Show **strategic adaptation** within matches

2. **Modular Architecture**
   - **Behavior trees** for high-level decision making
   - **Tactics library** for reusable combat patterns
   - **Style overlays** that modify decision weights
   - **Difficulty knobs** that control reaction time and accuracy

3. **Testing & Validation**
   - **Unit tests** for individual tactics (e.g., "anti-air activates on jump")
   - **Integration tests** for full bot behavior (e.g., "zoner maintains distance")
   - **Statistical tests** for style consistency (e.g., "defensive blocks 60% of attacks")
   - **Win rate calibration** against known benchmarks

4. **Alignment with Roadmap**
   - **PvP Track:** Bots serve as opponents in single-player mode
   - **ML Track:** Bots provide curriculum training stages
   - **Long-term:** Bots become "boss fights" after ML surpasses them

---

## Bot Roster

### 1. **Guardian** (Defensive)
**Style:** Turtle / Counter-puncher  
**Difficulty Range:** 3-7 (Medium to Hard)

**Behavior:**
- **Blocks 60-70%** of incoming attacks
- **Punishes unsafe moves** (detects recovery frames)
- **Anti-airs jumps** with 70% success rate
- **Cautious offense** - only attacks when safe
- **Optimal spacing** - maintains +2 advantage range

**Decision Tree:**
```
Is opponent in recovery? → Yes → Punish with optimal combo
↓ No
Is opponent jumping? → Yes → Anti-air (70% accuracy)
↓ No
Is opponent attacking? → Yes → Block (60-70% chance)
↓ No
Am I at advantage? → Yes → Safe pressure (LP/LK strings)
↓ No
→ Maintain spacing, wait for opportunity
```

**Implementation Tactics:**
- `detectRecoveryState()` - Track opponent frame data
- `calculatePunishDamage()` - Choose optimal punish combo
- `antiAirReaction()` - React to jump startup (4-6 frame delay)
- `blockProbability()` - Weight based on opponent move safety
- `maintainSpacing()` - Walk/dash to optimal range

**Testing:**
- [ ] Blocks 60-70% of LP strings in 100-trial test
- [ ] Anti-airs 70% of jumps (±5% variance)
- [ ] Punishes unsafe moves (recovery > 15f) 90% of time
- [ ] Never performs unsafe moves at -3 or worse
- [ ] Win rate vs random bot: 85-95%

---

### 2. **Aggressor** (Rushdown)
**Style:** Rushdown / Pressure  
**Difficulty Range:** 4-8 (Medium-Hard to Very Hard)

**Behavior:**
- **Constant pressure** - frame traps and tick throws
- **Mix-up heavy** - randomizes high/low/throw
- **Combo chains** - cancels normals into specials
- **Reads patterns** - tracks opponent's defensive habits
- **Risk-taking** - uses unsafe moves for momentum

**Decision Tree:**
```
Is opponent in blockstun? → Yes → Frame trap (60%) or throw (40%)
↓ No
Am I close range? → Yes → Mix-up attack sequence
↓ No
Am I mid range? → Yes → Approach with dash/jump
↓ No
→ Close distance aggressively
```

**Implementation Tactics:**
- `frameTrapSequence()` - Chain attacks with small gaps
- `throwMixup()` - Alternate throw attempts with lows
- `comboOptimizer()` - Cancel LP→LK→Special
- `patternTracker()` - Record opponent's last 10 defensive choices
- `riskAssessment()` - Use unsafe moves when ahead

**Testing:**
- [ ] Performs frame traps 60% of opportunities
- [ ] Throws 30-40% when in throw range
- [ ] Completes LP→LK→Special combo 80% of time
- [ ] Adapts after opponent blocks 3 throws (uses more lows)
- [ ] Win rate vs blocking dummy: 95%+
- [ ] Win rate vs Guardian: 40-60% (skill-dependent)

---

### 3. **Tactician** (Zoner)
**Style:** Zoner / Keep-away  
**Difficulty Range:** 5-9 (Hard to Expert)

**Behavior:**
- **Maintains distance** - always stays at projectile range
- **Projectile spam** - Hadoken patterns with safe timing
- **Whiff punishes** - baits attacks and counters
- **Anti-approach** - counters dashes and jumps
- **Space control** - forces opponent to take risks

**Decision Tree:**
```
Is opponent > 200px away? → Yes → Fireball (80% chance)
↓ No
Is opponent approaching (dash/jump)? → Yes → Anti-approach move
↓ No
Is opponent whiffing? → Yes → Whiff punish combo
↓ No
Am I cornered? → Yes → Escape pressure (backdash/jump)
↓ No
→ Back away, reset to zoning range
```

**Implementation Tactics:**
- `projectilePattern()` - Fire Hadoken with varied timing
- `antiApproachTool()` - Shoryuken for dashes, anti-air for jumps
- `whiffDetector()` - Track opponent hitbox activity
- `cornerEscape()` - Execute escape sequence under pressure
- `spaceResetTactic()` - Move to optimal zoning range

**Testing:**
- [ ] Maintains 200-300px distance 70% of match
- [ ] Fires projectiles 3-5 times per 10 seconds
- [ ] Anti-airs jump approaches 60% of time
- [ ] Whiff punishes 50% of obvious whiffs
- [ ] Win rate vs Aggressor: 45-55% (style matchup)
- [ ] Win rate vs Guardian: 40-60%

---

### 4. **Wildcard** (Mixup)
**Style:** Unpredictable / Adaptive  
**Difficulty Range:** 6-10 (Very Hard to Elite)

**Behavior:**
- **No pattern** - randomizes tactics every few seconds
- **Style switching** - alternates between rush/zone/defense
- **Reads opponent style** - detects patterns and exploits them
- **High execution** - uses optimal combos and specials
- **Mind games** - baits reactions and punishes predictability

**Decision Tree:**
```
Every 5-10 seconds → Switch active style (random or counter-pick)
↓
If opponent is defensive (blocks >50%) → Activate Aggressor mode
If opponent is offensive (attacks >60%) → Activate Guardian mode
If opponent is predictable → Exploit pattern
↓
Execute tactics from active style
```

**Implementation Tactics:**
- `styleSelector()` - Randomly switch or counter-pick opponent style
- `patternAnalyzer()` - Detect opponent's behavioral tendencies
- `exploitPattern()` - Punish repetitive actions (e.g., always blocks low)
- `executionEngine()` - Perform frame-perfect combos
- `baitTactic()` - Whiff moves to induce reactions

**Testing:**
- [ ] Changes style at least 3 times per 60-second match
- [ ] Detects opponent always blocking low (tries throws/overheads)
- [ ] Detects opponent always neutral jumping (stays grounded)
- [ ] Performs optimal combos 70% of opportunities
- [ ] Win rate vs all other bots: 55-70% (adaptation advantage)
- [ ] No single tactic used >40% of the time (unpredictability)

---

### 5. **Tutorial Bot** (Beginner-Friendly)
**Style:** Passive / Punching Bag with Reactions  
**Difficulty Range:** 1-2 (Tutorial to Easy)

**Behavior:**
- **Mostly passive** - walks slowly, blocks occasionally
- **Telegraphed attacks** - slow, obvious moves
- **Never combos** - single attacks only
- **Reacts to player** - blocks if player spams, attacks if player idles
- **Teaches fundamentals** - rewards anti-airs, punishes, spacing

**Decision Tree:**
```
Has player been idle >3 seconds? → Yes → Slow attack
↓ No
Is player jumping? → Yes → Stand still (teachable moment)
↓ No
Is player spamming attacks? → Yes → Block occasionally
↓ No
→ Walk slowly forward, rare LP
```

**Implementation Tactics:**
- `teachingMode()` - Adjust difficulty based on player performance
- `rewardGoodPlay()` - Take more damage from punishes/anti-airs
- `slowReactions()` - Artificial 15-20 frame delay
- `obviousTelegraph()` - Always use slowest moves (HP/HK)

**Testing:**
- [ ] Attacks <2 times per 10 seconds
- [ ] Never anti-airs (allows player jump practice)
- [ ] Blocks player spam after 3+ consecutive attacks
- [ ] Win rate vs random inputs: 20-40%
- [ ] Player feedback: "Good for learning basics"

---

## Architecture

### File Structure

```
src/
├── ai/
│   ├── scripted/
│   │   ├── AdvancedScriptedBot.ts        // Base class
│   │   ├── bots/
│   │   │   ├── GuardianBot.ts            // Defensive bot
│   │   │   ├── AggressorBot.ts           // Rushdown bot
│   │   │   ├── TacticianBot.ts           // Zoner bot
│   │   │   ├── WildcardBot.ts            // Mixup bot
│   │   │   └── TutorialBot.ts            // Beginner bot
│   │   ├── tactics/
│   │   │   ├── DefensiveTactics.ts       // Blocking, anti-air, punishing
│   │   │   ├── OffensiveTactics.ts       // Frame traps, combos, pressure
│   │   │   ├── SpacingTactics.ts         // Zoning, footsies, positioning
│   │   │   ├── PatternRecognition.ts     // Track opponent behavior
│   │   │   └── ComboCatalog.ts           // Optimal combo sequences
│   │   ├── systems/
│   │   │   ├── DecisionTree.ts           // Behavior tree executor
│   │   │   ├── FrameDataAnalyzer.ts      // Track frame advantage
│   │   │   ├── DifficultyModulator.ts    // Adjust reaction time/accuracy
│   │   │   └── StyleOverlay.ts           // Modify decision weights
│   │   └── utils/
│   │       ├── StateReader.ts            // Extract game state info
│   │       ├── ActionExecutor.ts         // Convert decisions to inputs
│   │       └── PerformanceMetrics.ts     // Track bot statistics
│   └── interfaces/
│       ├── BotInterface.ts               // Contract all bots implement
│       └── TacticInterface.ts            // Contract for tactics
└── tests/
    ├── ai/
    │   ├── bots/
    │   │   ├── GuardianBot.test.ts
    │   │   ├── AggressorBot.test.ts
    │   │   ├── TacticianBot.test.ts
    │   │   ├── WildcardBot.test.ts
    │   │   └── TutorialBot.test.ts
    │   ├── tactics/
    │   │   ├── DefensiveTactics.test.ts
    │   │   ├── OffensiveTactics.test.ts
    │   │   └── SpacingTactics.test.ts
    │   └── integration/
    │       ├── BotVsBot.test.ts          // Bot vs bot matchups
    │       ├── StyleConsistency.test.ts  // Statistical style tests
    │       └── WinRateCalibration.test.ts // Difficulty validation
```

---

### Base Class: `AdvancedScriptedBot`

**File:** `src/ai/scripted/AdvancedScriptedBot.ts`

```typescript
import { ActionBundle } from '../../core/interfaces/types';
import { StateReader } from './utils/StateReader';
import { ActionExecutor } from './utils/ActionExecutor';
import { FrameDataAnalyzer } from './systems/FrameDataAnalyzer';
import { DifficultyModulator } from './systems/DifficultyModulator';

export interface BotConfig {
  name: string;
  style: 'defensive' | 'rushdown' | 'zoner' | 'mixup' | 'tutorial';
  difficulty: number; // 1-10
  reactionTimeFrames: number; // Artificial delay
  executionAccuracy: number; // 0.0-1.0
  blockProbability: number; // 0.0-1.0
  antiAirAccuracy: number; // 0.0-1.0
}

export abstract class AdvancedScriptedBot {
  protected config: BotConfig;
  protected stateReader: StateReader;
  protected actionExecutor: ActionExecutor;
  protected frameAnalyzer: FrameDataAnalyzer;
  protected difficultyModulator: DifficultyModulator;
  
  // Internal state
  protected reactionBuffer: ActionBundle[] = [];
  protected lastOpponentAction: string = '';
  protected opponentPatternHistory: string[] = [];
  protected framesUntilAction: number = 0;
  
  constructor(config: BotConfig) {
    this.config = config;
    this.stateReader = new StateReader();
    this.actionExecutor = new ActionExecutor();
    this.frameAnalyzer = new FrameDataAnalyzer();
    this.difficultyModulator = new DifficultyModulator(config.difficulty);
  }
  
  /**
   * Main decision method called every frame
   * Implements reaction delay and decision tree
   */
  public decide(state: any, actorId: string, targetId: string): ActionBundle {
    // Update internal state
    this.updateState(state, actorId, targetId);
    
    // Check if we're still in reaction delay
    if (this.framesUntilAction > 0) {
      this.framesUntilAction--;
      return this.reactionBuffer[0] || { direction: 'neutral', button: 'none', holdDuration: 0 };
    }
    
    // Make new decision
    const decision = this.makeDecision(state, actorId, targetId);
    
    // Apply difficulty modulation (reaction delay, execution errors)
    const modulatedDecision = this.difficultyModulator.applyModulation(
      decision,
      this.config.reactionTimeFrames,
      this.config.executionAccuracy
    );
    
    // Set reaction delay for next decision
    this.framesUntilAction = this.config.reactionTimeFrames;
    this.reactionBuffer = [modulatedDecision];
    
    return modulatedDecision;
  }
  
  /**
   * Update internal state (track patterns, analyze frames)
   */
  protected updateState(state: any, actorId: string, targetId: string): void {
    const opponent = this.stateReader.getEntity(state, targetId);
    
    // Track opponent's current action
    if (opponent.currentMove !== this.lastOpponentAction) {
      this.opponentPatternHistory.push(opponent.currentMove);
      this.lastOpponentAction = opponent.currentMove;
      
      // Keep only last 20 actions
      if (this.opponentPatternHistory.length > 20) {
        this.opponentPatternHistory.shift();
      }
    }
    
    // Update frame advantage analysis
    this.frameAnalyzer.update(state, actorId, targetId);
  }
  
  /**
   * Core decision logic (implemented by subclasses)
   */
  protected abstract makeDecision(state: any, actorId: string, targetId: string): ActionBundle;
  
  /**
   * Detect if opponent has a pattern
   */
  protected detectPattern(sequence: string[]): string | null {
    if (this.opponentPatternHistory.length < 6) return null;
    
    const recent = this.opponentPatternHistory.slice(-6);
    
    // Check for repeating patterns
    for (const pattern of sequence) {
      if (recent.filter(a => a === pattern).length >= 3) {
        return pattern; // Opponent is spamming this move
      }
    }
    
    return null;
  }
  
  /**
   * Get tactical situation (offense, defense, neutral)
   */
  protected getTacticalSituation(): 'offense' | 'defense' | 'neutral' {
    const advantage = this.frameAnalyzer.getFrameAdvantage();
    
    if (advantage > 2) return 'offense';
    if (advantage < -2) return 'defense';
    return 'neutral';
  }
}
```

---

### Example Implementation: `GuardianBot`

**File:** `src/ai/scripted/bots/GuardianBot.ts`

```typescript
import { AdvancedScriptedBot, BotConfig } from '../AdvancedScriptedBot';
import { ActionBundle } from '../../../core/interfaces/types';
import { DefensiveTactics } from '../tactics/DefensiveTactics';

export class GuardianBot extends AdvancedScriptedBot {
  private defensiveTactics: DefensiveTactics;
  
  constructor(difficulty: number = 5) {
    const config: BotConfig = {
      name: 'Guardian',
      style: 'defensive',
      difficulty,
      reactionTimeFrames: Math.max(1, 10 - difficulty), // 9 frames at diff 1, 1 frame at diff 10
      executionAccuracy: 0.5 + (difficulty * 0.05), // 55% at diff 1, 100% at diff 10
      blockProbability: 0.4 + (difficulty * 0.03), // 43% at diff 1, 70% at diff 10
      antiAirAccuracy: 0.4 + (difficulty * 0.03), // 43% at diff 1, 70% at diff 10
    };
    
    super(config);
    this.defensiveTactics = new DefensiveTactics(this.stateReader, this.frameAnalyzer);
  }
  
  protected makeDecision(state: any, actorId: string, targetId: string): ActionBundle {
    const actor = this.stateReader.getEntity(state, actorId);
    const opponent = this.stateReader.getEntity(state, targetId);
    
    // Priority 1: Punish opponent's recovery
    if (this.frameAnalyzer.isOpponentInRecovery(opponent)) {
      const punish = this.defensiveTactics.calculatePunish(
        this.frameAnalyzer.getOpponentRecoveryFrames(opponent),
        this.stateReader.getDistance(actor, opponent)
      );
      if (punish) return punish;
    }
    
    // Priority 2: Anti-air if opponent is jumping
    if (this.stateReader.isJumping(opponent) && Math.random() < this.config.antiAirAccuracy) {
      const antiAir = this.defensiveTactics.antiAir(
        this.stateReader.getDistance(actor, opponent)
      );
      if (antiAir) return antiAir;
    }
    
    // Priority 3: Block if opponent is attacking
    if (this.stateReader.isAttacking(opponent) && Math.random() < this.config.blockProbability) {
      return this.defensiveTactics.block(opponent);
    }
    
    // Priority 4: Safe offense if at advantage
    const situation = this.getTacticalSituation();
    if (situation === 'offense') {
      return this.defensiveTactics.safeAttack(
        this.stateReader.getDistance(actor, opponent)
      );
    }
    
    // Priority 5: Maintain spacing
    return this.defensiveTactics.maintainSpacing(
      actor,
      opponent,
      150 // Optimal range for Guardian
    );
  }
}
```

---

### Tactics Module: `DefensiveTactics`

**File:** `src/ai/scripted/tactics/DefensiveTactics.ts`

```typescript
import { ActionBundle } from '../../../core/interfaces/types';
import { StateReader } from '../utils/StateReader';
import { FrameDataAnalyzer } from '../systems/FrameDataAnalyzer';
import { MUSASHI } from '../../../core/data/musashi';

export class DefensiveTactics {
  constructor(
    private stateReader: StateReader,
    private frameAnalyzer: FrameDataAnalyzer
  ) {}
  
  /**
   * Calculate optimal punish combo based on recovery frames
   */
  public calculatePunish(recoveryFrames: number, distance: number): ActionBundle | null {
    // If opponent has >15 frames of recovery, use heavy punish
    if (recoveryFrames >= 15 && distance < 80) {
      return { direction: 'neutral', button: 'hp', holdDuration: 0 };
    }
    
    // If opponent has 10-14 frames, use medium punish
    if (recoveryFrames >= 10 && distance < 100) {
      return { direction: 'neutral', button: 'lk', holdDuration: 0 };
    }
    
    // If opponent has 6-9 frames, use light punish
    if (recoveryFrames >= 6 && distance < 120) {
      return { direction: 'neutral', button: 'lp', holdDuration: 0 };
    }
    
    return null; // Not punishable
  }
  
  /**
   * Perform anti-air based on opponent's jump trajectory
   */
  public antiAir(distance: number): ActionBundle | null {
    // If opponent is close, use Shoryuken (invincible DP)
    if (distance < 100) {
      // TODO: Check if we have motion input system
      // For now, use standing HP as placeholder
      return { direction: 'neutral', button: 'hp', holdDuration: 0 };
    }
    
    // If opponent is far, use crouching HP
    if (distance < 200) {
      return { direction: 'down', button: 'hp', holdDuration: 0 };
    }
    
    return null;
  }
  
  /**
   * Block opponent's attack
   */
  public block(opponent: any): ActionBundle {
    // Block low against crouching attacks
    if (opponent.currentMove.includes('crouch') || opponent.currentMove.includes('lk')) {
      return { direction: 'down', button: 'block', holdDuration: 3 };
    }
    
    // Block high against everything else
    return { direction: 'neutral', button: 'block', holdDuration: 3 };
  }
  
  /**
   * Safe attack (use frame-advantaged normals)
   */
  public safeAttack(distance: number): ActionBundle {
    // Close: use LP (fastest, safest)
    if (distance < 80) {
      return { direction: 'neutral', button: 'lp', holdDuration: 0 };
    }
    
    // Mid: use LK (good range, safe on block)
    if (distance < 150) {
      return { direction: 'neutral', button: 'lk', holdDuration: 0 };
    }
    
    // Far: walk forward
    return { direction: 'right', button: 'none', holdDuration: 0 };
  }
  
  /**
   * Maintain optimal spacing
   */
  public maintainSpacing(actor: any, opponent: any, optimalRange: number): ActionBundle {
    const distance = Math.abs(opponent.position.x - actor.position.x);
    const toward = opponent.position.x > actor.position.x ? 'right' : 'left';
    const away = toward === 'right' ? 'left' : 'right';
    
    // Too close: back up
    if (distance < optimalRange - 20) {
      return { direction: away, button: 'none', holdDuration: 0 };
    }
    
    // Too far: move in
    if (distance > optimalRange + 20) {
      return { direction: toward, button: 'none', holdDuration: 0 };
    }
    
    // Perfect range: stay neutral
    return { direction: 'neutral', button: 'none', holdDuration: 0 };
  }
}
```

---

## Testing Strategy

### 1. Unit Tests (Tactics)

**Test:** Defensive tactics punish correctly

**File:** `tests/ai/tactics/DefensiveTactics.test.ts`

```typescript
import { DefensiveTactics } from '../../../src/ai/scripted/tactics/DefensiveTactics';
import { StateReader } from '../../../src/ai/scripted/utils/StateReader';
import { FrameDataAnalyzer } from '../../../src/ai/scripted/systems/FrameDataAnalyzer';

describe('DefensiveTactics', () => {
  let tactics: DefensiveTactics;
  let stateReader: StateReader;
  let frameAnalyzer: FrameDataAnalyzer;
  
  beforeEach(() => {
    stateReader = new StateReader();
    frameAnalyzer = new FrameDataAnalyzer();
    tactics = new DefensiveTactics(stateReader, frameAnalyzer);
  });
  
  describe('calculatePunish', () => {
    it('should use HP for 15+ frame recovery', () => {
      const punish = tactics.calculatePunish(20, 70);
      expect(punish?.button).toBe('hp');
    });
    
    it('should use LK for 10-14 frame recovery', () => {
      const punish = tactics.calculatePunish(12, 90);
      expect(punish?.button).toBe('lk');
    });
    
    it('should use LP for 6-9 frame recovery', () => {
      const punish = tactics.calculatePunish(7, 110);
      expect(punish?.button).toBe('lp');
    });
    
    it('should return null if not punishable', () => {
      const punish = tactics.calculatePunish(4, 100);
      expect(punish).toBeNull();
    });
    
    it('should return null if opponent is too far', () => {
      const punish = tactics.calculatePunish(20, 200);
      expect(punish).toBeNull();
    });
  });
  
  describe('antiAir', () => {
    it('should use HP for close jumps', () => {
      const antiAir = tactics.antiAir(80);
      expect(antiAir?.button).toBe('hp');
    });
    
    it('should use crouching HP for far jumps', () => {
      const antiAir = tactics.antiAir(180);
      expect(antiAir?.button).toBe('hp');
      expect(antiAir?.direction).toBe('down');
    });
    
    it('should return null if opponent is too far', () => {
      const antiAir = tactics.antiAir(250);
      expect(antiAir).toBeNull();
    });
  });
  
  describe('maintainSpacing', () => {
    const mockActor = { position: { x: 400, y: 0 } };
    const optimalRange = 150;
    
    it('should back away if too close', () => {
      const opponent = { position: { x: 350, y: 0 } }; // 50px away
      const action = tactics.maintainSpacing(mockActor, opponent, optimalRange);
      expect(action.direction).toBe('right'); // Away from opponent
    });
    
    it('should move forward if too far', () => {
      const opponent = { position: { x: 600, y: 0 } }; // 200px away
      const action = tactics.maintainSpacing(mockActor, opponent, optimalRange);
      expect(action.direction).toBe('right'); // Toward opponent
    });
    
    it('should stay neutral at optimal range', () => {
      const opponent = { position: { x: 550, y: 0 } }; // 150px away
      const action = tactics.maintainSpacing(mockActor, opponent, optimalRange);
      expect(action.direction).toBe('neutral');
    });
  });
});
```

---

### 2. Integration Tests (Full Bot Behavior)

**Test:** Guardian bot exhibits defensive behavior

**File:** `tests/ai/bots/GuardianBot.test.ts`

```typescript
import { GuardianBot } from '../../../src/ai/scripted/bots/GuardianBot';
import { FightingGameEnv } from '../../../src/ml/core/Environment';
import { MUSASHI } from '../../../src/core/data/musashi';

describe('GuardianBot Integration', () => {
  let bot: GuardianBot;
  let env: FightingGameEnv;
  
  beforeEach(() => {
    bot = new GuardianBot(5); // Medium difficulty
    env = new FightingGameEnv({
      p1Character: MUSASHI,
      p2Character: MUSASHI,
      roundTime: 99,
    });
  });
  
  it('should block most incoming attacks', () => {
    const trials = 100;
    let blockedCount = 0;
    
    for (let i = 0; i < trials; i++) {
      env.reset();
      
      // Player attacks with LP
      const playerAction = { direction: 'neutral', button: 'lp', holdDuration: 0 };
      const botAction = bot.decide(env.getState(), 'p2', 'p1');
      
      env.step(playerAction, botAction);
      
      // Check if bot is blocking
      if (botAction.button === 'block') {
        blockedCount++;
      }
    }
    
    // Should block 40-70% (depends on difficulty)
    expect(blockedCount).toBeGreaterThan(30);
    expect(blockedCount).toBeLessThan(80);
  });
  
  it('should anti-air jump-ins', () => {
    const trials = 100;
    let antiAirCount = 0;
    
    for (let i = 0; i < trials; i++) {
      env.reset();
      
      // Player jumps
      const playerAction = { direction: 'up', button: 'none', holdDuration: 0 };
      env.step(playerAction, { direction: 'neutral', button: 'none', holdDuration: 0 });
      
      // Bot should react with anti-air
      const botAction = bot.decide(env.getState(), 'p2', 'p1');
      
      if (botAction.button === 'hp') {
        antiAirCount++;
      }
    }
    
    // Should anti-air 40-70% (depends on difficulty and reaction time)
    expect(antiAirCount).toBeGreaterThan(30);
    expect(antiAirCount).toBeLessThan(80);
  });
  
  it('should punish unsafe moves', () => {
    const trials = 50;
    let punishCount = 0;
    
    for (let i = 0; i < trials; i++) {
      env.reset();
      
      // Player does unsafe HK (recovery: 15 frames)
      const playerAction = { direction: 'neutral', button: 'hk', holdDuration: 0 };
      env.step(playerAction, { direction: 'neutral', button: 'none', holdDuration: 0 });
      
      // Advance to recovery frames
      for (let f = 0; f < 10; f++) {
        const botAction = bot.decide(env.getState(), 'p2', 'p1');
        env.step({ direction: 'neutral', button: 'none', holdDuration: 0 }, botAction);
        
        // Check if bot attacks during recovery
        if (botAction.button !== 'none' && botAction.button !== 'block') {
          punishCount++;
          break;
        }
      }
    }
    
    // Should punish >80% of unsafe moves
    expect(punishCount).toBeGreaterThan(40);
  });
});
```

---

### 3. Statistical Tests (Style Consistency)

**Test:** Bot maintains style throughout match

**File:** `tests/ai/integration/StyleConsistency.test.ts`

```typescript
import { GuardianBot } from '../../../src/ai/scripted/bots/GuardianBot';
import { AggressorBot } from '../../../src/ai/scripted/bots/AggressorBot';
import { FightingGameEnv } from '../../../src/ml/core/Environment';
import { MUSASHI } from '../../../src/core/data/musashi';

describe('Style Consistency', () => {
  let env: FightingGameEnv;
  
  beforeEach(() => {
    env = new FightingGameEnv({
      p1Character: MUSASHI,
      p2Character: MUSASHI,
      roundTime: 99,
    });
  });
  
  it('GuardianBot should have defensive action distribution', () => {
    const bot = new GuardianBot(5);
    const actions = { block: 0, attack: 0, move: 0, none: 0 };
    const frames = 1000;
    
    env.reset();
    
    for (let i = 0; i < frames; i++) {
      const botAction = bot.decide(env.getState(), 'p2', 'p1');
      const playerAction = { direction: 'neutral', button: 'lp', holdDuration: 0 }; // Player attacks
      
      // Categorize action
      if (botAction.button === 'block') actions.block++;
      else if (botAction.button !== 'none') actions.attack++;
      else if (botAction.direction !== 'neutral') actions.move++;
      else actions.none++;
      
      env.step(playerAction, botAction);
    }
    
    // Guardian should block frequently (>30%), attack sparingly (<40%)
    expect(actions.block / frames).toBeGreaterThan(0.3);
    expect(actions.attack / frames).toBeLessThan(0.4);
  });
  
  it('AggressorBot should have offensive action distribution', () => {
    const bot = new AggressorBot(5);
    const actions = { block: 0, attack: 0, move: 0, none: 0 };
    const frames = 1000;
    
    env.reset();
    
    for (let i = 0; i < frames; i++) {
      const botAction = bot.decide(env.getState(), 'p2', 'p1');
      const playerAction = { direction: 'neutral', button: 'none', holdDuration: 0 }; // Player idle
      
      // Categorize action
      if (botAction.button === 'block') actions.block++;
      else if (botAction.button !== 'none') actions.attack++;
      else if (botAction.direction !== 'neutral') actions.move++;
      else actions.none++;
      
      env.step(playerAction, botAction);
    }
    
    // Aggressor should attack frequently (>50%), rarely block (<20%)
    expect(actions.attack / frames).toBeGreaterThan(0.5);
    expect(actions.block / frames).toBeLessThan(0.2);
  });
});
```

---

### 4. Win Rate Calibration

**Test:** Verify difficulty progression

**File:** `tests/ai/integration/WinRateCalibration.test.ts`

```typescript
import { GuardianBot } from '../../../src/ai/scripted/bots/GuardianBot';
import { RandomBot } from '../../../src/ai/bots/RandomBot';
import { FightingGameEnv } from '../../../src/ml/core/Environment';
import { MUSASHI } from '../../../src/core/data/musashi';

describe('Win Rate Calibration', () => {
  function runMatches(bot1: any, bot2: any, matches: number): number {
    const env = new FightingGameEnv({
      p1Character: MUSASHI,
      p2Character: MUSASHI,
      roundTime: 99,
    });
    
    let bot1Wins = 0;
    
    for (let i = 0; i < matches; i++) {
      env.reset();
      let done = false;
      
      while (!done) {
        const action1 = bot1.decide(env.getState(), 'p1', 'p2');
        const action2 = bot2.decide(env.getState(), 'p2', 'p1');
        
        const { reward, terminated } = env.step(action1, action2);
        done = terminated;
        
        if (done && reward > 0) bot1Wins++;
      }
    }
    
    return bot1Wins / matches;
  }
  
  it('GuardianBot difficulty 3 should beat RandomBot 70-90%', () => {
    const guardian = new GuardianBot(3);
    const random = new RandomBot();
    
    const winRate = runMatches(guardian, random, 30);
    
    expect(winRate).toBeGreaterThan(0.7);
    expect(winRate).toBeLessThan(0.9);
  });
  
  it('GuardianBot difficulty 7 should beat RandomBot 90%+', () => {
    const guardian = new GuardianBot(7);
    const random = new RandomBot();
    
    const winRate = runMatches(guardian, random, 30);
    
    expect(winRate).toBeGreaterThan(0.9);
  });
  
  it('GuardianBot difficulty 1 should beat RandomBot 40-60%', () => {
    const guardian = new GuardianBot(1);
    const random = new RandomBot();
    
    const winRate = runMatches(guardian, random, 30);
    
    expect(winRate).toBeGreaterThan(0.4);
    expect(winRate).toBeLessThan(0.6);
  });
});
```

---

## Implementation Timeline

### Phase 1: Foundation (Week 1)
**Goal:** Core architecture and one working bot

- [ ] Create base `AdvancedScriptedBot` class
- [ ] Implement `StateReader` utility
- [ ] Implement `FrameDataAnalyzer` system
- [ ] Create `DefensiveTactics` module
- [ ] Build `GuardianBot` (full implementation)
- [ ] Write unit tests for defensive tactics
- [ ] Write integration tests for GuardianBot
- [ ] Validate Guardian beats RandomBot 80%+

**Deliverables:**
- Working GuardianBot at difficulty 5
- 15+ passing tests
- Documented API for extending to other bots

---

### Phase 2: Bot Expansion (Week 2)
**Goal:** Complete bot roster

- [ ] Implement `OffensiveTactics` module
- [ ] Build `AggressorBot` (rushdown)
- [ ] Implement `SpacingTactics` module
- [ ] Build `TacticianBot` (zoner)
- [ ] Implement `PatternRecognition` module
- [ ] Build `WildcardBot` (mixup)
- [ ] Build `TutorialBot` (beginner)
- [ ] Write tests for all new bots (60+ tests total)
- [ ] Run style consistency tests

**Deliverables:**
- 5 fully functional bots
- All bots pass style consistency tests
- Win rate calibration chart

---

### Phase 3: Integration & Polish (Week 3)
**Goal:** Integrate bots into training and PvP

- [ ] Add bot selection to training script
- [ ] Create bot difficulty selector in UI
- [ ] Implement bot-vs-bot exhibition mode
- [ ] Add bot statistics tracking (win rate, action distribution)
- [ ] Write documentation for adding custom bots
- [ ] Performance optimization (bot decision <1ms)
- [ ] Final validation against ML policy

**Deliverables:**
- Bots selectable in training UI
- Single-player mode with bot opponents
- Bot gallery with stats (win rate, style charts)
- Developer guide for creating custom bots

---

## Success Metrics

### Training Effectiveness
- [ ] ML policy win rate vs GuardianBot increases from 0% → 60% over 1M steps
- [ ] Training with Aggressor produces 50% lower entropy than pure self-play
- [ ] Curriculum progression (Tutorial → Guardian → Aggressor) reaches 70% win rate 3x faster than vs RandomBot

### Bot Quality
- [ ] GuardianBot blocks 60-70% of attacks in 1000-frame test
- [ ] AggressorBot performs frame traps 60%+ of opportunities
- [ ] TacticianBot maintains 200-300px distance 70% of match time
- [ ] WildcardBot uses no single tactic >40% of the time
- [ ] All bots perform optimal combos 70%+ when available

### User Experience
- [ ] Players rate TutorialBot as "helpful for learning" (4/5 stars)
- [ ] Players report GuardianBot feels "defensive" (80% agreement)
- [ ] Players report AggressorBot feels "aggressive" (80% agreement)
- [ ] Single-player mode retention: 60%+ of players complete 5+ matches

---

## Alignment with Roadmap

### PvP Track Integration
- **Single-player mode:** Bots serve as offline opponents until player base grows
- **Training mode:** Tutorial bot teaches mechanics
- **Boss battles:** Wildcard bot as final challenge
- **AI spectacle:** Bot-vs-bot exhibition matches for entertainment

### ML Track Integration
- **Curriculum stages:**
  - Stage 1 (0-500k): TutorialBot (learn basics)
  - Stage 2 (500k-2M): GuardianBot (learn defense)
  - Stage 3 (2M-5M): AggressorBot + TacticianBot (learn offense)
  - Stage 4 (5M+): WildcardBot + self-play (master adaptation)

- **Opponent pool diversity:** Bots provide style variety when self-play pool is small
- **Evaluation benchmark:** Track policy improvement vs bot difficulties
- **Replay generation:** Bots create synthetic training data for imitation learning

### Long-term Vision
- **Post-ML:** Bots become "legacy bosses" after ML surpasses them
- **Hybrid approach:** Combine scripted tactics with ML decisions
- **Community bots:** Players create custom bots via scripting API
- **Esports integration:** Bot difficulty leaderboard (who beats level 10 Wildcard?)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Bots too predictable | ML exploits patterns, stops learning | Add noise to decisions, randomize timing |
| Bots too difficult | ML can't learn, training stagnates | Implement difficulty ramp, start easy |
| Performance bottleneck | Bots slow down training | Optimize decision tree, profile hot paths |
| Testing insufficient | Bots have undetected bugs | 100+ tests, statistical validation required |
| Style inconsistency | Bots don't feel distinct | Statistical tests enforce style distribution |

---

## Open Questions

1. **Motion inputs:** Do we have motion input detection working for special moves? If not, bots can't use Hadoken/Shoryuken yet.
   - **Answer:** Check `src/core/systems/InputManager.ts` for motion detection
   - **Fallback:** Use standing HP as placeholder anti-air

2. **Frame data access:** Can bots query frame advantage in real-time?
   - **Answer:** Need to expose `Actor.frameAdvantage` from game state
   - **Workaround:** Track manually in `FrameDataAnalyzer`

3. **Combo system:** Is move canceling implemented?
   - **Answer:** Check `cancellableInto` in move definitions
   - **Fallback:** Chain attacks with manual timing if not implemented

4. **Difficulty balance:** What win rate should difficulty 5 achieve vs random?
   - **Proposal:** Diff 1 = 50%, Diff 5 = 80%, Diff 10 = 95%
   - **Needs:** Playtesting to validate

5. **ML comparison:** When is ML policy "better" than scripted bots?
   - **Metric:** Consistent 60%+ win rate vs difficulty 8+ bots
   - **Milestone:** Track in training logs

---

## Next Steps

1. **Review this plan** with team/stakeholders
2. **Prioritize Phase 1** (GuardianBot foundation)
3. **Check motion input system** - can we use special moves?
4. **Begin implementation** of base architecture
5. **Set up testing infrastructure** (Jest + integration test suite)

**Estimated effort:** 3 weeks (1 developer full-time)  
**Dependencies:** Core game engine (✅), frame data system (⚠️ verify), motion inputs (⚠️ verify)

---

## Conclusion

Advanced scripted bots solve the immediate problem (100% win rate = no learning pressure) while providing long-term value:

- **Short-term:** Better training opponents for ML
- **Medium-term:** Competitive single-player experience
- **Long-term:** Benchmark for measuring ML progress

This plan ensures **testability** (100+ tests), **modularity** (reusable tactics), and **alignment** with both PvP and ML roadmap tracks. The bots become a core asset that enhances both training and gameplay.
