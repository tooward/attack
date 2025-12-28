# Five Rings: Development Roadmap

## Vision

Transform "Five Rings" into a production-ready fighting game with human-like AI opponents. We achieve this through two parallel development tracks:

1. **PvP Track:** Build mobile multiplayer to collect real human gameplay data
2. **ML Track:** Train intelligent bots using both synthetic and human data

These tracks inform and enhance each other, creating a virtuous cycle of improvement.

---

## Dual-Track Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                      PVP TRACK                              │
│  Build mobile multiplayer → Capture human gameplay         │
│  ↓                                                          │
│  Real player data feeds training pipeline                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    [REPLAY DATABASE]
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      ML TRACK                               │
│  Train bots with RL → Improve with human data              │
│  ↓                                                          │
│  Better bots enhance single-player experience              │
└─────────────────────────────────────────────────────────────┘
```

---

## Current State (December 2025)

### ✅ Completed
- Core fighting game engine (deterministic, headless-capable)
- Phaser rendering layer (desktop browser)
- Basic AI infrastructure (RandomBot, PersonalityBot)
- Neural network foundation (TensorFlow.js)
- Imitation learning trainer (supervised learning)
- Training mode with hitbox visualization
- Replay recording/playback system (training dummy)
- Special moves data structure (projectiles, motion inputs)

### 🔄 In Progress
- Special moves implementation (Phase 5)
- Combo system with cancels
- Motion input detection

### 📋 Planned
- Mobile deployment (PvP Track)
- Production ML training system (ML Track)
- Human gameplay recording infrastructure
- Additional characters and polish

---

## Track 1: PvP Mobile Multiplayer

**Goal:** Enable real-time PvP on iOS/Android to capture high-quality human gameplay data for AI training.

**Timeline:** 5-8 weeks

**Key Deliverables:**
- Mobile app (iOS + Android via Capacitor)
- Touch controls with gamepad layout
- Real-time multiplayer (WebSocket-based)
- Matchmaking with Elo ranking
- Complete gameplay recording (frame-by-frame)
- Replay validation and storage
- Privacy-compliant data collection

**Dependencies:**
- Core game engine (✅ Complete)
- Phaser integration (✅ Complete)
- Basic characters and moves (🔄 In Progress)

**See:** [design/PVP-MOBILE-PLAN.md](PVP-MOBILE-PLAN.md) for detailed implementation plan.

---

## Track 2: ML Training Pipeline

**Goal:** Build production-grade reinforcement learning system for training human-like bots with distinct personalities and difficulty levels.

**Timeline:** 5 weeks

**Key Deliverables:**
- PPO reinforcement learning trainer
- Opponent pool with Elo ranking
- Curriculum training system
- Dense reward shaping
- Difficulty knobs (Level 1-10)
- Style conditioning (rushdown, zoner, turtle, mixup)
- Anti-degenerate measures (stalling, loops)
- Mobile-optimized inference (<5ms, <1MB models)

**Dependencies:**
- Core game engine (✅ Complete)
- Basic AI infrastructure (✅ Complete)

**See:** [design/ML-TRAINING-SYSTEM-PLAN.md](ML-TRAINING-SYSTEM-PLAN.md) for detailed implementation plan.

---

## Integration Strategy

### Phase Integration Points

Both tracks can proceed in parallel with these synchronization points:

#### Integration Point 1: Replay Format Alignment
**When:** Week 2 of each track
**What:** Ensure PvP replay format compatible with ML training pipeline
- Both use same `ReplayFrame` structure
- Both track same game state fields
- Both support delta compression
- ML trainer can consume PvP replays directly

#### Integration Point 2: Human Data Bootstrap
**When:** ML Track Week 2 (Imitation Learning)
**What:** Use any available human replays to bootstrap training
- Train initial policy on human gameplay (if available)
- Fall back to self-play if no human data yet
- Continue with RL refinement regardless

#### Integration Point 3: Production Deployment
**When:** Both tracks complete
**What:** Combine PvP multiplayer with trained bots
- Offer both PvP and vs-AI modes
- Use human replays to continually improve bots
- Deploy updated bot models via app updates

---

## Development Phases

### Current: Phase 5 - Special Moves & Combos (Week 5-6)
**Focus:** Complete core fighting mechanics
- Motion input system
- Projectile physics
- Combo cancels and scaling
- Super meter mechanics

**Blocks:** Both PvP and ML tracks need complete move set.

---

### Next: Phase 6 - Polish & Game Feel (Week 6-7)
**Focus:** Make gameplay satisfying
- Hit freeze and screen shake
- Audio system (sounds, music)
- Training mode enhancements
- Visual effects

**Blocks:** PvP track needs polished gameplay for player retention.

---

### Parallel: PvP Track (Week 7-14)

#### PvP Phase A: Mobile Foundation (Week 7-8)
- Capacitor setup for iOS/Android
- Touch controls implementation
- Performance optimization for mobile
- App store submission prep

#### PvP Phase B: Backend Server (Week 9-10)
- WebSocket server (Node.js + TypeScript)
- Matchmaking system with Elo
- Real-time input synchronization
- Anti-cheat measures

#### PvP Phase C: Gameplay Recording (Week 11-12)
- Frame-by-frame replay capture
- Server-side validation
- Database storage (PostgreSQL)
- Replay quality scoring

#### PvP Phase D: Privacy & Launch (Week 13-14)
- User consent system (GDPR/CCPA)
- Data anonymization
- App store approval
- Beta launch

---

### Parallel: ML Track (Week 8-12)

#### ML Phase 1: Foundation (Week 8)
- Environment wrapper
- Enhanced observations with history
- Dense reward function
- Basic PPO trainer

#### ML Phase 2: Opponent Pool (Week 9)
- Pool manager with snapshots
- Elo rating system
- Sampling strategies
- Diversity measures

#### ML Phase 3: Curriculum & Safety (Week 10)
- Progressive training stages
- Stalling detection
- Loop detection
- Anti-degenerate penalties

#### ML Phase 4: Difficulty & Styles (Week 11)
- Difficulty knobs (Level 1-10)
- Style conditioning (4 styles)
- Bot runtime wrapper
- Inference optimization

#### ML Phase 5: Evaluation & Polish (Week 12)
- Comprehensive metrics
- Regression tests
- Mobile optimization
- Production deployment

---

## Hybrid Training Strategy

Once both tracks are operational:

### Stage 1: Imitation Bootstrap (Human Data)
```
Human Replays (PvP matches)
  ↓
Quality Filtering (score > 0.7)
  ↓
Skill Segmentation (beginner/intermediate/advanced)
  ↓
ImitationTrainer → Initial Policy
  ↓
Policy learns basic tactics from humans
```

### Stage 2: RL Refinement (Self-Play)
```
Human-Trained Policy (starting point)
  ↓
PPO Trainer + Opponent Pool
  ↓
Self-Play with Dense Rewards
  ↓
Policy improves beyond human baseline
```

### Stage 3: Continuous Improvement
```
New Human Replays (ongoing)
  ↓
Evaluate new strategies
  ↓
Fine-tune existing policies
  ↓
Deploy updated bots via app updates
```

**Benefits:**
- Human data provides diverse, creative strategies
- RL training removes human mistakes and optimizes
- Continuous human data prevents stagnation
- Bots stay current with meta evolution

---

## Success Metrics

### PvP Track Success
- [ ] Players find matches within 30 seconds
- [ ] Gameplay feels responsive (<100ms perceived lag)
- [ ] 90%+ of matches recorded successfully
- [ ] 1000+ high-quality replays collected
- [ ] Replay quality score > 0.7 average
- [ ] Player retention: >40% Day 7

### ML Track Success
- [ ] Bot beats scripted opponent >90%
- [ ] Level 1 loses to beginners, Level 10 beats intermediates
- [ ] 4 distinct fighting styles recognizable
- [ ] <10% stalling time, >0.6 action diversity
- [ ] <5ms inference on mobile devices
- [ ] Models <1MB total size
- [ ] All regression tests pass

### Integration Success
- [ ] PvP replays import into ML pipeline without errors
- [ ] Human-trained bots feel more "natural" than pure RL
- [ ] New human strategies reflected in bot behavior within 1 week
- [ ] Players can't easily distinguish Level 10 bot from human

---

## Resource Requirements

### PvP Track
**Development:**
- 1 developer (full-stack: TypeScript + Node.js)
- 5-8 weeks implementation
- ~200 hours total

**Infrastructure:**
- Backend server: $10-50/month (DigitalOcean/AWS)
- Database: $10-25/month (PostgreSQL)
- Storage: $5-20/month (replays)
- **Total: ~$25-100/month for <10k active users**

**One-Time:**
- Apple Developer: $99/year
- Google Play: $25 one-time
- ESRB/PEGI rating: $0-500

### ML Track
**Development:**
- 1 developer (ML engineer: TypeScript + TensorFlow.js)
- 5 weeks implementation
- ~150 hours total

**Infrastructure:**
- Training compute: Local development (desktop/laptop)
- Optional: Cloud GPU for faster training ($1-5/hour, ~10-20 hours)
- Model storage: <1GB total (negligible cost)
- **Total: ~$0-100 one-time for training**

**Hardware:**
- Recommended: M1/M2 Mac or NVIDIA GPU desktop for training
- Minimum: Modern laptop (training will be slower)

---

## Risk Assessment

### PvP Track Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| App store rejection | Medium | High | Follow guidelines, get ESRB rating, no chat |
| High server costs | Low | Medium | Use serverless, implement rate limiting |
| Network latency | Medium | Medium | Region locking, rollback netcode (future) |
| Small player base | Medium | Medium | Add offline bots, generous matchmaking |
| Privacy complaints | Low | High | Clear consent, GDPR compliance, anonymization |

### ML Track Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Training takes too long | Low | Low | Start with supervised learning, optimize hyperparams |
| Bots learn degenerate strategies | Medium | Medium | Anti-degenerate penalties, regression tests |
| Models too large for mobile | Low | Medium | Quantization, pruning, small architecture |
| Styles not distinct | Medium | Low | Strong reward modifiers, separate evaluation |
| Self-play collapse | Low | Medium | Opponent pool with diversity sampling |

---

## Decision Points

### Decision 1: Which Track First?
**Recommendation:** **Parallel Development**

**Rationale:**
- Tracks are largely independent
- ML training can start with synthetic data (self-play)
- Human data improves ML but isn't required to start
- Getting PvP launched early maximizes data collection time
- Both contribute to final product value

**Alternative:** If limited resources, prioritize **ML Track** first
- Reason: Single-player vs AI is core gameplay loop
- PvP is enhancement, not MVP requirement
- Can launch single-player first, add PvP later

### Decision 2: Backend Architecture
**Options:**
1. **Dedicated Server** (Node.js WebSocket server)
   - Pros: Full control, lower latency, authoritative server
   - Cons: Server costs, DevOps complexity
   
2. **Serverless + P2P** (AWS Lambda + WebRTC)
   - Pros: Scales to zero, lower costs at low player counts
   - Cons: Higher latency, complex NAT traversal

**Recommendation:** **Dedicated Server** for MVP
- Reason: Simpler to implement and debug
- Better replay validation (server authority)
- Can migrate to serverless later if costs spike

### Decision 3: Training Data Strategy
**Options:**
1. **Imitation Only** (learn from human replays)
   - Pros: Quick, requires less compute
   - Cons: Limited by human skill ceiling, no exploration
   
2. **RL Only** (pure self-play)
   - Pros: Can surpass human performance
   - Cons: May learn degenerate strategies, less human-like
   
3. **Hybrid** (imitation → RL refinement)
   - Pros: Best of both worlds, human-like with optimization
   - Cons: More complex pipeline

**Recommendation:** **Hybrid Approach**
- Start with RL self-play (don't wait for human data)
- Integrate human replays as they become available
- Use human data to fine-tune and prevent degenerate behavior

---

## Timeline Summary

```
Week 5-6:   Special Moves & Combos (Current)
Week 6-7:   Polish & Game Feel
Week 7-14:  PvP Track (parallel)
Week 8-12:  ML Track (parallel)
Week 13-15: Integration & Testing
Week 15:    Launch (PvP + trained bots)
```

**Total Duration:** ~10 weeks from current state to launch

**Critical Path:**
1. Complete Phase 5 & 6 (gameplay foundation)
2. Deploy PvP and ML tracks in parallel
3. Integrate and launch combined product

---

## Next Steps

1. **Complete Phase 5 & 6** (special moves, combos, polish)
   - Required before either track can proceed
   
2. **Choose Track Priority** (parallel or sequential)
   - Recommendation: Parallel if 2 developers available
   
3. **Set Up Infrastructure**
   - PvP: Provision server, database
   - ML: Set up training environment
   
4. **Begin Implementation**
   - Follow detailed plans in respective documents
   
5. **Monitor Metrics**
   - Track success criteria for each milestone
   - Adjust course based on results

---

## Long-Term Vision

### Post-Launch Improvements

**PvP Enhancements:**
- Rollback netcode (reduce perceived lag)
- Ranked modes with seasons
- Replay sharing and spectator mode
- In-game tournaments

**ML Enhancements:**
- Character-specific bot training
- Adaptive difficulty (learns your skill level)
- Boss characters with unique AI behaviors
- Meta-learning (rapid adaptation to player style)

**Side-Scroller Integration:**
- Use fighting system for combat encounters
- Trained bots become enemies in adventure mode
- Character progression unlocks new moves
- Story mode with AI boss fights

---

## Conclusion

This dual-track roadmap allows us to:
1. **Build multiplayer infrastructure** for long-term player engagement
2. **Train intelligent bots** for single-player experience
3. **Create a data flywheel** where human gameplay continuously improves AI
4. **Deliver value incrementally** with both PvP and vs-AI modes

Both tracks are valuable independently and synergistic together, creating a robust foundation for the full Five Rings vision.

**Key Insight:** We don't need to wait for human data to start ML training. Self-play gets us 80% of the way there, and human data polishes the final 20%.

Ready to begin implementation on your approval.
