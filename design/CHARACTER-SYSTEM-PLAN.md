# Character System - Implementation Plan

**Goal:** Add 3 distinct characters with unique fighting styles and mobile-friendly special moves.

**Timeline:** 3-4 weeks

**Current Status:** Design phase

---

## Character Roster

### 1. **Musashi** (Balanced/Zoner)
**Archetype:** Balanced with zoning tools
**Playstyle:** Mid-range control, defensive options
**Strengths:** Projectiles, anti-air, spacing
**Weaknesses:** Lower damage, requires precise spacing

**Stats:**
- Health: 100 (standard)
- Speed: 1.0x (standard)
- Jump: 1.0x (standard)
- Damage scaling: 1.0x

**Special Moves:**
- **Hadoken** (↓↘→ + Punch) - Projectile
  - Light: Fast, low damage (8), 15f startup
  - Heavy: Slow, high damage (15), 22f startup
- **Shoryuken** (→↓↘ + Punch) - Anti-air uppercut
  - Light: 10f startup, invincible 1-8f, 12 damage
  - Heavy: 8f startup, invincible 1-10f, 18 damage
- **Hurricane Kick** (↓↙← + Kick) - Advancing spin
  - Light: Single hit, 12f startup, 10 damage
  - Heavy: Multi-hit, 16f startup, 18 damage total

### 2. **Kaze** (Rushdown)
**Archetype:** Fast, aggressive pressure
**Playstyle:** Close-range mixups, frame traps
**Strengths:** Speed, combo potential, pressure
**Weaknesses:** Low health, risky gameplan

**Stats:**
- Health: 90 (fragile)
- Speed: 1.3x (fast)
- Jump: 1.2x (high/floaty)
- Damage scaling: 0.9x (requires combos)

**Special Moves:**
- **Lightning Strike** (→→ + Punch) - Dash punch
  - Light: Safe on block, 10f startup, 8 damage, +2 on block
  - Heavy: Punishable, 12f startup, 14 damage, -4 on block
- **Flash Kick** (↓(charge)↑ + Kick) - Invincible flip kick
  - Light: 8f startup, upper body invincible, 10 damage
  - Heavy: 6f startup, fully invincible, 16 damage
- **Air Dash** (→→ in air) - Mobility tool
  - Crosses up, no damage
  - 8f startup, can follow with air normal

### 3. **Tetsuo** (Grappler)
**Archetype:** Command grabs, armor moves
**Playstyle:** Patient, reads, high damage
**Strengths:** Massive damage, armor, throw range
**Weaknesses:** Slow, vulnerable to zoning

**Stats:**
- Health: 120 (tank)
- Speed: 0.7x (slow)
- Jump: 0.8x (short/floaty)
- Damage scaling: 1.3x (high damage)

**Special Moves:**
- **Spinning Piledriver** (360° + Punch) - Command grab
  - Light: 5f startup, 1.2x grab range, 25 damage
  - Heavy: 3f startup, 1.5x grab range, 35 damage
- **Charging Bull** (←(charge)→ + Punch) - Armored rush
  - Light: 1 hit armor, 18f startup, 12 damage, -2 on block
  - Heavy: 2 hit armor, 20f startup, 18 damage, -4 on block
- **Seismic Slam** (↓↓ + Kick) - Ground pound
  - Light: Hits grounded, 24f startup, 10 damage
  - Heavy: Hits grounded + launches, 30f startup, 16 damage

---

## Mobile-Friendly Input System

### **Problem:** Complex motion inputs (like 360° or DP) are hard on touch D-pad

### **Solution:** Simplified motion detection with leniency

**Input Types:**

1. **Quarter-Circle Forward** (↓↘→)
   - Works: Down → Down-Right → Right (3 inputs)
   - Also accepts: Down → Right (2 inputs, lenient)
   - Buffer: 10 frames (167ms)

2. **Quarter-Circle Back** (↓↙←)
   - Works: Down → Down-Left → Left
   - Also accepts: Down → Left (lenient)
   - Buffer: 10 frames

3. **Dragon Punch** (→↓↘)
   - Works: Right → Down → Down-Right
   - Also accepts: Right → Down (lenient)
   - Buffer: 12 frames (200ms, more lenient)

4. **Charge Moves** (← hold 30f, then →)
   - Hold back/down for 30 frames (500ms)
   - Press forward + button
   - Very mobile-friendly (hold while moving)

5. **Dash Input** (→→ or ←←)
   - Double tap within 12 frames (200ms)
   - Alternative: Hold direction + LP+LK
   - Buffer: 12 frames

6. **360° Motion** (Full circle)
   - Any 6+ directions in order within 20 frames
   - Can start/end anywhere in circle
   - Extra lenient for grapplers

### **Visual Feedback:**
- Show motion trail on D-pad during input
- Flash green on successful special move
- Subtle haptic feedback on motion completion

---

## Implementation Phases

### **Phase 1: Character Data Structure** (Week 1)

**Tasks:**
1. Create `CharacterDefinition` interface extension
   - Add `archetype: 'balanced' | 'rushdown' | 'grappler'`
   - Add `stats: { health, speed, jump, damageScaling }`
   - Add `specialMoves: SpecialMove[]`

2. Define `SpecialMove` interface
   ```typescript
   interface SpecialMove {
     id: string;              // 'hadoken'
     name: string;            // 'Hadoken'
     input: MotionInput;      // QCF + Punch
     variants: {
       light: MoveProperties;
       heavy: MoveProperties;
     };
     properties: {
       projectile?: ProjectileData;
       invincibility?: InvincibilityFrames;
       armor?: ArmorProperties;
       movement?: MovementData;
     };
   }
   ```

3. Create character data files
   - `src/core/data/musashi.ts` (extend existing)
   - `src/core/data/kaze.ts` (new)
   - `src/core/data/tetsuo.ts` (new)

### **Phase 2: Motion Input System** (Week 1-2)

**Tasks:**
1. Create `MotionDetector` class
   - Track input history (last 20 frames)
   - Detect quarter-circles, DP motions, charges
   - Apply leniency rules
   - Return matched motion + button

2. Integrate with `InputHandler`
   - Store directional input history
   - Check for special move inputs each frame
   - Priority: Special moves > Normal moves

3. Add input buffer system
   - Store inputs for 10-20 frames
   - Allow special moves during other animations
   - Cancel system integration

4. Create motion input tests
   - Test all 6 motion types
   - Test leniency windows
   - Test buffer system

### **Phase 3: Special Move Execution** (Week 2)

**Tasks:**
1. Extend game state to track special moves
   - Add `specialMoveState` to fighter state
   - Track projectile entities
   - Handle armor/invincibility frames

2. Implement projectile system
   - Projectile entity with hitbox
   - Movement and collision
   - Durability (can clash with other projectiles)
   - Destruction on hit/block/max distance

3. Implement invincibility/armor
   - Frame-by-frame invincibility tracking
   - Armor hit absorption
   - Visual feedback (flashing, particles)

4. Implement command grabs
   - Unblockable throw with extended range
   - Cannot be teched
   - Special animation

### **Phase 4: Character-Specific Balance** (Week 2-3)

**Tasks:**
1. Implement stat modifiers
   - Health scaling (90-120)
   - Speed scaling (0.7-1.3x)
   - Damage scaling (0.9-1.3x)
   - Jump arc adjustments

2. Frame data for each character
   - Normal move frame data (startup, active, recovery)
   - Special move frame data
   - Block advantage calculations
   - Hitbox/hurtbox sizes

3. Combo system adjustments
   - Character-specific cancel windows
   - Juggle limits per character
   - Damage scaling per combo length

4. Balance testing
   - Each character vs scripted bots
   - Character matchup testing (3v3 = 9 matchups)
   - Win rate should be 45-55% for each matchup

### **Phase 5: ML Training Integration** (Week 3-4)

**Tasks:**
1. Update observation encoder
   - Add self character ID (3 values, one-hot)
   - Add opponent character ID (3 values, one-hot)
   - Add character-specific state (charge time, projectiles)
   - Total: +6-10 observation features

2. Retrain bots for all matchups
   - 9 matchups total (3x3)
   - Train curriculum for each matchup
   - Progressive difficulty per character
   - Estimated: 3-5M steps per matchup = 27-45M total

3. Character-specific bot behavior
   - Musashi bots use zoning/spacing
   - Kaze bots use rushdown/pressure
   - Tetsuo bots use grabs/armor

4. Update exhibition mode
   - Character select for player
   - Character select for bot opponent
   - Show character vs character matchup

### **Phase 6: UI/UX Integration** (Week 4)

**Tasks:**
1. Character select screen improvements
   - Show 3 character portraits
   - Display archetype and stats
   - Show special moves list
   - Preview animations

2. In-game HUD updates
   - Show character name
   - Show special move icons (ready/cooldown)
   - Charge meter indicator (for charge characters)

3. Move list display
   - Pause menu with full move list
   - Input notation display
   - Frame data (optional, advanced)

### **Phase 7: Character Training Mode** (Week 4-5)

**Goal:** Interactive tutorial system that teaches players moves with visual demonstrations - feels like a guided experience, not a match

**Key Philosophy:** Practice mode should feel like a game with instructions and walkthroughs, not a combat scenario

**Tasks:**
1. Create CharacterTrainingScene
   - Character select screen (pick from 3 characters)
   - Shows character portrait, name, archetype, special move list preview
   - "Enter Training" button transitions to training room
   - **NO OPPONENT spawned** (solo practice only)
   - **NO falling bomb obstacles** (clean, distraction-free environment)
   - Player cannot die or lose

2. Onscreen Control Walkthrough
   - Display interactive tutorial at start
   - Walk through basic controls step-by-step (movement, attacks, block, jump)
   - Visual highlights show which buttons to press
   - Tutorial flow feels guided and game-like
   - Player progresses through tutorial before accessing full move list

3. Move List Display (Right Side of Screen)
   - **Always visible** scrollable move list on right side
   - Each move shows:
     - Move name (e.g., "Hadoken")
     - Input notation (e.g., "↓↘→ + Punch")
     - Damage value
     - Frame data (startup, advantage)
     - Execution success rate (e.g., "8/10 successful")
   - Move list organized by category: Normals, Special Moves, Command Grabs
   - Selected move is highlighted

4. Move Selection & Demonstration System
   **When player selects a move from list:**
   
   a. **Demonstration Phase (Automatic):**
   - Camera focuses on character
   - Character **automatically performs** the selected move
   - Move statistics overlay appears:
     - Damage, startup frames, block advantage
     - Motion input diagram (visual arrows for QCF, DP, etc.)
   - **Control visualization:**
     - Highlight the keys/buttons used for the move
     - Place **numbers on keys** showing order/timing (e.g., "1→2→3")
     - Animate the input sequence with timing
     - Example: For QCF+P, show "Down(1) → Forward(2) → Punch(3)"
   - Slow-motion option available (toggle for 0.5x speed)
   
   b. **Practice Prompt:**
   - After demo completes, show: "Practice this move? [Yes] [No]"
   - **Yes**: Enter practice mode for that specific move
     - Practice counter appears (e.g., "0/10 successful")
     - Input display shows current inputs
     - Visual feedback: Green checkmark on success, red X on failure
     - Audio cue on successful execution
   - **No**: Return to move list to select another move
   
5. Practice Mode Features
   - **Solo practice** - No opponent present
   - **Clean environment** - No hazards, obstacles, or distractions
   - Input history display (shows last 10 inputs on bottom of screen)
   - Successful execution counter per move (persists across sessions)
   - Visual feedback on execution:
     - Green border flash on successful special move
     - Red border pulse on failed attempt
     - Confetti/particle effect on milestone (10/10, 25/25, etc.)
   - Combo damage display (for combo sequences)
   - Reset position button (returns character to center)
   - Infinite health/meter enabled by default
   - "Return to Move List" button always accessible

6. Training dummy options (OPTIONAL - Advanced Practice)
   - Default: **No opponent** (solo practice)
   - Optional dummy toggle in menu:
     - **Standing Dummy** - Doesn't move, absorbs hits
     - **Blocking Dummy** - Always blocks, practice block strings
     - **Combo Dummy** - Gets hit, shows juggle state
   - Note: Dummies are clearly OPTIONAL and not required for learning

7. Character-specific tutorials
   - **Musashi Tutorial**: 
     - Hadoken execution (5 successful)
     - Shoryuken anti-air timing (3 successful)
     - Spacing and zoning concepts
   - **Kaze Tutorial**: 
     - Lightning Strike dash punch (5 successful)
     - Flash Kick charge timing (3 successful)
     - Rushdown pressure sequences
   - **Tetsuo Tutorial**: 
     - Spinning Piledriver 360° input (3 successful)
     - Charging Bull armor usage (hit through 2 dummy attacks)
     - Command grab setups and tick throws
   - Each tutorial includes:
     - Step-by-step demonstrations with highlighted controls
     - Clear success criteria
     - Progress tracking
     - Completion reward (unlock character portrait/badge)
   
8. Menu integration
   - Add "Character Training" button to main menu (distinct from "Practice Mode")
   - Button placement: Main Menu → [Play] [Character Training] [Settings]
   - Character select screen shows:
     - Character portrait (large)
     - Name and archetype
     - Special move preview (3 move names)
     - "Enter Training" button
     - Progress indicator (e.g., "12/15 moves mastered")
   - Can exit back to character select or main menu anytime
   - Training mode clearly labeled as "Tutorial & Practice" to distinguish from regular Play mode
   - **Combo Dummy** - Gets hit, shows juggle state and combo counter
   
4. Training features
   - Input history display (shows last 10 inputs on screen)
   - Successful special move counter (track execution rate)
   - Combo damage display
   - Reset position button
   - Infinite health/meter toggle

5. Character-specific tutorials
   - **Musashi Tutorial**: Fireball zoning, anti-air timing, spacing
   - **Kaze Tutorial**: Dash mixups, frame traps, pressure sequences
   - **Tetsuo Tutorial**: Command grab setups, armor usage, tick throws
   
6. Menu integration
   - Add "Character Training" button to main menu (between Practice and Settings)
   - Character select screen shows: Portrait, Name, Archetype, "Enter Training"
   - Can exit back to character select or main menu

---

## Technical Considerations

### **Observation Space Size**
- Current: ~40 features
- Added: +6-10 (character IDs, special state)
- New total: ~46-50 features
- **Impact:** Minimal, neural network size stays same

### **Training Time**
- Current: 10M steps for 1 character mirror
- New: 27-45M steps for 9 matchups (3x3)
- **Timeline:** 3-5 days on M1/M2 Mac
- **Cost:** Free (local training)

### **Model Size**
- Current: <500KB per style
- New: <500KB per character-style combo
- Total: ~6MB (3 characters × 4 styles × 500KB)
- **Impact:** Still mobile-friendly

### **Sprite Assets**
- Need sprites for 2 new characters (Kaze, Tetsuo)
- Each character needs:
  - Idle, walk, jump (existing)
  - 4 normal attacks (existing)
  - 3-4 special move animations (new)
  - Hit/block reactions (existing)
- **Total:** ~8 new animations per character = 16 animations

---

## Success Criteria

- [ ] All 3 characters playable with distinct feel
- [ ] Special moves execute reliably on mobile (>90% success rate)
- [ ] Motion input system feels responsive (<3 frame delay)
- [ ] Each character has viable gameplan against others
- [ ] Bot can use special moves appropriately (>50% of optimal usage)
- [ ] Win rates balanced across all 9 matchups (45-55%)
- [ ] Character Training mode accessible from main menu
- [ ] Move list display shows all moves with notation
- [ ] Players can practice special moves without opponent
- [ ] Character-specific tutorials completable in <5 minutes each
- [ ] Input history display helps players understand motion inputs
- [ ] Player can complete character tutorial in <5 minutes
- [ ] Move list is accessible and understandable

---

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Motion inputs too hard on mobile | Medium | High | Extensive leniency testing, offer simplified inputs |
| Characters feel too similar | Low | Medium | Strong stat differentiation, unique animations |
| Training takes too long | Medium | Medium | Train matchups in parallel, use cloud GPU if needed |
| Balance issues | High | Medium | Iterative balance patches, gather player feedback |
| Assets take too long | Low | High | Use placeholder sprites, commission artists early |
| ML can't learn character-specific tactics | Low | High | Add character-specific reward modifiers |

---

## Next Steps

1. ✅ Get user approval on character designs
2. ✅ Add Character Training Mode to implementation plan
3. Create USER-MANUAL.md with character movesets (✅ Complete)
4. Implement Phase 1 (character data structure)
5. Begin Phase 2 (motion input system)
6. Update current training to complete
7. Plan asset creation (sprites/animations)
8. Design training mode UI mockups

---

## Open Questions

1. Should we add a 4th character for more variety?
2. Do we want super moves (meter-based ultras)?
3. Should motion inputs have an "Easy Mode" toggle?
4. How do we handle character unlocking? (All available vs progression)
5. Should bots have character preferences or rotate?

