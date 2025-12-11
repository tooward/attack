# Phase 6: Polish & Game Feel - DETAILED PLAN

## Overview

**Goal:** Transform the functional fighting game into a satisfying, polished experience with visual feedback, audio, and quality-of-life features.

**Duration:** 1-2 weeks

**Dependencies:** Phase 5 complete (Special Moves & Combos)

---

## What We're Building

### 1. Visual Feedback Systems
- **Hit freeze** (frame pause on impact)
- **Screen shake** (camera shake on heavy hits)
- **Hit sparks** (particle effects)
- **Character flash** (color flash on damage)
- **Motion blur** (on fast movements)

### 2. Audio System
- **Hit sounds** (light, medium, heavy impact)
- **Block sounds** (successful defense)
- **Whoosh sounds** (attack swings)
- **Special move sounds** (fireballs, shoryuken)
- **Background music** (looping combat theme)
- **Announcer voice** (round start, K.O., etc.)

### 3. Animation Polish
- **Smooth transitions** between states
- **Anticipation frames** (wind-up before attacks)
- **Impact frames** (freeze frame at hit moment)
- **Recovery animations** (return to neutral)

### 4. Training Mode
- **Dummy controls** (record/playback)
- **Hitbox visualization** (toggle display)
- **Frame data display** (real-time move info)
- **Reset position** (instant restart)

### 5. Quality of Life
- **Pause menu** (resume, restart, quit)
- **Input display** (show player inputs on screen)
- **Damage numbers** (floating text on hit)
- **Combo display** (hit counter with scaling)

---

## Technical Design

### Hit Freeze System

**Purpose:** Pause gameplay briefly on hit to add impact weight.

**Implementation:**
```typescript
// In GameState
interface GameState {
  // ... existing fields
  freezeFramesRemaining: number; // Pause tick() updates
  freezeIntensity: number;       // 0-1, affects visuals
}

// In Combat.ts
function applyHit(attacker, defender, move): GameState {
  const freezeFrames = calculateHitFreeze(move.damage);
  
  return {
    ...state,
    freezeFramesRemaining: freezeFrames,
    freezeIntensity: move.damage / 100,
  };
}

function calculateHitFreeze(damage: number): number {
  if (damage < 15) return 2;      // Light hit: 2 frames
  if (damage < 30) return 4;      // Medium hit: 4 frames
  return 6;                        // Heavy hit: 6 frames
}
```

**Phaser Integration:**
```typescript
// In PhaserGameScene.update()
if (this.gameState.freezeFramesRemaining > 0) {
  // Don't call tick(), just decrement freeze
  this.gameState.freezeFramesRemaining--;
  
  // Apply visual freeze effects
  this.applyFreezeEffect(this.gameState.freezeIntensity);
  return;
}

// Normal update
this.gameState = tick(this.gameState, inputs);
```

---

### Screen Shake System

**Purpose:** Camera shake on heavy hits adds visceral feedback.

**Implementation:**
```typescript
// In PhaserGameScene
class PhaserGameScene {
  private shakeIntensity: number = 0;
  private shakeDuration: number = 0;
  private shakeOffset: Vector2 = { x: 0, y: 0 };
  
  triggerScreenShake(intensity: number, duration: number) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeDuration = Math.max(this.shakeDuration, duration);
  }
  
  updateScreenShake() {
    if (this.shakeDuration > 0) {
      // Random offset based on intensity
      this.shakeOffset.x = (Math.random() - 0.5) * this.shakeIntensity * 20;
      this.shakeOffset.y = (Math.random() - 0.5) * this.shakeIntensity * 20;
      
      // Apply to camera
      this.cameras.main.setScroll(
        this.shakeOffset.x,
        this.shakeOffset.y
      );
      
      // Decay
      this.shakeDuration--;
      this.shakeIntensity *= 0.9;
    } else {
      // Reset camera
      this.cameras.main.setScroll(0, 0);
    }
  }
}

// Trigger on hit
onHit(damage: number) {
  const intensity = damage / 100; // 0-1 range
  const duration = Math.floor(damage / 5); // frames
  this.triggerScreenShake(intensity, duration);
}
```

---

### Particle Effects System

**Purpose:** Visual feedback for hits, blocks, and special moves.

**Implementation:**
```typescript
// Create particle emitter manager
class EffectsManager {
  private scene: Phaser.Scene;
  private hitSparkPool: Phaser.GameObjects.Particles.ParticleEmitter[];
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createHitSparkEmitter();
    this.createBlockSparkEmitter();
    this.createDustEmitter();
  }
  
  createHitSparkEmitter() {
    const particles = this.scene.add.particles('hit-spark');
    
    this.hitSparkEmitter = particles.createEmitter({
      speed: { min: 100, max: 200 },
      angle: { min: 0, max: 360 },
      scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 300,
      quantity: 1,
      on: false, // Manual emission
    });
  }
  
  spawnHitSpark(x: number, y: number, intensity: number) {
    this.hitSparkEmitter.setPosition(x, y);
    this.hitSparkEmitter.explode(8 * intensity, x, y);
  }
  
  spawnBlockSpark(x: number, y: number) {
    // Similar but with different color/shape
  }
  
  spawnLandingDust(x: number, y: number) {
    // Dust when fighter lands from jump
  }
}
```

**Integration:**
```typescript
// In PhaserGameScene
private effectsManager: EffectsManager;

create() {
  this.effectsManager = new EffectsManager(this);
}

syncState(newState: GameState) {
  // Detect new hits
  const newHits = detectNewHits(this.gameState, newState);
  
  for (const hit of newHits) {
    const position = hit.defender.position;
    const intensity = hit.damage / 100;
    
    this.effectsManager.spawnHitSpark(
      position.x,
      position.y - 40,
      intensity
    );
  }
}
```

---

### Audio System

**Purpose:** Sound effects and music for immersion and feedback.

**File Structure:**
```
assets/sounds/
├── hit/
│   ├── hit_light_01.ogg
│   ├── hit_light_02.ogg
│   ├── hit_medium_01.ogg
│   ├── hit_medium_02.ogg
│   ├── hit_heavy_01.ogg
│   └── hit_heavy_02.ogg
├── whoosh/
│   ├── whoosh_punch.ogg
│   ├── whoosh_kick.ogg
│   └── whoosh_special.ogg
├── block/
│   └── block_01.ogg
├── special/
│   ├── hadoken.ogg
│   └── shoryuken.ogg
├── voice/
│   ├── round_1.ogg
│   ├── round_2.ogg
│   ├── fight.ogg
│   ├── ko.ogg
│   └── perfect.ogg
└── music/
    └── combat_theme.ogg
```

**Implementation:**
```typescript
class AudioManager {
  private scene: Phaser.Scene;
  private bgm: Phaser.Sound.BaseSound | null = null;
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }
  
  playHitSound(damage: number) {
    let key: string;
    
    if (damage < 15) {
      key = `hit_light_0${Phaser.Math.Between(1, 2)}`;
    } else if (damage < 30) {
      key = `hit_medium_0${Phaser.Math.Between(1, 2)}`;
    } else {
      key = `hit_heavy_0${Phaser.Math.Between(1, 2)}`;
    }
    
    this.scene.sound.play(key, { volume: 0.7 });
  }
  
  playBlockSound() {
    this.scene.sound.play('block_01', { volume: 0.6 });
  }
  
  playWhoosh(moveType: string) {
    this.scene.sound.play(`whoosh_${moveType}`, { volume: 0.5 });
  }
  
  playSpecialSound(moveId: string) {
    this.scene.sound.play(moveId, { volume: 0.8 });
  }
  
  playAnnouncerVoice(key: string) {
    this.scene.sound.play(key, { volume: 1.0 });
  }
  
  playBackgroundMusic() {
    if (this.bgm) {
      this.bgm.stop();
    }
    
    this.bgm = this.scene.sound.add('combat_theme', {
      loop: true,
      volume: 0.3,
    });
    
    this.bgm.play();
  }
  
  stopBackgroundMusic() {
    if (this.bgm) {
      this.bgm.stop();
    }
  }
}
```

**Audio Preloading:**
```typescript
// In BootScene.ts
preload() {
  // Hit sounds
  this.load.audio('hit_light_01', 'assets/sounds/hit/hit_light_01.ogg');
  this.load.audio('hit_light_02', 'assets/sounds/hit/hit_light_02.ogg');
  this.load.audio('hit_medium_01', 'assets/sounds/hit/hit_medium_01.ogg');
  this.load.audio('hit_medium_02', 'assets/sounds/hit/hit_medium_02.ogg');
  this.load.audio('hit_heavy_01', 'assets/sounds/hit/hit_heavy_01.ogg');
  this.load.audio('hit_heavy_02', 'assets/sounds/hit/hit_heavy_02.ogg');
  
  // Whoosh sounds
  this.load.audio('whoosh_punch', 'assets/sounds/whoosh/whoosh_punch.ogg');
  this.load.audio('whoosh_kick', 'assets/sounds/whoosh/whoosh_kick.ogg');
  this.load.audio('whoosh_special', 'assets/sounds/whoosh/whoosh_special.ogg');
  
  // Block
  this.load.audio('block_01', 'assets/sounds/block/block_01.ogg');
  
  // Special moves
  this.load.audio('hadoken', 'assets/sounds/special/hadoken.ogg');
  this.load.audio('shoryuken', 'assets/sounds/special/shoryuken.ogg');
  
  // Announcer
  this.load.audio('round_1', 'assets/sounds/voice/round_1.ogg');
  this.load.audio('round_2', 'assets/sounds/voice/round_2.ogg');
  this.load.audio('fight', 'assets/sounds/voice/fight.ogg');
  this.load.audio('ko', 'assets/sounds/voice/ko.ogg');
  
  // Music
  this.load.audio('combat_theme', 'assets/sounds/music/combat_theme.ogg');
}
```

---

### Training Mode

**Purpose:** Practice moves, test combos, and learn frame data.

**Features:**
1. **Dummy Controls**
   - Standing dummy (idle)
   - Crouching dummy
   - Jumping dummy
   - Blocking dummy (always)
   - Recording/playback (record player actions, play back on dummy)

2. **Hitbox Display**
   - Toggle visualization (F1 key already implemented)
   - Color-coded boxes:
     - Green: Hurtboxes (vulnerable)
     - Red: Hitboxes (attacking)
     - Blue: Push boxes (collision)
     - Yellow: Invincible frames

3. **Frame Data Display**
   - On-screen overlay showing:
     - Current move name
     - Frame number
     - Startup / Active / Recovery
     - Hit/Block advantage
     - Damage and scaling

4. **Reset Position**
   - F3: Reset fighters to start positions
   - F4: Reset health/meter
   - F5: Toggle infinite meter

**Implementation:**
```typescript
// Training mode state
interface TrainingModeState {
  enabled: boolean;
  dummyMode: 'idle' | 'crouch' | 'jump' | 'block' | 'recording' | 'playback';
  recording: InputFrame[];
  recordingIndex: number;
  showHitboxes: boolean;
  showFrameData: boolean;
  infiniteMeter: boolean;
  infiniteHealth: boolean;
}

// In PhaserGameScene
class PhaserGameScene {
  private trainingMode: TrainingModeState;
  
  handleTrainingModeInput(key: string) {
    switch(key) {
      case 'F1':
        this.trainingMode.showHitboxes = !this.trainingMode.showHitboxes;
        break;
      case 'F2':
        this.cycleBot(); // Existing bot cycle
        break;
      case 'F3':
        this.resetPositions();
        break;
      case 'F4':
        this.resetHealthMeter();
        break;
      case 'F5':
        this.trainingMode.infiniteMeter = !this.trainingMode.infiniteMeter;
        break;
      case 'F6':
        this.cycleTrainingDummyMode();
        break;
      case 'F7':
        this.startRecording();
        break;
      case 'F8':
        this.stopRecording();
        break;
      case 'F9':
        this.playbackRecording();
        break;
    }
  }
  
  cycleTrainingDummyMode() {
    const modes = ['idle', 'crouch', 'jump', 'block'] as const;
    const current = modes.indexOf(this.trainingMode.dummyMode as any);
    const next = (current + 1) % modes.length;
    this.trainingMode.dummyMode = modes[next];
  }
  
  drawFrameData() {
    if (!this.trainingMode.showFrameData) return;
    
    const player = this.gameState.entities[0];
    if (!player.currentMove) return;
    
    const move = this.characterMoves.get(player.currentMove);
    if (!move) return;
    
    const text = [
      `Move: ${move.name}`,
      `Frame: ${player.moveFrame} / ${move.frameData.totalFrames}`,
      `Startup: ${move.frameData.startup}`,
      `Active: ${move.frameData.active}`,
      `Recovery: ${move.frameData.recovery}`,
      `Damage: ${move.damage}`,
      `Scaling: ${(player.comboScaling * 100).toFixed(0)}%`,
    ].join('\n');
    
    this.frameDataText.setText(text);
  }
}
```

---

### Input Display

**Purpose:** Show player inputs on screen for learning and streaming.

**Implementation:**
```typescript
class InputDisplay {
  private scene: Phaser.Scene;
  private inputHistory: string[] = [];
  private textObjects: Phaser.GameObjects.Text[] = [];
  
  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.createDisplay(x, y);
  }
  
  createDisplay(x: number, y: number) {
    for (let i = 0; i < 10; i++) {
      const text = this.scene.add.text(x, y + i * 20, '', {
        fontSize: '16px',
        color: '#ffffff',
        fontFamily: 'monospace',
      });
      this.textObjects.push(text);
    }
  }
  
  update(input: InputFrame) {
    // Convert input to notation
    const notation = this.inputToNotation(input);
    
    if (notation) {
      this.inputHistory.push(notation);
      if (this.inputHistory.length > 10) {
        this.inputHistory.shift();
      }
      
      // Update display
      this.inputHistory.forEach((input, i) => {
        this.textObjects[i].setText(input);
      });
    }
  }
  
  inputToNotation(input: InputFrame): string | null {
    const actions = Array.from(input.actions);
    if (actions.length === 0) return null;
    
    let notation = '';
    
    // Directions (numpad notation)
    if (actions.includes(InputAction.DOWN) && actions.includes(InputAction.LEFT)) {
      notation += '1';
    } else if (actions.includes(InputAction.DOWN)) {
      notation += '2';
    } else if (actions.includes(InputAction.DOWN) && actions.includes(InputAction.RIGHT)) {
      notation += '3';
    } else if (actions.includes(InputAction.LEFT)) {
      notation += '4';
    } else if (actions.includes(InputAction.RIGHT)) {
      notation += '6';
    } else if (actions.includes(InputAction.UP) && actions.includes(InputAction.LEFT)) {
      notation += '7';
    } else if (actions.includes(InputAction.UP)) {
      notation += '8';
    } else if (actions.includes(InputAction.UP) && actions.includes(InputAction.RIGHT)) {
      notation += '9';
    } else {
      notation += '5'; // Neutral
    }
    
    // Buttons
    const buttons = [];
    if (actions.includes(InputAction.LIGHT_PUNCH)) buttons.push('LP');
    if (actions.includes(InputAction.HEAVY_PUNCH)) buttons.push('HP');
    if (actions.includes(InputAction.LIGHT_KICK)) buttons.push('LK');
    if (actions.includes(InputAction.HEAVY_KICK)) buttons.push('HK');
    if (actions.includes(InputAction.BLOCK)) buttons.push('BL');
    
    if (buttons.length > 0) {
      notation += '+' + buttons.join('+');
    }
    
    return notation;
  }
}
```

---

### Damage Numbers

**Purpose:** Show damage dealt as floating text.

**Implementation:**
```typescript
class DamageNumber {
  private scene: Phaser.Scene;
  private text: Phaser.GameObjects.Text;
  private lifespan: number = 60; // frames
  
  constructor(scene: Phaser.Scene, x: number, y: number, damage: number, scaled: boolean) {
    this.scene = scene;
    
    const color = scaled ? '#ffaa00' : '#ffffff'; // Orange if scaled
    
    this.text = scene.add.text(x, y, `-${damage}`, {
      fontSize: '24px',
      color: color,
      fontFamily: 'Arial Black',
      stroke: '#000000',
      strokeThickness: 4,
    });
    
    this.text.setOrigin(0.5);
  }
  
  update(): boolean {
    this.lifespan--;
    
    // Float upward
    this.text.y -= 1;
    
    // Fade out
    this.text.setAlpha(this.lifespan / 60);
    
    if (this.lifespan <= 0) {
      this.text.destroy();
      return true; // Remove from manager
    }
    
    return false;
  }
}

// Manager
class DamageNumberManager {
  private numbers: DamageNumber[] = [];
  
  spawn(scene: Phaser.Scene, x: number, y: number, damage: number, scaled: boolean) {
    this.numbers.push(new DamageNumber(scene, x, y, damage, scaled));
  }
  
  update() {
    this.numbers = this.numbers.filter(num => !num.update());
  }
}
```

---

## Implementation Steps

### Step 6.1: Hit Freeze & Screen Shake
**Files to Modify:**
- `/src/core/interfaces/types.ts` - Add `freezeFramesRemaining`
- `/src/core/Game.ts` - Handle freeze logic in `tick()`
- `/src/scenes/PhaserGameScene.ts` - Implement screen shake

**Tests:**
- Hit freeze duration based on damage
- Screen shake intensity scaling
- Freeze doesn't affect UI updates

### Step 6.2: Particle Effects
**Files to Create:**
- `/src/phaser/effects/EffectsManager.ts` - Centralized effect spawner

**Files to Modify:**
- `/src/scenes/PhaserGameScene.ts` - Integrate effects manager
- `/src/scenes/BootScene.ts` - Load particle textures

**Tests:**
- Hit sparks spawn at correct position
- Block sparks different from hit sparks
- Landing dust on grounded

### Step 6.3: Audio System
**Files to Create:**
- `/src/phaser/audio/AudioManager.ts` - Sound effect manager

**Files to Modify:**
- `/src/scenes/BootScene.ts` - Load all audio files
- `/src/scenes/PhaserGameScene.ts` - Trigger sounds on events

**Assets Needed:**
- 6 hit sounds (light x2, medium x2, heavy x2)
- 3 whoosh sounds
- 1 block sound
- 2 special sounds (hadoken, shoryuken)
- 5 announcer clips
- 1 background music track

### Step 6.4: Training Mode
**Files to Create:**
- `/src/phaser/training/TrainingUI.ts` - Training mode overlay

**Files to Modify:**
- `/src/scenes/PhaserGameScene.ts` - Add training mode controls
- `/src/phaser/InputHandler.ts` - F-key shortcuts

**Features:**
- Dummy mode cycling (F6)
- Recording (F7) / Playback (F9)
- Frame data display (toggle with F10)
- Infinite meter (F5)

### Step 6.5: Input Display & Damage Numbers
**Files to Create:**
- `/src/phaser/ui/InputDisplay.ts` - Input notation display
- `/src/phaser/ui/DamageNumbers.ts` - Floating damage text

**Files to Modify:**
- `/src/scenes/PhaserGameScene.ts` - Integrate UI elements

---

## Asset Requirements

### Visual Effects (Sprites/Textures)
- [ ] Hit spark sprite (8-frame animation)
- [ ] Block spark sprite (4-frame animation)
- [ ] Dust cloud sprite (6-frame animation)
- [ ] Impact flash (white circle, various sizes)
- [ ] Motion blur trail sprite

### Audio Files
**Required:**
- [ ] hit_light_01.ogg
- [ ] hit_light_02.ogg
- [ ] hit_medium_01.ogg
- [ ] hit_medium_02.ogg
- [ ] hit_heavy_01.ogg
- [ ] hit_heavy_02.ogg
- [ ] whoosh_punch.ogg
- [ ] whoosh_kick.ogg
- [ ] whoosh_special.ogg
- [ ] block_01.ogg
- [ ] hadoken.ogg
- [ ] shoryuken.ogg
- [ ] round_1.ogg (voice: "Round 1")
- [ ] round_2.ogg (voice: "Round 2")
- [ ] fight.ogg (voice: "Fight!")
- [ ] ko.ogg (voice: "K.O.!")
- [ ] perfect.ogg (voice: "Perfect!")
- [ ] combat_theme.ogg (looping, 2-3 minutes)

**Nice to Have:**
- [ ] Character voice clips (attack grunts)
- [ ] Menu sounds (select, back, confirm)
- [ ] Crowd ambience

### UI Graphics
- [ ] Training mode overlay background
- [ ] Input display background
- [ ] F-key shortcut icons

---

## Success Criteria

Phase 6 complete when:
1. ✅ Hit freeze adds weight to impacts
2. ✅ Screen shake scales with damage
3. ✅ Hit sparks spawn on all attacks
4. ✅ Block sparks appear on successful blocks
5. ✅ Audio plays for all major events
6. ✅ Background music loops seamlessly
7. ✅ Training mode allows dummy control
8. ✅ Frame data displays accurately
9. ✅ Input display shows notation
10. ✅ Damage numbers float on hit
11. ✅ Hitbox visualization works in training mode
12. ✅ Recording/playback functional
13. ✅ All tests passing (93+ tests)

---

## Testing Plan

### Manual Testing
1. **Visual Feedback**
   - Hit different strength attacks, verify freeze duration
   - Check screen shake intensity
   - Confirm particles spawn at correct positions
   - Test at 60 FPS (no frame drops)

2. **Audio**
   - Play all sound effects in sequence
   - Verify volume levels (not too loud/quiet)
   - Check music loops without gap
   - Test simultaneous sounds (no crackling)

3. **Training Mode**
   - Cycle through dummy modes
   - Record 10-second combo, play back
   - Toggle frame data, verify accuracy
   - Test infinite meter
   - Reset positions/health

4. **UI Elements**
   - Input display shows correct notation
   - Damage numbers spawn and fade
   - Training overlay readable
   - No UI overlap

### Unit Tests
No new unit tests required (all core logic already tested).  
This phase is primarily visual/audio polish.

### Performance Testing
- Monitor FPS during:
  - Multiple particle effects
  - Screen shake + hit freeze
  - Audio playback (5+ simultaneous)
- Target: Stable 60 FPS

---

## Timeline

| Day | Task | Hours |
|-----|------|-------|
| 1-2 | Hit Freeze & Screen Shake | 4h |
| 3-4 | Particle Effects System | 6h |
| 5-6 | Audio System + Integration | 6h |
| 7-8 | Training Mode Features | 6h |
| 9 | Input Display & Damage Numbers | 4h |
| 10 | Polish & Testing | 4h |

**Total: ~30 hours (1-2 weeks part-time)**

---

## Future Enhancements (Phase 7+)

- **Slow-motion replays** (instant replay on K.O.)
- **Character portraits** (animated expressions)
- **Stage hazards** (interactive backgrounds)
- **Weather effects** (rain, snow particles)
- **Damage scaling indicators** (visual feedback on combo scaling)
- **Counter hit indicator** (special effect on counter)
- **Dizzy state** (stars around character)
- **Guard break** (dramatic visual when block broken)

---

Ready to begin Phase 6 implementation! 🎮✨
