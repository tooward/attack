# ML Bot System - Integration Guide

## Overview

This guide explains how to integrate the ML bot system into your fighting game. The system provides intelligent, configurable AI opponents with 10 difficulty levels and 4 distinct fighting styles.

---

## Quick Start

### 1. Installation

```bash
npm install @tensorflow/tfjs-node
# Or for browser/mobile
npm install @tensorflow/tfjs
```

### 2. Load a Bot

```typescript
import { createBotRuntime } from './ml/inference/BotRuntime';

// Load bot from model file
const bot = await createBotRuntime('./models/policy', {
  difficulty: 5,  // 1-10
  style: 'rushdown',  // rushdown, zoner, turtle, mixup
  playerIndex: 2,
});
```

### 3. Get Actions Each Frame

```typescript
// In your game loop
function update(gameState) {
  // Get bot action
  const action = bot.getAction(gameState);
  
  // Apply action to game
  applyAction(action.action, gameState);
}
```

---

## Difficulty Levels

The system provides 10 difficulty levels (1-10) implemented via intentional limitations:

### Difficulty Characteristics

| Level | Name | Reaction | Mistakes | Elo Range | Description |
|-------|------|----------|----------|-----------|-------------|
| 1 | Beginner | 20 frames | 40% | 0-800 | Very slow, frequent errors, basic moves only |
| 2 | Very Easy | 18 frames | 35% | 600-1000 | Slow reactions, many mistakes |
| 3 | Easy | 15 frames | 30% | 800-1200 | Moderate reactions, uses specials |
| 4 | Medium-Easy | 12 frames | 25% | 1000-1400 | Decent reactions, simple strategies |
| 5 | Medium | 10 frames | 20% | 1200-1600 | Good reactions, solid fundamentals |
| 6 | Medium-Hard | 8 frames | 15% | 1400-1800 | Fast reactions, advanced combos |
| 7 | Hard | 5 frames | 10% | 1600-2000 | Very fast, complex strategies |
| 8 | Very Hard | 3 frames | 5% | 1800-2200 | Near-instant, optimal punishes |
| 9 | Expert | 1 frame | 2% | 2000-2400 | Instant reactions, near-perfect |
| 10 | Master | 0 frames | 0% | 2200-3000 | Perfect reactions, flawless execution |

### Changing Difficulty

```typescript
// Change difficulty at runtime
bot.setDifficulty(7);

// Or create custom difficulty
import { createCustomDifficulty } from './ml/inference/DifficultyConfig';

const custom = createCustomDifficulty(5, {
  reactionDelay: 15,  // Slower reactions
  executionError: 0.3,  // More mistakes
  disableSupers: true,  // No super moves
});

bot.setDifficulty(custom);
```

---

## Fighting Styles

The system provides 4 distinct fighting styles:

### Style Characteristics

**Rushdown** (Aggressive Pressure)
- **Range:** Close
- **Playstyle:** Constantly applies pressure, stays in your face
- **Strengths:** High damage output, relentless offense
- **Weaknesses:** Vulnerable when knocked back, less defensive
- **Matchups:** Strong vs Turtle, weak vs Zoner

**Zoner** (Distance Control)
- **Range:** Far
- **Playstyle:** Keeps distance, uses projectiles and long-range attacks
- **Strengths:** Controls space, forces approach
- **Weaknesses:** Struggles up close, lower damage
- **Matchups:** Strong vs Rushdown, weak vs Mixup

**Turtle** (Defensive Counter)
- **Range:** Mid
- **Playstyle:** Waits patiently, blocks frequently, punishes mistakes
- **Strengths:** Very defensive, devastating counters
- **Weaknesses:** Low pressure, can be grabbed
- **Matchups:** Strong vs Mixup, weak vs Rushdown

**Mixup** (Unpredictable)
- **Range:** Mid
- **Playstyle:** Constantly changes patterns, hard to read
- **Strengths:** Unpredictable, uses all tools
- **Weaknesses:** No particular strength, balanced
- **Matchups:** Balanced against all styles

### Changing Styles

```typescript
// Change style at runtime
bot.setStyle('zoner');

// Or blend styles
import { blendStyles } from './ml/inference/StyleConfig';

const hybrid = blendStyles('rushdown', 'mixup', 0.3);
bot.setStyle(hybrid);
```

---

## Game State Integration

### Required Game State Format

The bot expects a `GameState` object with this structure:

```typescript
interface GameState {
  entities: Array<{
    id: string;
    position: { x: number; y: number };
    velocity: { x: number; y: number };
    health: number;
    maxHealth: number;
    superMeter: number;
    maxSuperMeter: number;
    energy: number;
    maxEnergy: number;
    status: 'idle' | 'attacking' | 'blocking' | 'hitstun' | 'blockstun';
    stunFramesRemaining: number;
    facing: 1 | -1;
    isGrounded: boolean;
    comboCount: number;
  }>;
  arena: {
    leftBound: number;
    rightBound: number;
    height: number;
  };
  round: {
    timeRemaining: number;
  };
}
```

### Converting Your Game State

Create an adapter to convert your game state:

```typescript
function convertToMLGameState(yourGameState: YourGameState): GameState {
  return {
    entities: [
      {
        id: 'player1',
        position: yourGameState.player1.position,
        velocity: yourGameState.player1.velocity,
        health: yourGameState.player1.hp,
        maxHealth: 100,
        // ... map all fields
      },
      {
        id: 'player2',
        // ... same for player 2
      },
    ],
    arena: {
      leftBound: 0,
      rightBound: yourGameState.stageWidth,
      height: yourGameState.stageHeight,
    },
    round: {
      timeRemaining: yourGameState.timer,
    },
  };
}
```

---

## Action Mapping

### Bot Output Format

The bot returns actions in this format:

```typescript
interface BotAction {
  action: number;        // 0-17 (action index)
  confidence: number;    // 0-1 (how confident)
  wasGreedy: boolean;    // Used greedy selection
  hadError: boolean;     // Execution error occurred
  reactionDelayed: boolean;  // Reaction was delayed
}
```

### Action Index Mapping

Map bot actions to your game's input system:

```typescript
const ACTION_MAP = {
  0: { direction: 'neutral', button: 'none' },
  1: { direction: 'forward', button: 'none' },
  2: { direction: 'back', button: 'none' },
  3: { direction: 'up', button: 'none' },
  4: { direction: 'down', button: 'none' },
  5: { direction: 'neutral', button: 'light_punch' },
  6: { direction: 'neutral', button: 'heavy_punch' },
  7: { direction: 'neutral', button: 'light_kick' },
  8: { direction: 'neutral', button: 'heavy_kick' },
  9: { direction: 'neutral', button: 'block' },
  10: { direction: 'forward', button: 'light_punch' },  // Special
  11: { direction: 'down', button: 'heavy_punch' },     // Special
  // ... map all 18 actions
};

function applyBotAction(botAction: BotAction, player: Player) {
  const input = ACTION_MAP[botAction.action];
  player.setInput(input.direction, input.button);
}
```

---

## Performance Optimization

### Mobile/Browser Optimization

```typescript
// Use quantized model for mobile
import { ModelOptimizer, MOBILE_OPTIMIZATION_CONFIG } from './ml/deployment/ModelOptimizer';

const optimizer = new ModelOptimizer(MOBILE_OPTIMIZATION_CONFIG);
const { model: optimizedModel } = await optimizer.optimizeModel(originalModel);

// Reduces size from ~500KB to ~125KB
// Reduces inference from ~10ms to ~3ms
```

### Batch Inference (Multiple Bots)

```typescript
import { BotRuntimeBatch } from './ml/inference/BotRuntime';

// Create multiple bots
const bots = [bot1, bot2, bot3];
const batch = new BotRuntimeBatch(bots);

// Get actions for all bots in one call (faster)
const actions = batch.getActions([state1, state2, state3]);
```

### Caching

```typescript
// Cache bot instances
const botCache = new Map<string, BotRuntime>();

function getBot(difficulty: number, style: string): BotRuntime {
  const key = `${difficulty}_${style}`;
  
  if (!botCache.has(key)) {
    botCache.set(key, createBotRuntime(modelPath, { difficulty, style, playerIndex: 2 }));
  }
  
  return botCache.get(key)!;
}
```

---

## Difficulty Auto-Scaling

Automatically adjust difficulty based on player performance:

```typescript
class DifficultyScaler {
  private currentDifficulty = 5;
  private recentMatches: boolean[] = [];
  
  recordMatch(playerWon: boolean) {
    this.recentMatches.push(playerWon);
    if (this.recentMatches.length > 10) {
      this.recentMatches.shift();
    }
    
    // Adjust difficulty
    const winRate = this.recentMatches.filter(w => w).length / this.recentMatches.length;
    
    if (winRate > 0.7 && this.currentDifficulty < 10) {
      this.currentDifficulty++;
      console.log(`Increased difficulty to ${this.currentDifficulty}`);
    } else if (winRate < 0.3 && this.currentDifficulty > 1) {
      this.currentDifficulty--;
      console.log(`Decreased difficulty to ${this.currentDifficulty}`);
    }
  }
  
  getDifficulty(): number {
    return this.currentDifficulty;
  }
}
```

---

## Training Your Own Bots

### Quick Training

```bash
# Train for 1M steps
npm run ml:train

# Train specific style
npm run ml:train -- --style rushdown

# Resume from checkpoint
npm run ml:train -- --resume ./models/checkpoint_500k
```

### Training Configuration

Edit `src/ml/config/training.yaml`:

```yaml
training:
  totalSteps: 1000000
  saveFrequency: 100000
  evalFrequency: 50000

ppo:
  learningRate: 0.0003
  gamma: 0.99
  lambda: 0.95
  clipRange: 0.2

styles:
  - rushdown
  - zoner
  - turtle
  - mixup
```

### Monitoring Training

```typescript
// Training logs are saved to ./logs/training.json
const log = JSON.parse(fs.readFileSync('./logs/training.json', 'utf8'));

console.log(`Training complete after ${log.duration}ms`);
console.log(`Final reward: ${log.metrics[log.metrics.length - 1].avgReward}`);
console.log(`Style distribution:`, log.poolStats.styleDistribution);
```

---

## Troubleshooting

### Bot Not Responding

```typescript
// Check if bot is initialized
if (!bot) {
  console.error('Bot not initialized!');
}

// Check game state is valid
const isValid = gameState.entities.length === 2;
if (!isValid) {
  console.error('Invalid game state: expected 2 entities');
}

// Check for errors in bot action
const action = bot.getAction(gameState);
if (action.hadError) {
  console.warn('Bot had execution error');
}
```

### Poor Performance

```typescript
// Profile inference time
const start = performance.now();
const action = bot.getAction(gameState);
const duration = performance.now() - start;

if (duration > 16) {
  console.warn(`Bot inference too slow: ${duration}ms`);
  // Consider using optimized model
}
```

### Degenerate Behavior

```typescript
// Check for stalling
import { BehaviorAnalyzer } from './ml/evaluation/BehaviorAnalysis';

const analyzer = new BehaviorAnalyzer();
const report = analyzer.generateReport(100);

if (report.stalling.stallingRate > 0.2) {
  console.warn('Bot is stalling excessively!');
  // Retrain or use different checkpoint
}
```

---

## Best Practices

1. **Start with Medium Difficulty (5)**: Good balance for most players
2. **Use Style Auto-Select**: Let players choose or randomize for variety
3. **Cache Bot Instances**: Reuse bots across matches
4. **Monitor Performance**: Track inference times, adjust if needed
5. **Provide Feedback**: Let players rate bot behavior for improvements
6. **Test Thoroughly**: Run tournaments to validate behavior
7. **Version Models**: Use model registry for A/B testing

---

## API Reference

### BotRuntime

```typescript
class BotRuntime {
  constructor(model: tf.LayersModel, config: BotConfig, randomSeed?: number);
  getAction(state: GameState): BotAction;
  reset(): void;
  setDifficulty(difficulty: DifficultyLevel | DifficultyKnobs): void;
  setStyle(style: FightingStyle | StyleConfig): void;
  getStats(): BotRuntimeStats;
  dispose(): void;
}
```

### Factory Functions

```typescript
createBotRuntime(modelPath: string, config: BotConfig): Promise<BotRuntime>;
createBotRuntimeFromModel(model: tf.LayersModel, config: BotConfig): BotRuntime;
```

### Configuration Types

```typescript
interface BotConfig {
  difficulty: DifficultyLevel | DifficultyKnobs;
  style: FightingStyle | StyleConfig;
  playerIndex: number;
}

type DifficultyLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
type FightingStyle = 'rushdown' | 'zoner' | 'turtle' | 'mixup';
```

---

## Support

For issues or questions:
- GitHub: [your-repo/issues](https://github.com/your-repo/issues)
- Docs: [your-docs-site](https://your-docs.com)
- Discord: [your-discord](https://discord.gg/your-server)
