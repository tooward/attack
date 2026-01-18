/**
 * BotSelectionScene - Select AI opponent for practice/exhibition mode
 * 
 * Features:
 * - Display all 5 advanced scripted bots
 * - Show bot characteristics (style, block rate, anti-air rate)
 * - Difficulty slider (1-10)
 * - Visual preview of bot behavior
 */

import { Scene } from 'phaser';
import { BotType } from '../ml/training/BotSelector';

interface BotInfo {
  type: BotType;
  name: string;
  style: string;
  description: string;
  blockRate: string;
  antiAir: string;
  difficultyRange: string;
  color: number;
}

type CharacterInfo = {
  id: string;
  name: string;
  spriteKey: string;
  color: number;
};

export default class BotSelectionScene extends Scene {
  private selectedBotIndex: number = 2; // Default to Aggressor
  private selectedDifficulty: number = 5;
  private selectedPlayer1CharIndex: number = 0; // Default to Musashi
  private selectedPlayer2CharIndex: number = 1; // Default to Kaze (different from player)
  
  private characterSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  
  private characters: CharacterInfo[] = [
    { id: 'musashi', name: 'Musashi', spriteKey: 'player_idle', color: 0x4488ff },
    { id: 'kaze', name: 'Kaze', spriteKey: 'kaze_idle', color: 0xff8844 },
    { id: 'tetsuo', name: 'Tetsuo', spriteKey: 'tetsuo_idle', color: 0x44ff88 }
  ];
  
  private bots: BotInfo[] = [
    {
      type: BotType.TUTORIAL,
      name: 'Tutorial Bot',
      style: 'Passive / Educational',
      description: 'Perfect for beginners. Simple, predictable patterns with large openings.',
      blockRate: '17-40%',
      antiAir: '11-30%',
      difficultyRange: '1-4',
      color: 0x4CAF50 // Green
    },
    {
      type: BotType.GUARDIAN,
      name: 'Guardian Bot',
      style: 'Defensive / Counter',
      description: 'Strong defense and counter-punching. Blocks often and punishes mistakes.',
      blockRate: '43-70%',
      antiAir: '43-70%',
      difficultyRange: '3-8',
      color: 0x2196F3 // Blue
    },
    {
      type: BotType.AGGRESSOR,
      name: 'Aggressor Bot',
      style: 'Rushdown / Pressure',
      description: 'Constant pressure with frame traps. Rarely blocks, always attacking.',
      blockRate: '17-30%',
      antiAir: '50-60%',
      difficultyRange: '3-8',
      color: 0xF44336 // Red
    },
    {
      type: BotType.TACTICIAN,
      name: 'Tactician Bot',
      style: 'Zoner / Spacing',
      description: 'Maintains optimal range. Punishes approaches and controls space.',
      blockRate: '62-78%',
      antiAir: '75-85%',
      difficultyRange: '3-5',
      color: 0xFF9800 // Orange
    },
    {
      type: BotType.WILDCARD,
      name: 'Wildcard Bot',
      style: 'Unpredictable / Adaptive',
      description: 'Randomly switches playstyles. Expert execution and adaptation.',
      blockRate: '77-80%',
      antiAir: '91-95%',
      difficultyRange: '5-10',
      color: 0x9C27B0 // Purple
    }
  ];

  constructor() {
    super({ key: 'BotSelectionScene' });
  }

  preload() {
    // Load character idle sprites
    this.load.spritesheet('player_idle', 'assets/player/IDLE.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('kaze_idle', 'assets/enemy2/IDLE.png', { frameWidth: 128, frameHeight: 64 });
    this.load.spritesheet('tetsuo_idle', 'assets/enemy4/IDLE.png', { frameWidth: 96, frameHeight: 96 });
  }

  create() {
    const width = this.sys.game.config.width as number;
    const height = this.sys.game.config.height as number;

    // Create animations if they don't exist
    if (!this.anims.exists('player_idle_anim')) {
      this.anims.create({
        key: 'player_idle_anim',
        frames: this.anims.generateFrameNumbers('player_idle', { start: 0, end: -1 }),
        frameRate: 8,
        repeat: -1
      });
    }
    if (!this.anims.exists('kaze_idle_anim')) {
      this.anims.create({
        key: 'kaze_idle_anim',
        frames: this.anims.generateFrameNumbers('kaze_idle', { start: 0, end: -1 }),
        frameRate: 8,
        repeat: -1
      });
    }
    if (!this.anims.exists('tetsuo_idle_anim')) {
      this.anims.create({
        key: 'tetsuo_idle_anim',
        frames: this.anims.generateFrameNumbers('tetsuo_idle', { start: 0, end: -1 }),
        frameRate: 8,
        repeat: -1
      });
    }

    // Background
    this.add.rectangle(0, 0, width, height, 0x1a1a1a).setOrigin(0);

    // Title
    this.add.text(width / 2, 30, 'Practice Mode', {
      fontSize: `${height * 0.045}px`,
      color: '#fff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Character selection section
    this.createCharacterSelection(width, height);

    // Difficulty slider
    this.createDifficultySlider(width, height);

    // Action buttons
    this.createActionButtons(width, height);

    // Setup keyboard controls
    this.setupKeyboardControls();
  }

  private createCharacterSelection(width: number, height: number) {
    // Section title
    this.add.text(width / 2, 50, 'Select Characters', {
      fontSize: '20px',
      color: '#aaaaaa'
    }).setOrigin(0.5);

    // Player 1 selection (left side)
    this.createCharacterSelector(width / 2 - 200, 120, 'PLAYER 1', true);
    
    // Player 2 selection (right side)
    this.createCharacterSelector(width / 2 + 200, 120, 'OPPONENT', false);
    
    // VS text in middle
    this.add.text(width / 2, 150, 'VS', {
      fontSize: '32px',
      color: '#ffff00',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    // Bot selector under opponent (right side)
    this.createBotSelector(width / 2 + 200, 280);
  }

  private createCharacterSelector(x: number, y: number, label: string, isPlayer1: boolean) {
    const charIndex = isPlayer1 ? this.selectedPlayer1CharIndex : this.selectedPlayer2CharIndex;
    const char = this.characters[charIndex];

    // Label above
    this.add.text(x, y - 20, label, {
      fontSize: '14px',
      color: '#aaaaaa'
    }).setOrigin(0.5);

    // Character box
    const box = this.add.rectangle(x, y + 50, 150, 120, 0x1a1a1a);
    
    // Character sprite with idle animation
    let scale = 1;
    let yOffset = 0; // Y offset to align bottoms
    switch (char.id) {
      case 'musashi':
        scale = 2.5;
        yOffset = 20; // Adjust Musashi up
        break;
      case 'kaze':
        scale = 2.0;
        yOffset = 0;
        break;
      case 'tetsuo':
        scale = 2.5;
        yOffset = 0;
        break;
    }
    
    const sprite = this.add.sprite(x, y + 40 - yOffset, char.spriteKey);
    sprite.setScale(scale);
    const animKey = `${char.spriteKey}_anim`;
    if (this.anims.exists(animKey)) {
      sprite.play(animKey);
    }
    this.characterSprites.set(isPlayer1 ? 'p1' : 'p2', sprite);

    // Character name below sprite
    const nameText = this.add.text(x, y + 110, char.name, {
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setName(isPlayer1 ? 'p1CharName' : 'p2CharName');

    // Left arrow
    this.add.text(x - 80, y + 50, '◀', {
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerover', function(this: Phaser.GameObjects.Text) { this.setColor('#ffff00'); })
      .on('pointerout', function(this: Phaser.GameObjects.Text) { this.setColor('#ffffff'); })
      .on('pointerdown', () => this.changeCharacter(isPlayer1, -1));

    // Right arrow
    this.add.text(x + 80, y + 50, '▶', {
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerover', function(this: Phaser.GameObjects.Text) { this.setColor('#ffff00'); })
      .on('pointerout', function(this: Phaser.GameObjects.Text) { this.setColor('#ffffff'); })
      .on('pointerdown', () => this.changeCharacter(isPlayer1, 1));
  }

  private changeCharacter(isPlayer1: boolean, delta: number) {
    if (isPlayer1) {
      this.selectedPlayer1CharIndex = (this.selectedPlayer1CharIndex + delta + this.characters.length) % this.characters.length;
      const char = this.characters[this.selectedPlayer1CharIndex];
      const nameText = this.children.getByName('p1CharName') as Phaser.GameObjects.Text;
      nameText.setText(char.name);
      
      // Update sprite
      const sprite = this.characterSprites.get('p1');
      if (sprite) {
        sprite.setTexture(char.spriteKey);
        const animKey = `${char.spriteKey}_anim`;
        if (this.anims.exists(animKey)) {
          sprite.play(animKey);
        }
        let scale = 1;
        let yOffset = 0;
        switch (char.id) {
          case 'musashi':
            scale = 2.5;
            yOffset = 20;
            break;
          case 'kaze':
            scale = 2.0;
            yOffset = 0;
            break;
          case 'tetsuo':
            scale = 2.5;
            yOffset = 0;
            break;
        }
        sprite.setScale(scale);
        sprite.y = 120 + 40 - yOffset; // Recalculate Y position
      }
    } else {
      this.selectedPlayer2CharIndex = (this.selectedPlayer2CharIndex + delta + this.characters.length) % this.characters.length;
      const char = this.characters[this.selectedPlayer2CharIndex];
      const nameText = this.children.getByName('p2CharName') as Phaser.GameObjects.Text;
      nameText.setText(char.name);
      
      // Update sprite
      const sprite = this.characterSprites.get('p2');
      if (sprite) {
        sprite.setTexture(char.spriteKey);
        const animKey = `${char.spriteKey}_anim`;
        if (this.anims.exists(animKey)) {
          sprite.play(animKey);
        }
        let scale = 1;
        let yOffset = 0;
        switch (char.id) {
          case 'musashi':
            scale = 2.5;
            yOffset = 20;
            break;
          case 'kaze':
            scale = 2.0;
            yOffset = 0;
            break;
          case 'tetsuo':
            scale = 2.5;
            yOffset = 0;
            break;
        }
        sprite.setScale(scale);
        sprite.y = 120 + 40 - yOffset; // Recalculate Y position
      }
    }
  }

  private createBotSelector(x: number, y: number) {
    const bot = this.bots[this.selectedBotIndex];

    // Bot display box (smaller, no border)
    const box = this.add.rectangle(x, y + 40, 250, 80, 0x1a1a1a);
    box.setName('botBox');

    // Bot name
    const nameText = this.add.text(x, y + 15, bot.name, {
      fontSize: '14px',
      color: `#${bot.color.toString(16).padStart(6, '0')}`,
      fontStyle: 'bold'
    }).setOrigin(0.5).setName('botName');

    // Bot description (truncated - first 2 lines only)
    const lines = bot.description.split('\n');
    const truncatedDescription = lines.slice(0, 2).join('\n');
    const descText = this.add.text(x, y + 40, truncatedDescription, {
      fontSize: '10px',
      color: '#cccccc',
      align: 'center',
      wordWrap: { width: 230 }
    }).setOrigin(0.5).setName('botDesc');

    // Left arrow
    this.add.text(x - 135, y + 40, '◀', {
      fontSize: '20px',
      color: '#ffffff'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerover', function(this: Phaser.GameObjects.Text) { this.setColor('#ffff00'); })
      .on('pointerout', function(this: Phaser.GameObjects.Text) { this.setColor('#ffffff'); })
      .on('pointerdown', () => this.changeBot(-1));

    // Right arrow
    this.add.text(x + 135, y + 40, '▶', {
      fontSize: '20px',
      color: '#ffffff'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerover', function(this: Phaser.GameObjects.Text) { this.setColor('#ffff00'); })
      .on('pointerout', function(this: Phaser.GameObjects.Text) { this.setColor('#ffffff'); })
      .on('pointerdown', () => this.changeBot(1));
  }

  private changeBot(delta: number) {
    this.selectedBotIndex = (this.selectedBotIndex + delta + this.bots.length) % this.bots.length;
    const bot = this.bots[this.selectedBotIndex];
    
    // Update name
    const nameText = this.children.getByName('botName') as Phaser.GameObjects.Text;
    nameText.setText(bot.name);
    nameText.setColor(`#${bot.color.toString(16).padStart(6, '0')}`);
    
    // Update description
    const lines = bot.description.split('\n');
    const truncatedDescription = lines.slice(0, 2).join('\n');
    const descText = this.children.getByName('botDesc') as Phaser.GameObjects.Text;
    descText.setText(truncatedDescription);
  }

  private createDifficultySlider(width: number, height: number) {
    const sliderY = 450;
    const sliderWidth = 350;
    const sliderX = width / 2;

    // Label
    this.add.text(sliderX, sliderY - 30, `Difficulty: ${this.selectedDifficulty}`, {
      fontSize: `${height * 0.028}px`,
      color: '#fff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setName('difficultyLabel');

    // Slider track
    const track = this.add.rectangle(sliderX, sliderY, sliderWidth, 6, 0x444444).setOrigin(0.5);

    // Slider notches (1-10)
    for (let i = 1; i <= 10; i++) {
      const notchX = sliderX - sliderWidth / 2 + (i - 0.5) * (sliderWidth / 10);
      this.add.rectangle(notchX, sliderY, 2, 12, 0x666666).setOrigin(0.5);
      
      // Number labels
      this.add.text(notchX, sliderY + 15, i.toString(), {
        fontSize: `${height * 0.016}px`,
        color: '#888'
      }).setOrigin(0.5);
    }

    // Slider handle
    const handleX = sliderX - sliderWidth / 2 + (this.selectedDifficulty - 0.5) * (sliderWidth / 10);
    const handle = this.add.circle(handleX, sliderY, 10, 0xffffff)
      .setInteractive({ useHandCursor: true, draggable: true })
      .setName('difficultyHandle');

    // Drag handling
    this.input.on('drag', (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject, dragX: number) => {
      if (gameObject === handle) {
        // Constrain to track
        const minX = sliderX - sliderWidth / 2;
        const maxX = sliderX + sliderWidth / 2;
        const constrainedX = Phaser.Math.Clamp(dragX, minX, maxX);
        
        // Snap to notches
        const relativeX = constrainedX - minX;
        const difficulty = Math.round((relativeX / sliderWidth) * 10);
        const snappedDifficulty = Phaser.Math.Clamp(difficulty, 1, 10);
        
        if (snappedDifficulty !== this.selectedDifficulty) {
          this.selectedDifficulty = snappedDifficulty;
          const snappedX = sliderX - sliderWidth / 2 + (this.selectedDifficulty - 0.5) * (sliderWidth / 10);
          handle.setX(snappedX);
          
          // Update label
          const label = this.children.getByName('difficultyLabel') as Phaser.GameObjects.Text;
          label.setText(`Difficulty: ${this.selectedDifficulty}`);
        }
      }
    });
  }

  private createActionButtons(width: number, height: number) {
    const buttonY = 530;

    // Start button
    const startButton = this.add.text(width / 2 - 120, buttonY, 'Start Match', {
      fontSize: `${height * 0.035}px`,
      color: '#000',
      padding: { x: 30, y: 15 },
      backgroundColor: '#ffffff'
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
    .on('pointerover', () => startButton.setStyle({ backgroundColor: '#dddddd' }))
    .on('pointerout', () => startButton.setStyle({ backgroundColor: '#ffffff' }))
    .on('pointerdown', () => this.startMatch());

    // Back button
    const backButton = this.add.text(width / 2 + 120, buttonY, 'Back', {
      fontSize: `${height * 0.035}px`,
      color: '#000',
      padding: { x: 30, y: 15 },
      backgroundColor: '#ffffff'
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
    .on('pointerover', () => backButton.setStyle({ backgroundColor: '#dddddd' }))
    .on('pointerout', () => backButton.setStyle({ backgroundColor: '#ffffff' }))
    .on('pointerdown', () => this.goBack());
  }

  private startMatch() {
    const selectedBot = this.bots[this.selectedBotIndex];
    const player1Char = this.characters[this.selectedPlayer1CharIndex];
    const player2Char = this.characters[this.selectedPlayer2CharIndex];
    
    // Store selection in registry for the game scene to use
    this.registry.set('exhibitionMode', true);
    this.registry.set('botType', selectedBot.type);
    this.registry.set('botDifficulty', this.selectedDifficulty);
    this.registry.set('player1Character', player1Char.id);
    this.registry.set('player2Character', player2Char.id);
    
    // Start the game scene with exhibition mode
    this.scene.start('PhaserGameScene');
  }

  private goBack() {
    this.scene.start('MenuScene');
  }

  shutdown() {
    // Clean up keyboard event listeners when scene is stopped
    this.input.keyboard?.off('keydown-LEFT');
    this.input.keyboard?.off('keydown-RIGHT');
    this.input.keyboard?.off('keydown-PLUS');
    this.input.keyboard?.off('keydown-MINUS');
    this.input.keyboard?.off('keydown-UP');
    this.input.keyboard?.off('keydown-DOWN');
    this.input.keyboard?.off('keydown-ENTER');
    this.input.keyboard?.off('keydown-ESC');
  }

  private setupKeyboardControls() {
    // Left/Right arrow keys to change bot
    this.input.keyboard?.on('keydown-LEFT', () => {
      this.changeBot(-1);
    });

    this.input.keyboard?.on('keydown-RIGHT', () => {
      this.changeBot(1);
    });

    // Plus/Minus or Up/Down to adjust difficulty
    this.input.keyboard?.on('keydown-PLUS', () => {
      this.changeDifficulty(1);
    });

    this.input.keyboard?.on('keydown-MINUS', () => {
      this.changeDifficulty(-1);
    });

    this.input.keyboard?.on('keydown-UP', () => {
      this.changeDifficulty(1);
    });

    this.input.keyboard?.on('keydown-DOWN', () => {
      this.changeDifficulty(-1);
    });

    // Enter to start match
    this.input.keyboard?.on('keydown-ENTER', () => {
      this.startMatch();
    });

    // Escape to go back
    this.input.keyboard?.on('keydown-ESC', () => {
      this.goBack();
    });
  }

  private changeDifficulty(delta: number) {
    const newDifficulty = Phaser.Math.Clamp(this.selectedDifficulty + delta, 1, 10);
    
    if (newDifficulty !== this.selectedDifficulty) {
      this.selectedDifficulty = newDifficulty;
      
      // Update slider handle position
      const handle = this.children.getByName('difficultyHandle') as Phaser.GameObjects.Arc;
      const width = this.sys.game.config.width as number;
      const sliderWidth = 350;
      const sliderX = width / 2;
      const handleX = sliderX - sliderWidth / 2 + (this.selectedDifficulty - 0.5) * (sliderWidth / 10);
      handle.setX(handleX);
      
      // Update label
      const label = this.children.getByName('difficultyLabel') as Phaser.GameObjects.Text;
      label.setText(`Difficulty: ${this.selectedDifficulty}`);
    }
  }
}
