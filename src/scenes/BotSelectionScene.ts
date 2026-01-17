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

export default class BotSelectionScene extends Scene {
  private selectedBotIndex: number = 0;
  private selectedDifficulty: number = 5;
  
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
    this.add.text(width / 2, 40, 'Practice Mode - Select Opponent', {
      fontSize: `${height * 0.045}px`,
      color: '#fff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Bot selection area
    this.createBotCards(width, height);

    // Difficulty slider
    this.createDifficultySlider(width, height);

    // Action buttons
    this.createActionButtons(width, height);

    // Controls hint
    this.add.text(width / 2, height - 20, 'Arrow Keys: Navigate | Enter: Start | Esc: Back | +/-: Adjust Difficulty', {
      fontSize: `${height * 0.018}px`,
      color: '#888'
    }).setOrigin(0.5);

    // Setup keyboard controls
    this.setupKeyboardControls();
  }

  private createBotCards(width: number, height: number) {
    const cardWidth = 180;
    const cardHeight = 280;
    const spacing = 20;
    const startX = (width - (cardWidth * 5 + spacing * 4)) / 2;
    const startY = 120;

    this.bots.forEach((bot, index) => {
      const x = startX + index * (cardWidth + spacing);
      const isSelected = index === this.selectedBotIndex;

      // Card background
      const card = this.add.rectangle(x, startY, cardWidth, cardHeight, bot.color, isSelected ? 1 : 0.3)
        .setOrigin(0, 0)
        .setStrokeStyle(isSelected ? 4 : 2, isSelected ? 0xffffff : 0x666666)
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
        fontSize: `${height * 0.015}px`,
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
    const sliderWidth = 500;
    const sliderX = width / 2;

    // Label
    this.add.text(sliderX, sliderY - 40, `Difficulty: ${this.selectedDifficulty}`, {
      fontSize: `${height * 0.032}px`,
      color: '#fff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setName('difficultyLabel');

    // Slider track
    const track = this.add.rectangle(sliderX, sliderY, sliderWidth, 8, 0x444444).setOrigin(0.5);

    // Slider notches (1-10)
    for (let i = 1; i <= 10; i++) {
      const notchX = sliderX - sliderWidth / 2 + (i - 0.5) * (sliderWidth / 10);
      this.add.rectangle(notchX, sliderY, 2, 16, 0x666666).setOrigin(0.5);
      
      // Number labels
      this.add.text(notchX, sliderY + 20, i.toString(), {
        fontSize: `${height * 0.018}px`,
        color: '#888'
      }).setOrigin(0.5);
    }

    // Slider handle
    const handleX = sliderX - sliderWidth / 2 + (this.selectedDifficulty - 0.5) * (sliderWidth / 10);
    const handle = this.add.circle(handleX, sliderY, 12, 0xffffff)
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
        
        child.setAlpha(isSelected ? 1 : 0.3);
        child.setStrokeStyle(isSelected ? 4 : 2, isSelected ? 0xffffff : 0x666666);
        
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
    
    // Store selection in registry for the game scene to use
    this.registry.set('exhibitionMode', true);
    this.registry.set('botType', selectedBot.type);
    this.registry.set('botDifficulty', this.selectedDifficulty);
    
    // Start the game scene with exhibition mode
    this.scene.start('GameScene');
  }

  private goBack() {
    this.scene.start('MenuScene');
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
