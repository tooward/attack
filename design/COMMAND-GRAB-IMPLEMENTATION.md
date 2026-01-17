# Command Grab System Implementation

## Overview
Completed implementation of the command grab system for Phase 3 of the CHARACTER-SYSTEM-PLAN. Command grabs are unblockable special moves with extended range that form a core part of the grappler archetype (Tetsuo).

## Implementation Summary

### New Methods in SpecialMoveExecutor.ts
1. **checkCommandGrab()** - Main validation and execution logic
   - Checks if move has `isCommandGrab: true` flag
   - Validates grab immunity using `isGrabImmune()`
   - Calculates grab range (base 60px × multiplier)
   - Checks distance and vertical tolerance
   - Executes grab if all conditions met

2. **isGrabImmune()** - Grab immunity checker
   - Returns true if fighter is:
     - Airborne (!isGrounded)
     - Invincible (invincibilityState !== null)
     - Already grabbed (HITSTUN status with 'throw' move)
     - Executing special move (activeSpecialMove !== null)

3. **calculateGrabRange()** - Range calculation
   - Base range: 60 pixels
   - Multiplied by move's grabRange property
   - Light variant: 60 × 1.2 = 72 pixels
   - Heavy variant: 60 × 1.5 = 90 pixels

4. **executeCommandGrab()** - Grab execution
   - Applies damage (25-35 for Spinning Piledriver)
   - Sets 40 frames hitstun (long for cinematic effect)
   - Pulls defender 20px toward attacker
   - Launches defender (velocity: 5 horizontal, -8 vertical)
   - Resets defender combo, increments attacker combo
   - Marks defender as 'grabbed' for animation

5. **processCommandGrabs()** - Game loop integration
   - Iterates all fighters with activeSpecialMove
   - Gets specialMove definition from characterDef
   - Only processes during active frames
   - Checks against all opponents (different teamId)
   - Breaks after first successful grab

### Game Loop Integration
Added step 3b in [Game.ts](../src/core/Game.ts):
```typescript
// 3b. Process command grabs (after physics, before combat)
if (characterDefs) {
  SpecialMoveExecutor.processCommandGrabs(newState, characterDefs);
}
```

**Placement Rationale:**
- After physics (step 3): Grab range checks need updated positions
- Before combat (step 4): Command grabs resolve before normal hits
- Separate from normal combat: Unblockable mechanics require different logic

### Character Configuration
Tetsuo's Spinning Piledriver ([tetsuo.ts](../src/core/data/tetsuo.ts)) configured with:

**Light Variant:**
- Motion: FULL_CIRCLE (360°) + PUNCH
- Damage: 25 (massive compared to normal 8-15)
- Startup: 5 frames
- Active: 3 frames (5-7f window)
- Recovery: 18 frames
- Grab Range: 1.2× (72 pixels)
- Buffer: 20 frames (lenient for 360° difficulty)
- isCommandGrab: true

**Heavy Variant:**
- Motion: FULL_CIRCLE (360°) + HEAVY_PUNCH
- Damage: 35 (enormous)
- Startup: 3 frames (faster!)
- Active: 3 frames (3-5f window)
- Recovery: 20 frames
- Grab Range: 1.5× (90 pixels)
- Buffer: 20 frames
- isCommandGrab: true

## Mechanics

### Unblockable Design
Command grabs completely ignore FighterStatus.BLOCK:
- No block check in code path
- Defender grabbed even while blocking
- Implements rock-paper-scissors: Grab beats Block

### Grab Immunity
Four conditions prevent grabs:

1. **Airborne** - Jump is fundamental counter
   - Universal in fighting games
   - Allows defensive option against grab pressure

2. **Invincible** - Reversal moves beat grabs
   - Shoryuken (full invincibility) immune during startup
   - Flash Kick immune during startup
   - Prevents guaranteed grab setups

3. **Already Grabbed** - Technical correctness
   - Prevents double-grab bugs
   - One grab at a time per fighter

4. **Executing Special** - Design choice for clarity
   - Prevents grab trade scenarios
   - No simultaneous command grabs
   - Clear outcome: first active grab wins

### Range System
Extended range compensates for difficult 360° input:
- Normal throw: 60 pixels
- Light command grab: 72 pixels (1.2×)
- Heavy command grab: 90 pixels (1.5×)

Heavy variant trades longer startup (3f vs 5f) for extended range and damage.

### Pull + Launch Effect
**Pull (20 pixels toward attacker):**
- Visual feedback that grab connected
- Prevents "grabbed from afar" feel
- Sets up for future grab animation

**Launch (5 horizontal, -8 vertical):**
- Enables juggle follow-ups
- Vertical launch (-8) for additional combo potential
- Rewards successful grab execution

### Hitstun Duration
40 frames (0.67 seconds at 60fps):
- Long enough for cinematic grab animation
- Allows attacker to dash forward for combo extension
- Standard for command grabs in fighting games

## Testing

### Unit Tests
Created [CommandGrab.test.ts](../tests/core/CommandGrab.test.ts) with 16 tests:

**checkCommandGrab tests (12):**
- ✅ Successfully grabs opponent within range
- ✅ Fails to grab opponent outside range
- ✅ Heavy variant grabs at extended range
- ✅ Does not grab airborne opponents
- ✅ Does not grab invincible opponents
- ✅ Does not grab already grabbed opponents
- ✅ Does not grab opponents executing specials
- ✅ Applies knockback to grabbed opponent
- ✅ Pulls defender toward attacker
- ✅ Increments attacker combo count
- ✅ Resets defender combo count
- ✅ Does not process non-command-grab moves

**processCommandGrabs tests (4):**
- ✅ Checks all active command grabs in game state
- ✅ Does not process during startup frames
- ✅ Does not process after active frames
- ✅ Only grabs one opponent per execution

**Test Results:**
```
Test Suites: 1 passed
Tests:       16 passed
Time:        1.419s
```

Full test suite: **605 tests passing**

## Balance Design

### Rock-Paper-Scissors
Command grabs enable archetype balance:

**Tetsuo (Grappler) > Musashi (Zoner)**
- Musashi zones with Hadoken projectiles
- Tetsuo uses Charging Bull armor to close distance
- At close range, command grab beats blocking
- Forces Musashi to backdash or reversal

**Kaze (Rushdown) > Tetsuo (Grappler)**
- Kaze's 1.3× speed avoids grabs
- Can bait grab whiff and punish 18-20f recovery
- Lightning Strike pressure (+2 on block)

**Musashi (Zoner) > Kaze (Rushdown)**
- Hadoken controls space vs fast Kaze
- Shoryuken anti-air beats jump approaches
- No command grab threat allows safer blocking

### Risk/Reward
**High Reward:**
- 25-35 damage (vs 8-15 normal attacks)
- Combo potential from launch
- Unblockable property

**High Risk:**
- 5-3f startup (reactable at close range)
- 18-20f recovery (big punish window if whiffed)
- Difficult 360° execution
- Grab immunity allows defensive options

### Time-to-Kill
With 1000 health:
- 3 successful heavy grabs (35 × 3 = 105 damage, need ~10 grabs)
- 4 successful light grabs (25 × 4 = 100 damage, need ~10 grabs)
- Intended: 8-12 successful exchanges to win
- Command grabs reduce exchanges but increase risk

## Next Steps for Phase 4

### 1. CharacterTestScene Integration
Add CharacterTestScene to game:
- Accessible from main menu or URL param
- Test Spinning Piledriver execution
- Verify grab ranges feel appropriate

### 2. Command Grab Testing
**Range validation:**
- 72px (light) feels fair for 360° difficulty
- 90px (heavy) feels generous but not broken
- Test against moving opponents

**Immunity validation:**
- Jump escapes command grab
- Invincible Shoryuken beats grab
- Mid-special opponents immune
- Can't double-grab

**Unblockable validation:**
- Grabs blocking opponents
- Visual feedback of pull effect
- Launch enables follow-ups

### 3. Matchup Testing
Play 10 games per matchup:
- Musashi vs Tetsuo (zoner vs grappler)
- Kaze vs Tetsuo (rushdown vs grappler)
- Tetsuo mirror (grappler vs grappler)
- Record results in matchup matrix

### 4. Frame Data Tuning
Based on test results:
- **Too easy to grab:** Reduce range or increase startup
- **Can't land grabs:** Increase range or reduce recovery
- **Too punishable:** Reduce recovery frames
- **Too safe:** Increase recovery frames

Target: 45-55% win rate for all matchups

### 5. Damage Tuning
Verify time-to-kill feels right:
- **Too fast:** Reduce damage (25→20, 35→30)
- **Too slow:** Increase damage or reduce health
- **Can't close distance:** Buff armor hits

### 6. Documentation
Create PHASE-4-COMPLETE.md when testing finishes:
- Final frame data for all special moves
- Final damage values
- Matchup analysis (9×9 matrix)
- Balance adjustment log
- Known issues and future work

## Technical Debt
None. Clean implementation with comprehensive tests.

## Files Modified
- [src/core/special/SpecialMoveExecutor.ts](../src/core/special/SpecialMoveExecutor.ts) - Added 6 methods (164 lines)
- [src/core/Game.ts](../src/core/Game.ts) - Added step 3b for command grab processing
- [tests/core/CommandGrab.test.ts](../tests/core/CommandGrab.test.ts) - NEW: 16 tests

## Files Referenced
- [src/core/data/tetsuo.ts](../src/core/data/tetsuo.ts) - Spinning Piledriver configuration
- [src/core/interfaces/types.ts](../src/core/interfaces/types.ts) - Type definitions

## Completion Status
✅ **Phase 3 Complete**: Command grab system fully implemented
- All methods implemented and tested
- Game loop integration complete
- Character configuration verified
- 16 unit tests passing
- No compilation errors

Ready to proceed with Phase 4 balance testing.
