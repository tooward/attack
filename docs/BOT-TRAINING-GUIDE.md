# Advanced Bot Training Guide

This guide explains how to train your AI against the advanced scripted bots.

## Available Bots

The game includes 5 advanced scripted opponents with difficulty scaling:

### 1. **TutorialBot** (`TUTORIAL`)
- **Purpose**: Teaching bot that telegraphs attacks
- **Difficulty**: 1-10 (affects telegraph timing)
- **Best for**: Early training, learning basic combat

### 2. **GuardianBot** (`GUARDIAN`)
- **Purpose**: Defensive specialist with strong blocking
- **Difficulty**: 1-10 (affects block precision and counter timing)
- **Best for**: Teaching patience and opening recognition

### 3. **AggressorBot** (`AGGRESSOR`)
- **Purpose**: Offensive pressure with combo chains
- **Difficulty**: 1-10 (affects combo execution and frame traps)
- **Best for**: Defensive skill and escape techniques

### 4. **TacticianBot** (`TACTICIAN`)
- **Purpose**: Adaptive strategist with pattern recognition
- **Difficulty**: 1-10 (affects adaptation speed and mixup quality)
- **Best for**: Advanced decision-making and unpredictability

### 5. **WildcardBot** (`WILDCARD`)
- **Purpose**: Unpredictable with high-risk/high-reward plays
- **Difficulty**: 1-10 (affects risk calculation and feint quality)
- **Best for**: Handling chaos and reading opponent patterns

## Training Modes

### Progressive Bot Curriculum (Default)
Automatically enabled - no configuration needed!
```bash
npm run train
```

Curriculum progression:
1. **0-500k steps**: Tutorial (difficulty 1) - Learn basics
2. **500k-1M**: Tutorial (difficulty 3) - Improve fundamentals
3. **1M-1.5M**: Guardian (difficulty 3) - Learn defense
4. **1.5M-2M**: Guardian (difficulty 5) - Master blocking
5. **2M-3M**: Guardian (difficulty 7) - Expert defense
6. **3M-4M**: Aggressor (difficulty 5) - Handle pressure
7. **4M-5M**: Aggressor (difficulty 7) - Advanced offense
8. **5M-6M**: Tactician (difficulty 5) - Strategic thinking
9. **6M-8M**: Tactician (difficulty 8) - Expert tactics
10. **8M-10M**: Wildcard (difficulty 8) - Handle unpredictability
11. **10M+**: Wildcard (difficulty 10) - Ultimate challenge

### 3. Custom Bot Selection
Train against a specific bot and difficulty:
```bash
TRAIN_BOT_TYPE=AGGRESSOR TRAIN_BOT_DIFFICULTY=7 npm run train
```

Available bot types:
- `TUTORIAL`
- `GUARDIAN`
- `AGGRESSOR`
- `TACTICIAN`
- `WILDCARD`
- `LEGACY_EASY` (original easy scripted)
- `LEGACY_TIGHT` (original tight scripted)

## Environment Variables

### Bot Curriculum Settings
```bash
# Enable advanced bot curriculum
TRAIN_ADVANCED_BOT_CURRICULUM=1

# Or select specific bot and difficulty
TRAIN_BOT_TYPE=TACTICIAN
TRAIN_BOT_DIFFICULTY=6  # 1-10 scale
```

### Legacy Curriculum Settings
```bash
# Enable simple easy->tight curriculum
TRAIN_CURRICULUM=1

# Damage threshold to advance (default: 20)
TRAIN_CURRICULUM_DAMAGE_THRESHOLD=20

# Number of successful evals before advancing (default: 2)
TRAIN_CURRICULUM_REQUIRED_EVALS=2
```

### Other Training Settings
```bash
# Training steps
TRAIN_STEPS=10000000

# Evaluation frequency
TRAIN_EVAL_FREQUENCY=10000
TRAIN_EVAL_EPISODES_SCRIPTED=30

# Model checkpointing
TRAIN_SAVE_FREQUENCY=50000

# Opponent pool settings
TRAIN_OPPONENT_POOL_ENABLED=1
TRAIN_OPPONENT_SCRIPTED_PROB=0.3  # Mix in scripted opponents
```

## Training Progress Tracking

The training script logs progress to `models/training-progress.jsonl`. Each line includes:

```json
{
  "timestamp": 1234567890,
  "step": 100000,
  "style": "balanced",
  "botType": "GUARDIAN",
  "botDifficulty": 5,
  "scripted": {
    "winRate": 0.65,
    "avgDamageDealt": 45.2,
    "avgDamageTaken": 32.1,
    "avgFrames": 850
  },
  "snapshots": {
    "winRate": 0.52,
    "avgDamageDealt": 38.5,
    "avgDamageTaken": 41.2
  }
}
```

## Example Training Sessions

### Quick Test (1 hour)
```bash
TRAIN_STEPS=100000 npm run train
```

### Full Curriculum (24+ hours)
```bash
npm run train
```

### Guardian Specialist (focused training)
```bash
TRAIN_STEPS=5000000 \
TRAIN_BOT_TYPE=GUARDIAN \
TRAIN_BOT_DIFFICULTY=8 \
npm run train
```

### Multi-Stage Manual Curriculum
Train in stages with increasing difficulty:

```bash
# Stage 1: Tutorial basics (500k steps)
TRAIN_STEPS=500000 TRAIN_BOT_TYPE=TUTORIAL TRAIN_BOT_DIFFICULTY=2 npm run train

# Stage 2: Guardian defense (1M more steps)
TRAIN_STEPS=1500000 TRAIN_BOT_TYPE=GUARDIAN TRAIN_BOT_DIFFICULTY=5 npm run train

# Stage 3: Aggressor pressure (1M more steps)  
TRAIN_STEPS=2500000 TRAIN_BOT_TYPE=AGGRESSOR TRAIN_BOT_DIFFICULTY=6 npm run train

# Stage 4: Final polish (1M more steps)
TRAIN_STEPS=3500000 TRAIN_BOT_TYPE=TACTICIAN TRAIN_BOT_DIFFICULTY=8 npm run train
```

## Monitoring Training

### Console Output
The training script shows real-time metrics every 10k steps:
```
[Step 150000] vs GUARDIAN (difficulty 5)
[Eval] scripted WR=58.3% dmg=42.1/35.6 frames=920
[Advanced Bot Curriculum] Progressed to: AGGRESSOR (difficulty 5)
```

### Progress Log
Analyze training history:
```bash
# View recent progress
tail -20 models/training-progress.jsonl | jq

# Plot win rate over time
cat models/training-progress.jsonl | jq '.scripted.winRate' | your_plotting_tool
```

## Tips for Effective Training

1. **Start with curriculum**: The advanced bot curriculum provides a well-tested progression
2. **Monitor evaluation metrics**: Win rate should gradually improve; if stuck, reduce difficulty
3. **Use opponent pool**: Enable self-play for diverse training (`TRAIN_OPPONENT_POOL_ENABLED=1`)
4. **Checkpoints**: Save frequently to avoid losing progress (`TRAIN_SAVE_FREQUENCY=50000`)
5. **Scripted mixing**: Keep some scripted opponents in the mix to prevent forgetting (`TRAIN_OPPONENT_SCRIPTED_PROB=0.3`)

## Troubleshooting

### Low Win Rate After Many Steps
- Reduce bot difficulty by 2-3 levels
- Increase evaluation episodes to verify performance
- Check if model is learning (entropy should be 0.3-1.0)

### Training Crashes
- Reduce batch size or minibatch size
- Lower learning rate
- Check available memory

### Stuck at 50% Win Rate
- Agent might be playing too passively
- Increase attack intent reward weight
- Try different bot type to vary training signal

## Next Steps

After training:
- Evaluate against all bots: `npm run evaluate`
- Create custom bot matchups in UI
- Export model for deployment
- Continue training with self-play snapshots
