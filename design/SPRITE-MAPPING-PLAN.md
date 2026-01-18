# Sprite Mapping Plan - Character Assets

**Date:** January 17, 2026  
**Status:** Planning Phase

---

## Overview

We have 5 new character sprite folders (`enemy2/` through `enemy6/`) with consistent animations. This document outlines how to map these sprites to our 3 characters (Musashi, Kaze, Tetsuo) and identifies missing assets.

---

## Available Sprite Assets

### Player Folder (`assets/player/`)
**Frame Size:** 96x96 pixels  
**Sprites (23 total):**
- **Movement:** IDLE, WALK, RUN, DASH, JUMP, JUMP-START, JUMP-TRANSITION, JUMP-FALL
- **Combat:** ATTACK1, ATTACK 2, ATTACK 3, AIR ATTACK, SPECIAL ATTACK, THROW, DASH ATTACK
- **Defense:** DEFEND, HURT, DEATH
- **Advanced (unused):** CLIMBING, WALL CONTACT, WALL JUMP, WALL SLIDE, HEALING, HEALING NO EFFECT

### Enemy Folders (`assets/enemy2/` through `enemy6/`)
**Frame Size:** 64x64 pixels (assumed, needs verification)  
**Sprites (10 per folder):**
- IDLE
- RUN
- JUMP
- DASH
- ATTACK 1
- ATTACK 2
- ATTACK 3
- DASH ATTACK
- HURT
- DEATH

---

## Character Sprite Assignments

### Musashi (Balanced Zoner)
**Folder:** `assets/player/` (keep existing)  
**Archetype:** All-rounder with projectiles

**Sprite Mapping:**
- **IDLE** → idle state
- **WALK** → walk_forward/walk_backward
- **RUN** → faster movement
- **JUMP / JUMP-START / JUMP-FALL** → jump states
- **ATTACK1** → light_punch
- **ATTACK 2** → heavy_punch
- **ATTACK 3** → light_kick / heavy_kick
- **AIR ATTACK** → air attacks
- **SPECIAL ATTACK** → Hadoken (projectile throw)
- **THROW** → throw/grab
- **DEFEND** → block state
- **HURT** → hitstun/blockstun
- **DEATH** → knockdown

**Missing Sprites:**
- Shoryuken (dragon punch/uppercut) - use SPECIAL ATTACK as placeholder
- Hurricane Kick (spinning kick) - use DASH ATTACK or create new
- Hadoken projectile sprite (separate 32x32 fireball)

---

### Kaze (Fast Rushdown)
**Folder:** `assets/enemy2/` or `assets/enemy3/` (choose one)  
**Archetype:** Fast, aggressive pressure fighter

**Sprite Mapping:**
- **IDLE** → idle state
- **RUN** → walk_forward/walk_backward (faster movement matches archetype)
- **JUMP** → jump state
- **DASH** → Lightning Strike dash animation
- **ATTACK 1** → light_punch (fastest jab)
- **ATTACK 2** → heavy_punch / light_kick
- **ATTACK 3** → heavy_kick (launcher)
- **DASH ATTACK** → Lightning Strike special move (dash punch)
- **HURT** → hitstun/blockstun
- **DEATH** → knockdown

**Missing Sprites:**
- **DEFEND/BLOCK** - CRITICAL MISSING
  - Workaround: Use IDLE with tint/transparency
  - Future: Need proper defensive stance
- **Flash Kick** (invincible flip kick)
  - Workaround: Use JUMP or ATTACK 3 reversed
- **Air Dash** (mobility special)
  - Workaround: Use DASH sprite in air
- **CROUCH** (not critical)

---

### Tetsuo (Heavy Grappler)
**Folder:** `assets/enemy4/` or `assets/enemy5/` (choose one)  
**Archetype:** Slow, powerful, high damage

**Sprite Mapping:**
- **IDLE** → idle state (should look heavy/imposing)
- **RUN** → walk_forward/walk_backward (slower, heavier animation)
- **JUMP** → jump state (shorter, heavier arc)
- **DASH** → Charging Bull special (armored rush startup)
- **ATTACK 1** → light_punch
- **ATTACK 2** → heavy_punch (big haymaker)
- **ATTACK 3** → light_kick / heavy_kick
- **DASH ATTACK** → Charging Bull attack frames
- **HURT** → hitstun/blockstun
- **DEATH** → knockdown

**Missing Sprites:**
- **DEFEND/BLOCK** - CRITICAL MISSING
  - Workaround: Use IDLE with tint/transparency
  - Future: Need proper defensive stance
- **Spinning Piledriver** (360° command grab)
  - Workaround: Use DASH ATTACK or ATTACK 2
- **Seismic Slam** (ground pound)
  - Workaround: Use ATTACK 3 or create from DEATH frames
- **THROW** animation for command grab
  - Workaround: Use ATTACK 3 or DASH ATTACK
- **CROUCH** (not critical)

---

## Current Game States (FighterStatus)

From `src/core/interfaces/types.ts`:
- IDLE
- WALK_FORWARD / WALK_BACKWARD
- CROUCH
- JUMP
- ATTACK (covers all punch/kick variations)
- BLOCK
- HITSTUN (getting hit)
- BLOCKSTUN (blocking an attack)
- KNOCKDOWN
- WAKEUP

---

## Critical Missing Assets

### High Priority (Blocks Gameplay)

1. **DEFEND/BLOCK sprites** for Kaze and Tetsuo
   - **Impact:** Characters can't visually show blocking
   - **Workaround:** Use IDLE sprite with visual effect (shield/glow)
   - **Solution:** Commission or create defensive stance sprites

2. **Hadoken projectile** (Musashi)
   - **Impact:** Special move has no visual
   - **Workaround:** Use explosion.png or simple colored circle
   - **Solution:** Create 32x32 fireball sprite sheet

### Medium Priority (Polish)

3. **Special move unique animations**
   - Shoryuken (Musashi uppercut)
   - Flash Kick (Kaze flip kick)
   - Spinning Piledriver (Tetsuo grab)
   - Seismic Slam (Tetsuo ground pound)
   - **Workaround:** Reuse existing attack animations
   - **Solution:** Create custom animations per move

4. **CROUCH sprites** for all characters
   - **Impact:** Crouching looks identical to standing
   - **Workaround:** Skip crouching or use standing hurtbox
   - **Solution:** Create/commission crouch sprites

### Low Priority (Enhancement)

5. **THROW animations** for Kaze and Tetsuo
   - **Workaround:** Use ATTACK 3 or DASH ATTACK
   - **Solution:** Create throw-specific sprites

6. **Victory/Taunt animations**
   - **Workaround:** Use IDLE
   - **Solution:** Add celebration sprites

---

## Unused Enemy Folders

**Folders:** `assets/enemy6/` (and potentially enemy3/enemy5 if not used)

**Options:**
1. **Backup/Future Characters** - Save for 4th character
2. **Alternate Skins** - Color variations for existing characters
3. **Delete** - Clean up unused assets
4. **Boss Character** - Special AI opponent with unique sprites

**Recommendation:** Keep enemy6 as backup for future character expansion

---

## Implementation Plan

### Phase 1: Basic Character Sprites (Week 1)
- [ ] Map enemy2 → Kaze basic animations (IDLE, RUN, JUMP, ATTACK 1-3, HURT, DEATH)
- [ ] Map enemy4 → Tetsuo basic animations (same as above)
- [ ] Update `PhaserGameScene.ts` to load new sprite sheets
- [ ] Create animation definitions for Kaze and Tetsuo
- [ ] Test character switching in Character Test Lab

### Phase 2: Special Move Mapping (Week 1-2)
- [ ] Map DASH ATTACK → Lightning Strike (Kaze)
- [ ] Map DASH/DASH ATTACK → Charging Bull (Tetsuo)
- [ ] Create placeholder BLOCK animation (IDLE + visual effect)
- [ ] Test special moves with current sprites

### Phase 3: Missing Assets (Week 2-3)
- [ ] Create or commission DEFEND/BLOCK sprites for Kaze and Tetsuo
- [ ] Create Hadoken projectile sprite (32x32 fireball, 4-6 frames)
- [ ] Create or adapt special move animations:
  - Shoryuken (Musashi)
  - Flash Kick (Kaze)
  - Spinning Piledriver (Tetsuo)
  - Seismic Slam (Tetsuo)

### Phase 4: Polish & Refinement (Week 3-4)
- [ ] Add CROUCH sprites if needed
- [ ] Add THROW animations if needed
- [ ] Add victory/taunt animations
- [ ] Color adjustments and visual polish
- [ ] Animation timing adjustments

---

## File Structure

### Current Structure
```
assets/
├── player/          # Musashi (96x96, 23 sprites)
├── enemy/           # Original enemy (64x64, legacy)
├── enemy2/          # → Kaze (64x64, 10 sprites)
├── enemy3/          # (unused backup)
├── enemy4/          # → Tetsuo (64x64, 10 sprites)
├── enemy5/          # (unused backup)
└── enemy6/          # (unused backup)
```

### Recommended Rename (Future)
```
assets/
├── musashi/         # (formerly player/)
├── kaze/            # (formerly enemy2/)
├── tetsuo/          # (formerly enemy4/)
├── projectiles/     # Hadoken, etc.
└── _unused/         # Move enemy3, enemy5, enemy6 here
```

---

## Code Changes Required

### 1. PhaserGameScene.ts - preload()
Add sprite sheet loading for Kaze and Tetsuo:
```typescript
// Kaze sprites (enemy2)
this.load.spritesheet('kaze_idle', 'assets/enemy2/IDLE.png', { frameWidth: 64, frameHeight: 64 });
this.load.spritesheet('kaze_run', 'assets/enemy2/RUN.png', { frameWidth: 64, frameHeight: 64 });
// ... etc for all Kaze sprites

// Tetsuo sprites (enemy4)
this.load.spritesheet('tetsuo_idle', 'assets/enemy4/IDLE.png', { frameWidth: 64, frameHeight: 64 });
// ... etc for all Tetsuo sprites
```

### 2. PhaserGameScene.ts - createAnimations()
Define animations for each character state:
```typescript
// Kaze animations
this.anims.create({
  key: 'kaze_idle_anim',
  frames: this.anims.generateFrameNumbers('kaze_idle', { start: 0, end: -1 }),
  frameRate: 8,
  repeat: -1
});
// ... etc

// Tetsuo animations
this.anims.create({
  key: 'tetsuo_idle_anim',
  frames: this.anims.generateFrameNumbers('tetsuo_idle', { start: 0, end: -1 }),
  frameRate: 8,
  repeat: -1
});
// ... etc
```

### 3. FighterSprite.ts - Character-based sprite selection
Update sprite creation to use characterId:
```typescript
// Current: Uses team-based colors (rectangles)
// Future: Use character-specific sprite sheets
const spriteKey = `${fighter.characterId}_idle`; // e.g., 'kaze_idle'
this.sprite = scene.add.sprite(0, 0, spriteKey);
```

### 4. Character Data Files
Update character definitions with sprite frame counts if needed:
```typescript
// src/core/data/kaze.ts
export const KAZE: CharacterDefinition = {
  id: 'kaze',
  name: 'Kaze',
  sprites: {
    frameWidth: 64,
    frameHeight: 64,
    // ... sprite-specific config
  },
  // ... rest of definition
};
```

---

## Testing Checklist

### Per Character
- [ ] IDLE animation plays correctly
- [ ] Walking forward/backward uses correct sprite
- [ ] Jump animation plays and returns to idle
- [ ] All 4 basic attacks (LP, HP, LK, HK) show unique sprites
- [ ] HURT animation plays when hit
- [ ] DEATH animation plays on knockout
- [ ] BLOCK stance shows (even if placeholder)
- [ ] Facing direction flips sprites correctly
- [ ] Special moves show appropriate animations

### Integration
- [ ] All 3 characters selectable in Character Test Lab
- [ ] Can switch between characters with 1/2 keys
- [ ] All 9 matchups work (3x3 character combinations)
- [ ] Hitboxes align with sprite visuals
- [ ] No missing sprite errors in console

---

## Notes

- **Frame sizes differ:** Player sprites are 96x96, enemy sprites are 64x64 (needs verification)
- **Animation frame counts:** Unknown until sprite sheets are inspected
- **Current placeholder:** Game uses colored rectangles, not sprites yet
- **Priority:** Focus on getting 3 characters working with available sprites before creating new assets
- **Budget:** Missing assets may require commission work or AI generation

---

## Questions to Resolve

1. ❓ What are the exact frame dimensions of enemy2-6 sprites?
2. ❓ How many frames per animation in enemy2-6?
3. ❓ Should we rename folders now or wait until implementation?
4. ❓ Budget for commissioning missing sprites (DEFEND, special moves)?
5. ❓ Do we want alternate color schemes (use enemy3/enemy5)?
6. ❓ Should Hadoken projectile be animated (4-6 frames) or static?

---

## Success Criteria

- [ ] All 3 characters have complete basic move sets (idle, walk, jump, attacks, hurt, death)
- [ ] All 3 characters have BLOCK sprites or acceptable placeholders
- [ ] Musashi has Hadoken projectile visual
- [ ] Special moves map to appropriate animations (even if reused)
- [ ] Character Test Lab shows all 9 matchups working
- [ ] No console errors for missing sprites
- [ ] Sprites align with hitboxes (no visual mismatch)

---

## Related Documents

- [CHARACTER-SYSTEM-PLAN.md](CHARACTER-SYSTEM-PLAN.md) - Character stats and move definitions
- [SPRITE-GENERATION-PROMPTS.md](SPRITE-GENERATION-PROMPTS.md) - AI prompts for creating missing sprites
- [SPRITE-AND-SOUND-MAPPING.md](../docs/SPRITE-AND-SOUND-MAPPING.md) - Technical guide for sprite integration
- [ROADMAP.md](ROADMAP.md) - Overall project timeline

---

**Last Updated:** January 17, 2026  
**Next Review:** After Phase 1 implementation
