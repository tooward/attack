# Bot Training Integration - Quick Reference

## Files Modified

### 1. `/src/ml/training/BotSelector.ts` (NEW)
Unified bot selection interface with curriculum support.
- **BotType enum**: 7 bot types (Tutorial, Guardian, Aggressor, Tactician, Wildcard, Legacy Easy/Tight)
- **DEFAULT_CURRICULUM**: 11-stage progression (0→10M+ steps)
- **getBotForStep()**: Returns bot config for current training step
- **createBotActionFn()**: Creates action function for bot type + difficulty
- **BotCache**: Performance optimization for bot instances

### 2. `/src/ml/training/train.ts` (MODIFIED)
Main PPO training script with bot curriculum integration.
- Added imports: `BotType`, `getBotForStep`, `createBotActionFn`, `resetBotCache`, `DEFAULT_CURRICULUM`, `getCurriculumStage`
- Added env vars: `TRAIN_ADVANCED_BOT_CURRICULUM`, `TRAIN_BOT_TYPE`, `TRAIN_BOT_DIFFICULTY`
- Curriculum initialization: Lines 297-340
- Bot evaluation selection: Lines 618-636
- Curriculum advancement: Lines 670-688
- Progress tracking includes `botType` and `botDifficulty`

### 3. `/src/ml/training/PPOTrainer.ts` (MODIFIED)
PPO trainer with custom bot action support.
- Added field: `customBotActionFn?: (state, actorId, targetId) => ActionBundle`
- Added method: `setCustomBotActionFn()` - Set custom bot for training
- Modified opponent selection (line ~870): Uses custom bot if set, falls back to legacy easy/tight

### 4. `/docs/BOT-TRAINING-GUIDE.md` (NEW)
Comprehensive training guide with examples and tips.

### 5. `/scripts/test-bot-integration.ts` (NEW)
Test script to verify bot integration.

## Environment Variables

### Bot Training (Progressive curriculum enabled by default)
```bash
TRAIN_BOT_TYPE=GUARDIAN           # Override curriculum with specific bot
TRAIN_BOT_DIFFICULTY=7            # Set difficulty (1-10) when using custom bot
```

### Training Configuration
```bash
TRAIN_STEPS=10000000              # Total training steps (default: 10M)
TRAIN_MAX_EPISODE_FRAMES=1200     # Force resolution to prevent stalling (default: 1200)
TRAIN_EVAL_FREQUENCY=10000        # Evaluate every N steps (default: 10k)
TRAIN_SAVE_FREQUENCY=50000        # Save checkpoint every N steps (default: 50k)
```

### Reward Tuning (Optimized defaults for engagement)
```bash
TRAIN_REWARD_HIT_CONFIRM=2.0      # Reward successful attacks (default: 2.0)
TRAIN_REWARD_STALLING=-0.5        # Penalize passive play (default: -0.5)
TRAIN_REWARD_ATTACK_INTENT=0.05   # Encourage aggression (default: 0.05)
```

## Quick Start

### Test Integration
```bash
npm run test                                # Run all tests
npx tsx scripts/test-bot-integration.ts    # Test bot integration
```

### Training Examples
```bash
# Start training (uses progressive bot curriculum automatically)
npm run train

# Custom bot selection (override curriculum)
TRAIN_BOT_TYPE=GUARDIAN TRAIN_BOT_DIFFICULTY=7 npm run train

# Quick test run
TRAIN_STEPS=100000 npm run train
```

## Bot Types

| Bot Type | Purpose | Difficulty Range | Best For |
|----------|---------|------------------|----------|
| `TUTORIAL` | Teaching bot with telegraphed attacks | 1-10 | Early training, basics |
| `GUARDIAN` | Defensive specialist | 1-10 | Learning defense, patience |
| `AGGRESSOR` | Offensive pressure | 1-10 | Handling combos, pressure |
| `TACTICIAN` | Adaptive strategist | 1-10 | Advanced decision-making |
| `WILDCARD` | Unpredictable chaos | 1-10 | Reading patterns, chaos |
| `LEGACY_EASY` | Original easy scripted | N/A | Backward compatibility |
| `LEGACY_TIGHT` | Original tight scripted | N/A | Backward compatibility |

## Curriculum Stages

| Steps | Bot | Difficulty | Focus |
|-------|-----|------------|-------|
| 0-500k | Tutorial | 1 | Learn basics |
| 500k-1M | Tutorial | 3 | Improve fundamentals |
| 1M-1.5M | Guardian | 3 | Learn defense |
| 1.5M-2M | Guardian | 5 | Master blocking |
| 2M-3M | Guardian | 7 | Expert defense |
| 3M-4M | Aggressor | 5 | Handle pressure |
| 4M-5M | Aggressor | 7 | Advanced offense |
| 5M-6M | Tactician | 5 | Strategic thinking |
| 6M-8M | Tactician | 8 | Expert tactics |
| 8M-10M | Wildcard | 8 | Handle unpredictability |
| 10M+ | Wildcard | 10 | Ultimate challenge |

## Architecture

```
Training Script (train.ts)
    ↓ sets customBotActionFn
PPOTrainer (PPOTrainer.ts)
    ↓ calls during rollout
BotSelector (BotSelector.ts)
    ↓ returns action function
Bot Instances (GuardianBot, etc.)
    ↓ returns ActionBundle
Environment (Environment.ts)
```

## Key Functions

### `getBotForStep(step, curriculum)`
Returns bot configuration for current training step.
```typescript
const config = getBotForStep(1500000, DEFAULT_CURRICULUM);
// Returns: { botType: 'guardian', difficulty: 5, description: '...' }
```

### `createBotActionFn(botType, difficulty)`
Creates action function for bot.
```typescript
const actionFn = createBotActionFn(BotType.GUARDIAN, 7);
const action = actionFn(gameState, 'player2', 'player1');
// Returns: ActionBundle
```

### `trainer.setCustomBotActionFn(fn)`
Sets custom bot for PPO training.
```typescript
const botFn = createBotActionFn(BotType.AGGRESSOR, 6);
trainer.setCustomBotActionFn(botFn);
```

### `resetBotCache()`
Clears bot instance cache (call when switching bots).
```typescript
resetBotCache(); // Clear before curriculum advancement
```

## Testing

Run comprehensive bot tests:
```bash
npm test -- tests/integration/core/ai/scripted/bots/
```

Individual bot tests:
```bash
npm test -- GuardianBot
npm test -- AggressorBot
npm test -- TacticianBot
npm test -- WildcardBot
npm test -- TutorialBot
```

## Monitoring

Training logs show bot progression:
```
[Advanced Bot Curriculum] Enabled
  Starting bot: tutorial (difficulty 1)
  Learn basic combat patterns and movement
  Curriculum will progress through: Tutorial → Guardian → Aggressor → Tactician → Wildcard

[Step 150000] vs tutorial (difficulty 1)
[Eval] scripted WR=65.0% dmg=38.2/25.1 frames=890

[Advanced Bot Curriculum] Progressed to: guardian (difficulty 3)
  Master defensive techniques and blocking
```

Progress log (`models/training-progress.jsonl`):
```json
{
  "step": 1500000,
  "botType": "guardian",
  "botDifficulty": 5,
  "scripted": {"winRate": 0.58, "avgDamageDealt": 42.1}
}
```

## Troubleshooting

### Bot action returns null/undefined
- Verify bot exports in `src/core/ai/scripted/index.ts`
- Check bot constructor and `getAction()` method
- Run `npx tsx scripts/test-bot-integration.ts`

### Training not progressing
- Check curriculum step thresholds in `DEFAULT_CURRICULUM`
- Verify `getBotForStep()` returns correct bot
- Monitor console for curriculum advancement messages

### Performance issues
- Bot cache reduces instance creation overhead
- Call `resetBotCache()` only when switching bots
- Avoid recreating action functions in hot loops

## Next Steps

1. **Phase 3 Integration Complete** ✓
   - All bots integrated into training system
   - Curriculum system working
   - Environment variables configured

2. **Phase 4: PvP Integration** (Next)
   - Add bot selection to UI
   - Create bot-vs-bot exhibition mode
   - Add difficulty selector in character select

3. **Phase 5: Refinement** (Future)
   - Fine-tune curriculum thresholds
   - Add adaptive curriculum (auto-adjust based on performance)
   - Create specialized bot variants
