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
  private selectedBotIndex: number = 0;
  private selectedDifficulty: number = 5;
  private selectedPlayer1CharIndex: number = 0;
  private selectedPlayer2CharIndex: number = 0;
  
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

  create() {
    const width = this.sys.game.config.width as number;
    const height = this.sys.game.config.height as number;

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

    // Bot selection area
    this.createBotCards(width, height);

    // Difficulty slider
    this.createDifficultySlider(width, height);

    // Action buttons
    this.createActionButtons(width, height);

    // Setup keyboard controls
    this.setupKeyboardControls();
  }

  private createCharacterSelection(width: number, height: number) {
    // Section title
    this.add.text(width / 2, 60, 'Select Characters', {
      fontSize: `${height * 0.028}px`,
      color: '#aaaaaa'
    }).setOrigin(0.5);

    // Player 1 selection (left side)
    this.createCharacterSelector(width / 2 - 200, 100, 'Player 1', true);
    
    // Player 2 selection (right side)
    this.createCharacterSelector(width / 2 + 200, 100, 'Opponent', false);
    
    // VS text in middle
    this.add.text(width / 2, 120, 'VS', {
      fontSize: '32px',
      color: '#ffff00',
      fontStyle: 'bold'
    }).setOrigin(0.5);
  }

  private createCharacterSelector(x: number, y: number, label: string, isPlayer1: boolean) {
    const height = this.sys.game.config.height as number;
    const charIndex = isPlayer1 ? this.selectedPlayer1CharIndex : this.selectedPlayer2CharIndex;
    const char = this.characters[charIndex];

    // Label
    this.add.text(x, y, label, {
      fontSize: `${height * 0.022}px`,
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Character name with color
    const nameText = this.add.text(x, y + 25, char.name, {
      fontSize: `${height * 0.025}px`,
      color: `#${char.color.toString(16).padStart(6, '0')}`
    }).setOrigin(0.5).setName(isPlayer1 ? 'p1CharName' : 'p2CharName');

    // Left arrow
    this.add.text(x - 60, y + 25, '◀', {
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerover', function(this: Phaser.GameObjects.Text) { this.setColor('#ffff00'); })
      .on('pointerout', function(this: Phaser.GameObjects.Text) { this.setColor('#ffffff'); })
      .on('pointerdown', () => this.changeCharacter(isPlayer1, -1));

    // Right arrow
    this.add.text(x + 60, y + 25, '▶', {
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
      nameText.setColor(`#${char.color.toString(16).padStart(6, '0')}`);
    } else {
      this.selectedPlayer2CharIndex = (this.selectedPlayer2CharIndex + delta + this.characters.length) % this.characters.length;
      const char = this.characters[this.selectedPlayer2CharIndex];
      const nameText = this.children.getByName('p2CharName') as Phaser.GameObjects.Text;
      nameText.setText(char.name);
      nameText.setColor(`#${char.color.toString(16).padStart(6, '0')}`);
    }
  }

  private createBotCards(width: number, height: number) {
    // Section title
    this.add.text(width / 2, 165, 'Select Opponent AI', {
      fontSize: `${height * 0.028}px`,
      color: '#aaaaaa'
    }).setOrigin(0.5);

    const cardWidth = 180;
    const cardHeight = 240;
    const spacing = 20;
    const startX = (width - (cardWidth * 5 + spacing * 4)) / 2;
    const startY = 200;

    this.bots.forEach((bot, index) => {
      const x = startX + index * (cardWidth + spacing);
      const isSelected = index === this.selectedBotIndex;

      // Card background
      const card = this.add.rectangle(x, startY, cardWidth, cardHeight, 0x000000)
        .setOrigin(0, 0)
        .setStrokeStyle(isSelected ? 4 : 2, 0xffffff)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.selectBot(index));

      // Bot name
      this.add.text(x + cardWidth / 2, startY + 20, bot.name, {
        fontSize: `${height * 0.025}px`,
        color: '#fff',
        fontStyle: 'bold',
        wordWrap: { width: cardWidth - 20 }
      }).setOrigin(0.5, 0);

      // Style
      this.add.text(x + cardWidth / 2, startY + 50, bot.style, {
        fontSize: `${height * 0.017}px`,
        color: '#ddd',
        wordWrap: { width: cardWidth - 20 },
        align: 'center'
      }).setOrigin(0.5, 0);

      // Description
      this.add.text(x + 10, startY + 80, bot.description, {
        fontSize: `${height * 0.020}px`,
        color: '#ccc',
        wordWrap: { width: cardWidth - 20 }
      }).setOrigin(0, 0);

      // Stats
      const statsY = startY + 180;
      this.add.text(x + 10, statsY, `Block: ${bot.blockRate}`, {
        fontSize: `${height * 0.015}px`,
        color: '#aaa'
      }).setOrigin(0, 0);

      this.add.text(x + 10, statsY + 20, `Anti-Air: ${bot.antiAir}`, {
        fontSize: `${height * 0.015}px`,
        color: '#aaa'
      }).setOrigin(0, 0);

      this.add.text(x + 10, statsY + 40, `Difficulty: ${bot.difficultyRange}`, {
        fontSize: `${height * 0.015}px`,
        color: '#aaa'
      }).setOrigin(0, 0);

      // Store card reference for updates
      card.setData('index', index);
      card.setData('bot', bot);
    });
  }

  private createDifficultySlider(width: number, height: number) {
    const sliderY = 480;
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
    const buttonY = 570;

    // Start button
    const startButton = this.add.text(width / 2 - 120, buttonY, 'Start Match', {
      fontSize: `${height * 0.035}px`,
      color: '#fff',
      padding: { x: 30, y: 15 },
      backgroundColor: '#4CAF50'
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
    .on('pointerover', () => startButton.setStyle({ backgroundColor: '#66BB6A' }))
    .on('pointerout', () => startButton.setStyle({ backgroundColor: '#4CAF50' }))
    .on('pointerdown', () => this.startMatch());

    // Back button
    const backButton = this.add.text(width / 2 + 120, buttonY, 'Back', {
      fontSize: `${height * 0.035}px`,
      color: '#fff',
      padding: { x: 30, y: 15 },
      backgroundColor: '#666'
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
    .on('pointerover', () => backButton.setStyle({ backgroundColor: '#888' }))
    .on('pointerout', () => backButton.setStyle({ backgroundColor: '#666' }))
    .on('pointerdown', () => this.goBack());
  }

  private selectBot(index: number) {
    if (this.selectedBotIndex === index) return;

    this.selectedBotIndex = index;

    // Update card highlights with animation
    this.children.getAll().forEach((child) => {
      if (child instanceof Phaser.GameObjects.Rectangle && child.getData('index') !== undefined) {
        const cardIndex = child.getData('index');
        const bot = child.getData('bot');
        const isSelected = cardIndex === index;
        
        // Stop any existing tweens on this card
        this.tweens.killTweensOf(child);
        
        child.setAlpha(isSelected ? 1 : 0.6);
        child.setStrokeStyle(isSelected ? 4 : 2, 0xffffff);
        
        // Add pulse animation to selected card
        if (isSelected) {
          this.tweens.add({
            targets: child,
            scaleX: 1.05,
            scaleY: 1.05,
            duration: 200,
            yoyo: true,
            ease: 'Sine.easeInOut'
          });
        } else {
          child.setScale(1);
        }
      }
    });
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
      const newIndex = (this.selectedBotIndex - 1 + this.bots.length) % this.bots.length;
      this.selectBot(newIndex);
    });

    this.input.keyboard?.on('keydown-RIGHT', () => {
      const newIndex = (this.selectedBotIndex + 1) % this.bots.length;
      this.selectBot(newIndex);
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
      const sliderWidth = 500;
      const sliderX = width / 2;
      const handleX = sliderX - sliderWidth / 2 + (this.selectedDifficulty - 0.5) * (sliderWidth / 10);
      handle.setX(handleX);
      
      // Update label
      const label = this.children.getByName('difficultyLabel') as Phaser.GameObjects.Text;
      label.setText(`Difficulty: ${this.selectedDifficulty}`);
    }
  }
}
