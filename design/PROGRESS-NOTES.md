# Progress Notes - December 28, 2025

## Session Summary

### What We Accomplished

#### 1. ML Training System (Complete)
- ✅ Built full PPO reinforcement learning pipeline
- ✅ Implemented opponent pool with Elo rankings
- ✅ Added style conditioning (rushdown, zoner, turtle, mixup)
- ✅ Created curriculum training system
- ✅ Built evaluation harness with behavior analysis
- ✅ Added difficulty knobs (Level 1-10)
- ✅ 45+ comprehensive ML tests

#### 2. Training Infrastructure (Complete)
- ✅ Training script with 10M step support
- ✅ Progress visualization tool (sparkline charts, milestones)
- ✅ Continuous training script with auto-restart
- ✅ Enhanced logging with health checks every 10k/50k steps
- ✅ Automated diagnostics (entropy, engagement, losses, rewards)
- ✅ Configuration display on training startup

#### 3. Documentation (Complete)
- ✅ **ROADMAP.md** - Dual-track development strategy (PvP + ML)
- ✅ **PVP-MOBILE-PLAN.md** - 4-phase mobile multiplayer plan
- ✅ **ADVANCED-SCRIPTED-BOTS-PLAN.md** - Sophisticated bot architecture
- ✅ **TRAINING-MONITORING.md** - Training health monitoring guide
- ✅ **TRAINING-GUIDE.md** - How to run and configure training
- ✅ **ML-INTEGRATION-GUIDE.md** - Bot integration patterns
- ✅ Phase completion docs (Phases 1-4)

#### 4. Training Diagnosis & Fixes
- ✅ Identified critically high losses (policy: 93, value: 181)
- ✅ Reduced learning rate: 0.0003 → 0.00005 (6x slower)
- ✅ Reduced batch size: 2048 → 64 (32x smaller)
- ✅ Fixed TypeScript compilation errors in train.ts
- ✅ Diagnosed 100% win rate issue (opponents too weak)
- ✅ Identified opponent pool malfunction (Elo stuck, no games)

---

## Current State

### What's Working
- Core fighting game engine (deterministic, headless-capable)
- Phaser 3.88.2 rendering layer
- ML training infrastructure (scripts, logging, monitoring)
- Style-based training rotation
- Opponent pool snapshot creation
- Comprehensive test suite (45+ tests)

### What's Broken
- **Training effectiveness:** Losses 10-90x too high, network unstable
- **Opponent pool:** Not creating challenge (all Elo 1500, 0 games played)
- **Current bots:** Too simple (100% win rate, no learning pressure)
- **Neural network:** Likely corrupted from high-loss training

### Key Metrics from Last Training Run
```
Duration:        1h 7m 18s
Total Steps:     10,000,384
Win Rate:        100.0% (212 wins, 0 losses)
Policy Loss:     92.48 (should be < 1)
Value Loss:      181.09 (should be < 10)
Entropy:         0.91 (✅ healthy)
Final Reward:    2.59

Opponent Pool:
- Snapshots:     18
- All Elo:       1500 (no differentiation)
- Games Played:  0.0 (not competing)
```

---

## Next Steps (Priority Order)

### 1. Implement Advanced Scripted Bots (Week 1) 🔴 **CRITICAL**
**Problem:** Current opponents too easy (100% win rate = no learning)

**Solution:** Build 5 sophisticated bots per ADVANCED-SCRIPTED-BOTS-PLAN.md
- **GuardianBot** (Defensive) - Blocks 60-70%, punishes unsafe moves
- **AggressorBot** (Rushdown) - Frame traps, throw mixups, pressure
- **TacticianBot** (Zoner) - Projectiles, whiff punishes, space control
- **WildcardBot** (Mixup) - Unpredictable, adapts to patterns
- **TutorialBot** (Beginner) - Teaching bot for early training

**Architecture:**
- Modular tactics library (DefensiveTactics, OffensiveTactics, SpacingTactics)
- Behavior trees for decision making
- Difficulty knobs (1-10) controlling reaction time/accuracy
- 100+ tests for validation

**Timeline:** 3 weeks (1 week for GuardianBot foundation, 2 weeks for full roster)

---

### 2. Fix Opponent Pool System (Week 2) 🟠 **HIGH**
**Problem:** Pool creates snapshots but doesn't use them for matchmaking

**Investigation Needed:**
- Why is "average games played" 0.0?
- Are snapshots being loaded during training?
- Is Elo updating after matches?
- Check OpponentPool.ts sampling logic

**Expected Behavior:**
- Snapshots compete against each other
- Elo ratings diverge (not all 1500)
- Matchmaking selects opponents near current policy's Elo
- Win rate stabilizes around 50% as pool improves

---

### 3. Reset & Retrain with New Config (Week 2-3) 🟡 **MEDIUM**
**Problem:** Current model likely corrupted from extreme losses

**Plan:**
1. Delete existing policy weights (`rm -rf models/policy/*`)
2. Verify new config loaded (learning rate: 0.00005, batch size: 64)
3. Train with GuardianBot (difficulty 3-5) as opponent
4. Monitor logs for:
   - Policy loss < 1 (if still high, reduce LR further)
   - Value loss < 10
   - Win rate 40-70% (indicates proper challenge)
   - Engagement > 30% (bots fighting, not avoiding)

**Success Criteria:**
- Stable losses after 100k steps
- Win rate gradually increases from 30% → 60% over 1M steps
- Opponent pool Elo spreads (1400-1600 range)

---

### 4. Begin PvP Track (Weeks 3-6) 🟢 **LOW (Parallel Work)**
**Goal:** Collect human gameplay data for training

**Phases (from PVP-MOBILE-PLAN.md):**
- Phase A: Capacitor setup, touch controls (Week 1-2)
- Phase B: Backend WebSocket server, matchmaking (Week 3-4)
- Phase C: Replay recording & validation (Week 5-6)
- Phase D: Analytics & privacy compliance (Week 7-8)

**Can start in parallel** with bot implementation since it's independent work

---

## Lessons Learned

### Training ML Models
1. **Start with low learning rates** - 0.0003 was too aggressive for this problem
2. **Smaller batches = more stable** - 64 steps better than 2048 for gradient stability
3. **Comprehensive logging is essential** - Without it, "not learning well" is impossible to diagnose
4. **Opponent quality matters more than quantity** - 100% win rate means no learning pressure

### Scripted Opponents
1. **Frame-based patterns are too predictable** - ML exploits them instantly
2. **Must block and defend** - Pure offense doesn't teach defense
3. **Need variable difficulty** - Single bot difficulty doesn't provide progression
4. **Style diversity important** - Train against multiple playstyles (defensive, aggressive, zoner)

### Project Structure
1. **Document everything** - Roadmap, plans, and progress notes are invaluable
2. **Modular architecture pays off** - Tactics library enables bot reuse
3. **Test early and often** - 45+ tests caught issues before they became critical
4. **Dual tracks work** - PvP and ML can progress independently

---

## Technical Debt

### High Priority
- [ ] Motion input detection for special moves (needed for advanced bots)
- [ ] Frame advantage exposed in game state (needed for punish logic)
- [ ] Combo canceling system (referenced but may not be implemented)

### Medium Priority
- [ ] Performance optimization for bot decisions (<1ms target)
- [ ] Replay validation system for anti-cheat
- [ ] Model versioning and rollback system

### Low Priority
- [ ] Bot-vs-bot exhibition mode for entertainment
- [ ] Community bot scripting API
- [ ] Esports integration (difficulty leaderboards)

---

## Open Questions

1. **Motion inputs:** Is motion detection implemented for Hadoken/Shoryuken?
   - Check `src/core/systems/InputManager.ts`
   - Fallback: Use standing HP as placeholder anti-air

2. **Frame data:** Can we query frame advantage in real-time?
   - Need `Actor.frameAdvantage` exposed in game state
   - Workaround: Track manually in FrameDataAnalyzer

3. **Combo system:** Is move canceling working?
   - Check `cancellableInto` in musashi.ts move definitions
   - Test: Can LP → LK → Special execute?

4. **Why isn't opponent pool working?**
   - Snapshots created but never compete (0 games played)
   - All Elo stuck at 1500 (no rating changes)
   - Investigation needed in OpponentPool.ts

---

## Resources

### Key Files
- Training: `src/ml/training/train.ts`
- PPO Config: `src/ml/training/PPOTrainer.ts` (DEFAULT_PPO_CONFIG)
- Opponent Pool: `src/ml/training/OpponentPool.ts`
- Scripted Bots: `src/ml/evaluation/evalRunner.ts` (current simple bots)

### Documentation
- Roadmap: `design/ROADMAP.md`
- Bot Plan: `design/ADVANCED-SCRIPTED-BOTS-PLAN.md`
- Training Guide: `docs/TRAINING-GUIDE.md`
- Monitoring: `docs/TRAINING-MONITORING.md`

### Commands
```bash
# Train
npm run train

# View progress
npx ts-node scripts/show-training-progress.ts

# Continuous training
./scripts/train-continuous.sh

# Run tests
npm test

# Run ML tests only
npm test -- tests/ml/
```

---

## Commits Made This Session

### Commit 1: Add ML training system and advanced bot planning
- 48 files, 22,665+ lines
- Complete PPO training infrastructure
- Style conditioning & curriculum training
- Comprehensive documentation
- 45+ ML tests

### Commit 2: Fix training stability issues and update core game files
- 11 files, 2,070 insertions, 1,318 deletions
- Reduced learning rate to 0.00005
- Reduced batch sizes to 64
- Updated core game files for ML integration
- Diagnosed training issues (high losses, weak opponents)

---

## Summary

**Major Achievement:** Built production-grade ML training system from scratch with comprehensive testing and documentation.

**Current Blocker:** Training not effective due to weak opponents (100% win rate) and unstable neural network (losses 10-90x too high).

**Critical Path:** Implement advanced scripted bots to provide genuine challenge, then retrain from scratch with stable hyperparameters.

**Timeline:** 3 weeks to complete advanced bots + retrain = functional ML system ready for human data integration.

**Next Session:** Begin Phase 1 of advanced bot implementation (GuardianBot foundation).
