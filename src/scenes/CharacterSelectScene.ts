/**
 * Character Selection Scene
 * Allows players to choose their character before starting a match
 */

import { Scene } from 'phaser';

export default class CharacterSelectScene extends Scene {
  private selectedCharacter: string = 'musashi';
  private titleText!: Phaser.GameObjects.Text;
  private characterName!: Phaser.GameObjects.Text;
  private characterSprite!: Phaser.GameObjects.Sprite;
  private startButton!: Phaser.GameObjects.Container;
  private backButton!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'CharacterSelectScene' });
  }

  create(): void {
    const centerX = 500;
    const centerY = 300;
    const height = this.sys.game.config.height as number;

    // Background
    this.add.rectangle(0, 0, 1000, 600, 0x1a1a2e).setOrigin(0);

    // Title
    this.titleText = this.add.text(centerX, 50, 'SELECT YOUR FIGHTER', {
      fontSize: `${height * 0.06}px`,
      fontStyle: 'bold',
      color: '#00ff00',
      stroke: '#000000',
      strokeThickness: 4,
    });
    this.titleText.setOrigin(0.5);

    // Character sprite (animated idle)
    this.characterSprite = this.add.sprite(centerX, 180, 'dude-idle');
    this.characterSprite.setScale(4);
    this.characterSprite.play('idle');

    // Character name
    this.characterName = this.add.text(centerX, 320, 'MUSASHI', {
      fontSize: `${height * 0.045}px`,
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    });
    this.characterName.setOrigin(0.5);

    // Character stats/info
    const statsText = this.add.text(centerX, 370, 
      'Balanced fighter with versatile special moves\nFireball • Uppercut • Counter', {
      fontSize: `${height * 0.022}px`,
      color: '#aaaaaa',
      align: 'center',
    });
    statsText.setOrigin(0.5);

    // Instructions
    const instructionText = this.add.text(centerX, 430, 
      'Press ENTER to start or ESC to go back', {
      fontSize: `${height * 0.018}px`,
      color: '#888888',
    });
    instructionText.setOrigin(0.5);

    // Character selection (currently only Musashi available)
    const availableText = this.add.text(centerX, 480, 
      'More characters coming soon!', {
      fontSize: `${height * 0.018}px`,
      color: '#666666',
      fontStyle: 'italic',
    });
    availableText.setOrigin(0.5);

    // Start button
    this.createButton(centerX + 120, 530, 'START', () => this.startMatch());
    
    // Back button
    this.createButton(centerX - 120, 530, 'BACK', () => this.goBack());

    // Keyboard shortcuts
    this.input.keyboard!.on('keydown-ENTER', () => this.startMatch());
    this.input.keyboard!.on('keydown-ESC', () => this.goBack());
  }

  private createButton(x: number, y: number, text: string, onClick: () => void): void {
    const bg = this.add.rectangle(0, 0, 180, 50, 0x00aa00);
    bg.setInteractive({ useHandCursor: true });
    bg.setStrokeStyle(2, 0x00ff00);

    const height = this.sys.game.config.height as number;
    const label = this.add.text(0, 0, text, {
      fontSize: `${height * 0.027}px`,
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

  private startMatch(): void {
    // Store selected character in registry
    this.registry.set('player1Character', this.selectedCharacter);
    this.registry.set('player2Character', this.selectedCharacter); // Both use same for now

    // Start the game
    this.scene.start('PhaserGameScene');
  }

  private goBack(): void {
    this.scene.start('MainMenuScene');
  }
}
