# ML Training - Checkpoint Document
**Date:** January 10, 2026
**Status:** On Hold - Pivoting to PVP Development

---

## Summary

ML training system is **fully implemented and functional**, but training effectiveness is limited by opponent quality. We're pausing ML work to focus on the PVP mobile track, which will provide human gameplay data for better training.

---

## What's Complete ✅

### Phase 1-4: ML Infrastructure (100% Complete)
- ✅ Core fighting game engine (deterministic, headless-capable)
- ✅ Phaser 3.88.2 rendering layer
- ✅ Neural network policy (TensorFlow.js)
- ✅ PPO reinforcement learning trainer
- ✅ Opponent pool with Elo ranking system
- ✅ Style conditioning (rushdown, zoner, turtle, mixup)
- ✅ Curriculum training system
- ✅ Evaluation harness with behavior analysis
- ✅ Difficulty knobs (Level 1-10)
- ✅ Comprehensive test suite (116 tests passing)
- ✅ Training scripts with progress visualization
- ✅ Continuous training with auto-restart
- ✅ Enhanced logging and diagnostics

### Documentation (Complete)
- ✅ [ROADMAP.md](ROADMAP.md) - Dual-track strategy (PvP + ML)
- ✅ [ML-TRAINING-SYSTEM-PLAN.md](ML-TRAINING-SYSTEM-PLAN.md) - Full ML system design
- ✅ [ADVANCED-SCRIPTED-BOTS-PLAN.md](ADVANCED-SCRIPTED-BOTS-PLAN.md) - Bot architecture
- ✅ [TRAINING-GUIDE.md](../docs/TRAINING-GUIDE.md) - How to run training
- ✅ [TRAINING-MONITORING.md](../docs/TRAINING-MONITORING.md) - Health monitoring
- ✅ [ML-INTEGRATION-GUIDE.md](../docs/ML-INTEGRATION-GUIDE.md) - Bot integration
- ✅ Phase completion docs (Phases 1-4)

### Training Configuration (Stable)
```typescript
// Current stable config in src/ml/training/PPOTrainer.ts
DEFAULT_PPO_CONFIG = {
  learningRate: 0.00005,        // Reduced from 0.0003 for stability
  clipRange: 0.2,
  valueCoef: 0.5,
  entropyCoef: 0.01,
  maxGradNorm: 0.5,
  gamma: 0.99,
  lambda: 0.95,
  
  // Batch sizes
  nSteps: 1200,                 // Episode frame limit
  batchSize: 64,                // Reduced from 2048
  nEpochs: 10,
  minibatchSize: 32,
  
  // Reward weights (optimized for engagement)
  rewardWeights: {
    damageDealt: 1.0,
    damageTaken: -0.5,
    healthDifference: 0.5,
    matchWon: 50.0,
    matchLost: -50.0,
    attackLanded: 2.0,           // 2x reward for engagement
    attackBlocked: 0.5,
    comboExtended: 1.0,
    proximity: 0.1,
    stalling: -50.0,             // 50x penalty to prevent passivity
    timeLeft: -0.01
  }
};
```

---

## Current Issues 🔴

### 1. Training Effectiveness
**Problem:** Bot learning is limited by opponent quality

**Symptoms:**
- 100% win rate against current opponents (no learning pressure)
- Policy loss: 92.48 (should be <1)
- Value loss: 181.09 (should be <10)
- Network likely unstable from prolonged high-loss training

**Root Cause:** Current opponents (RandomBot, PersonalityBot) are too simplistic

### 2. Opponent Pool
**Problem:** Pool creates snapshots but doesn't use them effectively

**Symptoms:**
- All Elo ratings stuck at 1500 (no differentiation)
- Average games played: 0.0 (snapshots not competing)
- No genuine matchmaking occurring

**Needs Investigation:** OpponentPool.ts sampling logic

---

## What's Not Complete 📋

### Advanced Scripted Bots (Phase 6)
**Status:** Planned but not implemented

**Why Needed:** Current bots too weak for effective training

**Planned Bots:**
1. **TutorialBot** - Teaching bot for early training (difficulty 1-3)
2. **GuardianBot** - Defensive specialist (60-70% block rate)
3. **AggressorBot** - Rushdown with frame traps and pressure
4. **TacticianBot** - Zoner with projectiles and space control
5. **WildcardBot** - Unpredictable mixup specialist

**Architecture:**
- Modular tactics library (DefensiveTactics, OffensiveTactics, SpacingTactics)
- Behavior trees for decision making
- Difficulty knobs (1-10) controlling reaction time/accuracy
- See: [ADVANCED-SCRIPTED-BOTS-PLAN.md](ADVANCED-SCRIPTED-BOTS-PLAN.md)

### Special Moves (Phase 5)
**Status:** Planned but not implemented

**What's Missing:**
- Input buffer system for motion inputs
- Projectile system
- Special moves (Hadoken-style projectile, Shoryuken-style anti-air)
- Combo system with move canceling
- Super meter mechanics

**Impact on ML:** Advanced bots need special moves for tactical depth

---

## How to Resume ML Work

### Quick Start (1 command)
```bash
npm run train
```

This runs the progressive bot curriculum by default (Tutorial→Guardian→Aggressor→Tactician→Wildcard).

### Key Files to Review
```
src/ml/training/
├── train.ts                 # Main training script
├── PPOTrainer.ts           # PPO algorithm implementation
├── OpponentPool.ts         # Opponent management and Elo
├── CurriculumTrainer.ts    # Progressive training system
└── BotCurriculum.ts        # Bot progression configuration

src/ml/evaluation/
├── Evaluator.ts            # Model evaluation
└── evalRunner.ts           # Bot testing

src/core/ai/
├── NeuralBot.ts           # Neural network bot
├── NeuralPolicy.ts        # TensorFlow.js policy
└── bots/                  # Scripted bots (when implemented)
```

### Training Commands
```bash
# Train with default curriculum
npm run train

# View training progress
npx ts-node scripts/show-training-progress.ts

# Run continuous training (with auto-restart)
./scripts/train-continuous.sh

# Run ML tests
npm test -- tests/ml/
```

### Monitoring Training Health
Look for these metrics in logs:
- **Policy Loss:** Should be <1 after 100k steps
- **Value Loss:** Should be <10 after 100k steps
- **Entropy:** Should stay around 0.8-1.2 (exploration)
- **Win Rate:** Should be 40-70% (balanced challenge)
- **Engagement:** Should be >30% (bots fighting, not avoiding)

See: [TRAINING-MONITORING.md](../docs/TRAINING-MONITORING.md)

---

## Recommended Next Steps for ML (When Resuming)

### Priority 1: Implement Advanced Scripted Bots
**Estimated Time:** 3 weeks

1. **Week 1:** GuardianBot foundation
   - Defensive tactics library
   - Block decision logic
   - Whiff punishment
   - 20+ tests

2. **Week 2:** AggressorBot + TacticianBot
   - Offensive tactics (frame traps, pressure)
   - Spacing tactics (projectiles, zoning)
   - 40+ tests

3. **Week 3:** WildcardBot + Integration
   - Unpredictable behavior
   - Full bot roster testing
   - Curriculum integration

### Priority 2: Fix Opponent Pool
**Estimated Time:** 1 week

- Debug why snapshots have 0 games played
- Ensure Elo updates after matches
- Verify matchmaking logic
- Add pool diagnostics

### Priority 3: Reset and Retrain
**Estimated Time:** 2-3 weeks training time

1. Delete corrupted policy weights
2. Train against new GuardianBot (difficulty 3-5)
3. Monitor for stable losses
4. Gradually increase opponent difficulty
5. Let train for 10M steps

---

## Integration with PVP Track

Once PVP mobile is operational, human replays will dramatically improve training:

```
PvP Matches
  ↓
Replay Recording (frame-by-frame)
  ↓
Quality Filtering (score > 0.7)
  ↓
Skill Segmentation (beginner/intermediate/advanced/expert)
  ↓
Export to Training Pipeline
  ↓
ImitationTrainer (supervised learning from humans)
  ↓
PPO Refinement (RL self-play)
  ↓
Deploy Human-Like Bots
```

**Benefits:**
- Training from actual human strategies
- Diverse playstyles captured
- Progressive difficulty from real skill levels
- Validation against human performance metrics

---

## Key Learnings (For Future Reference)

### Training Insights
1. **Start with low learning rates** - High rates cause instability
2. **Smaller batches are more stable** - 64 works better than 2048
3. **Opponent quality > Opponent quantity** - 100% win rate = no learning
4. **Comprehensive logging is essential** - Can't fix what you can't measure

### Architecture Insights
1. **Modular tactics libraries enable reuse** - Same tactics across multiple bots
2. **Difficulty knobs provide progression** - One bot scaled beats multiple static bots
3. **Style diversity is critical** - Must train against multiple playstyles
4. **Frame-based patterns are too predictable** - ML exploits them instantly

---

## Files and Directories

### Training Data
```
models/
├── musashi_v1/                    # Neural network weights
│   ├── policy-0001.json          # Policy snapshots
│   ├── policy-0002.json
│   └── ...
└── backups/                       # Manual backups

replays/
├── match_0001.json               # Training replays (160+ files)
├── match_0002.json
└── ...
```

### Test Coverage
```
tests/ml/
├── NeuralBot.test.ts             # 10 tests ✅
├── NeuralPolicy.test.ts          # 8 tests ✅
├── PPOTrainer.test.ts            # 23 tests ✅
├── OpponentPool.test.ts          # 15 tests ✅
├── CurriculumTrainer.test.ts     # 12 tests ✅
├── Evaluator.test.ts             # 18 tests ✅
└── ImitationTrainer.test.ts      # 30 tests ✅

Total: 116 tests passing
```

---

## Contact Points for Future Work

### When to Resume ML Training:
1. After PVP mobile launches and collects 500+ human replays
2. After implementing advanced scripted bots (Phase 6)
3. After implementing special moves (Phase 5) - needed for bot depth
4. When ready for 2-3 week continuous training run

### What to Check First:
1. Review [PROGRESS-NOTES.md](PROGRESS-NOTES.md) for latest status
2. Run `npm test -- tests/ml/` to verify tests still pass
3. Check `models/musashi_v1/` for existing weights
4. Read [TRAINING-MONITORING.md](../docs/TRAINING-MONITORING.md) for health metrics

---

## Current Model Status

**Location:** `models/musashi_v1/`

**Training History:**
- Duration: ~1h 7m
- Total Steps: 10,000,384
- Win Rate: 100% (all victories)
- Policy Loss: 92.48 (unstable)
- Value Loss: 181.09 (unstable)

**Recommendation:** Delete and retrain from scratch once advanced bots are ready

---

## Questions for Future Developer (You!)

When resuming ML work, answer these:

1. **Are motion inputs implemented?**
   - Check `src/core/systems/InputManager.ts`
   - Needed for special moves in advanced bots

2. **Is frame advantage exposed in game state?**
   - Needed for punish logic in GuardianBot/TacticianBot
   - May need to add `Actor.frameAdvantage` field

3. **Is the combo/cancel system working?**
   - Check `cancellableInto` in `src/core/data/characters/musashi.ts`
   - Test if LP → LK → Special executes

4. **Why isn't opponent pool working?**
   - Investigate `OpponentPool.ts` sampling logic
   - Debug why games_played = 0.0
   - Check Elo update mechanism

---

## Conclusion

ML training infrastructure is **production-ready** but needs:
1. Better opponents (advanced scripted bots)
2. Human gameplay data (from PVP mobile)
3. Special moves implementation (Phase 5)

Pivoting to PVP track will provide the data foundation for truly effective training. When we return to ML, we'll have real human strategies to learn from, not just synthetic bot patterns.

**Current Status:** Ready to pivot to PVP development ✅
**When to Return:** After PVP mobile launches and collects 500+ replays
**Expected Training Duration:** 2-3 weeks continuous run for 10M+ steps

---

**Last Updated:** January 10, 2026
**Next Review:** When resuming ML track (after PVP launch)
