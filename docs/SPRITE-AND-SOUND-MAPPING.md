# Sprite and Sound Mapping Guide

This guide explains how the game maps visual sprites and audio to game entities (players, bots, projectiles).

---

## Architecture Overview

The game uses a **separation of concerns** architecture:

```
┌─────────────────────────────────────────────────────────┐
│  CORE LAYER (Pure TypeScript)                           │
│  - FighterState (position, health, status)              │
│  - No visual or audio information                       │
│  - Pure data and game logic                             │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  PHASER RENDERING LAYER                                 │
│  - FighterSprite reads FighterState                     │
│  - Maps fighter data → visual representation            │
│  - Maps game events → audio playback                    │
└─────────────────────────────────────────────────────────┘
```

**Key Principle:** The core game state knows nothing about sprites or sounds. Phaser reads the state and visualizes it.

---

## Sprite Mapping System

### 1. Entity → Sprite Association

**Location:** `src/scenes/PhaserGameScene.ts`

Sprites are created and associated with fighters during scene initialization:

```typescript
// Create fighter sprites (line ~126)
this.fighterSprites = new Map();
for (const fighter of this.gameState.entities) {
  const sprite = new FighterSprite(this, fighter);
  this.fighterSprites.set(fighter.id, sprite);  // Maps "player1", "player2"
}
```

**How It Works:**
- Each `FighterState` in the game has a unique `id` (e.g., "player1", "player2")
- A `FighterSprite` is created for each fighter
- The sprite is stored in a `Map<string, FighterSprite>` using the fighter's ID as the key

### 2. FighterSprite Class

**Location:** `src/phaser/FighterSprite.ts`

The `FighterSprite` class is responsible for:
- Creating the visual representation
- Syncing with the core `FighterState` every frame
- Playing animations based on fighter status

```typescript
export class FighterSprite extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, fighter: FighterState) {
    super(scene, fighter.position.x, fighter.position.y);

    // Visual representation (currently colored rectangles)
    const color = fighter.teamId === 0 ? 0x4488ff : 0xff4444;
    this.bodyRect = scene.add.rectangle(0, -40, 60, 80, color);
    
    // Add health bars, name text, etc.
  }

  sync(fighter: FighterState): void {
    // Update position
    this.setPosition(fighter.position.x, fighter.position.y);
    
    // Update facing direction
    this.bodyRect.setScale(fighter.facing, 1);
    
    // Update visuals based on status
    this.updateVisuals(fighter);
  }
}
```

### 3. Updating Sprites Each Frame

**Location:** `src/scenes/PhaserGameScene.ts` in `update()` method

```typescript
// Sync sprites with new state (line ~380)
for (const fighter of this.gameState.entities) {
  const sprite = this.fighterSprites.get(fighter.id);
  if (sprite) {
    sprite.sync(fighter);  // Update visual to match game state
  }
}
```

**Flow:**
1. Core `tick()` updates game state
2. Loop through all fighters
3. Get corresponding sprite by fighter ID
4. Call `sprite.sync(fighter)` to update visuals

### 4. Character-Specific Sprites

**How to Add Sprite Sheets:**

Currently using placeholder rectangles. To add real sprite sheets:

**Step 1:** Load sprite sheet in `create()`:
```typescript
// In PhaserGameScene.create()
this.load.spritesheet('musashi', 'assets/musashi.png', {
  frameWidth: 128,
  frameHeight: 128
});
```

**Step 2:** Define animations:
```typescript
this.anims.create({
  key: 'musashi_idle',
  frames: this.anims.generateFrameNumbers('musashi', { start: 0, end: 3 }),
  frameRate: 8,
  repeat: -1
});

this.anims.create({
  key: 'musashi_punch',
  frames: this.anims.generateFrameNumbers('musashi', { start: 4, end: 8 }),
  frameRate: 12,
  repeat: 0
});
```

**Step 3:** Modify FighterSprite to use sprites:
```typescript
// In FighterSprite constructor
this.sprite = scene.add.sprite(0, 0, 'musashi');
this.sprite.play('musashi_idle');
this.add(this.sprite);

// In updateVisuals()
updateVisuals(fighter: FighterState): void {
  const characterId = fighter.characterId;  // "musashi", "ronin", etc.
  const status = fighter.status;
  
  const animKey = `${characterId}_${status}`;
  if (this.sprite.anims.exists(animKey)) {
    this.sprite.play(animKey, true);
  }
}
```

### 5. Team-Based Appearance

Fighters are distinguished by `teamId`:

```typescript
// Player (teamId: 0) = Blue
// Enemy (teamId: 1) = Red
const color = fighter.teamId === 0 ? 0x4488ff : 0xff4444;
```

**For Sprite Sheets:**
- Use `tint` property: `sprite.setTint(color)`
- Or load separate sprite sheets: `'musashi_blue'`, `'musashi_red'`

### 6. Projectile Sprites

**Location:** `src/scenes/PhaserGameScene.ts` - `updateProjectiles()`

```typescript
private updateProjectiles(): void {
  // Create sprites for new projectiles
  for (const projectile of this.gameState.projectiles) {
    if (!this.projectileSprites.has(projectile.id)) {
      const sprite = this.add.rectangle(
        projectile.position.x,
        projectile.position.y,
        projectile.hitbox.width,
        projectile.hitbox.height,
        0xffaa00  // Orange for fireballs
      );
      this.projectileSprites.set(projectile.id, sprite);
    }
  }
  
  // Update existing projectiles
  for (const [id, sprite] of this.projectileSprites.entries()) {
    const projectile = this.gameState.projectiles.find(p => p.id === id);
    if (projectile) {
      sprite.setPosition(projectile.position.x, projectile.position.y);
    } else {
      // Projectile no longer exists, remove sprite
      sprite.destroy();
      this.projectileSprites.delete(id);
    }
  }
}
```

---

## Sound Mapping System

### 1. AudioManager Class

**Location:** `src/phaser/AudioManager.ts`

Centralized system for playing sounds:

```typescript
export class AudioManager {
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  playSfx(key: string): void {
    if (this.scene.cache.audio.exists(key)) {
      this.scene.sound.play(key, { volume: 0.7 });
    }
  }

  playHitSound(damage: number, wasBlocked: boolean): void {
    if (wasBlocked) {
      this.playSfx('block');
    } else if (damage < 10) {
      this.playSfx('hit_light');
    } else if (damage < 20) {
      this.playSfx('hit_medium');
    } else {
      this.playSfx('hit_heavy');
    }
  }
}
```

### 2. Game Event → Sound Mapping

**Location:** `src/scenes/PhaserGameScene.ts`

Sounds are triggered by detecting game events:

```typescript
private detectAndPlayAttackSounds(): void {
  for (const fighter of this.gameState.entities) {
    const lastMove = this.lastMoveFrames.get(fighter.id);
    
    // Did fighter start a new move?
    if (fighter.currentMove && fighter.currentMove !== lastMove?.move) {
      // Move just started - play whoosh sound
      if (fighter.currentMove.includes('punch')) {
        this.audioManager.playWhoosh('punch');
      } else if (fighter.currentMove.includes('kick')) {
        this.audioManager.playWhoosh('kick');
      } else if (fighter.currentMove.includes('special')) {
        this.audioManager.playWhoosh('special');
      }
    }
  }
}

private detectAndSpawnHitEffects(): void {
  for (const fighter of this.gameState.entities) {
    const lastHitFrame = this.lastHitFrames.get(fighter.id) || 0;
    
    // Did fighter get hit this frame?
    if (fighter.lastHitByFrame > lastHitFrame) {
      // Play hit sound
      const damage = /* calculate from hit event */;
      this.audioManager.playHitSound(damage, wasBlocked);
      
      // Spawn particle effects
      this.spawnHitSpark(fighter.position);
      
      // Flash sprite
      const sprite = this.fighterSprites.get(fighter.id);
      sprite?.flashDamage();
    }
  }
}
```

**How It Works:**
1. Store previous frame's state (last move, last hit frame)
2. Compare with current frame's state
3. If state changed, trigger audio/visual effects
4. Update stored state for next frame

### 3. Loading Audio Assets

**Current Implementation:** Uses procedural audio generation:

```typescript
// src/utils/ProceduralAudio.ts
export class ProceduralAudio {
  static generateAllSounds(scene: Phaser.Scene): void {
    // Generate hit sounds
    scene.cache.audio.add('hit_light', this.generateHitSound(440));
    scene.cache.audio.add('hit_medium', this.generateHitSound(330));
    scene.cache.audio.add('hit_heavy', this.generateHitSound(220));
    
    // Generate whoosh sounds
    scene.cache.audio.add('whoosh_punch', this.generateWhoosh(800));
    // ... etc
  }
}
```

**To Use Real Audio Files:**

**Step 1:** Load in BootScene or preload:
```typescript
// src/scenes/BootScene.ts
preload() {
  this.load.audio('hit_light', 'assets/sounds/hit_light.ogg');
  this.load.audio('hit_medium', 'assets/sounds/hit_medium.ogg');
  this.load.audio('hit_heavy', 'assets/sounds/hit_heavy.ogg');
  this.load.audio('whoosh_punch', 'assets/sounds/whoosh_punch.ogg');
  // ... etc
}
```

**Step 2:** AudioManager automatically uses loaded sounds:
```typescript
// No code change needed - AudioManager checks if audio exists
if (this.scene.cache.audio.exists(key)) {
  this.scene.sound.play(key);
}
```

### 4. Character-Specific Sounds

To play different sounds per character:

```typescript
playCharacterVoice(characterId: string, action: string): void {
  const soundKey = `${characterId}_${action}`;  // e.g., "musashi_attack"
  this.playSfx(soundKey);
}

// In game loop
if (fighter.currentMove) {
  this.audioManager.playCharacterVoice(fighter.characterId, 'attack');
}
```

### 5. Sound Variations

Add variety by randomizing pitch:

```typescript
playHitSound(damage: number): void {
  const rate = 0.9 + Math.random() * 0.2;  // 0.9 to 1.1
  this.playSfx('hit_light', { rate });
}
```

---

## Complete Example: Adding a New Character

### Character Definition (Core)

```typescript
// src/core/data/ronin.ts
export const RONIN: CharacterDefinition = {
  id: 'ronin',
  name: 'Ronin',
  // ... stats, moves, etc.
};
```

### Sprite Mapping (Phaser)

```typescript
// In PhaserGameScene

// 1. Load sprite sheet
preload() {
  this.load.spritesheet('ronin', 'assets/ronin.png', {
    frameWidth: 128,
    frameHeight: 128
  });
}

// 2. Create animations
create() {
  this.anims.create({
    key: 'ronin_idle',
    frames: this.anims.generateFrameNumbers('ronin', { start: 0, end: 5 }),
    frameRate: 8,
    repeat: -1
  });
  
  this.anims.create({
    key: 'ronin_attack',
    frames: this.anims.generateFrameNumbers('ronin', { start: 6, end: 12 }),
    frameRate: 12,
    repeat: 0
  });
}

// 3. FighterSprite automatically uses character ID
// No additional mapping needed - sprite system uses fighter.characterId
```

### Sound Mapping (Phaser)

```typescript
// 1. Load sounds
preload() {
  this.load.audio('ronin_attack', 'assets/sounds/ronin_attack.ogg');
  this.load.audio('ronin_hit', 'assets/sounds/ronin_hit.ogg');
}

// 2. Play sounds based on character
detectAndPlayAttackSounds() {
  if (fighter.currentMove) {
    const soundKey = `${fighter.characterId}_attack`;
    this.audioManager.playSfx(soundKey);
  }
}
```

---

## Bot vs Player Sprites

**There is no difference between bot and player sprites.** Both use `FighterState` and `FighterSprite`.

The distinction is only in **input source:**

```typescript
// Player 1 - keyboard input
const player1Input = this.inputHandler.captureInput();

// Player 2 - AI input
const player2Input = this.aiBot.selectAction(observation);

// Both are treated identically by the core engine
const inputs = new Map([
  ['player1', player1Input],
  ['player2', player2Input],
]);

this.gameState = tick(this.gameState, inputs);

// Both get sprites the same way
for (const fighter of this.gameState.entities) {
  const sprite = this.fighterSprites.get(fighter.id);
  sprite.sync(fighter);
}
```

**To differentiate visually:**
- Use `fighter.teamId` for colors/tints
- Use `fighter.characterId` for sprite selection
- Use `fighter.id` to identify specific fighters

---

## Key Takeaways

### Sprites:
1. **One sprite per fighter** - Created in PhaserGameScene, stored in Map by fighter.id
2. **Sync every frame** - `sprite.sync(fighter)` updates visuals to match state
3. **Character-based** - Use `fighter.characterId` to select sprite sheet/animations
4. **Team-based appearance** - Use `fighter.teamId` for colors/tints

### Sounds:
1. **Event-driven** - Detect state changes (new move, hit, etc.) and play sounds
2. **Centralized** - AudioManager handles all playback
3. **Graceful degradation** - Checks if sound exists before playing
4. **Character-specific** - Build sound key from `characterId_action`

### Architecture:
1. **Core is visual-agnostic** - Game logic knows nothing about sprites/sounds
2. **Phaser reads core** - One-way data flow: Core → Phaser
3. **Identity by ID** - Use fighter.id to map between core state and Phaser objects
4. **Same system for all** - Players, bots, enemies all use the same sprite/sound pipeline

---

## File Reference

**Core (No Visuals):**
- `src/core/interfaces/types.ts` - FighterState definition
- `src/core/data/musashi.ts` - Character definition (no visual data)
- `src/core/Game.ts` - Game loop (no visual updates)

**Phaser (Visuals & Audio):**
- `src/phaser/FighterSprite.ts` - Visual representation of FighterState
- `src/phaser/AudioManager.ts` - Sound playback system
- `src/scenes/PhaserGameScene.ts` - Sprite creation and event detection
- `src/utils/ProceduralAudio.ts` - Audio generation (placeholder)

**Key Methods:**
- `PhaserGameScene.create()` - Create sprites, load assets
- `FighterSprite.sync()` - Update sprite to match fighter state
- `PhaserGameScene.detectAndSpawnHitEffects()` - Trigger audio/visuals on hits
- `AudioManager.playHitSound()` - Play appropriate sound based on game event
