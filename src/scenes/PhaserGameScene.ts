/**
 * Phaser Game Scene with Core Engine Integration
 * 
 * This scene is a thin wrapper around the core engine.
 * It captures input, calls tick(), and renders the result.
 */

import { Scene } from 'phaser';
import { GameState, CharacterDefinition, InputFrame, FighterState } from '../core/interfaces/types';
import { createInitialState, tick, startNextRound } from '../core/Game';
import { MUSASHI } from '../core/data/musashi';
import { FighterSprite } from '../phaser/FighterSprite';
import { InputHandler } from '../phaser/InputHandler';
import { AudioManager } from '../phaser/AudioManager';
import { TouchControlsOverlay } from '../phaser/ui/TouchControlsOverlay';
import { ProceduralAudio } from '../utils/ProceduralAudio';
import { generateObservation } from '../core/ai/Observation';
import { RandomBot } from '../core/ai/RandomBot';
import { PersonalityBot } from '../core/ai/PersonalityBot';
import { NeuralBot } from '../core/ai/NeuralBot';
import { ScriptedBot } from '../core/ai/ScriptedBot';
import { NeuralPolicy } from '../core/ai/NeuralPolicy';
import { BotRuntime, BotAction } from '../ml/inference/BotRuntime.browser';
import { DifficultyLevel } from '../ml/inference/DifficultyConfig';
import { FightingStyle } from '../ml/inference/StyleConfig';
import { actionToInputFrame, AIAction } from '../core/ai/ActionSpace';
import * as tf from '@tensorflow/tfjs';
import { getInputNotation, getDisplayNotation } from '../utils/InputNotation';
import { OnlineManager, OnlineMatchConfig } from '../network/OnlineManager';
import { NetworkClient } from '../network/NetworkClient';

export default class PhaserGameScene extends Scene {
  // Core game state (source of truth)
  private gameState!: GameState;
  private characterDefs!: Map<string, CharacterDefinition>;

  // Phaser rendering
  private fighterSprites!: Map<string, FighterSprite>;
  private projectileSprites!: Map<string, Phaser.GameObjects.Rectangle>;
  private debugGraphics!: Phaser.GameObjects.Graphics;
  private debugMode: boolean = false;
  
  // Visual effects
  private hitSparks!: Phaser.GameObjects.Particles.ParticleEmitter[];
  private lastHitFrames!: Map<string, number>; // Track last hit frame per fighter
  private lastMoveFrames!: Map<string, { move: string | null; frame: number }>; // Track move changes
  private hitFreezeFrames: number = 0; // Frames remaining in hit freeze

  // Input
  private inputHandler!: InputHandler;
  private touchControls?: TouchControlsOverlay;
  private inputDebugText?: Phaser.GameObjects.Text;
  private debugKey!: Phaser.Input.Keyboard.Key;
  private botSwitchKey!: Phaser.Input.Keyboard.Key;
  private trainingModeKey!: Phaser.Input.Keyboard.Key;
  private resetPositionKey!: Phaser.Input.Keyboard.Key;
  private resetHealthKey!: Phaser.Input.Keyboard.Key;
  private infiniteMeterKey!: Phaser.Input.Keyboard.Key;
  private difficultyUpKey!: Phaser.Input.Keyboard.Key;
  private difficultyDownKey!: Phaser.Input.Keyboard.Key;
  private styleKey!: Phaser.Input.Keyboard.Key;

  // AI
  private aiBot!: RandomBot | PersonalityBot | NeuralBot | ScriptedBot;
  private botType: 'random' | 'personality' | 'defensive' | 'scripted' | 'neural' | 'ml' = 'personality';
  private neuralPolicy!: NeuralPolicy;
  private mlBot?: BotRuntime;
  private currentDifficulty: DifficultyLevel = 5;
  private currentStyle: FightingStyle = 'rushdown';
  private mlBotAction?: BotAction;
  
  // Audio
  private audioManager!: AudioManager;

  // UI Text
  private roundText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private fpsText!: Phaser.GameObjects.Text;
  private botTypeText!: Phaser.GameObjects.Text;
  private difficultyText!: Phaser.GameObjects.Text;
  private styleText!: Phaser.GameObjects.Text;
  private comboTexts!: Map<string, Phaser.GameObjects.Text>;
  private meterGraphics!: Map<string, Phaser.GameObjects.Graphics>;
  private inputDisplayTexts!: Map<string, Phaser.GameObjects.Text>;
  private inputHistories!: Map<string, InputFrame[]>; // Track input history for notation
  
  // Match end UI
  private matchEndContainer!: Phaser.GameObjects.Container | null;
  private tieOverlay!: Phaser.GameObjects.Text | null;
  private winOverlay!: Phaser.GameObjects.Text | null;
  private roundEndTimer!: Phaser.Time.TimerEvent | null;
  
  // Round start cinematics
  private roundAnnouncement!: Phaser.GameObjects.Text | null;
  private fightAnnouncement!: Phaser.GameObjects.Text | null;

  // Online multiplayer
  private onlineManager?: OnlineManager;
  private isOnlineMatch: boolean = false;
  private onlineInitialized: boolean = false;
  private opponentInfoText?: Phaser.GameObjects.Text;
  private pingText?: Phaser.GameObjects.Text;
  private waitingForInputsText?: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'PhaserGameScene' });
  }

  preload(): void {
    // Load player sprite sheets (96x96 frames)
    this.load.spritesheet('player_idle', 'assets/player/IDLE.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('player_walk', 'assets/player/WALK.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('player_run', 'assets/player/RUN.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('player_jump', 'assets/player/JUMP.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('player_jump_fall', 'assets/player/JUMP-FALL.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('player_attack1', 'assets/player/ATTACK1.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('player_attack2', 'assets/player/ATTACK 2.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('player_attack3', 'assets/player/ATTACK 3.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('player_special', 'assets/player/SPECIAL ATTACK.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('player_defend', 'assets/player/DEFEND.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('player_hurt', 'assets/player/HURT.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('player_death', 'assets/player/DEATH.png', { frameWidth: 96, frameHeight: 96 });
    
    // Load enemy sprite sheets (64x64 frames)
    this.load.spritesheet('enemy_idle', 'assets/enemy/IDLE.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('enemy_run', 'assets/enemy/RUN.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('enemy_jump', 'assets/enemy/JUMP.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('enemy_attack1', 'assets/enemy/ATTACK1.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('enemy_attack2', 'assets/enemy/ATTACK2.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('enemy_attack3', 'assets/enemy/ATTACK3.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('enemy_dash', 'assets/enemy/DASH ATTACK.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('enemy_defence', 'assets/enemy/DEFENCE.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('enemy_hurt', 'assets/enemy/HURT.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('enemy_death', 'assets/enemy/DEATH.png', { frameWidth: 64, frameHeight: 64 });
  }

  create(): void {
    // Check if this is an online match
    const onlineMatchData = this.registry.get('onlineMatch');
    if (onlineMatchData) {
      this.isOnlineMatch = true;
      this.setupOnlineMatch(onlineMatchData);
    }

    // Create sprite animations
    this.createAnimations();

    // Initialize character definitions
    this.characterDefs = new Map([['musashi', MUSASHI]]);

    // Initialize core game state
    const config = {
      entities: [
        {
          characterId: 'musashi',
          id: 'player1',
          teamId: 0,
          startPosition: { x: 300, y: 500 },
        },
        {
          characterId: 'musashi',
          id: 'player2',
          teamId: 1,
          startPosition: { x: 700, y: 500 },
        },
      ],
      arena: {
        width: 1000,
        height: 600,
        groundLevel: 500,
        leftBound: 100,
        rightBound: 900,
      },
      roundsToWin: 2,
      roundTimeSeconds: 60,
    };

    this.gameState = createInitialState(config);
    
    // For online matches, set initial frame to the frame delay
    // This ensures delayed frame lookups work from the start
    if (this.isOnlineMatch && this.onlineManager) {
      const initialFrame = this.onlineManager.getFrameDelay();
      this.gameState.frame = initialFrame;
      console.log(`[PhaserGameScene] Starting online match at frame ${initialFrame}`);
      this.onlineInitialized = true; // Mark as ready to send inputs
    }

    // Create background
    this.add.rectangle(500, 300, 1000, 600, 0x222233);

    // Draw ground line
    const groundLine = this.add.graphics();
    groundLine.lineStyle(2, 0x666666);
    groundLine.lineBetween(
      config.arena.leftBound,
      config.arena.groundLevel,
      config.arena.rightBound,
      config.arena.groundLevel
    );

    // Draw arena bounds
    const boundsGraphics = this.add.graphics();
    boundsGraphics.lineStyle(2, 0x444444);
    boundsGraphics.strokeRect(
      config.arena.leftBound,
      0,
      config.arena.rightBound - config.arena.leftBound,
      config.arena.height
    );

    // Create fighter sprites
    this.fighterSprites = new Map();
    console.log('[PhaserGameScene] Creating initial fighter sprites...');
    for (const fighter of this.gameState.entities) {
      const sprite = new FighterSprite(this, fighter);
      this.fighterSprites.set(fighter.id, sprite);
      console.log(`[PhaserGameScene] Created sprite for ${fighter.id}`);
    }
    console.log(`[PhaserGameScene] Total sprites in map: ${this.fighterSprites.size}`);

    // Create projectile sprites map
    this.projectileSprites = new Map();

    // Create combo texts and meter graphics for each fighter
    this.comboTexts = new Map();
    this.meterGraphics = new Map();
    for (const fighter of this.gameState.entities) {
      const comboText = this.add.text(0, 0, '', {
        fontSize: '32px',
        color: '#ffff00',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      });
      comboText.setOrigin(0.5, 0.5);
      comboText.setDepth(50);
      this.comboTexts.set(fighter.id, comboText);

      const meterGraphics = this.add.graphics();
      meterGraphics.setDepth(40);
      this.meterGraphics.set(fighter.id, meterGraphics);
    }

    // Create debug graphics
    this.debugGraphics = this.add.graphics();
    this.debugGraphics.setDepth(100);

    // Initialize visual effects
    this.hitSparks = [];
    this.lastHitFrames = new Map();
    this.lastMoveFrames = new Map();
    this.gameState.entities.forEach(f => {
      this.lastHitFrames.set(f.id, f.lastHitByFrame);
      this.lastMoveFrames.set(f.id, { move: f.currentMove, frame: f.moveFrame });
    });
    
    // Create particle emitters for hit effects
    this.createHitParticles();
    
    // Initialize audio system
    ProceduralAudio.generateAllSounds(this);
    this.audioManager = new AudioManager(this);

    // Initialize input
    this.inputHandler = new InputHandler(this);
    
    // Add touch controls for mobile devices
    const isMobile = this.isMobileDevice();
    
    if (isMobile) {
      this.touchControls = new TouchControlsOverlay(this);
      this.add.existing(this.touchControls);
      this.touchControls.setDepth(1000);
      this.touchControls.setScrollFactor(0);
      
      // Add input debug display for mobile (can be disabled later)
      const inputDebugText = this.add.text(10, 80, '', {
        fontSize: '14px',
        color: '#00ff00',
        backgroundColor: '#000000aa',
        padding: { x: 5, y: 5 }
      });
      inputDebugText.setDepth(1001);
      inputDebugText.setScrollFactor(0);
      this.inputDebugText = inputDebugText;
    }
    
    this.debugKey = this.input.keyboard!.addKey('F1');
    this.botSwitchKey = this.input.keyboard!.addKey('F2');
    this.trainingModeKey = this.input.keyboard!.addKey('F3');
    this.resetPositionKey = this.input.keyboard!.addKey('F4');
    this.resetHealthKey = this.input.keyboard!.addKey('F6');
    this.infiniteMeterKey = this.input.keyboard!.addKey('F5');

    // Initialize AI bots (skip for online matches)
    if (!this.isOnlineMatch) {
      this.aiBot = new PersonalityBot({
        aggression: 0.5,       // Reduced from 0.75 - less button mashing
        riskTolerance: 0.4,    // Reduced from 0.6 - more conservative
        defenseBias: 0.4,      // Increased from 0.25 - more blocking/spacing
        spacingTarget: 0.35,   // Increased from 0.3 - maintain better distance
        comboAmbition: 0.5,    // Reduced from 0.7 - shorter combos
        jumpRate: 0.1,         // Reduced from 0.15 - less jumping
        throwRate: 0.08,       // Reduced from 0.1 - less throwing
        fireballRate: 0.25,    // Reduced from 0.3 - less special spam
        antiAirCommitment: 0.5, // Reduced from 0.6
        adaptivity: 0.5,
        discipline: 0.75,      // Increased from 0.65 - more patient
        patternAddiction: 0.2, // Reduced from 0.3 - less predictable
        tiltThreshold: 0.6,
      });
      this.neuralPolicy = new NeuralPolicy();
      this.botType = 'personality';
      
      // Try to load trained model (async, doesn't block scene)
      this.loadNeuralModel();
    }

    // Create UI text
    this.roundText = this.add.text(500, 20, '', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    this.roundText.setOrigin(0.5, 0);

    this.timeText = this.add.text(500, 50, '', {
      fontSize: '20px',
      color: '#ffff00',
    });
    this.timeText.setOrigin(0.5, 0);

    this.fpsText = this.add.text(10, 10, '', {
      fontSize: '14px',
      color: '#00ff00',
    });

    // Instructions text (hide on mobile to avoid overlap with touch controls)
    const instructions = this.add.text(500, 560, 
      'Arrow Keys + Z/X/C/V | F1: Hitboxes | F2: AI | F3: Training (cycle modes) | F4: Reset Pos | F5: ∞ Meter | F6: Reset HP', {
      fontSize: '11px',
      color: '#888888',
      align: 'center',
    });
    instructions.setOrigin(0.5, 1);
    if (this.touchControls) {
      instructions.setVisible(false);
    }

    // Training mode sub-instructions
    const trainingInstructions = this.add.text(500, 545, 
      'Training Modes: Idle → Crouch → Jump → Block → CPU → Record → Playback', {
      fontSize: '9px',
      color: '#666666',
      align: 'center',
    });
    trainingInstructions.setOrigin(0.5, 1);
    if (this.touchControls) {
      trainingInstructions.setVisible(false);
    }

    // Bot type indicator
    this.botTypeText = this.add.text(500, 580, 
      'AI: Personality Bot (Aggressive)', {
      fontSize: '14px',
      color: '#ffff00',
      align: 'center',
    });
    this.botTypeText.setOrigin(0.5, 1);

    // Difficulty and Style indicators (for ML bot)
    this.difficultyText = this.add.text(850, 560, 
      `Difficulty: ${this.currentDifficulty}/10 (F7/F8)`, {
      fontSize: '12px',
      color: '#00ff00',
    });
    this.difficultyText.setOrigin(0, 1);
    this.difficultyText.setVisible(false);

    this.styleText = this.add.text(850, 580, 
      `Style: ${this.currentStyle} (F9)`, {
      fontSize: '12px',
      color: '#00ff00',
    });
    this.styleText.setOrigin(0, 1);
    this.styleText.setVisible(false);

    // Input display for both players
    this.inputDisplayTexts = new Map();
    this.inputDisplayTexts.set('player1', this.add.text(150, 540, '', {
      fontSize: '20px',
      color: '#00ffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 1));

    this.inputDisplayTexts.set('player2', this.add.text(850, 540, '', {
      fontSize: '20px',
      color: '#ff00ff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 1));

    // Initialize match end UI
    this.matchEndContainer = null;
    this.tieOverlay = null;
    this.winOverlay = null;
    this.roundEndTimer = null;
    this.roundAnnouncement = null;
    this.fightAnnouncement = null;

    // Initialize input histories
    this.inputHistories = new Map();
    this.inputHistories.set('player1', []);
    this.inputHistories.set('player2', []);

    // Initialize difficulty and style control keys
    this.difficultyUpKey = this.input.keyboard!.addKey('F7');
    this.difficultyDownKey = this.input.keyboard!.addKey('F8');
    this.styleKey = this.input.keyboard!.addKey('F9');
    
    // Show round start cinematic after brief delay
    this.time.delayedCall(500, () => {
      this.showRoundStartCinematic();
    });
  }

  /**
   * Create sprite animations for all character states
   */
  private createAnimations(): void {
    // Player animations (96x96 sprites)
    this.anims.create({
      key: 'player_idle_anim',
      frames: this.anims.generateFrameNumbers('player_idle', { start: 0, end: -1 }),
      frameRate: 8,
      repeat: -1
    });

    this.anims.create({
      key: 'player_walk_anim',
      frames: this.anims.generateFrameNumbers('player_walk', { start: 0, end: -1 }),
      frameRate: 10,
      repeat: -1
    });

    this.anims.create({
      key: 'player_run_anim',
      frames: this.anims.generateFrameNumbers('player_run', { start: 0, end: -1 }),
      frameRate: 12,
      repeat: -1
    });

    this.anims.create({
      key: 'player_jump_anim',
      frames: this.anims.generateFrameNumbers('player_jump', { start: 0, end: -1 }),
      frameRate: 10,
      repeat: 0
    });

    this.anims.create({
      key: 'player_attack1_anim',
      frames: this.anims.generateFrameNumbers('player_attack1', { start: 0, end: -1 }),
      frameRate: 15,
      repeat: 0
    });

    this.anims.create({
      key: 'player_attack2_anim',
      frames: this.anims.generateFrameNumbers('player_attack2', { start: 0, end: -1 }),
      frameRate: 15,
      repeat: 0
    });

    this.anims.create({
      key: 'player_attack3_anim',
      frames: this.anims.generateFrameNumbers('player_attack3', { start: 0, end: -1 }),
      frameRate: 15,
      repeat: 0
    });

    this.anims.create({
      key: 'player_special_anim',
      frames: this.anims.generateFrameNumbers('player_special', { start: 0, end: -1 }),
      frameRate: 12,
      repeat: 0
    });

    this.anims.create({
      key: 'player_defend_anim',
      frames: this.anims.generateFrameNumbers('player_defend', { start: 0, end: -1 }),
      frameRate: 8,
      repeat: -1
    });

    this.anims.create({
      key: 'player_hurt_anim',
      frames: this.anims.generateFrameNumbers('player_hurt', { start: 0, end: -1 }),
      frameRate: 12,
      repeat: 0
    });

    this.anims.create({
      key: 'player_death_anim',
      frames: this.anims.generateFrameNumbers('player_death', { start: 0, end: -1 }),
      frameRate: 10,
      repeat: 0
    });

    // Enemy animations (64x64 sprites)
    this.anims.create({
      key: 'enemy_idle_anim',
      frames: this.anims.generateFrameNumbers('enemy_idle', { start: 0, end: -1 }),
      frameRate: 8,
      repeat: -1
    });

    this.anims.create({
      key: 'enemy_run_anim',
      frames: this.anims.generateFrameNumbers('enemy_run', { start: 0, end: -1 }),
      frameRate: 12,
      repeat: -1
    });

    this.anims.create({
      key: 'enemy_jump_anim',
      frames: this.anims.generateFrameNumbers('enemy_jump', { start: 0, end: -1 }),
      frameRate: 10,
      repeat: 0
    });

    this.anims.create({
      key: 'enemy_attack1_anim',
      frames: this.anims.generateFrameNumbers('enemy_attack1', { start: 0, end: -1 }),
      frameRate: 15,
      repeat: 0
    });

    this.anims.create({
      key: 'enemy_attack2_anim',
      frames: this.anims.generateFrameNumbers('enemy_attack2', { start: 0, end: -1 }),
      frameRate: 15,
      repeat: 0
    });

    this.anims.create({
      key: 'enemy_attack3_anim',
      frames: this.anims.generateFrameNumbers('enemy_attack3', { start: 0, end: -1 }),
      frameRate: 15,
      repeat: 0
    });

    this.anims.create({
      key: 'enemy_dash_anim',
      frames: this.anims.generateFrameNumbers('enemy_dash', { start: 0, end: -1 }),
      frameRate: 12,
      repeat: 0
    });

    this.anims.create({
      key: 'enemy_defence_anim',
      frames: this.anims.generateFrameNumbers('enemy_defence', { start: 0, end: -1 }),
      frameRate: 8,
      repeat: -1
    });

    this.anims.create({
      key: 'enemy_hurt_anim',
      frames: this.anims.generateFrameNumbers('enemy_hurt', { start: 0, end: -1 }),
      frameRate: 12,
      repeat: 0
    });

    this.anims.create({
      key: 'enemy_death_anim',
      frames: this.anims.generateFrameNumbers('enemy_death', { start: 0, end: -1 }),
      frameRate: 10,
      repeat: 0
    });
  }

  /**
   * Setup online multiplayer match
   */
  private setupOnlineMatch(config: OnlineMatchConfig): void {
    console.log('Setting up online match:', config);
    
    // Create online manager
    this.onlineManager = new OnlineManager(config);
    
    // Set disconnect handler
    this.onlineManager.setDisconnectHandler(() => {
      this.handleOnlineDisconnect();
    });
    
    // Create opponent info display
    const opponent = this.onlineManager.getOpponentInfo();
    this.opponentInfoText = this.add.text(10, 540, 
      `Opponent: ${opponent.id.substring(0, 8)}... (Elo: ${opponent.elo})`, {
      fontSize: '14px',
      color: '#00ffff',
      backgroundColor: '#000000aa',
      padding: { x: 5, y: 5 }
    });
    this.opponentInfoText.setDepth(1001);
    this.opponentInfoText.setScrollFactor(0);
    
    // Create ping display
    this.pingText = this.add.text(10, 560, 
      `Ping: ${this.onlineManager.getPing()}ms | Delay: ${this.onlineManager.getFrameDelay()}f`, {
      fontSize: '12px',
      color: '#00ff00',
      backgroundColor: '#000000aa',
      padding: { x: 5, y: 5 }
    });
    this.pingText.setDepth(1001);
    this.pingText.setScrollFactor(0);
    
    // Create waiting message (hidden initially)
    this.waitingForInputsText = this.add.text(500, 300, 
      'Waiting for opponent...', {
      fontSize: '24px',
      color: '#ffff00',
      stroke: '#000000',
      strokeThickness: 4
    });
    this.waitingForInputsText.setOrigin(0.5);
    this.waitingForInputsText.setDepth(1001);
    this.waitingForInputsText.setVisible(false);
    
    // Hide AI-related UI
    if (this.botTypeText) {
      this.botTypeText.setVisible(false);
    }
    if (this.difficultyText) {
      this.difficultyText.setVisible(false);
    }
    if (this.styleText) {
      this.styleText.setVisible(false);
    }
  }

  /**
   * Handle online disconnect
   */
  private handleOnlineDisconnect(): void {
    console.log('Online match disconnected');
    
    // Show disconnect message
    const overlay = this.add.rectangle(
      0, 0,
      this.cameras.main.width,
      this.cameras.main.height,
      0x000000, 0.7
    ).setOrigin(0).setDepth(2000);
    
    const text = this.add.text(500, 300, 
      'Connection Lost\n\nReturning to menu...', {
      fontSize: '32px',
      color: '#ff0000',
      align: 'center',
      stroke: '#000000',
      strokeThickness: 4
    });
    text.setOrigin(0.5).setDepth(2001);
    
    // Return to menu after delay
    this.time.delayedCall(3000, () => {
      if (this.onlineManager) {
        this.onlineManager.destroy();
      }
      this.registry.remove('onlineMatch');
      this.scene.start('MainMenuScene');
    });
  }

  update(time: number, delta: number): void {
    // Toggle debug mode
    if (Phaser.Input.Keyboard.JustDown(this.debugKey)) {
      this.debugMode = !this.debugMode;
    }

    // Switch AI bot type
    if (Phaser.Input.Keyboard.JustDown(this.botSwitchKey)) {
      this.switchBotType();
    }

    // Check for hit freeze - pause game logic if frozen
    if (this.hitFreezeFrames > 0) {
      this.hitFreezeFrames--;
      // Still update visuals during freeze
      for (const fighter of this.gameState.entities) {
        const sprite = this.fighterSprites.get(fighter.id);
        if (sprite) {
          sprite.sync(fighter);
        }
      }
      return; // Skip game logic during freeze
    }

    // Difficulty and Style controls (only active for ML bot)
    if (this.botType === 'ml' && this.mlBot) {
      if (Phaser.Input.Keyboard.JustDown(this.difficultyUpKey)) {
        this.changeDifficulty(1);
      }
      if (Phaser.Input.Keyboard.JustDown(this.difficultyDownKey)) {
        this.changeDifficulty(-1);
      }
      if (Phaser.Input.Keyboard.JustDown(this.styleKey)) {
        this.cycleStyle();
      }
    }

    // Toggle training mode
    if (Phaser.Input.Keyboard.JustDown(this.trainingModeKey)) {
      this.toggleTrainingMode();
    }

    // Reset position (F4)
    if (Phaser.Input.Keyboard.JustDown(this.resetPositionKey)) {
      this.resetFighterPositions();
    }

    // Reset health (F6)
    if (Phaser.Input.Keyboard.JustDown(this.resetHealthKey)) {
      this.resetFighterHealth();
    }

    // Toggle infinite meter (F5)
    if (Phaser.Input.Keyboard.JustDown(this.infiniteMeterKey)) {
      this.toggleInfiniteMeter();
    }

    // Show match end menu if match is over
    if (this.gameState.isMatchOver) {
      this.updateUI();
      this.showMatchEndMenu();
      return;
    }

    // Don't update if round is over, but schedule next round
    if (this.gameState.isRoundOver) {
      this.updateUI();
      // Start next round after 3 seconds if we haven't already scheduled it
      if (!this.roundEndTimer) {
        this.roundEndTimer = this.time.delayedCall(3000, () => {
          this.startNextRound();
          this.roundEndTimer = null;
        });
      }
      return;
    }

    // Capture player 1 input - use touch controls on mobile, keyboard otherwise
    let player1Input = this.touchControls 
      ? this.touchControls.getCurrentInput() 
      : this.inputHandler.captureInput(this.gameState.frame);
    
    // Update input debug display
    if (this.inputDebugText) {
      if (player1Input.actions.size > 0) {
        const actionNames = Array.from(player1Input.actions).map(a => {
          const names: Record<number, string> = {
            1: 'LEFT', 2: 'RIGHT', 3: 'UP', 4: 'DOWN',
            5: 'LP', 6: 'HP', 7: 'LK', 8: 'HK', 9: 'BLOCK'
          };
          return names[a] || a;
        });
        this.inputDebugText.setText('Input: ' + actionNames.join(' + '));
      } else {
        this.inputDebugText.setText('Input: None');
      }
    }

    // Player 2 input - depends on mode
    let player2Input: InputFrame;
    
    // Online multiplayer mode
    if (this.isOnlineMatch && this.onlineManager) {
      // Don't send inputs until initialization is complete
      if (!this.onlineInitialized) {
        return;
      }
      
      // Send our input to opponent
      const currentFrame = this.gameState.frame;
      const localInputArray = Array.from(player1Input.actions);
      this.onlineManager.sendInput(currentFrame, localInputArray);
      
      // Try to get synchronized inputs for the delayed frame
      const frameInputs = this.onlineManager.getFrameInputs(currentFrame);
      
      if (!frameInputs) {
        // Waiting for opponent input - don't advance game
        if (this.waitingForInputsText) {
          this.waitingForInputsText.setVisible(true);
        }
        
        // Update ping display
        if (this.pingText) {
          this.pingText.setText(
            `Ping: ${this.onlineManager.getPing()}ms | Delay: ${this.onlineManager.getFrameDelay()}f | Frame: ${currentFrame} | Waiting...`
          );
        }
        
        // Don't increment frame - wait for both players to be ready
        return; // Skip game logic this frame
      }
      
      // Hide waiting message
      if (this.waitingForInputsText) {
        this.waitingForInputsText.setVisible(false);
      }
      
      // Update ping display
      if (this.pingText) {
        this.pingText.setText(
          `Ping: ${this.onlineManager.getPing()}ms | Delay: ${this.onlineManager.getFrameDelay()}f`
        );
      }
      
      // Use synchronized inputs
      player1Input = frameInputs.player1!;
      player2Input = frameInputs.player2!;
      
    } else {
      // Local AI mode
      const observation = generateObservation(this.gameState, 'player2');
      const player2 = this.gameState.entities.find(e => e.id === 'player2');
      
      let aiAction = AIAction.IDLE;
      
      // Training mode overrides AI
      if (this.gameState.trainingMode?.enabled) {
        const mode = this.gameState.trainingMode.dummyMode;
        
        if (mode === 'record') {
          // Record player 2's actual inputs (from AI)
          aiAction = (this.aiBot instanceof RandomBot || this.aiBot instanceof PersonalityBot || this.aiBot instanceof ScriptedBot)
            ? this.aiBot.selectAction(observation, this.gameState.frame)
            : AIAction.IDLE;
          player2Input = actionToInputFrame(aiAction, player2?.facing || 1, this.gameState.frame);
          
          // Add to recording
          this.gameState.trainingMode.recording.push(player2Input);
        } else if (mode === 'playback') {
          // Play back recorded inputs
          const recording = this.gameState.trainingMode.recording;
          if (recording.length > 0) {
            const index = this.gameState.trainingMode.playbackIndex % recording.length;
            player2Input = recording[index];
            this.gameState.trainingMode.playbackIndex++;
          } else {
            // No recording, idle
            player2Input = actionToInputFrame(AIAction.IDLE, player2?.facing || 1, this.gameState.frame);
          }
        } else if (mode === 'idle') {
          aiAction = AIAction.IDLE;
          player2Input = actionToInputFrame(aiAction, player2?.facing || 1, this.gameState.frame);
        } else if (mode === 'crouch') {
          aiAction = AIAction.CROUCH;
          player2Input = actionToInputFrame(aiAction, player2?.facing || 1, this.gameState.frame);
        } else if (mode === 'jump') {
          aiAction = AIAction.JUMP;
          player2Input = actionToInputFrame(aiAction, player2?.facing || 1, this.gameState.frame);
        } else if (mode === 'block') {
          aiAction = AIAction.BLOCK;
          player2Input = actionToInputFrame(aiAction, player2?.facing || 1, this.gameState.frame);
        } else if (mode === 'cpu') {
          // Use normal AI
          aiAction = (this.aiBot instanceof RandomBot || this.aiBot instanceof PersonalityBot || this.aiBot instanceof ScriptedBot)
            ? this.aiBot.selectAction(observation, this.gameState.frame)
            : AIAction.IDLE;
          player2Input = actionToInputFrame(aiAction, player2?.facing || 1, this.gameState.frame);
        } else {
          player2Input = actionToInputFrame(AIAction.IDLE, player2?.facing || 1, this.gameState.frame);
        }
      } else {
        // Normal AI - check bot type
        if (this.botType === 'ml' && this.mlBot) {
          // Use ML bot (new RL-trained system)
          this.mlBotAction = this.mlBot.getAction(this.gameState);
          aiAction = this.mlBotAction.action as AIAction;
          player2Input = actionToInputFrame(aiAction, player2?.facing || 1, this.gameState.frame);
        } else if (this.aiBot instanceof RandomBot || this.aiBot instanceof PersonalityBot || this.aiBot instanceof ScriptedBot) {
          // Use legacy bots
          aiAction = this.aiBot.selectAction(observation, this.gameState.frame);
          player2Input = actionToInputFrame(aiAction, player2?.facing || 1, this.gameState.frame);
        } else {
          // Fallback
          aiAction = AIAction.IDLE;
          player2Input = actionToInputFrame(aiAction, player2?.facing || 1, this.gameState.frame);
        }
      }
    }

    // Create input map
    const inputs = new Map([
      ['player1', player1Input],
      ['player2', player2Input],
    ]);

    // Update input histories (keep last 15 frames)
    this.inputHistories.get('player1')?.push(player1Input);
    if (this.inputHistories.get('player1')!.length > 15) {
      this.inputHistories.get('player1')?.shift();
    }
    this.inputHistories.get('player2')?.push(player2Input);
    if (this.inputHistories.get('player2')!.length > 15) {
      this.inputHistories.get('player2')?.shift();
    }

    // Apply infinite meter if enabled (before tick)
    if (this.gameState.trainingMode?.infiniteMeter) {
      this.gameState.entities.forEach(fighter => {
        fighter.superMeter = fighter.maxSuperMeter;
        fighter.energy = fighter.maxEnergy;
      });
    }

    // Tick core engine (this is where the magic happens)
    this.gameState = tick(this.gameState, inputs, this.characterDefs);

    // Apply visual effects
    this.applyScreenShake();
    this.detectAndSpawnHitEffects();
    this.detectAndPlayAttackSounds();
    
    // Sync sprites with new state
    for (const fighter of this.gameState.entities) {
      const sprite = this.fighterSprites.get(fighter.id);
      if (sprite) {
        sprite.sync(fighter);
      }
    }

    // Update projectiles
    this.updateProjectiles();

    // Update combo counters and meter bars
    this.updateCombosAndMeters();

    // Update input displays
    this.updateInputDisplays();

    // Update UI
    this.updateUI();

    // Draw debug overlays
    if (this.debugMode) {
      this.drawDebugOverlays();
    } else {
      this.debugGraphics.clear();
    }
  }

  /**
   * Update UI elements (round info, time, etc.)
   */
  private updateUI(): void {
    // Round number
    this.roundText.setText(`Round ${this.gameState.round.roundNumber}`);

    // Time remaining (convert frames to seconds)
    const timeSeconds = Math.ceil(this.gameState.round.timeRemaining / 60);
    this.timeText.setText(`${timeSeconds}s`);

    // FPS
    this.fpsText.setText(`FPS: ${Math.round(this.game.loop.actualFps)}`);

    // Check for round end
    if (this.gameState.isRoundOver) {
      if (this.gameState.round.winner) {
        const winnerFighter = this.gameState.entities.find(
          (f) => f.id === this.gameState.round.winner
        );
        if (winnerFighter) {
          this.showWinOverlay(winnerFighter.id);
          this.roundText.setText(
            `Round ${this.gameState.round.roundNumber} - ${winnerFighter.id} wins!`
          );
        }
      } else {
        // Tie - show animated overlay
        this.showTieOverlay();
        this.roundText.setText(`Round ${this.gameState.round.roundNumber} - TIE!`);
      }
    }

    // Check for match end
    if (this.gameState.isMatchOver) {
      if (this.gameState.match.matchWinner) {
        const winnerFighter = this.gameState.entities.find(
          (f) => f.id === this.gameState.match.matchWinner
        );
        if (winnerFighter) {
          this.roundText.setText(`${winnerFighter.id} WINS THE MATCH!`);
        }
      }
    }
  }

  /**
   * Update projectile sprites to match game state
   */
  private updateProjectiles(): void {
    // Remove projectiles that no longer exist
    const currentProjectileIds = new Set(this.gameState.projectiles.map(p => p.id));
    for (const [id, sprite] of this.projectileSprites.entries()) {
      if (!currentProjectileIds.has(id)) {
        // Clean up trail emitter if it exists
        const trail = (sprite as any).trailEmitter;
        if (trail) {
          trail.stop();
          this.time.delayedCall(300, () => trail.destroy());
        }
        sprite.destroy();
        this.projectileSprites.delete(id);
      }
    }

    // Create or update projectile sprites
    for (const projectile of this.gameState.projectiles) {
      let sprite = this.projectileSprites.get(projectile.id);
      
      if (!sprite) {
        // Create new projectile sprite with glow effect
        const color = projectile.teamId === 0 ? 0x00ffff : 0xff00ff;
        sprite = this.add.rectangle(
          projectile.position.x,
          projectile.position.y,
          projectile.hitbox.width,
          projectile.hitbox.height,
          color,
          0.8
        );
        sprite.setDepth(20);
        this.projectileSprites.set(projectile.id, sprite);
        
        // Add particle trail effect
        const trailColor = projectile.teamId === 0 ? 0x00ffff : 0xff00ff;
        const trail = this.add.particles(projectile.position.x, projectile.position.y, 'particle', {
          follow: sprite,
          speed: 20,
          scale: { start: 0.8, end: 0 },
          alpha: { start: 0.6, end: 0 },
          lifespan: 200,
          tint: trailColor,
          frequency: 20,
        });
        
        // Store trail emitter to clean up later
        (sprite as any).trailEmitter = trail;
        
      } else {
        // Update existing sprite position
        sprite.setPosition(projectile.position.x, projectile.position.y);
      }
    }
  }

  /**
   * Update combo counters and super meter bars
   */
  private updateCombosAndMeters(): void {
    for (const fighter of this.gameState.entities) {
      // Update combo counter
      const comboText = this.comboTexts.get(fighter.id);
      if (comboText) {
        if (fighter.comboCount > 1) {
          // Update text with dramatic styling based on combo size
          let displayText = `${fighter.comboCount} HIT`;
          let fontSize = 32;
          let color = '#ffff00'; // Yellow for small combos
          let strokeColor = '#000000';
          let strokeThickness = 4;
          
          if (fighter.comboCount >= 10) {
            displayText = `${fighter.comboCount} HIT COMBO!!!`;
            fontSize = 48;
            color = '#ff0000'; // Red for huge combos
            strokeColor = '#ffff00'; // Yellow stroke
            strokeThickness = 6;
          } else if (fighter.comboCount >= 5) {
            displayText = `${fighter.comboCount} HIT COMBO!`;
            fontSize = 40;
            color = '#ff8800'; // Orange for medium combos
            strokeThickness = 5;
          }
          
          comboText.setText(displayText);
          comboText.setFontSize(fontSize);
          comboText.setColor(color);
          comboText.setStroke(strokeColor, strokeThickness);
          comboText.setPosition(fighter.position.x, fighter.position.y - 150);
          
          // Add pulsing scale effect for large combos
          if (fighter.comboCount >= 5) {
            const pulseScale = 1 + Math.sin(Date.now() / 100) * 0.1;
            comboText.setScale(pulseScale);
          } else {
            comboText.setScale(1);
          }
          
          comboText.setAlpha(1.0);
        } else {
          comboText.setAlpha(0);
          comboText.setScale(1);
        }
      }

      // Update super meter bar
      const meterGraphics = this.meterGraphics.get(fighter.id);
      if (meterGraphics) {
        this.drawMeterBar(meterGraphics, fighter);
      }
    }
  }

  /**
   * Draw super meter bar for a fighter
   */
  private drawMeterBar(graphics: Phaser.GameObjects.Graphics, fighter: FighterState): void {
    const barWidth = 200;
    const barHeight = 12;
    const barX = fighter.teamId === 0 ? 20 : 780; // Left for P1, right for P2
    const barY = 80;
    const meterPercent = Math.max(0, Math.min(1, fighter.superMeter / fighter.maxSuperMeter));

    graphics.clear();

    // Background (dark)
    graphics.fillStyle(0x000000, 0.8);
    graphics.fillRect(barX, barY, barWidth, barHeight);

    // Super meter (gradient from yellow to red)
    const segments = 3; // Show 3 bars for visual effect
    const segmentWidth = barWidth / segments;
    const filledSegments = Math.floor(meterPercent * segments);
    const partialSegment = (meterPercent * segments) % 1;

    for (let i = 0; i < segments; i++) {
      const segmentX = barX + (i * segmentWidth) + 2;
      const segmentY = barY + 2;
      const segmentH = barHeight - 4;
      
      if (i < filledSegments) {
        // Full segment
        graphics.fillStyle(0xffaa00);
        graphics.fillRect(segmentX, segmentY, segmentWidth - 4, segmentH);
      } else if (i === filledSegments && partialSegment > 0) {
        // Partial segment
        graphics.fillStyle(0xffaa00);
        graphics.fillRect(segmentX, segmentY, (segmentWidth - 4) * partialSegment, segmentH);
      }
    }

    // Border
    graphics.lineStyle(2, 0xffffff);
    graphics.strokeRect(barX, barY, barWidth, barHeight);

    // Label
    if (!this[`meterLabel_${fighter.id}` as keyof this]) {
      const label = this.add.text(barX, barY - 18, 'SUPER METER', {
        fontSize: '12px',
        color: '#ffffff',
        fontStyle: 'bold',
      });
      (this as any)[`meterLabel_${fighter.id}`] = label;
    }
  }

  /**
   * Update input displays for both players
   */
  private updateInputDisplays(): void {
    for (const fighter of this.gameState.entities) {
      const text = this.inputDisplayTexts.get(fighter.id);
      const history = this.inputHistories.get(fighter.id);
      
      if (!text || !history) continue;

      // Get input notation from recent history
      const notation = getInputNotation(history, fighter.facing);
      const displayNotation = getDisplayNotation(notation);

      // Only show if there's recent input (within last 30 frames = 0.5 seconds)
      const hasRecentInput = history.length > 0;
      
      if (hasRecentInput && displayNotation) {
        text.setText(displayNotation);
        text.setAlpha(1);
      } else {
        text.setText('');
        text.setAlpha(0);
      }
    }
  }

  /**
   * Draw debug overlays (hitboxes, hurtboxes, state info)
   */
  private drawDebugOverlays(): void {
    this.debugGraphics.clear();

    for (const fighter of this.gameState.entities) {
      // Draw hurtboxes (blue)
      this.debugGraphics.lineStyle(2, 0x0000ff, 0.8);
      for (const box of fighter.hurtboxes) {
        const worldX = fighter.position.x + box.x * fighter.facing;
        const worldY = fighter.position.y + box.y;
        this.debugGraphics.strokeRect(worldX, worldY, box.width, box.height);
      }

      // Draw hitboxes (red)
      this.debugGraphics.lineStyle(3, 0xff0000, 1.0);
      for (const box of fighter.hitboxes) {
        const worldX = fighter.position.x + box.x * fighter.facing;
        const worldY = fighter.position.y + box.y;
        this.debugGraphics.strokeRect(worldX, worldY, box.width, box.height);
      }

      // Draw state info text
      const debugText = [
        `${fighter.id}`,
        `Status: ${fighter.status}`,
        `Move: ${fighter.currentMove || 'none'}`,
        `Frame: ${fighter.moveFrame}`,
        `Combo: ${fighter.comboCount}`,
        `Stun: ${fighter.stunFramesRemaining}`,
      ].join('\n');

      const textObj = this.add.text(
        fighter.position.x,
        fighter.position.y - 120,
        debugText,
        {
          fontSize: '10px',
          color: '#ffff00',
          backgroundColor: '#000000',
          padding: { x: 4, y: 4 },
        }
      );
      textObj.setOrigin(0.5, 1);

      // Destroy text after this frame (it's just for debug)
      this.time.delayedCall(0, () => textObj.destroy());
    }

    // Draw projectile hitboxes
    this.debugGraphics.lineStyle(2, 0xff00ff, 0.8);
    for (const projectile of this.gameState.projectiles) {
      const worldX = projectile.position.x + projectile.hitbox.x;
      const worldY = projectile.position.y + projectile.hitbox.y;
      this.debugGraphics.strokeRect(worldX, worldY, projectile.hitbox.width, projectile.hitbox.height);
      
      // Draw projectile info
      const projText = this.add.text(
        projectile.position.x,
        projectile.position.y - 20,
        `Hits: ${projectile.hitCount}/${projectile.hitLimit}`,
        {
          fontSize: '10px',
          color: '#ffff00',
          backgroundColor: '#000000',
          padding: { x: 4, y: 4 },
        }
      );
      projText.setOrigin(0.5, 1);
      this.time.delayedCall(0, () => projText.destroy());
    }
  }

  /**
   * Toggle training mode
   */
  private toggleTrainingMode(): void {
    if (!this.gameState.trainingMode) return;
    
    this.gameState.trainingMode.enabled = !this.gameState.trainingMode.enabled;
    
    if (this.gameState.trainingMode.enabled) {
      // Cycle through dummy modes (now includes record and playback)
      const modes: Array<typeof this.gameState.trainingMode.dummyMode> = 
        ['idle', 'crouch', 'jump', 'block', 'cpu', 'record', 'playback'];
      const currentIndex = modes.indexOf(this.gameState.trainingMode.dummyMode);
      const nextIndex = (currentIndex + 1) % modes.length;
      this.gameState.trainingMode.dummyMode = modes[nextIndex];
      
      // Handle mode transitions
      if (this.gameState.trainingMode.dummyMode === 'record') {
        // Start recording
        this.gameState.trainingMode.recording = [];
        this.gameState.trainingMode.recordingStartFrame = this.gameState.frame;
        console.log('Training Mode: RECORDING (press F3 again to stop and playback)');
      } else if (this.gameState.trainingMode.dummyMode === 'playback') {
        // Start playback
        this.gameState.trainingMode.playbackIndex = 0;
        if (this.gameState.trainingMode.recording.length === 0) {
          console.log('Training Mode: PLAYBACK (no recording available, using idle)');
          this.gameState.trainingMode.dummyMode = 'idle';
        } else {
          console.log(`Training Mode: PLAYBACK (${this.gameState.trainingMode.recording.length} frames)`);
        }
      } else {
        console.log(`Training Mode: ${this.gameState.trainingMode.dummyMode}`);
      }
      
      this.botTypeText.setText(`Training: ${this.gameState.trainingMode.dummyMode.toUpperCase()}`);
    } else {
      console.log('Training Mode: OFF');
      this.updateBotTypeText();
    }
  }

  /**
   * Reset fighter positions to starting positions
   */
  private resetFighterPositions(): void {
    const config = {
      entities: [
        { characterId: 'musashi', id: 'player1', teamId: 0, startPosition: { x: 300, y: 500 } },
        { characterId: 'musashi', id: 'player2', teamId: 1, startPosition: { x: 700, y: 500 } },
      ],
      arena: this.gameState.arena,
      roundsToWin: 2,
      roundTimeSeconds: 60,
    };

    this.gameState.entities.forEach((fighter, index) => {
      fighter.position = { ...config.entities[index].startPosition };
      fighter.velocity = { x: 0, y: 0 };
      fighter.status = 'idle' as any;
      fighter.currentMove = null;
      fighter.moveFrame = 0;
      fighter.stunFramesRemaining = 0;
      fighter.invincibleFrames = 0;
    });

    console.log('Positions reset');
  }

  /**
   * Reset fighter health to full
   */
  private resetFighterHealth(): void {
    this.gameState.entities.forEach(fighter => {
      fighter.health = fighter.maxHealth;
      fighter.comboCount = 0;
      fighter.comboScaling = 1.0;
    });

    console.log('Health reset');
  }

  /**
   * Toggle infinite super meter
   */
  private toggleInfiniteMeter(): void {
    if (!this.gameState.trainingMode) return;
    
    this.gameState.trainingMode.infiniteMeter = !this.gameState.trainingMode.infiniteMeter;
    
    if (this.gameState.trainingMode.infiniteMeter) {
      console.log('Infinite Meter: ON');
      // Fill meters
      this.gameState.entities.forEach(fighter => {
        fighter.superMeter = fighter.maxSuperMeter;
        fighter.energy = fighter.maxEnergy;
      });
    } else {
      console.log('Infinite Meter: OFF');
    }
  }

  /**
   * Detect if running on a mobile device
   */
  private isMobileDevice(): boolean {
    // Check if Capacitor is available (native mobile app)
    if ((window as any).Capacitor) {
      return true;
    }
    
    // Fallback: Check user agent for mobile browsers
    const userAgent = navigator.userAgent.toLowerCase();
    return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  }

  /**
   * Update bot type text
   */
  private updateBotTypeText(): void {
    const typeNames = {
      'personality': 'Personality Bot (Aggressive)',
      'defensive': 'Defensive Bot (Zoner)',
      'scripted': 'Scripted Bot (Tight)',
      'neural': 'Neural Bot',
      'random': 'Random Bot',
      'ml': `ML Bot (RL-Trained) | Lv${this.currentDifficulty} ${this.currentStyle}`,
    };
    this.botTypeText.setText(`AI: ${typeNames[this.botType]}`);
  }

  /**
   * Switch between different AI bot types
   */
  private switchBotType(): void {
    if (this.botType === 'personality') {
      // Switch to defensive personality
      this.aiBot = new PersonalityBot({
        aggression: 0.3,
        riskTolerance: 0.4,
        defenseBias: 0.8,
        spacingTarget: 0.4,
        comboAmbition: 0.5,
        jumpRate: 0.1,
        throwRate: 0.15,
        fireballRate: 0.6,
        antiAirCommitment: 0.8,
        adaptivity: 0.6,
        discipline: 0.8,
        patternAddiction: 0.2,
        tiltThreshold: 0.7,
      });
      this.botType = 'defensive';
      this.botTypeText.setText('AI: Defensive Bot (Zoner)');
      this.difficultyText.setVisible(false);
      this.styleText.setVisible(false);
    } else if (this.botType === 'defensive') {
      // Switch to scripted bot (playtesting baseline)
      this.aiBot = new ScriptedBot('tight');
      this.botType = 'scripted';
      this.botTypeText.setText('AI: Scripted Bot (Tight)');
      this.difficultyText.setVisible(false);
      this.styleText.setVisible(false);
    } else if (this.botType === 'scripted') {
      // Switch to neural bot
      this.aiBot = new NeuralBot(this.neuralPolicy, {
        temperature: 1.0,
        actionDuration: 5,
        useGreedy: false,
      });
      this.botType = 'neural';
      this.botTypeText.setText('AI: Neural Bot');
      this.difficultyText.setVisible(false);
      this.styleText.setVisible(false);
    } else if (this.botType === 'neural') {
      // Switch to ML bot (new RL-trained system)
      if (this.mlBot) {
        this.botType = 'ml';
        this.updateBotTypeText();
        this.difficultyText.setVisible(true);
        this.styleText.setVisible(true);
      } else {
        // ML bot not loaded, skip to random
        this.aiBot = new RandomBot();
        this.botType = 'random';
        this.botTypeText.setText('AI: Random Bot (ML Bot not loaded)');
        this.difficultyText.setVisible(false);
        this.styleText.setVisible(false);
      }
    } else if (this.botType === 'ml') {
      // Switch to random bot
      this.aiBot = new RandomBot();
      this.botType = 'random';
      this.botTypeText.setText('AI: Random Bot');
      this.difficultyText.setVisible(false);
      this.styleText.setVisible(false);
    } else {
      // Switch back to aggressive personality
      this.aiBot = new PersonalityBot({
        aggression: 0.75,
        riskTolerance: 0.6,
        defenseBias: 0.25,
        spacingTarget: 0.3,
        comboAmbition: 0.7,
        jumpRate: 0.15,
        throwRate: 0.1,
        fireballRate: 0.3,
        antiAirCommitment: 0.6,
        adaptivity: 0.5,
        discipline: 0.65,
        patternAddiction: 0.3,
        tiltThreshold: 0.6,
      });
      this.botType = 'personality';
      this.botTypeText.setText('AI: Personality Bot (Aggressive)');
      this.difficultyText.setVisible(false);
      this.styleText.setVisible(false);
    }
  }

  /**
   * Change difficulty level
   */
  private changeDifficulty(delta: number): void {
    this.currentDifficulty = Math.max(1, Math.min(10, this.currentDifficulty + delta)) as DifficultyLevel;
    this.difficultyText.setText(`Difficulty: ${this.currentDifficulty}/10 (F7/F8)`);
    
    // Recreate ML bot with new difficulty
    if (this.mlBot) {
      this.createMLBot();
    }
  }

  /**
   * Cycle through fighting styles
   */
  private cycleStyle(): void {
    const styles: FightingStyle[] = ['rushdown', 'zoner', 'turtle', 'mixup'];
    const currentIndex = styles.indexOf(this.currentStyle);
    this.currentStyle = styles[(currentIndex + 1) % styles.length];
    this.styleText.setText(`Style: ${this.currentStyle} (F9)`);
    
    // Recreate ML bot with new style
    if (this.mlBot) {
      this.createMLBot();
    }
  }

  /**
   * Create particle emitters for hit effects
   */
  private createHitParticles(): void {
    // Create circle particle texture for hit sparks
    const graphics = this.add.graphics();
    graphics.fillStyle(0xffffff);
    graphics.fillCircle(2, 2, 2);
    graphics.generateTexture('particle', 4, 4);
    graphics.destroy();
    
    // Create star particle texture for critical/heavy hits
    const starGraphics = this.add.graphics();
    starGraphics.fillStyle(0xffffff);
    starGraphics.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const x = 4 + Math.cos(angle) * 4;
      const y = 4 + Math.sin(angle) * 4;
      if (i === 0) starGraphics.moveTo(x, y);
      else starGraphics.lineTo(x, y);
    }
    starGraphics.closePath();
    starGraphics.fillPath();
    starGraphics.generateTexture('star_particle', 8, 8);
    starGraphics.destroy();
    
    // Create ring particle texture for blocked hits
    const ringGraphics = this.add.graphics();
    ringGraphics.lineStyle(2, 0xffffff);
    ringGraphics.strokeCircle(4, 4, 3);
    ringGraphics.generateTexture('ring_particle', 8, 8);
    ringGraphics.destroy();
  }

  /**
   * Spawn hit spark effect at position
   */
  private spawnHitSpark(x: number, y: number, wasBlocked: boolean, damage: number): void {
    if (wasBlocked) {
      // Blocked hits - gray rings spreading outward
      const emitter = this.add.particles(x, y, 'ring_particle', {
        speed: { min: 50, max: 100 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.5, end: 1.5 },
        alpha: { start: 1, end: 0 },
        lifespan: 300,
        tint: 0x888888,
        emitting: false,
      });
      emitter.explode(6);
      this.time.delayedCall(500, () => emitter.destroy());
      
    } else if (damage > 25) {
      // Heavy hits - orange/red stars with extra impact
      const colors = [0xff0000, 0xff4400, 0xff8800];
      const emitter = this.add.particles(x, y, 'star_particle', {
        speed: { min: 150, max: 250 },
        angle: { min: 0, max: 360 },
        scale: { start: 2, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: 400,
        gravityY: 300,
        tint: colors,
        emitting: false,
      });
      emitter.explode(25);
      
      // Add secondary burst of circles
      const circleEmitter = this.add.particles(x, y, 'particle', {
        speed: { min: 100, max: 200 },
        angle: { min: 0, max: 360 },
        scale: { start: 1.5, end: 0 },
        lifespan: 300,
        gravityY: 200,
        tint: 0xff6600,
        emitting: false,
      });
      circleEmitter.explode(15);
      
      this.time.delayedCall(500, () => {
        emitter.destroy();
        circleEmitter.destroy();
      });
      
    } else {
      // Normal hits - yellow/white particles
      const color = damage > 15 ? 0xffaa00 : 0xffff00;
      const emitter = this.add.particles(x, y, 'particle', {
        speed: { min: 80, max: 150 },
        angle: { min: 0, max: 360 },
        scale: { start: 1.2, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: 300,
        gravityY: 200,
        tint: color,
        emitting: false,
      });
      emitter.explode(12);
      
      this.time.delayedCall(500, () => emitter.destroy());
    }
  }

  /**
   * Detect attack starts and play whoosh/special sounds
   */
  private detectAndPlayAttackSounds(): void {
    for (const fighter of this.gameState.entities) {
      const lastMove = this.lastMoveFrames.get(fighter.id);
      const currentMove = fighter.currentMove;
      const currentFrame = fighter.moveFrame;
      
      // New move started (moveFrame = 0 or 1, move changed)
      if (currentMove && (!lastMove || lastMove.move !== currentMove) && currentFrame <= 1) {
        // Check if it's a special move
        if (currentMove.includes('fireball')) {
          this.audioManager.playSpecialSound('fireball');
        } else if (currentMove.includes('uppercut')) {
          this.audioManager.playSpecialSound('uppercut');
        } else if (currentMove.includes('super')) {
          this.audioManager.playSpecialSound('super');
        } else if (currentMove.includes('kick')) {
          this.audioManager.playWhoosh('kick');
        } else if (currentMove.includes('punch')) {
          this.audioManager.playWhoosh('punch');
        }
      }
      
      // Update tracking
      this.lastMoveFrames.set(fighter.id, { move: currentMove, frame: currentFrame });
    }
  }

  /**
   * Detect new hits and spawn particle effects
   */
  private detectAndSpawnHitEffects(): void {
    for (const fighter of this.gameState.entities) {
      const lastFrame = this.lastHitFrames.get(fighter.id) || 0;
      const currentFrame = fighter.lastHitByFrame;
      
      // New hit detected
      if (currentFrame > lastFrame) {
        // Spawn particles at fighter position
        const wasBlocked = fighter.status === 'block' || fighter.status === 'blockstun';
        // Estimate damage from combo scaling (rough approximation)
        const estimatedDamage = 15 / fighter.comboScaling;
        
        this.spawnHitSpark(fighter.position.x, fighter.position.y - 40, wasBlocked, estimatedDamage);
        
        // Flash character sprite
        const sprite = this.fighterSprites.get(fighter.id);
        if (sprite) {
          sprite.flashDamage();
        }
        
        // Play hit sound
        this.audioManager.playHitSound(estimatedDamage, wasBlocked);
        
        // Apply hit freeze based on damage
        if (!wasBlocked) {
          // Strong hits freeze longer (2-6 frames)
          const freezeDuration = Math.floor(Math.min(6, 2 + estimatedDamage / 10));
          this.hitFreezeFrames = freezeDuration;
        } else {
          // Blocked hits have minimal freeze (1-2 frames)
          this.hitFreezeFrames = Math.floor(Math.min(2, 1 + estimatedDamage / 20));
        }
        
        // Update tracking
        this.lastHitFrames.set(fighter.id, currentFrame);
      }
    }
  }

  /**
   * Apply screen shake effect based on game state
   */
  private applyScreenShake(): void {
    const shake = this.gameState.screenShake;
    
    if (shake) {
      // Calculate shake progress (0 to 1)
      const progress = shake.elapsed / shake.duration;
      // Decay intensity over time
      const currentIntensity = shake.intensity * (1 - progress);
      
      // Random offset
      const offsetX = (Math.random() - 0.5) * currentIntensity * 2;
      const offsetY = (Math.random() - 0.5) * currentIntensity * 2;
      
      // Apply to camera
      this.cameras.main.setScroll(-offsetX, -offsetY);
    } else {
      // No shake, reset camera
      this.cameras.main.setScroll(0, 0);
    }
  }

  /**
   * Create ML bot with current difficulty and style
   */
  private async createMLBot(): Promise<void> {
    if (!this.mlBot) {
      console.error('Cannot create ML bot: model not loaded');
      return;
    }

    const httpPath = 'http://localhost:8080/policy/model.json';
    try {
      const model = await tf.loadLayersModel(httpPath);
      this.mlBot = new BotRuntime(model, {
        difficulty: this.currentDifficulty,
        style: this.currentStyle,
        playerIndex: 2,
      });
      this.updateBotTypeText();
    } catch (error) {
      console.error('Failed to recreate ML bot:', error);
    }
  }

  /**
   * Attempt to load trained ML model
   * 1. Try loading from HTTP server
   * 2. Create BotRuntime with default settings
   * 3. Also load legacy NeuralPolicy for backward compatibility
   */
  private async loadNeuralModel(): Promise<void> {
    const indexedDbPath = 'indexeddb://policy_v1';
    const httpPath = 'http://localhost:8080/policy/model.json';

    // Try to load NeuralPolicy (legacy)
    try {
      await this.neuralPolicy.load(indexedDbPath);
      console.log('✓ Loaded legacy neural model from IndexedDB');
    } catch (indexedDbError) {
      console.log('⚠ No cached legacy model in IndexedDB, trying HTTP server...');
      
      try {
        await this.neuralPolicy.load(httpPath);
        console.log('✓ Loaded legacy neural model from HTTP');
        
        try {
          await this.neuralPolicy.save(indexedDbPath);
          console.log('✓ Cached legacy model to IndexedDB');
        } catch (saveError) {
          console.warn('⚠ Failed to cache legacy model:', saveError);
        }
      } catch (httpError) {
        console.log('⚠ No legacy neural model found');
      }
    }

    // Try to load ML BotRuntime (new RL system)
    try {
      const model = await tf.loadLayersModel(httpPath);
      this.mlBot = new BotRuntime(model, {
        difficulty: this.currentDifficulty,
        style: this.currentStyle,
        playerIndex: 2,
      });
      console.log('✓ Loaded ML Bot (RL-trained system)');
      console.log(`  Difficulty: ${this.currentDifficulty}/10, Style: ${this.currentStyle}`);
      console.log('  Press F2 to cycle bots → Press F7/F8 for difficulty, F9 for style');
    } catch (error) {
      console.log('⚠ ML Bot not available');
      console.log('  1. Train: npm run train:rl');
      console.log('  2. Serve: npm run serve-models');
      console.log('  3. Reload page');
    }
  }

  /**
   * Show animated win overlay
   */
  private showWinOverlay(winnerId: string): void {
    // Only show once
    if (this.winOverlay) return;

    // Apply dramatic slow-motion effect
    this.time.timeScale = 0.3; // Slow down time
    
    // Reset time scale after effect
    this.time.delayedCall(800, () => {
      this.time.timeScale = 1.0;
    });

    // Create dramatic "K.O.!" text first
    const koText = this.add.text(500, 300, 'K.O.!', {
      fontSize: '120px',
      color: '#ff0000',
      fontStyle: 'bold',
      stroke: '#ffffff',
      strokeThickness: 10,
    });
    koText.setOrigin(0.5);
    koText.setDepth(1001);
    koText.setAlpha(0);
    koText.setScale(3);

    // Explosive K.O. entrance
    this.tweens.add({
      targets: koText,
      scale: 1,
      alpha: 1,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Flash effect
        this.cameras.main.flash(200, 255, 255, 255, true);
        
        // Hold briefly then fade
        this.time.delayedCall(600, () => {
          this.tweens.add({
            targets: koText,
            alpha: 0,
            scale: 0.5,
            duration: 300,
            onComplete: () => koText.destroy()
          });
        });
      }
    });

    // Show winner announcement after K.O. fades
    this.time.delayedCall(1200, () => {
      this.winOverlay = this.add.text(500, 300, `${winnerId.toUpperCase()} WINS!`, {
        fontSize: '60px',
        color: '#00ff00',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 8,
      });
      this.winOverlay.setOrigin(0.5);
      this.winOverlay.setDepth(1000);
      this.winOverlay.setAlpha(0);
      this.winOverlay.setScale(0.5);

      // Grow from small to large
      this.tweens.add({
        targets: this.winOverlay,
        scale: 1,
        alpha: 1,
        duration: 600,
        ease: 'Back.easeOut',
        onComplete: () => {
          // Hold then fade out
          this.time.delayedCall(1500, () => {
            this.tweens.add({
              targets: this.winOverlay,
              alpha: 0,
              duration: 500,
              onComplete: () => {
                this.winOverlay?.destroy();
                this.winOverlay = null;
              }
            });
          });
        }
      });
    });
  }

  /**
   * Show animated tie overlay
   */
  private showTieOverlay(): void {
    // Only show once
    if (this.tieOverlay) return;

    this.tieOverlay = this.add.text(500, 300, 'TIE!', {
      fontSize: '20px',
      color: '#ffff00',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6,
    });
    this.tieOverlay.setOrigin(0.5);
    this.tieOverlay.setDepth(1000);
    this.tieOverlay.setAlpha(0);

    // Grow from small to large in center
    this.tweens.add({
      targets: this.tieOverlay,
      fontSize: '100px',
      alpha: 1,
      duration: 800,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Hold for a moment then fade out
        this.time.delayedCall(1000, () => {
          this.tweens.add({
            targets: this.tieOverlay,
            alpha: 0,
            duration: 500,
            onComplete: () => {
              this.tieOverlay?.destroy();
              this.tieOverlay = null;
            }
          });
        });
      }
    });
  }

  /**
   * Start the next round
   */
  private startNextRound(): void {
    // Get config from current game state
    const config = {
      entities: [
        {
          characterId: 'musashi',
          id: 'player1',
          teamId: 0,
          startPosition: { x: 300, y: 500 },
        },
        {
          characterId: 'musashi',
          id: 'player2',
          teamId: 1,
          startPosition: { x: 700, y: 500 },
        },
      ],
      arena: {
        width: 1000,
        height: 600,
        groundLevel: 500,
        leftBound: 100,
        rightBound: 900,
      },
      roundTimeSeconds: 60,
      roundsToWin: 2, // Best of 3
    };

    // Destroy old fighter sprites
    console.log('[startNextRound] Destroying old sprites...');
    this.fighterSprites.forEach((sprite, id) => {
      console.log(`[startNextRound] Destroying sprite for ${id}`);
      sprite.destroy();
    });
    this.fighterSprites.clear();

    // Start next round
    this.gameState = startNextRound(this.gameState, config);
    
    // Recreate fighter sprites for new round
    console.log('[startNextRound] Creating new sprites...');
    for (const fighter of this.gameState.entities) {
      const sprite = new FighterSprite(this, fighter);
      this.fighterSprites.set(fighter.id, sprite);
      console.log(`[startNextRound] Created sprite for ${fighter.id}`);
    }
    console.log(`[startNextRound] Total sprites in map: ${this.fighterSprites.size}`);
    
    // Clear any overlays - stop tweens first to avoid errors
    if (this.winOverlay) {
      this.tweens.killTweensOf(this.winOverlay);
      this.winOverlay.destroy();
      this.winOverlay = null;
    }
    if (this.tieOverlay) {
      this.tweens.killTweensOf(this.tieOverlay);
      this.tieOverlay.destroy();
      this.tieOverlay = null;
    }
    
    // Show round start cinematic
    this.showRoundStartCinematic();
  }
  
  /**
   * Show round start cinematic with "ROUND X" and "FIGHT!" announcements
   */
  private showRoundStartCinematic(): void {
    const centerX = 500;
    const centerY = 300;
    
    // Create round announcement text (e.g., "ROUND 1")
    this.roundAnnouncement = this.add.text(centerX, centerY, 
      `ROUND ${this.gameState.round.roundNumber}`, {
      fontSize: '80px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 8,
    });
    this.roundAnnouncement.setOrigin(0.5);
    this.roundAnnouncement.setDepth(2000);
    this.roundAnnouncement.setAlpha(0);
    this.roundAnnouncement.setScale(0.5);
    
    // Animate round announcement: fade in + scale up
    this.tweens.add({
      targets: this.roundAnnouncement,
      alpha: 1,
      scale: 1,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Hold for a moment
        this.time.delayedCall(500, () => {
          // Fade out
          this.tweens.add({
            targets: this.roundAnnouncement,
            alpha: 0,
            scale: 1.5,
            duration: 200,
            ease: 'Power2',
            onComplete: () => {
              if (this.roundAnnouncement) {
                this.roundAnnouncement.destroy();
                this.roundAnnouncement = null;
              }
              
              // Show "FIGHT!" after round number fades
              this.showFightAnnouncement();
            }
          });
        });
      }
    });
  }
  
  /**
   * Show "FIGHT!" announcement
   */
  private showFightAnnouncement(): void {
    const centerX = 500;
    const centerY = 300;
    
    this.fightAnnouncement = this.add.text(centerX, centerY, 'FIGHT!', {
      fontSize: '120px',
      fontStyle: 'bold',
      color: '#ffff00',
      stroke: '#ff0000',
      strokeThickness: 10,
    });
    this.fightAnnouncement.setOrigin(0.5);
    this.fightAnnouncement.setDepth(2000);
    this.fightAnnouncement.setAlpha(0);
    this.fightAnnouncement.setScale(2);
    
    // Animate fight announcement: explosive entrance
    this.tweens.add({
      targets: this.fightAnnouncement,
      alpha: 1,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Hold briefly
        this.time.delayedCall(400, () => {
          // Quick fade out
          this.tweens.add({
            targets: this.fightAnnouncement,
            alpha: 0,
            scale: 0.8,
            duration: 150,
            ease: 'Power2',
            onComplete: () => {
              if (this.fightAnnouncement) {
                this.fightAnnouncement.destroy();
                this.fightAnnouncement = null;
              }
            }
          });
        });
      }
    });
  }

  /**
   * Show match end menu with options
   */
  private showMatchEndMenu(): void {
    // Only show once
    if (this.matchEndContainer) return;

    const centerX = 500;
    const centerY = 300;

    // Create container
    this.matchEndContainer = this.add.container(centerX, centerY);
    this.matchEndContainer.setDepth(1000);

    // Background
    const bg = this.add.rectangle(0, 0, 400, 300, 0x000000, 0.8);
    this.matchEndContainer.add(bg);

    // Title
    let titleText = 'MATCH OVER!';
    if (this.gameState.match.matchWinner) {
      const winner = this.gameState.entities.find(f => f.id === this.gameState.match.matchWinner);
      if (winner) {
        titleText = `${winner.id.toUpperCase()} WINS!`;
      }
    }
    const title = this.add.text(0, -100, titleText, {
      fontSize: '40px',
      color: '#ffff00',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5);
    this.matchEndContainer.add(title);

    // Replay button
    const replayBtn = this.add.rectangle(0, 0, 250, 50, 0x4488ff);
    const replayText = this.add.text(0, 0, 'REPLAY', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    replayText.setOrigin(0.5);
    replayBtn.setInteractive({ useHandCursor: true });
    replayBtn.on('pointerover', () => replayBtn.setFillStyle(0x6699ff));
    replayBtn.on('pointerout', () => replayBtn.setFillStyle(0x4488ff));
    replayBtn.on('pointerdown', () => {
      this.scene.restart();
    });
    this.matchEndContainer.add(replayBtn);
    this.matchEndContainer.add(replayText);

    // Main menu button
    const menuBtn = this.add.rectangle(0, 70, 250, 50, 0x888888);
    const menuText = this.add.text(0, 70, 'MAIN MENU', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    menuText.setOrigin(0.5);
    menuBtn.setInteractive({ useHandCursor: true });
    menuBtn.on('pointerover', () => menuBtn.setFillStyle(0xaaaaaa));
    menuBtn.on('pointerout', () => menuBtn.setFillStyle(0x888888));
    menuBtn.on('pointerdown', () => {
      this.matchEndContainer?.destroy();
      this.matchEndContainer = null;
      this.scene.start('MenuScene');
    });
    this.matchEndContainer.add(menuBtn);
    this.matchEndContainer.add(menuText);

    // Fade in animation
    this.matchEndContainer.setAlpha(0);
    this.tweens.add({
      targets: this.matchEndContainer,
      alpha: 1,
      duration: 500,
      ease: 'Power2',
    });
  }

  /**
   * Cleanup
   */
  shutdown(): void {
    this.inputHandler.destroy();
    this.fighterSprites.clear();
    
    // Clean up projectile sprites
    for (const sprite of this.projectileSprites.values()) {
      sprite.destroy();
    }
    this.projectileSprites.clear();
    
    // Clean up UI elements
    for (const text of this.comboTexts.values()) {
      text.destroy();
    }
    this.comboTexts.clear();
    
    for (const graphics of this.meterGraphics.values()) {
      graphics.destroy();
    }
    this.meterGraphics.clear();
    
    // Clean up match end UI
    if (this.matchEndContainer) {
      this.matchEndContainer.destroy();
      this.matchEndContainer = null;
    }
    if (this.tieOverlay) {
      this.tieOverlay.destroy();
      this.tieOverlay = null;
    }
    if (this.winOverlay) {
      this.winOverlay.destroy();
      this.winOverlay = null;
    }
    if (this.roundEndTimer) {
      this.roundEndTimer.remove();
      this.roundEndTimer = null;
    }
    
    this.neuralPolicy.dispose();
  }
}
