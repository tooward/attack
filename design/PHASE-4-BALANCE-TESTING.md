# Phase 4: Character Balance Testing

**Status:** 🔄 In Progress  
**Started:** January 2026  

## Overview

Balance the 3 characters across 9 matchups through systematic playtesting and frame data tuning.

## Matchup Matrix

Track win rates for all character combinations. Target: 45-55% win rate for each matchup.

| Matchup | Games Played | P1 Wins | P2 Wins | Win Rate | Status | Notes |
|---------|--------------|---------|---------|----------|--------|-------|
| Musashi vs Musashi | 0 | 0 | 0 | - | ⏳ Pending | Mirror match baseline |
| Musashi vs Kaze | 0 | 0 | 0 | - | ⏳ Pending | Zoner vs Rushdown |
| Musashi vs Tetsuo | 0 | 0 | 0 | - | ⏳ Pending | Zoner vs Grappler |
| Kaze vs Musashi | 0 | 0 | 0 | - | ⏳ Pending | Rushdown vs Zoner |
| Kaze vs Kaze | 0 | 0 | 0 | - | ⏳ Pending | Mirror match |
| Kaze vs Tetsuo | 0 | 0 | 0 | - | ⏳ Pending | Rushdown vs Grappler |
| Tetsuo vs Musashi | 0 | 0 | 0 | - | ⏳ Pending | Grappler vs Zoner |
| Tetsuo vs Kaze | 0 | 0 | 0 | - | ⏳ Pending | Grappler vs Rushdown |
| Tetsuo vs Tetsuo | 0 | 0 | 0 | - | ⏳ Pending | Mirror match |

## Testing Methodology

### 1. Initial Playtesting (Human vs Human)
- Play 10 games per matchup
- Record wins, losses, dominant strategies
- Note: special moves that feel too strong/weak, combos that do excessive damage
- Identify degenerate strategies (infinites, unavoidable setups)

### 2. Bot Testing
- Run bot battles (50 games per matchup)
- Verify bots can execute special moves
- Check for AI exploits or patterns

### 3. Frame Data Analysis
- Compare frame data to successful fighting games
- Adjust startup/recovery based on playtest feedback
- Ensure risk/reward is balanced

## Current Character Stats

### Musashi (Balanced/Zoner)
**Base Stats:**
- Health: 100
- Speed: 1.0x
- Jump: 1.0x
- Damage: 1.0x

**Special Moves (Current Frame Data):**

**Hadoken (Projectile)**
- Light: 8 dmg, 15f startup, 3f active, 12f recovery (30f total)
- Heavy: 15 dmg, 22f startup, 3f active, 15f recovery (40f total)
- Notes: Need to test projectile speed and screen coverage

**Shoryuken (Anti-air)**
- Light: 12 dmg, 10f startup, 4f active, 20f recovery (34f total)
  - Invincible: 1-8f (strike)
- Heavy: 18 dmg, 8f startup, 5f active, 25f recovery (38f total)
  - Invincible: 1-10f (full)
- Notes: Check if invincibility windows are too long

**Hurricane Kick (Advancing)**
- Light: 10 dmg, 12f startup, 8f active, 15f recovery (35f total)
- Heavy: 18 dmg, 16f startup, 12f active, 18f recovery (46f total)
- Notes: Test distance traveled vs safety

### Kaze (Rushdown)
**Base Stats:**
- Health: 90 (fragile)
- Speed: 1.3x (fast)
- Jump: 1.2x (high)
- Damage: 0.9x (combo-focused)

**Special Moves (Current Frame Data):**

**Lightning Strike (Dash Punch)**
- Light: 8 dmg, 10f startup, 3f active, 10f recovery (23f total), +2 on block
- Heavy: 14 dmg, 12f startup, 4f active, 15f recovery (31f total), -4 on block
- Notes: Check if +2 on block enables infinite pressure

**Flash Kick (Charge Anti-air)**
- Light: 10 dmg, 8f startup, 5f active, 18f recovery (31f total)
  - Invincible: 1-6f (strike)
  - Requires: 30f charge
- Heavy: 16 dmg, 6f startup, 6f active, 22f recovery (34f total)
  - Invincible: 1-8f (full)
  - Requires: 30f charge
- Notes: Verify charge time feels reasonable

**Air Dash (Mobility)**
- No damage, 8f startup, 15f duration
- Moves 20 units forward
- Notes: Not implemented yet (air special moves pending)

### Tetsuo (Grappler)
**Base Stats:**
- Health: 120 (tank)
- Speed: 0.7x (slow)
- Jump: 0.8x (short)
- Damage: 1.3x (high)

**Special Moves (Current Frame Data):**

**Spinning Piledriver (Command Grab)**
- Light: 25 dmg, 5f startup, 1.2x grab range
- Heavy: 35 dmg, 3f startup, 1.5x grab range
- Notes: Not implemented yet (command grab system pending)

**Charging Bull (Armored Rush)**
- Light: 12 dmg, 18f startup, 8f active, 20f recovery (46f total)
  - Armor: 1 hit, 50% reduction, active 8-18f
- Heavy: 18 dmg, 20f startup, 10f active, 25f recovery (55f total)
  - Armor: 2 hits, 70% reduction, active 10-20f
- Notes: Test if armor windows are too strong

**Seismic Slam (Ground Pound)**
- Light: 10 dmg, 24f startup, 5f active, 25f recovery (54f total), +20 on hit
- Heavy: 16 dmg, 30f startup, 6f active, 30f recovery (66f total), +30 on hit
- Notes: Check if frame advantage enables guaranteed follow-ups

## Known Issues

### Musashi
- [ ] Hadoken projectile speed needs testing
- [ ] Shoryuken invincibility might be too long
- [ ] Hurricane Kick distance needs verification

### Kaze
- [ ] Lightning Strike +2 on block might enable infinite pressure
- [ ] Flash Kick charge time (30f) needs feel testing
- [ ] Air Dash not implemented yet

### Tetsuo
- [ ] Spinning Piledriver not implemented (command grab system)
- [ ] Charging Bull armor might be too strong
- [ ] Seismic Slam frame advantage needs combo testing

## Balance Adjustments Log

### Iteration 1 (Baseline)
- **Date:** January 2026
- **Changes:** Initial implementation from design document
- **Status:** Ready for testing

---

## Testing Checklist

### Setup
- [x] Create CharacterTestScene for rapid matchup testing
- [ ] Add character switching controls (1/2 keys)
- [ ] Add frame data debug display (F key)
- [ ] Add reset round function (R key)

### Playtesting
- [ ] Test all 9 matchups (10 games each)
- [ ] Record win rates
- [ ] Document dominant strategies
- [ ] Identify broken moves/combos

### Frame Data Tuning
- [ ] Review startup frames (too fast = hard to react)
- [ ] Review recovery frames (too short = unpunishable)
- [ ] Review invincibility windows (too long = reversal too strong)
- [ ] Review armor hit counts (too many = can't interrupt)

### Damage Balancing
- [ ] Test time-to-kill (target: 8-12 successful exchanges)
- [ ] Test combo damage (single combo shouldn't kill)
- [ ] Test chip damage (blocking shouldn't be free)
- [ ] Test damage scaling (combos scale to 30% minimum)

### Special Move Properties
- [ ] Test projectile speeds and ranges
- [ ] Test invincibility frame accuracy
- [ ] Test armor damage reduction values
- [ ] Test grab ranges (when implemented)

### Bot Integration
- [ ] Test bot with Musashi (zoning AI)
- [ ] Test bot with Kaze (rushdown AI)
- [ ] Test bot with Tetsuo (grappler AI)
- [ ] Verify bot uses special moves effectively

## Next Steps

1. Add CharacterTestScene to game (accessible via debug menu or URL param)
2. Complete implementation of missing features (command grabs, air specials)
3. Begin systematic playtesting with matchup matrix
4. Document all balance changes and rationale
5. Iterate on frame data based on feedback
6. Finalize character stats before ML training (Phase 5)

## Success Criteria

- ✅ All 9 matchups are viable
- ✅ No matchup has >60% or <40% win rate
- ✅ Each character has clear strengths and weaknesses
- ✅ No infinite combos or unbeatable strategies
- ✅ Special moves feel impactful but not broken
- ✅ Bots can effectively use each character
- ✅ Frame data is consistent with fighting game conventions
