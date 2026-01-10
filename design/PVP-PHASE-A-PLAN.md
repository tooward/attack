# PVP Phase A: Mobile Foundation - Detailed Implementation Plan

**Duration:** 1-2 weeks
**Goal:** Package existing game for mobile devices with touch controls

---

## Overview

Phase A transforms the desktop browser game into a mobile-ready application. We're **NOT** building multiplayer yet - just getting the game running on phones with proper touch controls.

**What You'll Build:**
1. Capacitor wrapper for iOS/Android
2. Touch controls overlay (virtual gamepad)
3. Performance optimizations for mobile
4. Test builds on actual devices

**What You'll Have:**
- Game running on your phone
- Virtual controls that feel responsive
- 60fps on mid-tier devices
- Foundation for multiplayer in Phase B

---

## Prerequisites

### Required Software
- Node.js 20+ (already installed ✅)
- iOS Development:
  - macOS (for Xcode)
  - Xcode 15+
  - iOS Simulator
  - Apple Developer Account ($99/year) - for device testing only, simulator is free
- Android Development:
  - Android Studio
  - Android SDK 33+
  - Android Emulator or physical device

### Existing Codebase Status
✅ Core game engine works
✅ Phaser 3.88.2 integrated
✅ Sprites and animations ready
✅ Single-player vs bot works

---

## Task Breakdown

### A.1: Capacitor Setup (Day 1)
**Goal:** Install Capacitor and create native projects

#### Step 1: Install Capacitor
```bash
cd /Users/mikeiog/Development/attack
npm install @capacitor/cli @capacitor/core
npm install @capacitor/ios @capacitor/android
npm install @capacitor/haptics @capacitor/storage
npx cap init
```

When prompted:
- **App name:** Five Rings
- **App ID:** com.fiverings.fighting
- **Web directory:** dist

#### Step 2: Create Capacitor Config
**File:** `capacitor.config.ts` (create in root)

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fiverings.fighting',
  appName: 'Five Rings',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // For development, uncomment to use local server:
    // url: 'http://192.168.1.XXX:5173',
    // cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#000000",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false
    }
  }
};

export default config;
```

#### Step 3: Add Native Platforms
```bash
npm run build        # Build the web app
npx cap add ios      # Creates ios/ folder
npx cap add android  # Creates android/ folder
```

#### Step 4: Sync and Open
```bash
npx cap sync         # Copy web assets to native projects
npx cap open ios     # Opens Xcode
npx cap open android # Opens Android Studio
```

#### Verification
- [ ] `ios/` and `android/` folders created
- [ ] Xcode project opens without errors
- [ ] Android Studio project opens without errors
- [ ] Can build in iOS Simulator (Cmd+R in Xcode)
- [ ] Can build in Android Emulator (Run button in Android Studio)

---

### A.2: Touch Controls Implementation (Days 2-4)

#### Step 1: Create Touch Controls Module Structure
```bash
mkdir -p src/phaser/ui
touch src/phaser/ui/TouchControlsOverlay.ts
touch src/phaser/ui/DPadControl.ts
touch src/phaser/ui/ActionButton.ts
```

#### Step 2: Implement ActionButton Component
**File:** `src/phaser/ui/ActionButton.ts`

```typescript
import Phaser from 'phaser';
import { InputAction } from '../../core/types/InputAction';

export class ActionButton extends Phaser.GameObjects.Container {
  private button: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private isPressed: boolean = false;
  private action: InputAction;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    action: InputAction,
    label: string,
    color: number = 0xe74c3c
  ) {
    super(scene, x, y);
    this.action = action;

    // Draw circular button
    this.button = scene.add.graphics();
    this.button.fillStyle(color, 0.7);
    this.button.fillCircle(0, 0, 35);
    this.add(this.button);

    // Add label text
    this.label = scene.add.text(0, 0, label, {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    });
    this.label.setOrigin(0.5);
    this.add(this.label);

    // Make interactive
    this.setSize(70, 70);
    this.setInteractive(
      new Phaser.Geom.Circle(0, 0, 35),
      Phaser.Geom.Circle.Contains
    );

    this.setupInputHandlers();
  }

  private setupInputHandlers() {
    this.on('pointerdown', () => {
      this.setPressed(true);
    });

    this.on('pointerup', () => {
      this.setPressed(false);
    });

    this.on('pointerout', () => {
      if (this.isPressed) {
        this.setPressed(false);
      }
    });
  }

  private setPressed(pressed: boolean) {
    this.isPressed = pressed;

    // Visual feedback
    this.button.clear();
    if (pressed) {
      this.button.fillStyle(0xff6b6b, 1.0);
      this.button.fillCircle(0, 0, 38); // Slightly larger
      this.triggerHaptic();
    } else {
      this.button.fillStyle(0xe74c3c, 0.7);
      this.button.fillCircle(0, 0, 35);
    }

    // Emit event
    this.emit(pressed ? 'pressed' : 'released', this.action);
  }

  private async triggerHaptic() {
    try {
      const { Haptics } = await import('@capacitor/haptics');
      await Haptics.impact({ style: 'light' });
    } catch (e) {
      // Haptics not available (browser)
    }
  }

  getAction(): InputAction {
    return this.action;
  }

  isPressedDown(): boolean {
    return this.isPressed;
  }
}
```

#### Step 3: Implement D-Pad Control
**File:** `src/phaser/ui/DPadControl.ts`

```typescript
import Phaser from 'phaser';

type Direction = 'up' | 'down' | 'left' | 'right' | null;

export class DPadControl extends Phaser.GameObjects.Container {
  private background: Phaser.GameObjects.Graphics;
  private directionGraphics: Map<string, Phaser.GameObjects.Graphics>;
  private activeDirection: Direction = null;
  private isPressed: boolean = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    // Background circle
    this.background = scene.add.graphics();
    this.background.fillStyle(0x333333, 0.5);
    this.background.fillCircle(0, 0, 60);
    this.add(this.background);

    // Directional segments
    this.directionGraphics = new Map();
    const directions = [
      { key: 'up', angle: -90 },
      { key: 'right', angle: 0 },
      { key: 'down', angle: 90 },
      { key: 'left', angle: 180 }
    ];

    for (const dir of directions) {
      const graphic = scene.add.graphics();
      graphic.fillStyle(0x4a90e2, 0.7);
      graphic.slice(
        0, 0, 50,
        Phaser.Math.DegToRad(dir.angle - 30),
        Phaser.Math.DegToRad(dir.angle + 30)
      );
      graphic.fillPath();
      graphic.setAlpha(0.3);
      this.directionGraphics.set(dir.key, graphic);
      this.add(graphic);
    }

    // Make interactive
    this.setSize(120, 120);
    this.setInteractive(
      new Phaser.Geom.Circle(0, 0, 60),
      Phaser.Geom.Circle.Contains
    );

    this.setupTouchHandlers();
  }

  private setupTouchHandlers() {
    this.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isPressed = true;
      this.updateDirection(pointer);
    });

    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isPressed && pointer.isDown) {
        this.updateDirection(pointer);
      }
    });

    this.scene.input.on('pointerup', () => {
      this.isPressed = false;
      this.setActiveDirection(null);
    });
  }

  private updateDirection(pointer: Phaser.Input.Pointer) {
    const localX = pointer.x - this.x;
    const localY = pointer.y - this.y;
    const distance = Math.sqrt(localX * localX + localY * localY);

    if (distance > 60) {
      // Outside d-pad, clear direction
      this.setActiveDirection(null);
      return;
    }

    const angle = Phaser.Math.Angle.Between(0, 0, localX, localY);
    const degrees = Phaser.Math.RadToDeg(angle);

    let newDirection: Direction = null;
    if (degrees > -45 && degrees < 45) newDirection = 'right';
    else if (degrees >= 45 && degrees < 135) newDirection = 'down';
    else if (degrees >= 135 || degrees < -135) newDirection = 'left';
    else if (degrees >= -135 && degrees <= -45) newDirection = 'up';

    if (newDirection !== this.activeDirection) {
      this.setActiveDirection(newDirection);
    }
  }

  private setActiveDirection(direction: Direction) {
    // Reset all
    for (const graphic of this.directionGraphics.values()) {
      graphic.setAlpha(0.3);
    }

    // Highlight active
    if (direction && this.directionGraphics.has(direction)) {
      this.directionGraphics.get(direction)!.setAlpha(1.0);
    }

    this.activeDirection = direction;
    this.emit('directionChange', direction);
  }

  getActiveDirection(): Direction {
    return this.activeDirection;
  }
}
```

#### Step 4: Implement Touch Controls Overlay
**File:** `src/phaser/ui/TouchControlsOverlay.ts`

```typescript
import Phaser from 'phaser';
import { DPadControl } from './DPadControl';
import { ActionButton } from './ActionButton';
import { InputAction } from '../../core/types/InputAction';

export class TouchControlsOverlay extends Phaser.GameObjects.Container {
  private dpad: DPadControl;
  private actionButtons: Map<InputAction, ActionButton>;
  private activeInputs: Set<InputAction> = new Set();

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);

    const width = scene.cameras.main.width;
    const height = scene.cameras.main.height;

    // D-Pad (bottom left)
    this.dpad = new DPadControl(scene, 120, height - 120);
    this.add(this.dpad);

    // Action buttons (bottom right)
    this.actionButtons = new Map();
    const buttonLayout = [
      { action: InputAction.HP, label: 'HP', x: -80, y: -80 },
      { action: InputAction.LP, label: 'LP', x: -80, y: 0 },
      { action: InputAction.HK, label: 'HK', x: 0, y: -40 },
      { action: InputAction.LK, label: 'LK', x: 0, y: 40 }
    ];

    const baseX = width - 120;
    const baseY = height - 120;

    for (const btn of buttonLayout) {
      const button = new ActionButton(
        scene,
        baseX + btn.x,
        baseY + btn.y,
        btn.action,
        btn.label
      );
      this.actionButtons.set(btn.action, button);
      this.add(button);
    }

    // Block button (left side, middle height)
    const blockButton = new ActionButton(
      scene,
      120,
      height - 280,
      InputAction.BLOCK,
      '🛡',
      0x666666
    );
    this.actionButtons.set(InputAction.BLOCK, blockButton);
    this.add(blockButton);

    this.setupInputHandlers();
    this.setDepth(1000); // Always on top
  }

  private setupInputHandlers() {
    // D-Pad direction changes
    this.dpad.on('directionChange', (direction: string | null) => {
      // Clear all directional inputs
      this.activeInputs.delete(InputAction.LEFT);
      this.activeInputs.delete(InputAction.RIGHT);
      this.activeInputs.delete(InputAction.UP);
      this.activeInputs.delete(InputAction.DOWN);

      // Add new direction
      if (direction === 'left') this.activeInputs.add(InputAction.LEFT);
      if (direction === 'right') this.activeInputs.add(InputAction.RIGHT);
      if (direction === 'up') this.activeInputs.add(InputAction.UP);
      if (direction === 'down') this.activeInputs.add(InputAction.DOWN);
    });

    // Action button presses
    for (const [action, button] of this.actionButtons) {
      button.on('pressed', () => {
        this.activeInputs.add(action);
      });

      button.on('released', () => {
        this.activeInputs.delete(action);
      });
    }
  }

  getCurrentInput(): InputAction[] {
    return Array.from(this.activeInputs);
  }

  destroy() {
    this.activeInputs.clear();
    super.destroy();
  }
}
```

#### Step 5: Integrate with FightScene
**File:** `src/phaser/scenes/FightScene.ts` (modify existing)

Find the `create()` method and add:

```typescript
// Add near the top of create() method
private touchControls?: TouchControlsOverlay;

create() {
  // ... existing initialization code ...

  // Add touch controls for mobile
  if (this.isMobileDevice()) {
    this.touchControls = new TouchControlsOverlay(this);
    this.add.existing(this.touchControls);
  }

  // ... rest of create method ...
}

private isMobileDevice(): boolean {
  // Check if running on Capacitor (native app)
  return !!(window as any).Capacitor;
}
```

Find the `update()` method and modify input gathering:

```typescript
update() {
  // Get player inputs
  const playerInputs: InputAction[] = this.touchControls
    ? this.touchControls.getCurrentInput()
    : this.inputManager.getCurrentInput(); // Keyboard fallback

  // ... rest of update logic ...
}
```

#### Verification
- [ ] Touch controls appear on screen
- [ ] D-pad responds to touch
- [ ] Action buttons respond to touch
- [ ] Haptic feedback works on device
- [ ] Can perform moves using touch controls
- [ ] Multiple simultaneous inputs work (e.g., down+right+punch)

---

### A.3: Performance Optimization (Day 5)

#### Step 1: Enable Texture Atlas (if not already done)
Check if `assets/` has atlas files. If not, create them:

```bash
# Install texture packer alternative
npm install free-tex-packer-core --save-dev
```

Create script: `scripts/pack-textures.js`

```javascript
const texturePacker = require('free-tex-packer-core');
const fs = require('fs');
const path = require('path');

// Pack player sprites
texturePacker(
  [path.join(__dirname, '../assets/player/**/*.png')],
  {
    textureName: 'player-atlas',
    width: 2048,
    height: 2048,
    exporter: 'Phaser3'
  },
  (files) => {
    for (const file of files) {
      const outputPath = path.join(__dirname, '../assets', file.name);
      fs.writeFileSync(outputPath, file.buffer);
    }
  }
);
```

Run: `node scripts/pack-textures.js`

#### Step 2: Mobile-Specific Config
**File:** `src/phaser/config.ts` (modify)

```typescript
import Phaser from 'phaser';

const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
const scale = isMobile ? 0.75 : 1.0;

export const phaserConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  width: 1920 * scale,
  height: 1080 * scale,
  backgroundColor: '#000000',
  
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  
  render: {
    powerPreference: 'high-performance',
    roundPixels: true,
    pixelArt: false,
    antialias: !isMobile, // Disable AA on mobile for performance
    transparent: false
  },
  
  physics: {
    default: 'arcade',
    arcade: {
      debug: false
    }
  },
  
  // ... rest of config
};
```

#### Step 3: Audio Optimization
**File:** `src/phaser/systems/AudioManager.ts` (modify or create)

```typescript
export class AudioManager {
  private maxSimultaneousSounds = 5;
  private activeSounds: Phaser.Sound.BaseSound[] = [];

  playSound(scene: Phaser.Scene, key: string, volume: number = 1.0) {
    // Limit simultaneous sounds on mobile
    if (this.activeSounds.length >= this.maxSimultaneousSounds) {
      const oldest = this.activeSounds.shift();
      oldest?.stop();
    }

    const sound = scene.sound.add(key, { volume });
    sound.play();
    
    this.activeSounds.push(sound);
    sound.once('complete', () => {
      const index = this.activeSounds.indexOf(sound);
      if (index > -1) this.activeSounds.splice(index, 1);
    });
  }
}
```

#### Verification
- [ ] Game runs at 60fps on iPhone 12 / Galaxy A54
- [ ] No frame drops during combos
- [ ] Load time < 3 seconds
- [ ] App size < 50MB

---

### A.4: Build and Test (Days 6-7)

#### iOS Build Process
```bash
# 1. Build web app
npm run build

# 2. Sync to iOS
npx cap sync ios

# 3. Open Xcode
npx cap open ios

# In Xcode:
# 4. Select your development team (Xcode > Preferences > Accounts)
# 5. Select a simulator (e.g., iPhone 15)
# 6. Click Run (Cmd+R)
```

#### Android Build Process
```bash
# 1. Build web app
npm run build

# 2. Sync to Android
npx cap sync android

# 3. Open Android Studio
npx cap open android

# In Android Studio:
# 4. Create/select AVD (Virtual Device)
# 5. Click Run (green play button)
```

#### Testing Checklist
- [ ] App launches successfully
- [ ] Main menu displays correctly
- [ ] Can start a match
- [ ] Touch controls work
- [ ] Game runs smoothly (60fps)
- [ ] Sounds play correctly
- [ ] Game logic works (can win/lose)
- [ ] App doesn't crash

---

## Common Issues and Solutions

### Issue: Xcode won't build
**Solution:** 
1. Check team signing settings
2. Run `pod install` in `ios/App/` folder
3. Clean build folder (Cmd+Shift+K)

### Issue: Android Studio won't build
**Solution:**
1. Update Android SDK via SDK Manager
2. Run `Invalidate Caches and Restart`
3. Check `android/build.gradle` has correct SDK versions

### Issue: Touch controls not appearing
**Solution:**
1. Check `(window as any).Capacitor` is truthy
2. Verify `TouchControlsOverlay` is added to scene
3. Check z-index with `setDepth(1000)`

### Issue: Game runs slowly on device
**Solution:**
1. Reduce resolution scale further (0.5 instead of 0.75)
2. Disable antialiasing
3. Use texture atlases
4. Limit particle effects

---

## Deliverables Checklist

At the end of Phase A, you should have:

- [ ] iOS app builds and runs in simulator
- [ ] Android app builds and runs in emulator
- [ ] Touch controls fully functional
- [ ] D-pad controls movement
- [ ] Action buttons trigger attacks
- [ ] Can play full match using touch controls
- [ ] Game runs at 60fps on target devices
- [ ] Haptic feedback works
- [ ] Visual feedback on button presses
- [ ] No crashes or major bugs

---

## Next Steps (Phase B Preview)

Once Phase A is complete, Phase B will add:
- WebSocket connection to backend server
- Matchmaking queue
- Real-time opponent synchronization
- Network input handling

But for now, focus on getting the local single-player experience working perfectly on mobile!

---

## Questions or Issues?

If you get stuck:
1. Check Capacitor docs: https://capacitorjs.com/docs
2. Check Phaser docs: https://photonstorm.github.io/phaser3-docs/
3. Test on actual device if simulator behaves weirdly
4. Verify `npm run build` produces valid `dist/` folder

---

**Estimated Time:** 1-2 weeks
**Next Phase:** Phase B - Backend Server (Week 2-3)
