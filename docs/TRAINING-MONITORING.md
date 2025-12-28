# Training Monitoring Guide

## Enhanced Logging Features

The training system now includes comprehensive logging to help you monitor progress and diagnose issues.

### Real-Time Console Output

Every 10,000 steps, you'll see:
```
[Step 10000/10000000 (0.1%)] Style: rushdown  | Reward: -2.45  | P.Loss: 0.0234 | V.Loss: 0.1234 | Entropy: 0.4521 | WinRate: 35.0% | W/L/D=7/13/0 anyDmg=65% firstHit=45% dmg=12.3/18.7 close=234.5
```

**Key Metrics:**
- **Reward**: Should trend upward over time (negative is OK early on)
- **P.Loss/V.Loss**: Policy and value loss (should decrease and stabilize)
- **Entropy**: Action diversity (0.1-0.5 is healthy, <0.05 is concerning)
- **WinRate**: Percentage of episodes won
- **anyDmg**: % of episodes where bot dealt any damage (should be >50%)
- **firstHit**: % of episodes where bot landed first hit
- **dmg**: Average damage dealt/taken per episode

**Warning Indicators:**
- ⚠️ LOW ENTROPY: Policy becoming too deterministic
- ⚠️ LOW ENGAGEMENT: Bot not dealing damage
- ⚠️ NEGATIVE REWARDS: Bot consistently losing

### Detailed Progress Reports (Every 50k Steps)

Every 50,000 steps, you get a comprehensive breakdown:

```
================================================================================
📊 DETAILED PROGRESS @ 50000 steps
================================================================================
📈 Rolling Avg (last 10 rollouts):
   Reward:      -1.234
   Policy Loss: 0.02345
   Value Loss:  0.12345
   Entropy:     0.45123
   Trend:       📈 +0.523

🎮 Episode Stats:
   Total:       20
   Win Rate:    45.0%
   Engagement:  75.0% dealt damage
   First Hit:   55.0%
   Avg Damage:  15.3 dealt / 12.7 taken
   Distance:    456 pixels closed

🤖 Opponent Pool:
   Snapshots:   5
   Avg Elo:     1523
   Elo Range:   1450 - 1680

🏥 Health Check:
   ✅ Reward improving
   ✅ Entropy adequate
   ⚠️  Engagement good
   ✅ Losses stable
```

### Health Analysis System

The system automatically detects common training issues:

**Critical Issues (❌):**
- Very low entropy (<0.05): Policy collapsed
- Very low engagement (<20%): Bot avoiding combat
- High policy loss (>5): Training unstable

**Warnings (⚠️):**
- Reward plateauing: Not improving
- Low entropy (<0.15): Policy may collapse soon
- Low engagement (<40%): Bot needs encouragement

**Suggestions (💡):**
- Adjust reward weights
- Increase entropy coefficient
- Add early-game engagement penalty
- Lower learning rate

### Progress Tracking

All evaluation results are saved to `models/training-progress.jsonl`:

```json
{
  "timestamp": 1735401234567,
  "step": 500000,
  "style": "rushdown",
  "scripted": {
    "winRate": 0.65,
    "avgDamageDealt": 45.2,
    "avgDamageTaken": 32.1
  }
}
```

View progress with:
```bash
npx ts-node scripts/show-training-progress.ts
```

This shows:
- Latest performance metrics
- Sparkline charts of improvement
- Milestone achievement
- Training rate (steps/hour)

### Initial Diagnostic Test

On startup, the system runs 5 test episodes to verify the environment:

```
================================================================================
🔬 INITIAL DIAGNOSTIC TEST
================================================================================
Running 5 test episodes to verify environment...

Test 1: WIN  | Damage: 25.0 | Frames: 543
Test 2: LOSS | Damage: 15.0 | Frames: 621
Test 3: WIN  | Damage: 32.0 | Frames: 478
Test 4: LOSS | Damage: 8.0  | Frames: 712
Test 5: DRAW | Damage: 0.0  | Frames: 1800

✅ Environment test complete:
   Avg damage: 16.0
   Avg frames: 830
   Random play W/L/D: 2/2/1
```

If this shows 0 damage consistently, there's a fundamental issue with the combat system.

## Monitoring Your Training

### What to Watch For

**Early Training (0-100k steps):**
- ✅ Reward improving from very negative
- ✅ Entropy staying >0.2
- ✅ Any damage rate >30%
- ⏳ Win rate 10-30%

**Mid Training (100k-500k steps):**
- ✅ Reward approaching 0 or positive
- ✅ Entropy 0.15-0.4
- ✅ Any damage rate >60%
- ✅ Win rate 40-60%

**Late Training (500k+ steps):**
- ✅ Reward positive and stable
- ✅ Entropy 0.1-0.3
- ✅ Any damage rate >80%
- ✅ Win rate >70%

### When to Stop and Adjust

**Stop if you see:**
1. **Entropy drops below 0.05** after 50k steps
   - Fix: Increase TRAIN_ENTROPY_COEF (try 0.02 or 0.05)

2. **Any damage rate stays below 20%** after 100k steps
   - Fix: Increase attackIntent reward or add early engagement penalty

3. **Reward stays very negative** (< -10) after 200k steps
   - Fix: Check reward weights, ensure combat is working

4. **Policy loss exploding** (>10) at any time
   - Fix: Lower learning rate (try 0.0001)

### Continuing Training

When continuing from a checkpoint, the system will:
- Load existing model from `models/policy/`
- Resume training from current step
- Append to existing logs
- Keep building opponent pool

## Environment Variables

Adjust training with these env vars:

```bash
# Logging
TRAIN_LOG_FREQUENCY=5000        # Log every N steps (default: 10000)

# Reward tuning
TRAIN_REWARD_STALLING=-0.1       # Penalty for stalling
TRAIN_REWARD_ATTACK_INTENT=0.05  # Reward for aggression
TRAIN_REWARD_RANGE_CONTROL=0.02  # Reward for spacing

# PPO hyperparameters
TRAIN_ENTROPY_COEF=0.01          # Entropy coefficient
```

## Quick Commands

```bash
# Start training
npm run train

# View progress
npx ts-node scripts/show-training-progress.ts

# Continue from checkpoint
npm run train  # Automatically loads existing model

# Tail logs
tail -f models/training.log
```

## Troubleshooting

### "Bot not learning"

1. Check initial diagnostic test - is damage being dealt?
2. Look at entropy - is it too low?
3. Check engagement - is anyDamageRate >30%?
4. Review health analysis suggestions

### "Training too slow"

- Normal: ~1000-2000 steps/hour on laptop
- Fast: ~5000-10000 steps/hour on desktop
- Very fast: ~20000+ steps/hour on GPU

### "Logs filling disk"

- training.log only keeps last checkpoint
- training-progress.jsonl is small (~1KB per eval)
- Old snapshots auto-pruned (max 18)

## Understanding the Numbers

**Reward:**
- Negative: Bot losing more than winning (normal early)
- Near zero: Bot breaking even
- Positive: Bot winning consistently

**Win Rate:**
- <30%: Still learning basics
- 30-50%: Competent
- 50-70%: Strong
- >70%: Expert level

**Damage Dealt:**
- 0-10: Barely touching opponent
- 10-30: Landing some hits
- 30-50: Consistent damage
- >50: Good combo execution

**Engagement (anyDamageRate):**
- <20%: Bot avoiding combat (CRITICAL)
- 20-40%: Learning to attack
- 40-60%: Decent aggression
- >60%: Good engagement
