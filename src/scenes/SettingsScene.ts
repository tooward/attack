/**
 * Settings Scene
 * Allows players to configure audio, graphics, and controls
 */

import { Scene } from 'phaser';

interface GameSettings {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  showFPS: boolean;
  showHitboxes: boolean;
}

export default class SettingsScene extends Scene {
  private settings: GameSettings = {
    masterVolume: 1.0,
    sfxVolume: 0.7,
    musicVolume: 0.5,
    showFPS: false,
    showHitboxes: false,
  };

  private sliders: Map<string, { bar: Phaser.GameObjects.Rectangle, handle: Phaser.GameObjects.Circle }> = new Map();

  constructor() {
    super({ key: 'SettingsScene' });
  }

  create(): void {
    const centerX = 500;
    let yPos = 80;

    // Load saved settings
    this.loadSettings();

    // Background
    this.add.rectangle(0, 0, 1000, 600, 0x1a1a2e).setOrigin(0);

    // Title
    const titleText = this.add.text(centerX, 50, 'SETTINGS', {
      fontSize: '48px',
      fontStyle: 'bold',
      color: '#00ff00',
      stroke: '#000000',
      strokeThickness: 6,
    });
    titleText.setOrigin(0.5);

    yPos = 120;

    // Audio Settings Section
    this.add.text(centerX, yPos, '── AUDIO ──', {
      fontSize: '24px',
      color: '#00aaff',
    }).setOrigin(0.5);
    yPos += 50;

    // Master Volume
    this.createSlider('masterVolume', 'Master Volume', centerX, yPos, this.settings.masterVolume);
    yPos += 60;

    // SFX Volume
    this.createSlider('sfxVolume', 'Sound Effects', centerX, yPos, this.settings.sfxVolume);
    yPos += 60;

    // Music Volume
    this.createSlider('musicVolume', 'Music', centerX, yPos, this.settings.musicVolume);
    yPos += 80;

    // Graphics Settings Section
    this.add.text(centerX, yPos, '── DISPLAY ──', {
      fontSize: '24px',
      color: '#00aaff',
    }).setOrigin(0.5);
    yPos += 50;

    // FPS Toggle
    this.createToggle('showFPS', 'Show FPS', centerX, yPos, this.settings.showFPS);
    yPos += 50;

    // Hitbox Toggle (Training Mode)
    this.createToggle('showHitboxes', 'Show Hitboxes (Training)', centerX, yPos, this.settings.showHitboxes);
    yPos += 80;

    // Buttons
    this.createButton(centerX - 100, 520, 'SAVE', () => this.saveAndExit());
    this.createButton(centerX + 100, 520, 'CANCEL', () => this.cancel());

    // Instructions
    const instructionText = this.add.text(centerX, 560, 
      'Press ENTER to save or ESC to cancel', {
      fontSize: '14px',
      color: '#888888',
    });
    instructionText.setOrigin(0.5);

    // Keyboard shortcuts
    this.input.keyboard!.on('keydown-ENTER', () => this.saveAndExit());
    this.input.keyboard!.on('keydown-ESC', () => this.cancel());
  }

  private createSlider(key: string, label: string, x: number, y: number, value: number): void {
    // Label
    this.add.text(x - 250, y, label, {
      fontSize: '18px',
      color: '#ffffff',
    });

    // Value display
    const valueText = this.add.text(x + 250, y, `${Math.round(value * 100)}%`, {
      fontSize: '18px',
      color: '#00ff00',
    });

    // Slider bar background
    const barBg = this.add.rectangle(x, y, 300, 8, 0x333333);
    
    // Slider bar fill
    const barFill = this.add.rectangle(x - 150, y, value * 300, 8, 0x00ff00);
    barFill.setOrigin(0, 0.5);

    // Slider handle
    const handle = this.add.circle(x - 150 + value * 300, y, 12, 0xffffff);
    handle.setStrokeStyle(2, 0x00ff00);
    handle.setInteractive({ useHandCursor: true });
    this.input.setDraggable(handle);

    // Store references
    this.sliders.set(key, { bar: barFill, handle });

    // Drag event
    handle.on('drag', (pointer: Phaser.Input.Pointer, dragX: number) => {
      const sliderX = Math.max(x - 150, Math.min(x + 150, dragX));
      handle.x = sliderX;
      
      const newValue = (sliderX - (x - 150)) / 300;
      barFill.width = newValue * 300;
      valueText.setText(`${Math.round(newValue * 100)}%`);
      
      // Update settings
      (this.settings as any)[key] = newValue;
    });
  }

  private createToggle(key: string, label: string, x: number, y: number, value: boolean): void {
    // Label
    this.add.text(x - 200, y, label, {
      fontSize: '18px',
      color: '#ffffff',
    });

    // Toggle box
    const box = this.add.rectangle(x + 150, y, 50, 30, value ? 0x00aa00 : 0x666666);
    box.setStrokeStyle(2, 0xffffff);
    box.setInteractive({ useHandCursor: true });

    // Toggle indicator
    const indicator = this.add.circle(
      x + 150 + (value ? 10 : -10), 
      y, 
      10, 
      0xffffff
    );

    // Click to toggle
    box.on('pointerdown', () => {
      const newValue = !(this.settings as any)[key];
      (this.settings as any)[key] = newValue;
      
      box.setFillStyle(newValue ? 0x00aa00 : 0x666666);
      indicator.x = x + 150 + (newValue ? 10 : -10);
    });
  }

  private createButton(x: number, y: number, text: string, onClick: () => void): void {
    const bg = this.add.rectangle(0, 0, 140, 50, 0x00aa00);
    bg.setInteractive({ useHandCursor: true });
    bg.setStrokeStyle(2, 0x00ff00);

    const label = this.add.text(0, 0, text, {
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#ffffff',
    });
    label.setOrigin(0.5);

    const container = this.add.container(x, y, [bg, label]);

    // Hover effects
    bg.on('pointerover', () => {
      bg.setFillStyle(0x00cc00);
      label.setScale(1.1);
    });

    bg.on('pointerout', () => {
      bg.setFillStyle(0x00aa00);
      label.setScale(1);
    });

    bg.on('pointerdown', () => {
      bg.setFillStyle(0x008800);
      label.setScale(0.95);
    });

    bg.on('pointerup', () => {
      bg.setFillStyle(0x00cc00);
      label.setScale(1.1);
      onClick();
    });
  }

  private loadSettings(): void {
    const saved = localStorage.getItem('gameSettings');
    if (saved) {
      try {
        this.settings = JSON.parse(saved);
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    }
  }

  private saveAndExit(): void {
    // Save to localStorage
    localStorage.setItem('gameSettings', JSON.stringify(this.settings));
    
    // Apply settings to registry for game to use
    this.registry.set('settings', this.settings);
    
    // Return to menu
    this.scene.start('MainMenuScene');
  }

  private cancel(): void {
    this.scene.start('MainMenuScene');
  }
}
