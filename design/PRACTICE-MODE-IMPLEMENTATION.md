# Practice Mode Enhancement - Implementation Plan

## Overview
Step-by-step implementation guide for combining Practice Mode and Character Test Lab features into a unified, simplified training experience.

**Reference:** See `PRACTICE-MODE-ENHANCEMENT.md` for design rationale and requirements.

---

## Phase 1: Pause Menu System

### Step 1.1: Create Pause Menu Container
**File:** `src/scenes/PhaserGameScene.ts`

**Add private members:**
```typescript
private pauseMenu?: Phaser.GameObjects.Container;
private isPaused: boolean = false;
private pauseKey!: Phaser.Input.Keyboard.Key;
```

**In create() method, add ESC key:**
```typescript
this.pauseKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
```

**Test:** ESC key registered successfully

---

### Step 1.2: Implement togglePauseMenu() Method
**File:** `src/scenes/PhaserGameScene.ts`

**Add method:**
```typescript
private togglePauseMenu(): void {
  if (this.pauseMenu) {
    // Resume game
    this.pauseMenu.destroy();
    this.pauseMenu = undefined;
    this.isPaused = false;
    return;
  }

  // Pause game
  this.isPaused = true;

  // Create dark overlay
  const overlay = this.add.rectangle(
    0, 0,
    this.cameras.main.width,
    this.cameras.main.height,
    0x000000, 0.7
  ).setOrigin(0);

  // Create menu container
  this.pauseMenu = this.add.container(500, 300);
  this.pauseMenu.add(overlay);
  this.pauseMenu.setDepth(3000);

  // Title
  const title = this.add.text(0, -150, 'PRACTICE MENU', {
    fontSize: '32px',
    color: '#ffff00',
    fontStyle: 'bold'
  }).setOrigin(0.5);
  this.pauseMenu.add(title);

  // Menu options (implement in next step)
}
```

**Test:** 
- ESC opens/closes pause menu
- Dark overlay appears
- Title shows centered

---

### Step 1.3: Add Menu Options
**File:** `src/scenes/PhaserGameScene.ts`

**Continue in togglePauseMenu():**
```typescript
const options = [
  { text: 'Resume', action: () => this.togglePauseMenu() },
  { text: 'Show Moves List', action: () => this.showMovesFromPause() },
  { text: 'Change Characters', action: () => this.showCharacterSelect() },
  { text: 'Reset Match', action: () => this.resetMatch() },
  { text: 'Change Opponent', action: () => this.changeOpponent() },
  { text: 'Main Menu', action: () => this.returnToMainMenu() }
];

const startY = -50;
const spacing = 60;

options.forEach((option, index) => {
  const y = startY + (index * spacing);
  
  // Background button
  const btn = this.add.rectangle(0, y, 300, 50, 0x333333);
  btn.setInteractive({ useHandCursor: true });
  
  // Text
  const text = this.add.text(0, y, option.text, {
    fontSize: '20px',
    color: '#ffffff'
  }).setOrigin(0.5);
  
  // Hover effects
  btn.on('pointerover', () => {
    btn.setFillStyle(0x555555);
    text.setColor('#ffff00');
  });
  
  btn.on('pointerout', () => {
    btn.setFillStyle(0x333333);
    text.setColor('#ffffff');
  });
  
  btn.on('pointerdown', () => {
    option.action();
  });
  
  this.pauseMenu!.add(btn);
  this.pauseMenu!.add(text);
});

// ESC hint
const hint = this.add.text(0, 250, 'ESC to Resume', {
  fontSize: '14px',
  color: '#888888'
}).setOrigin(0.5);
this.pauseMenu!.add(hint);
```

**Test:**
- All 6 options display correctly
- Hover effects work
- Click triggers placeholder actions (will implement next)

---

### Step 1.4: Implement Menu Action Methods
**File:** `src/scenes/PhaserGameScene.ts`

**Add stub methods:**
```typescript
private showMovesFromPause(): void {
  // Close pause menu
  this.togglePauseMenu();
  // Open moves overlay (use existing toggleMovesMenu)
  if (!this.movesOverlay) {
    this.toggleMovesMenu();
  }
}

private showCharacterSelect(): void {
  // TODO: Implement in Phase 2
  console.log('Character select coming in Phase 2');
  this.togglePauseMenu();
}

private resetMatch(): void {
  // Reset positions and health
  this.resetFighterPositions();
  this.resetFighterHealth();
  this.togglePauseMenu();
}

private changeOpponent(): void {
  // Return to bot selection
  this.scene.start('BotSelectionScene');
}

private returnToMainMenu(): void {
  this.scene.start('MenuScene');
}
```

**Test:**
- "Resume" closes menu
- "Show Moves List" opens moves overlay
- "Reset Match" resets fighters and closes menu
- "Change Opponent" goes to BotSelectionScene
- "Main Menu" returns to MenuScene

---

### Step 1.5: Pause Game Logic During Menu
**File:** `src/scenes/PhaserGameScene.ts`

**In update() method, add at the top:**
```typescript
update(time: number, delta: number): void {
  // Skip game logic when paused
  if (this.isPaused) {
    return;
  }
  
  // ... rest of update logic
}
```

**Test:**
- Game freezes when pause menu is open
- Fighters stop moving
- Timer stops counting
- Game resumes when menu closes

---

### Step 1.6: Handle ESC Key in Update Loop
**File:** `src/scenes/PhaserGameScene.ts`

**In update(), near top after pause check:**
```typescript
// Toggle pause menu
if (Phaser.Input.Keyboard.JustDown(this.pauseKey)) {
  // Close moves menu if open
  if (this.movesOverlay) {
    this.toggleMovesMenu();
  }
  // Toggle pause
  this.togglePauseMenu();
}
```

**Test:**
- ESC opens/closes pause menu
- ESC closes moves menu if open
- No conflicts with existing menus

---

## Phase 2: Character Switching

### Step 2.1: Create Character Data Structure
**File:** `src/scenes/PhaserGameScene.ts`

**Add at top of class:**
```typescript
private characterOptions = [
  { id: 'musashi', name: 'MUSASHI', color: 0x4488ff },
  { id: 'kaze', name: 'KAZE', color: 0xff8844 },
  { id: 'tetsuo', name: 'TETSUO', color: 0x44ff88 }
];
private characterSelectOverlay?: Phaser.GameObjects.Container;
private selectedP1Index: number = 0;
private selectedP2Index: number = 0;
```

**Test:** Data structure defined correctly

---

### Step 2.2: Implement Character Select Overlay
**File:** `src/scenes/PhaserGameScene.ts`

**Add method:**
```typescript
private showCharacterSelect(): void {
  // Close pause menu first
  this.togglePauseMenu();
  
  // Create overlay
  const overlay = this.add.rectangle(
    0, 0,
    this.cameras.main.width,
    this.cameras.main.height,
    0x000000, 0.8
  ).setOrigin(0);
  
  this.characterSelectOverlay = this.add.container(500, 300);
  this.characterSelectOverlay.add(overlay);
  this.characterSelectOverlay.setDepth(3000);
  
  // Title
  const title = this.add.text(0, -200, 'CHANGE CHARACTERS', {
    fontSize: '28px',
    color: '#ffff00',
    fontStyle: 'bold'
  }).setOrigin(0.5);
  this.characterSelectOverlay.add(title);
  
  // P1 selector (left)
  this.createCharacterSelector(-200, -100, 'PLAYER 1', true);
  
  // P2 selector (right)
  this.createCharacterSelector(200, -100, 'OPPONENT', false);
  
  // VS text
  const vsText = this.add.text(0, -50, 'VS', {
    fontSize: '32px',
    color: '#ffff00',
    fontStyle: 'bold'
  }).setOrigin(0.5);
  this.characterSelectOverlay.add(vsText);
  
  // Confirm button
  const confirmBtn = this.add.rectangle(0, 180, 200, 50, 0x44ff44);
  confirmBtn.setInteractive({ useHandCursor: true });
  const confirmText = this.add.text(0, 180, 'CONFIRM', {
    fontSize: '20px',
    color: '#ffffff',
    fontStyle: 'bold'
  }).setOrigin(0.5);
  
  confirmBtn.on('pointerover', () => confirmBtn.setFillStyle(0x66ff66));
  confirmBtn.on('pointerout', () => confirmBtn.setFillStyle(0x44ff44));
  confirmBtn.on('pointerdown', () => this.applyCharacterChanges());
  
  this.characterSelectOverlay.add(confirmBtn);
  this.characterSelectOverlay.add(confirmText);
  
  // Cancel button
  const cancelBtn = this.add.rectangle(0, 240, 200, 50, 0xff4444);
  cancelBtn.setInteractive({ useHandCursor: true });
  const cancelText = this.add.text(0, 240, 'CANCEL', {
    fontSize: '20px',
    color: '#ffffff',
    fontStyle: 'bold'
  }).setOrigin(0.5);
  
  cancelBtn.on('pointerover', () => cancelBtn.setFillStyle(0xff6666));
  cancelBtn.on('pointerout', () => cancelBtn.setFillStyle(0xff4444));
  cancelBtn.on('pointerdown', () => this.closeCharacterSelect());
  
  this.characterSelectOverlay.add(cancelBtn);
  this.characterSelectOverlay.add(cancelText);
}

private closeCharacterSelect(): void {
  this.characterSelectOverlay?.destroy();
  this.characterSelectOverlay = undefined;
}
```

**Test:**
- Overlay appears centered
- P1 and P2 selectors visible
- Confirm and Cancel buttons work

---

### Step 2.3: Create Character Selector Component
**File:** `src/scenes/PhaserGameScene.ts`

**Add method:**
```typescript
private createCharacterSelector(x: number, y: number, label: string, isP1: boolean): void {
  const container = this.add.container(x, y);
  
  // Label
  const labelText = this.add.text(0, -80, label, {
    fontSize: '16px',
    color: '#aaaaaa'
  }).setOrigin(0.5);
  container.add(labelText);
  
  // Current character display
  const currentIndex = isP1 ? this.selectedP1Index : this.selectedP2Index;
  const character = this.characterOptions[currentIndex];
  
  const charBox = this.add.rectangle(0, 0, 150, 100, character.color);
  container.add(charBox);
  
  const charName = this.add.text(0, 0, character.name, {
    fontSize: '18px',
    color: '#ffffff',
    fontStyle: 'bold'
  }).setOrigin(0.5);
  container.add(charName);
  
  // Left arrow
  const leftArrow = this.add.text(-80, 0, '◀', {
    fontSize: '24px',
    color: '#ffffff'
  }).setOrigin(0.5);
  leftArrow.setInteractive({ useHandCursor: true });
  leftArrow.on('pointerover', () => leftArrow.setColor('#ffff00'));
  leftArrow.on('pointerout', () => leftArrow.setColor('#ffffff'));
  leftArrow.on('pointerdown', () => {
    if (isP1) {
      this.selectedP1Index = (this.selectedP1Index - 1 + this.characterOptions.length) % this.characterOptions.length;
    } else {
      this.selectedP2Index = (this.selectedP2Index - 1 + this.characterOptions.length) % this.characterOptions.length;
    }
    this.refreshCharacterSelect();
  });
  container.add(leftArrow);
  
  // Right arrow
  const rightArrow = this.add.text(80, 0, '▶', {
    fontSize: '24px',
    color: '#ffffff'
  }).setOrigin(0.5);
  rightArrow.setInteractive({ useHandCursor: true });
  rightArrow.on('pointerover', () => rightArrow.setColor('#ffff00'));
  rightArrow.on('pointerout', () => rightArrow.setColor('#ffffff'));
  rightArrow.on('pointerdown', () => {
    if (isP1) {
      this.selectedP1Index = (this.selectedP1Index + 1) % this.characterOptions.length;
    } else {
      this.selectedP2Index = (this.selectedP2Index + 1) % this.characterOptions.length;
    }
    this.refreshCharacterSelect();
  });
  container.add(rightArrow);
  
  this.characterSelectOverlay!.add(container);
}

private refreshCharacterSelect(): void {
  // Rebuild the overlay
  this.closeCharacterSelect();
  this.showCharacterSelect();
}
```

**Test:**
- Character selectors display correctly
- Arrows cycle through characters
- Selection updates visually

---

### Step 2.4: Apply Character Changes
**File:** `src/scenes/PhaserGameScene.ts`

**Add method:**
```typescript
private applyCharacterChanges(): void {
  const p1Char = this.characterOptions[this.selectedP1Index].id;
  const p2Char = this.characterOptions[this.selectedP2Index].id;
  
  // Store in registry
  this.registry.set('player1Character', p1Char);
  this.registry.set('player2Character', p2Char);
  
  // Close overlay
  this.closeCharacterSelect();
  
  // Restart scene to apply changes
  this.scene.restart();
}
```

**Test:**
- Selecting different characters and confirming
- Scene restarts with new characters
- Both P1 and P2 update correctly

---

### Step 2.5: Initialize Character Indices in create()
**File:** `src/scenes/PhaserGameScene.ts`

**In create() method, after loading characters:**
```typescript
// Initialize character selection indices based on current characters
const p1CharId = this.registry.get('player1Character') || 'musashi';
const p2CharId = this.registry.get('player2Character') || 'musashi';
this.selectedP1Index = this.characterOptions.findIndex(c => c.id === p1CharId);
this.selectedP2Index = this.characterOptions.findIndex(c => c.id === p2CharId);
```

**Test:**
- Character indices match current fighters
- Switching characters preserves correct starting indices

---

## Phase 3: Information Display Area

### Step 3.1: Consolidate Bottom Display Position
**File:** `src/scenes/PhaserGameScene.ts`

**Define constants at top of class:**
```typescript
private readonly INFO_DISPLAY_Y = 505;
private readonly INFO_DISPLAY_HEIGHT = 85;
```

**Test:** Constants defined

---

### Step 3.2: Update Moves Overlay Position
**File:** `src/scenes/PhaserGameScene.ts`

**In toggleMovesMenu(), update position:**
```typescript
private toggleMovesMenu(): void {
  if (this.movesOverlay) {
    this.movesOverlay.destroy();
    this.movesOverlay = undefined;
    this.currentMenu = null;
    return;
  }

  // Hide instructions when showing menu
  if (this.instructionsText) {
    this.instructionsText.setVisible(false);
  }

  // Use consistent position
  const centerX = 500;
  const baseY = this.INFO_DISPLAY_Y;
  
  // ... rest of method unchanged
}
```

**Test:** Moves overlay positioned at Y: 505

---

### Step 3.3: Update Instructions Text Position
**File:** `src/scenes/PhaserGameScene.ts`

**In create(), update instructionsText:**
```typescript
this.instructionsText = this.add.text(500, 560, 
  'F2: Moves | ESC: Menu', {
  fontSize: '11px',
  color: '#888888',
  align: 'center',
});
this.instructionsText.setOrigin(0.5, 1);
```

**Test:** Instructions display at bottom, consistent position

---

### Step 3.4: Hide Instructions When Menu Active
**File:** `src/scenes/PhaserGameScene.ts`

**In togglePauseMenu(), hide instructions:**
```typescript
private togglePauseMenu(): void {
  if (this.pauseMenu) {
    // Resume game
    this.pauseMenu.destroy();
    this.pauseMenu = undefined;
    this.isPaused = false;
    
    // Show instructions again
    if (this.instructionsText) {
      this.instructionsText.setVisible(!this.touchControls);
    }
    return;
  }

  // Pause game
  this.isPaused = true;
  
  // Hide instructions
  if (this.instructionsText) {
    this.instructionsText.setVisible(false);
  }
  
  // ... rest of method
}
```

**Test:** 
- Instructions hide when pause menu opens
- Instructions show when pause menu closes

---

## Phase 4: Cleanup and Polish

### Step 4.1: Remove Deprecated F-Key Handlers
**File:** `src/scenes/PhaserGameScene.ts`

**In create(), remove these keys:**
```typescript
// REMOVE THESE:
// this.trainingModeKey = this.input.keyboard!.addKey('F3');
// this.resetPositionKey = this.input.keyboard!.addKey('F4');
// this.resetHealthKey = this.input.keyboard!.addKey('F6');
// this.infiniteMeterKey = this.input.keyboard!.addKey('F5');

// KEEP ONLY:
this.movesKey = this.input.keyboard!.addKey('F2');
this.pauseKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
```

**In update(), remove old F-key logic:**
```typescript
// REMOVE THESE BLOCKS:
// if (Phaser.Input.Keyboard.JustDown(this.trainingModeKey)) { ... }
// if (Phaser.Input.Keyboard.JustDown(this.resetPositionKey)) { ... }
// if (Phaser.Input.Keyboard.JustDown(this.resetHealthKey)) { ... }
// if (Phaser.Input.Keyboard.JustDown(this.infiniteMeterKey)) { ... }
```

**Test:**
- F3-F9 keys no longer trigger actions
- F2 still toggles moves menu
- ESC opens pause menu

---

### Step 4.2: Update Help Menu (F1)
**File:** `src/scenes/PhaserGameScene.ts`

**Update toggleHelpMenu() content:**
```typescript
const leftControls = [
  'Arrow Keys - Move',
  'Z - Light Attack',
  'X - Heavy Attack',
  'C - Special Move'
];

const middleControls = [
  'V - Block',
  'ESC - Pause Menu',
  'F1 - Help Menu',
  'F2 - Special Moves'
];

const rightControls = [
  'Practice Menu (ESC):',
  '- Change Characters',
  '- Reset Match',
  '- Change Opponent'
];
```

**Test:** F1 shows updated controls

---

### Step 4.3: Remove Character Test Lab from Menu
**File:** `src/scenes/MenuScene.ts`

**Remove or comment out:**
```typescript
// REMOVE THIS BUTTON:
// const characterTestButton = this.add.text(...)
//   .on('pointerdown', () => this.startCharacterTest())

// REMOVE THIS METHOD:
// startCharacterTest() { ... }
```

**Test:** Character Test Lab button no longer appears on main menu

---

### Step 4.4: Update Copilot Instructions
**File:** `.github/copilot-instructions.md`

**Update Exhibition/Practice Mode section:**
```markdown
## Practice Mode
- Accessible via "Practice Mode" button on main menu
- 5 bot personalities with 10 difficulty levels each
- In-match pause menu (ESC) for training tools
- Character switching without leaving match
- Move list display (F2 quick toggle)
- Post-match options include Replay, Change Opponent, and Main Menu
```

**Test:** Documentation updated

---

### Step 4.5: Test Cross-Mode Consistency
**Manual testing required:**

**Single Player Mode:**
- ESC opens pause menu
- Menu positioned center screen
- Options include Resume, Main Menu

**Practice Mode:**
- ESC opens pause menu
- Menu positioned same as single player
- Additional options: Change Characters, Show Moves, etc.

**Multiplayer Mode:**
- ESC opens pause menu (if applicable)
- Consistent styling and position

**Test:**
- All modes use same menu styling
- Same font sizes and colors
- Same button hover effects
- Same keyboard navigation

---

## Phase 5: Testing & Validation

### Test 5.1: Pause Menu Functionality
- [ ] ESC opens/closes pause menu
- [ ] Game freezes when paused
- [ ] All menu options work correctly
- [ ] Resume returns to match
- [ ] Show Moves opens moves overlay
- [ ] Change Characters opens character select
- [ ] Reset Match resets positions and health
- [ ] Change Opponent returns to BotSelectionScene
- [ ] Main Menu returns to MenuScene

### Test 5.2: Character Switching
- [ ] Character select overlay displays correctly
- [ ] P1 and P2 selectors work independently
- [ ] Arrows cycle through all characters
- [ ] Confirm applies changes and restarts match
- [ ] Cancel returns to pause menu without changes
- [ ] Selected characters match actual fighters

### Test 5.3: Moves Display
- [ ] F2 toggles moves list
- [ ] Moves list positioned at bottom (Y: 505)
- [ ] All special moves show correct inputs
- [ ] ESC closes moves list
- [ ] Pause menu → Show Moves works

### Test 5.4: Information Area
- [ ] Default instructions visible at bottom
- [ ] Instructions hide when menu/overlay active
- [ ] Instructions reappear when menus close
- [ ] No overlapping displays
- [ ] Consistent positioning across all states

### Test 5.5: Cross-Mode Consistency
- [ ] Pause menu same position in all modes
- [ ] Same styling (colors, fonts, sizes)
- [ ] Same keyboard shortcuts (ESC, arrows, enter)
- [ ] Same button hover effects

### Test 5.6: Mobile/Touch Support
- [ ] Pause menu buttons tap-friendly
- [ ] Character select arrows tap-friendly
- [ ] Touch controls don't conflict with menus
- [ ] Instructions hidden on mobile (uses touch controls)

---

## Completion Checklist

- [ ] Phase 1: Pause Menu System - Complete
- [ ] Phase 2: Character Switching - Complete
- [ ] Phase 3: Information Display Area - Complete
- [ ] Phase 4: Cleanup and Polish - Complete
- [ ] Phase 5: Testing & Validation - All tests passing
- [ ] Documentation updated
- [ ] Ready for user acceptance testing

---

## Rollback Plan

If issues arise:

1. **Backup files before starting:**
   ```bash
   cp src/scenes/PhaserGameScene.ts src/scenes/PhaserGameScene.ts.backup
   cp src/scenes/MenuScene.ts src/scenes/MenuScene.ts.backup
   ```

2. **Commit after each phase:**
   ```bash
   git add .
   git commit -m "Phase X: [Description]"
   ```

3. **Revert if needed:**
   ```bash
   git revert HEAD
   # or restore from backup
   ```

---

## Success Metrics

- ✅ Single ESC-based pause menu replaces F3-F9 complexity
- ✅ Character switching works without scene transitions
- ✅ Consistent UI across all game modes
- ✅ Simplified, approachable interface
- ✅ All training tools accessible from one menu
- ✅ No user-facing bugs or visual glitches
