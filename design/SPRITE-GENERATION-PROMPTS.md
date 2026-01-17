# Character Sprite Generation Guide

## Overview

This document contains prompts for generating pixel art sprite sheets for two new characters in the Five Rings fighting game: **Kaze** (fast ninja) and **Tetsuo** (heavy grappler). These characters will complement the existing Musashi character.

## Style Reference Instructions

**YES - Absolutely provide your current sprites as reference images!**

To maintain visual consistency across all characters:

1. **Upload Existing Sprites**: Attach 2-3 of your current Musashi sprites (e.g., IDLE, WALK, ATTACK1) to your generation request
2. **Reference in Prompt**: Add this prefix to each prompt below:
   ```
   "Create a sprite matching the pixel art style of the reference images provided. Maintain the same level of detail, color saturation, shading technique, and animation quality."
   ```
3. **Key Style Elements to Match**:
   - Pixel density and resolution
   - Shading style (cell-shaded vs gradient)
   - Line thickness and outlining
   - Color palette approach (vibrant vs muted)
   - Animation timing and frame count philosophy
   - Background transparency handling

## Current Character Reference

Your existing character uses:
- **Assets Path**: `assets/player/` (Musashi/Player sprites)
- **Frame Size**: 96x96 pixels
- **Existing Animations**: IDLE, WALK, RUN, JUMP, JUMP-FALL, ATTACK1, ATTACK2, ATTACK3, SPECIAL ATTACK, DEFEND, HURT, DEATH
- **Style**: Fighting game pixel art with clear readable animations

## Recommended Workflow

1. Start with **IDLE** sprite for each character - this establishes the base style
2. Show the IDLE sprite to the generator alongside existing Musashi sprites
3. Use the approved IDLE as reference for subsequent animations
4. Generate animations in order: IDLE → WALK → ATTACKS → SPECIALS → HURT/DEATH
5. This ensures consistency throughout each character's sprite set

---

# Character Sprite Prompts

## Character 1: KAZE (Fast Ninja)

### Character Overview
- **Archetype**: Rushdown / Mobility Fighter
- **Design**: Agile ninja with dark blue/black outfit, masked face, lean athletic build
- **Fighting Style**: Fast strikes, air mobility, shadow techniques
- **Visual Theme**: Speed lines, afterimages, fluid motion
- **Size**: Standard (96x96), lighter frame than Musashi

---

### KAZE - Basic Movement

#### KAZE_IDLE
```
Create a sprite matching the pixel art style of the reference images. A ninja character in idle stance with dark blue/black outfit and mask. Lean athletic build. Subtle breathing animation with slight crouch, ready stance. 6 frames total. 96x96 pixels per frame arranged horizontally. Side view fighting game style. Match the shading and detail level of reference sprites.
```

#### KAZE_WALK
```
Create a sprite matching the pixel art style of the reference images. A ninja character walking forward smoothly with quick, light footsteps. Body stays low in stalking motion. 8 frames total. 96x96 pixels per frame arranged horizontally. Side view fighting game style. Match the animation smoothness of reference sprites.
```

#### KAZE_RUN
```
Create a sprite matching the pixel art style of the reference images. A ninja character running at high speed with very fast dash animation and subtle motion blur effect. Low profile sprint with forward lean. 8 frames total. 96x96 pixels per frame arranged horizontally. Side view fighting game style.
```

#### KAZE_JUMP
```
Create a sprite matching the pixel art style of the reference images. A ninja character jumping upward with powerful leap, tucked legs, and arms trailing. Explosive takeoff motion. 6 frames total. 96x96 pixels per frame arranged horizontally. Side view fighting game style.
```

#### KAZE_JUMP_FALL
```
Create a sprite matching the pixel art style of the reference images. A ninja character falling from jump with arms spread for balance. Light, controlled descent. 4 frames total. 96x96 pixels per frame arranged horizontally. Side view fighting game style.
```

---

### KAZE - Basic Attacks

#### KAZE_ATTACK1 (Light Punch - LP)
```
Create a sprite matching the pixel art style of the reference images. A ninja character performing a lightning fast knife hand strike (quick jab). Minimal wind-up, maximum speed. 4 frames total. 96x96 pixels per frame arranged horizontally. Side view fighting game style.
```

#### KAZE_ATTACK2 (Heavy Punch - HP)
```
Create a sprite matching the pixel art style of the reference images. A ninja character performing a spinning kunai slash with quick rotation and blade extended. Circular motion with weapon trail. 6 frames total. 96x96 pixels per frame arranged horizontally. Side view fighting game style.
```

#### KAZE_ATTACK3 (Light Kick - LK)
```
Create a sprite matching the pixel art style of the reference images. A ninja character performing a low sweep kick with fast leg extension near ground level. Tripping attack. 5 frames total. 96x96 pixels per frame arranged horizontally. Side view fighting game style.
```

#### KAZE_ATTACK4 (Heavy Kick - HK)
```
Create a sprite matching the pixel art style of the reference images. A ninja character performing an aerial spinning kick with body rotating horizontally and leg extended. Dynamic rotation. 6 frames total. 96x96 pixels per frame arranged horizontally. Side view fighting game style.
```

---

### KAZE - Special Moves

#### KAZE_SPECIAL1 (Shadow Strike - Forward Dash Attack)
```
Create a sprite matching the pixel art style of the reference images. A ninja character dashing forward with multiple shadow afterimages trailing behind. Teleport-like rush attack with 2-3 fading shadow copies. 8 frames total. 96x96 pixels per frame arranged horizontally. Side view fighting game style.
```

#### KAZE_SPECIAL2 (Kunai Barrage - Projectile)
```
Create a sprite matching the pixel art style of the reference images. A ninja character throwing multiple kunai knives in quick succession. Quick arm motion releasing 3 projectiles in spread pattern. 6 frames total. 96x96 pixels per frame arranged horizontally. Side view fighting game style.
```

#### KAZE_SPECIAL3 (Air Dive - Aerial Special)
```
Create a sprite matching the pixel art style of the reference images. A ninja character diving diagonally downward from air with blade-first descent and speed lines. Aggressive aerial attack. 5 frames total. 96x96 pixels per frame arranged horizontally. Side view fighting game style.
```

---

### KAZE - Defensive & Hurt

#### KAZE_DEFEND (Block)
```
Create a sprite matching the pixel art style of the reference images. A ninja character in defensive guard with arms crossed in front. Low stance ready to evade. Minimal motion. 3 frames total. 96x96 pixels per frame arranged horizontally. Side view fighting game style.
```

#### KAZE_HURT (Hit Reaction)
```
Create a sprite matching the pixel art style of the reference images. A ninja character recoiling from being hit. Body jerks backward with brief stagger. Pain reaction. 4 frames total. 96x96 pixels per frame arranged horizontally. Side view fighting game style.
```

#### KAZE_DEATH (K.O.)
```
Create a sprite matching the pixel art style of the reference images. A ninja character being defeated with dramatic fall and dissolving smoke effect. Body fades into shadows. 8 frames total. 96x96 pixels per frame arranged horizontally. Side view fighting game style.
```

---

## Character 2: TETSUO (Heavy Grappler)

### Character Overview
- **Archetype**: Grappler / Tank
- **Design**: Massive sumo-inspired wrestler, bald head with topknot, traditional mawashi belt or wrestling outfit
- **Fighting Style**: Slow but powerful, command grabs, armor on attacks
- **Visual Theme**: Weight, impact, ground-shaking presence
- **Size**: Standard frame (96x96) but fills more space, wider silhouette

---

### TETSUO - Basic Movement

#### TETSUO_IDLE
```
Create a sprite matching the pixel art style of the reference images. A massive wrestler/grappler character in idle stance. Very large muscular build, bald with topknot. Heavy breathing with chest expansion. Intimidating presence. 6 frames total. 96x96 pixels per frame arranged horizontally. Side view fighting game style.
```

#### TETSUO_WALK
```
Create a sprite matching the pixel art style of the reference images. A massive wrestler character walking forward slowly with heavy, ground-shaking steps. Ponderous movement suggesting weight and power. 6 frames total. 96x96 pixels per frame arranged horizontally. Side view fighting game style.
```

#### TETSUO_RUN
```
Create a sprite matching the pixel art style of the reference images. A massive wrestler character charging forward with slow but unstoppable momentum. Body leaning forward, building speed. 8 frames total. 96x96 pixels per frame arranged horizontally. Side view fighting game style.
```

#### TETSUO_JUMP
```
Create a sprite matching the pixel art style of the reference images. A massive wrestler character jumping with visible effort. Slow but powerful leap with body compact in air. Surprising agility for size. 8 frames total. 96x96 pixels per frame arranged horizontally. Side view fighting game style.
```

#### TETSUO_JUMP_FALL
```
Create a sprite matching the pixel art style of the reference images. A massive wrestler character falling heavily with arms spread. Large body descending with momentum. 4 frames total. 96x96 pixels per frame arranged horizontally. Side view fighting game style.
```

---

### TETSUO - Basic Attacks

#### TETSUO_ATTACK1 (Light Punch - LP)
```
Create a sprite matching the pixel art style of the reference images. A massive wrestler character performing a palm thrust with large open hand strike. Sumo-style push with force. 5 frames total. 96x96 pixels per frame arranged horizontally. Side view fighting game style.
```

#### TETSUO_ATTACK2 (Heavy Punch - HP)
```
Create a sprite matching the pixel art style of the reference images. A massive wrestler character performing a devastating overhand smash. Both fists raised overhead then slammed down with crushing force. 7 frames total. 96x96 pixels per frame arranged horizontally. Side view fighting game style.
```

#### TETSUO_ATTACK3 (Light Kick - LK)
```
Create a sprite matching the pixel art style of the reference images. A massive wrestler character performing a low stomp. Leg raised then stomps ground hard, creating shockwave effect. 6 frames total. 96x96 pixels per frame arranged horizontally. Side view fighting game style.
```

#### TETSUO_ATTACK4 (Heavy Kick - HK)
```
Create a sprite matching the pixel art style of the reference images. A massive wrestler character performing a wide sumo kick. Large sweeping leg motion, slow wind-up but massive range. 7 frames total. 96x96 pixels per frame arranged horizontally. Side view fighting game style.
```

---

### TETSUO - Special Moves

#### TETSUO_SPECIAL1 (Command Grab - Bear Hug)
```
Create a sprite matching the pixel art style of the reference images. A massive wrestler character performing a bear hug grab. Arms spread wide then close powerfully in crushing embrace. Grab motion. 8 frames total. 96x96 pixels per frame arranged horizontally. Side view fighting game style.
```

#### TETSUO_SPECIAL2 (Ground Slam - Throw Special)
```
Create a sprite matching the pixel art style of the reference images. A massive wrestler character performing a ground slam. Lifts opponent overhead then smashes them down with devastating force. Includes lift and slam motion. 10 frames total. 96x96 pixels per frame arranged horizontally. Side view fighting game style.
```

#### TETSUO_SPECIAL3 (Earthquake - Ground Pound)
```
Create a sprite matching the pixel art style of the reference images. A massive wrestler character jumping and landing with massive impact. Body rises then crashes down, ground cracks radiating outward with shockwave. 12 frames total. 96x96 pixels per frame arranged horizontally. Side view fighting game style.
```

---

### TETSUO - Defensive & Hurt

#### TETSUO_DEFEND (Block)
```
Create a sprite matching the pixel art style of the reference images. A massive wrestler character in defensive guard with arms up protecting head. Immovable stance, tanking hits. Minimal motion. 3 frames total. 96x96 pixels per frame arranged horizontally. Side view fighting game style.
```

#### TETSUO_HURT (Hit Reaction)
```
Create a sprite matching the pixel art style of the reference images. A massive wrestler character recoiling slightly from hit. Brief stagger but mostly absorbs damage due to size. Tough reaction. 4 frames total. 96x96 pixels per frame arranged horizontally. Side view fighting game style.
```

#### TETSUO_DEATH (K.O.)
```
Create a sprite matching the pixel art style of the reference images. A massive wrestler character being defeated. Slow fall to knees with struggle, then collapses forward heavily. Ground shaking impact implied. 10 frames total. 96x96 pixels per frame arranged horizontally. Side view fighting game style.
```

---

## Projectile & Effect Sprites

### KUNAI (Kaze's Projectile)
```
Create a sprite matching the pixel art style of the reference images. A small throwing kunai knife projectile spinning end-over-end. 16x16 pixels. 4 rotation frames arranged horizontally showing complete spin cycle. Side view fighting game style.
```

### SHADOW_CLONE (Kaze's Afterimage)
```
Create a sprite matching the pixel art style of the reference images. A dark shadowy afterimage silhouette of the ninja character. Semi-transparent with fading effect. Used for Kaze's dash attack trail. 96x96 pixels. 3 progressive fade frames arranged horizontally.
```

### SHOCKWAVE (Tetsuo's Ground Effect)
```
Create a sprite matching the pixel art style of the reference images. A ground-level expanding shockwave effect. Circular wave spreading outward along floor. Used for Tetsuo's earthquake and stomps. 128x32 pixels. 6 expansion frames arranged horizontally showing growth from small to large.
```

---

## Quality Checklist

Before finalizing each sprite:

- ✅ **Style Match**: Does it match the reference sprites' visual style?
- ✅ **Resolution**: Is it exactly 96x96 per frame (or specified size)?
- ✅ **Readability**: Are the animations clear and easy to read in motion?
- ✅ **Transparency**: Is the background properly transparent (alpha channel)?
- ✅ **Frame Count**: Does it have the correct number of frames?
- ✅ **Horizontal Layout**: Are frames arranged left-to-right in a single row?
- ✅ **Consistent Palette**: Does it use a limited, cohesive color palette?
- ✅ **Character Silhouette**: Is the character shape distinct and recognizable?
- ✅ **Frame Alignment**: Are all frames aligned consistently (foot position, center point)?

---

## File Naming Convention

Save generated sprites as:
```
assets/kaze/[ANIMATION_NAME].png
assets/tetsuo/[ANIMATION_NAME].png
assets/projectiles/[EFFECT_NAME].png
```

Example:
- `assets/kaze/IDLE.png`
- `assets/tetsuo/ATTACK1.png`
- `assets/projectiles/KUNAI.png`

---

## Animation Priority Order

Generate in this order for efficiency:

### Phase 1 (Core Character Movement)
1. IDLE - Establish character style
2. WALK - Basic locomotion
3. HURT - Hit reactions
4. DEFEND - Blocking

### Phase 2 (Combat Basics)
5. ATTACK1 (Light Punch)
6. ATTACK2 (Heavy Punch)  
7. ATTACK3 (Light Kick)
8. ATTACK4 (Heavy Kick)

### Phase 3 (Advanced Movement)
9. RUN - Fast movement
10. JUMP - Aerial
11. JUMP_FALL - Landing

### Phase 4 (Special Moves)
12. SPECIAL1 - Primary special
13. SPECIAL2 - Secondary special
14. SPECIAL3 - Super move

### Phase 5 (Polish)
15. DEATH - K.O. animation
16. Projectiles and effects

---

## Tips for Best Results

1. **Batch Generation**: Generate all animations for one character before moving to the next
2. **Style Locking**: Always include your reference images with each prompt
3. **Iteration**: Don't hesitate to regenerate if style drifts from reference
4. **Frame Testing**: Import sprites into game engine early to test animation flow
5. **Color Consistency**: Save your approved color palettes and reference them
6. **Feedback Loop**: Test in-game, note issues, regenerate specific frames if needed

---

## Additional Notes

- All sprites should be **side-view only** (engine will flip for opposite direction)
- **Pixel-perfect** alignment is crucial for smooth animation
- **Transparent backgrounds** required (PNG with alpha channel)
- Consider **attack hitbox** visibility - active frames should be visually distinct
- Special moves should be **visually impressive** while staying readable
- Character personalities should show through animation timing and posing

Good luck with your sprite generation! 🎮
