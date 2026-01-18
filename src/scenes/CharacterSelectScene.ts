/**
 * Character Selection Scene
 * Allows players to choose their character before starting a match
 * Supports single player and practice mode selection
 */

import { Scene } from 'phaser';

type CharacterInfo = {
  id: string;
  name: string;
  description: string;
  spriteKey: string;
  color: number;
};

export default class CharacterSelectScene extends Scene {
  private selectedCharacterIndex: number = 0;
  private characters: CharacterInfo[] = [
    {
      id: 'musashi',
      name: 'MUSASHI',
      description: 'Balanced fighter with versatile special moves\nFireball • Uppercut • Spinning Kick',
      spriteKey: 'player_idle',
      color: 0x4488ff
    },
    {
      id: 'kaze',
      name: 'KAZE',
      description: 'Fast rushdown with aggressive pressure\nDash Punch • Flash Kick • Air Dash',
      spriteKey: 'kaze_idle',
      color: 0xff8844
    },
    {
      id: 'tetsuo',
      name: 'TETSUO',
      description: 'Powerful grappler with high damage\nCommand Grab • Armored Rush • Ground Pound',
      spriteKey: 'tetsuo_idle',
      color: 0x44ff88
    }
  ];
  
  private titleText!: Phaser.GameObjects.Text;
  private characterName!: Phaser.GameObjects.Text;
  private characterSprite!: Phaser.GameObjects.Sprite;
  private descriptionText!: Phaser.GameObjects.Text;
  private startButton!: Phaser.GameObjects.Container;
  private backButton!: Phaser.GameObjects.Container;
  private leftArrow!: Phaser.GameObjects.Text;
  private rightArrow!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'CharacterSelectScene' });
  }

  preload(): void {
    // Load sprite sheets for all characters
    // Musashi (player sprites)
    this.load.spritesheet('player_idle', 'assets/player/IDLE.png', { frameWidth: 96, frameHeight: 96 });
    
    // Kaze sprites (8 frames in 1024x64 image)
    this.load.spritesheet('kaze_idle', 'assets/enemy2/IDLE.png', { frameWidth: 128, frameHeight: 64 });
    
    // Tetsuo sprites
    this.load.spritesheet('tetsuo_idle', 'assets/enemy4/IDLE.png', { frameWidth: 96, frameHeight: 96 });
  }

  create(): void {
    const centerX = 500;
    const centerY = 300;
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
        frameRate: 6,
        repeat: -1
      });
    }

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
    this.characterSprite = this.add.sprite(centerX, 200, this.characters[0].spriteKey);
    this.characterSprite.setScale(3);
    this.characterSprite.play(`${this.characters[0].id === 'musashi' ? 'player' : this.characters[0].id}_idle_anim`);

    // Left arrow
    this.leftArrow = this.add.text(centerX - 150, 200, '◀', {
      fontSize: `${height * 0.08}px`,
      color: '#ffffff'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerover', () => this.leftArrow.setColor('#ffff00'))
      .on('pointerout', () => this.leftArrow.setColor('#ffffff'))
      .on('pointerdown', () => this.changeCharacter(-1));

    // Right arrow
    this.rightArrow = this.add.text(centerX + 150, 200, '▶', {
      fontSize: `${height * 0.08}px`,
      color: '#ffffff'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerover', () => this.rightArrow.setColor('#ffff00'))
      .on('pointerout', () => this.rightArrow.setColor('#ffffff'))
      .on('pointerdown', () => this.changeCharacter(1));

    // Character name
    this.characterName = this.add.text(centerX, 340, this.characters[0].name, {
      fontSize: `${height * 0.05}px`,
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    });
    this.characterName.setOrigin(0.5);

    // Character stats/info
    this.descriptionText = this.add.text(centerX, 400, this.characters[0].description, {
      fontSize: `${height * 0.022}px`,
      color: '#aaaaaa',
      align: 'center',
    });
    this.descriptionText.setOrigin(0.5);

    // Start button
    this.createButton(centerX + 120, 530, 'START', () => this.startMatch());
    
    // Back button
    this.createButton(centerX - 120, 530, 'BACK', () => this.goBack());

    // Keyboard shortcuts
    this.input.keyboard!.on('keydown-LEFT', () => this.changeCharacter(-1));
    this.input.keyboard!.on('keydown-RIGHT', () => this.changeCharacter(1));
    this.input.keyboard!.on('keydown-ENTER', () => this.startMatch());
    this.input.keyboard!.on('keydown-ESC', () => this.goBack());
  }

  private changeCharacter(delta: number): void {
    this.selectedCharacterIndex = (this.selectedCharacterIndex + delta + this.characters.length) % this.characters.length;
    const selectedChar = this.characters[this.selectedCharacterIndex];
    
    // Update sprite
    const spritePrefix = selectedChar.id === 'musashi' ? 'player' : selectedChar.id;
    this.characterSprite.setTexture(selectedChar.spriteKey);
    this.characterSprite.play(`${spritePrefix}_idle_anim`);
    
    // Update name and description
    this.characterName.setText(selectedChar.name);
    this.descriptionText.setText(selectedChar.description);
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
    const selectedChar = this.characters[this.selectedCharacterIndex];
    
    // Randomly select opponent character
    const randomOpponentIndex = Phaser.Math.Between(0, this.characters.length - 1);
    const opponentChar = this.characters[randomOpponentIndex];
    
    // Store selected character in registry
    this.registry.set('player1Character', selectedChar.id);
    this.registry.set('player2Character', opponentChar.id);

    // Start the game
    this.scene.start('PhaserGameScene');
  }

  private goBack(): void {
    this.scene.start('MenuScene');
  }

  shutdown() {
    // Clean up keyboard event listeners when scene is stopped
    this.input.keyboard?.off('keydown-LEFT');
    this.input.keyboard?.off('keydown-RIGHT');
    this.input.keyboard?.off('keydown-ENTER');
    this.input.keyboard?.off('keydown-ESC');
  }
}
