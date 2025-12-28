# RL Training Guide

## Problem: Bot Too Passive

The bot was sitting idle because training had **zero reward signal**. 

### Root Cause
The `PPOTrainer` was using the Environment's simple rewards (only damage dealt/taken), but **never called the sophisticated `RewardFunction`** that rewards:
- Hit confirms (+3.0)
- Successful blocks (+1.0)
- Whiff punishes (+5.0)
- Anti-airs (+3.0)
- Move diversity (+0.3)
- And penalizes stalling (-0.2)

### Fixes Applied

1. **Connected RewardFunction to training** - PPOTrainer now uses `rewardFn.computeReward()` instead of environment's basic rewards

2. **Increased reward weights** to encourage aggressive play:
   - `damageDealt`: 1.0 → 2.0 (doubled)
   - `hitConfirm`: 2.0 → 3.0 (+50%)
   - `knockdown`: 5.0 → 10.0 (doubled)
   - `whiffPunish`: 3.0 → 5.0 (+66%)
   - `stalling`: -0.05 → -0.2 (4x penalty)
   - `aggression`: 0.0 → 0.5 (baseline bonus for being active)

3. **Training improvements** (recommended):
   - Increase from 1M to 3-5M steps
   - Use curriculum learning (start simple, add complexity)
   - Consider imitation pre-training from PersonalityBot

---

## Retrain the Model

### Option 1: Quick Retrain (2-3M steps, ~2-4 hours)

```bash
# Edit training config to 2M steps
# In src/ml/training/train.ts, change:
# totalSteps: 2_000_000,

npm run train:rl
```

### Option 2: Full Retrain (5M steps, ~6-10 hours)

```bash
# Edit training config to 5M steps
npm run train:rl
```

### Option 3: Imitation Pre-training + RL Fine-tuning

```bash
# 1. Generate training data from PersonalityBot
npm run train  # Generates replays from bot matches

# 2. Pre-train with imitation learning
# (This gives the bot a "head start" - it learns basic combos)
# Then run RL training which will improve beyond imitation

npm run train:rl
```

---

## Monitoring Training

Watch the console output:
```
[Step 1000] Style: rushdown | Reward: 15.23 | P.Loss: 0.0234 | V.Loss: 0.1234
```

**Good signs:**
- `Reward` increases over time (should reach 20-50+)
- `Win rate` approaches 50% (balanced self-play)
- Pool has diverse Elo ratings (800-2200)

**Bad signs:**
- `Reward` stays near 0 or negative
- `Win rate` stuck at 50% (not improving)
- High `stalling` rate in behavior analysis

---

## Training Configuration

Edit [src/ml/training/train.ts](src/ml/training/train.ts):

```typescript
const DEFAULT_TRAINING_CONFIG: TrainingConfig = {
  totalSteps: 2_000_000,      // Increase for better results
  saveFrequency: 100_000,     // Save checkpoints every 100K
  evalFrequency: 50_000,      // Evaluate every 50K
  logFrequency: 1_000,        // Log every 1K steps
  roundTime: 99,              // Max round time
  modelPath: './models/policy',
  logPath: './models/training.log',
};
```

---

## After Retraining

1. **Serve the new model:**
```bash
npm run serve-models
```

2. **Test in game:**
```bash
npm run dev
```

3. **Try different difficulties:**
- Press F2 to switch to ML Bot
- Press F7/F8 to change difficulty (1-10)
- Press F9 to cycle styles

---

## Expected Behavior After Proper Training

**Difficulty 1-3** (Beginner):
- Slow reactions (15-20 frame delay)
- Frequent mistakes (30-40%)
- Basic combos only
- Sometimes blocks, sometimes attacks

**Difficulty 5** (Medium):
- 10 frame reaction delay
- 20% mistake rate
- Uses specials
- Good fundamentals

**Difficulty 8-10** (Expert):
- 0-3 frame reactions
- 0-5% mistakes
- Optimal punishes
- Advanced combos

**All difficulties should:**
- ✅ Attack when opponent is close
- ✅ Block occasionally
- ✅ Move around the arena (not corner-camping)
- ✅ Use variety of moves
- ✅ Punish whiffs
- ❌ NOT stand idle
- ❌ NOT stall/timeout

---

## Troubleshooting

**Bot still passive after retraining?**
1. Check training log: `tail -100 models/training.log | grep avgReward`
2. If still 0, check PPOTrainer is calling rewardFn.computeReward()
3. Try even higher reward weights for offensive actions

**Bot too aggressive/suicidal?**
1. Reduce `damageDealt` weight
2. Increase `damageTaken` penalty
3. Increase `successfulBlock` reward

**Bot too repetitive?**
1. Increase `repetitionPenalty` (-1.0 → -2.0)
2. Increase `moveDiversity` reward (0.3 → 0.5)
3. Add style-specific rewards

**Training too slow?**
1. Reduce `totalSteps` to 1M for testing
2. Use fewer opponent pool snapshots
3. Reduce `historyFrames` in observations

---

## Advanced: Curriculum Learning

For even better results, implement progressive training:

**Stage 1 (0-200K steps):** Basic movement and attacks
- Only allow: idle, walk, jump, light punch, light kick
- Reward: Basic damage only

**Stage 2 (200K-500K):** Add defense
- Add: block, throw
- Reward: Add successful blocks, throw techs

**Stage 3 (500K-1M):** Add specials
- Add: Fireball, uppercut
- Reward: Add whiff punishes, anti-airs

**Stage 4 (1M-2M):** Full game
- All moves enabled
- Full reward shaping

This is partially implemented in `CurriculumManager` but not fully integrated yet.

---

## Next Steps

1. **Retrain** with fixes (2-3M steps recommended)
2. **Test** the new bot at different difficulties
3. **Iterate** on reward weights based on behavior
4. **Expand** training to 5-10M steps for production quality

The bot should now be much more active and engaging to fight!
