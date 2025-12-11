# Phase 2: Phaser Integration

## Goal
Connect the pure TypeScript core engine to Phaser 3 for rendering and input. Maintain strict separation: Phaser reads state, never modifies core state directly.

## Architecture Principles

### Core ← Phaser (Read-Only)
```
Core GameState (source of truth)
    ↓ (read only)
Phaser Scene (presentation layer)
    ↓ (captures)
Input → Core (next tick)
```

### No Reverse Flow
- Phaser never mutates core state
- Phaser never calls core functions directly from update loop
- Input flows: Keyboard → InputFrame → tick() → new GameState
- Rendering flows: GameState → sync() → Sprite positions/animations

## Implementation Steps

### Step 1: Create PhaserGameScene
**File:** `src/scenes/PhaserGameScene.ts`

Replace existing GameScene with new implementation:
- Store core GameState
- Store CharacterDefinition map
- Store InputBuffer for each player
- `create()`: Initialize core game state
- `update()`: Capture inputs → tick() → render()
- Keep existing scenes for menu/UI

**Key Methods:**
```typescript
create() {
  // Initialize core state
  this.gameState = createInitialState(config);
  this.characterDefs = new Map([['musashi', MUSASHI]]);
  
  // Create fighter sprites
  this.fighterSprites = new Map();
  for (const fighter of this.gameState.entities) {
    const sprite = new FighterSprite(this, fighter);
    this.fighterSprites.set(fighter.id, sprite);
  }
  
  // Initialize input buffers
  this.inputBuffers = new Map();
}

update(time: number, delta: number) {
  // Capture inputs
  const inputs = this.captureInputs();
  
  // Tick core engine
  this.gameState = tick(this.gameState, inputs);
  
  // Sync sprites with new state
  for (const fighter of this.gameState.entities) {
    const sprite = this.fighterSprites.get(fighter.id);
    sprite?.sync(fighter);
  }
  
  // Update debug overlays
  if (this.debugMode) {
    this.debugGraphics.clear();
    this.drawHitboxes(this.gameState);
  }
}
```

### Step 2: Implement FighterSprite
**File:** `src/phaser/FighterSprite.ts`

Phaser sprite that visualizes FighterState:
```typescript
export class FighterSprite extends Phaser.GameObjects.Container {
  private body: Phaser.GameObjects.Sprite;
  private healthBar: Phaser.GameObjects.Graphics;
  
  constructor(scene: Phaser.Scene, fighter: FighterState) {
    super(scene, fighter.position.x, fighter.position.y);
    
    // Create sprite (placeholder for now)
    this.body = scene.add.sprite(0, 0, 'fighter_placeholder');
    this.add(this.body);
    
    // Create health bar
    this.healthBar = scene.add.graphics();
    this.add(this.healthBar);
    
    scene.add.existing(this);
  }
  
  sync(fighter: FighterState): void {
    // Update position
    this.setPosition(fighter.position.x, fighter.position.y);
    
    // Update facing
    this.setScale(fighter.facing, 1);
    
    // Update animation based on status
    this.updateAnimation(fighter.status, fighter.currentMove);
    
    // Update health bar
    this.drawHealthBar(fighter.health, fighter.maxHealth);
  }
  
  private updateAnimation(status: FighterStatus, move: string | null): void {
    // Map status/move to animation key
    // For now: idle, walk, jump, attack
  }
  
  private drawHealthBar(health: number, maxHealth: number): void {
    const barWidth = 100;
    const barHeight = 8;
    const healthPercent = health / maxHealth;
    
    this.healthBar.clear();
    this.healthBar.fillStyle(0x000000);
    this.healthBar.fillRect(-50, -100, barWidth, barHeight);
    this.healthBar.fillStyle(0xff0000);
    this.healthBar.fillRect(-50, -100, barWidth * healthPercent, barHeight);
  }
}
```

### Step 3: Input Capture
**File:** `src/phaser/InputHandler.ts`

Convert keyboard/gamepad input to InputFrame:
```typescript
export class InputHandler {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys: Map<string, Phaser.Input.Keyboard.Key>;
  
  constructor(scene: Phaser.Scene) {
    this.cursors = scene.input.keyboard.createCursorKeys();
    this.keys = new Map([
      ['Z', scene.input.keyboard.addKey('Z')], // Light punch
      ['X', scene.input.keyboard.addKey('X')], // Heavy punch
      ['C', scene.input.keyboard.addKey('C')], // Light kick
      ['V', scene.input.keyboard.addKey('V')], // Heavy kick
    ]);
  }
  
  captureInput(timestamp: number): InputFrame {
    const actions = new Set<InputAction>();
    
    if (this.cursors.left?.isDown) actions.add(InputAction.LEFT);
    if (this.cursors.right?.isDown) actions.add(InputAction.RIGHT);
    if (this.cursors.up?.isDown) actions.add(InputAction.UP);
    if (this.cursors.down?.isDown) actions.add(InputAction.DOWN);
    
    if (this.keys.get('Z')?.isDown) actions.add(InputAction.LIGHT_PUNCH);
    if (this.keys.get('X')?.isDown) actions.add(InputAction.HEAVY_PUNCH);
    if (this.keys.get('C')?.isDown) actions.add(InputAction.LIGHT_KICK);
    if (this.keys.get('V')?.isDown) actions.add(InputAction.HEAVY_KICK);
    
    return { actions, timestamp };
  }
}
```

### Step 4: Debug Visualization
Add to PhaserGameScene:
```typescript
private drawHitboxes(state: GameState): void {
  for (const fighter of state.entities) {
    // Draw hurtboxes (blue)
    this.debugGraphics.lineStyle(2, 0x0000ff);
    for (const box of fighter.hurtboxes) {
      const worldX = fighter.position.x + (box.x * fighter.facing);
      const worldY = fighter.position.y + box.y;
      this.debugGraphics.strokeRect(worldX, worldY, box.width, box.height);
    }
    
    // Draw hitboxes (red)
    this.debugGraphics.lineStyle(2, 0xff0000);
    for (const box of fighter.hitboxes) {
      const worldX = fighter.position.x + (box.x * fighter.facing);
      const worldY = fighter.position.y + box.y;
      this.debugGraphics.strokeRect(worldX, worldY, box.width, box.height);
    }
  }
}
```

### Step 5: Update Existing Scenes
- **BootScene**: Load placeholder fighter sprites
- **MenuScene**: Keep as-is, launches PhaserGameScene
- **UIScene**: Display health bars, super meter, round timer

### Step 6: Main Entry Point
Update `main.ts`:
```typescript
import Phaser from 'phaser';
import BootScene from './scenes/BootScene';
import MenuScene from './scenes/MenuScene';
import PhaserGameScene from './scenes/PhaserGameScene';
import UIScene from './scenes/UIScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1000,
  height: 600,
  parent: 'game-container',
  backgroundColor: '#333333',
  scene: [BootScene, MenuScene, PhaserGameScene, UIScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);
```

## Testing Strategy

### Manual Testing
1. Run `npm run dev`
2. Start game from menu
3. Verify:
   - Fighters appear on screen
   - Keyboard input moves fighters
   - Punches/kicks show animations
   - Health bars update on hit
   - Debug mode shows hitboxes (F1 to toggle)
   - Round timer counts down
   - Round ends properly

### Integration Points to Verify
- [ ] Core tick() called exactly once per frame
- [ ] No core state mutation from Phaser
- [ ] Input lag minimal (< 1 frame)
- [ ] Sprites sync correctly with core positions
- [ ] Hitbox visualization matches core collision
- [ ] Game runs at stable 60fps

## Assets Needed (Temporary)
- Placeholder fighter sprite (32x64 colored rectangle)
- Idle animation (1 frame)
- Walk animation (2 frames)
- Jump animation (1 frame)
- Punch animation (3 frames)
- Kick animation (3 frames)

Use colored rectangles for now. Real sprites in Phase 6.

## Success Criteria
- [ ] Can play a complete 1v1 match with keyboard
- [ ] Core systems running underneath (verified via debug)
- [ ] Visual feedback for all actions
- [ ] Health/meter/timer displayed
- [ ] Round/match logic works
- [ ] Debug hitboxes match core state
- [ ] No console errors
- [ ] Stable 60fps

## Timeline
- FighterSprite class: 1 hour
- PhaserGameScene integration: 2 hours
- Input handling: 1 hour
- Debug visualization: 30 min
- Testing and polish: 1 hour
- **Total: ~5.5 hours**

Ready to implement!
