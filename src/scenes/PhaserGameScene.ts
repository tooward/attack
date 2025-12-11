/**
 * Phaser Game Scene with Core Engine Integration
 * 
 * This scene is a thin wrapper around the core engine.
 * It captures input, calls tick(), and renders the result.
 */

import { Scene } from 'phaser';
import { GameState, CharacterDefinition, InputFrame, FighterState } from '../core/interfaces/types';
import { createInitialState, tick } from '../core/Game';
import { MUSASHI } from '../core/data/musashi';
import { FighterSprite } from '../phaser/FighterSprite';
import { InputHandler } from '../phaser/InputHandler';
import { AudioManager } from '../phaser/AudioManager';
import { ProceduralAudio } from '../utils/ProceduralAudio';
import { generateObservation } from '../core/ai/Observation';
import { RandomBot } from '../core/ai/RandomBot';
import { PersonalityBot } from '../core/ai/PersonalityBot';
import { NeuralBot } from '../core/ai/NeuralBot';
import { NeuralPolicy } from '../core/ai/NeuralPolicy';
import { actionToInputFrame, AIAction } from '../core/ai/ActionSpace';

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

  // Input
  private inputHandler!: InputHandler;
  private debugKey!: Phaser.Input.Keyboard.Key;
  private botSwitchKey!: Phaser.Input.Keyboard.Key;
  private trainingModeKey!: Phaser.Input.Keyboard.Key;
  private resetPositionKey!: Phaser.Input.Keyboard.Key;
  private resetHealthKey!: Phaser.Input.Keyboard.Key;
  private infiniteMeterKey!: Phaser.Input.Keyboard.Key;

  // AI
  private aiBot!: RandomBot | PersonalityBot | NeuralBot;
  private botType: 'random' | 'personality' | 'defensive' | 'neural' = 'personality';
  private neuralPolicy!: NeuralPolicy;
  
  // Audio
  private audioManager!: AudioManager;

  // UI Text
  private roundText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private fpsText!: Phaser.GameObjects.Text;
  private botTypeText!: Phaser.GameObjects.Text;
  private comboTexts!: Map<string, Phaser.GameObjects.Text>;
  private meterGraphics!: Map<string, Phaser.GameObjects.Graphics>;

  constructor() {
    super({ key: 'PhaserGameScene' });
  }

  create(): void {
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
    for (const fighter of this.gameState.entities) {
      const sprite = new FighterSprite(this, fighter);
      this.fighterSprites.set(fighter.id, sprite);
    }

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
    this.debugKey = this.input.keyboard!.addKey('F1');
    this.botSwitchKey = this.input.keyboard!.addKey('F2');
    this.trainingModeKey = this.input.keyboard!.addKey('F3');
    this.resetPositionKey = this.input.keyboard!.addKey('F4');
    this.resetHealthKey = this.input.keyboard!.addKey('F6');
    this.infiniteMeterKey = this.input.keyboard!.addKey('F5');

    // Initialize AI bots - Start with PersonalityBot for better gameplay
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
    this.neuralPolicy = new NeuralPolicy();
    this.botType = 'personality';
    
    // Try to load trained model (async, doesn't block scene)
    this.loadNeuralModel();

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

    // Instructions text
    const instructions = this.add.text(500, 560, 
      'Arrow Keys + Z/X/C/V | F1: Hitboxes | F2: AI | F3: Training | F4: Reset Pos | F5: ∞ Meter | F6: Reset HP', {
      fontSize: '11px',
      color: '#888888',
      align: 'center',
    });
    instructions.setOrigin(0.5, 1);

    // Bot type indicator
    this.botTypeText = this.add.text(500, 580, 
      'AI: Personality Bot (Aggressive)', {
      fontSize: '14px',
      color: '#ffff00',
      align: 'center',
    });
    this.botTypeText.setOrigin(0.5, 1);
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

    // Don't update if round/match is over
    if (this.gameState.isRoundOver || this.gameState.isMatchOver) {
      this.updateUI();
      return;
    }

    // Capture player 1 input
    const player1Input = this.inputHandler.captureInput(this.gameState.frame);

    // Player 2 (AI bot or training dummy)
    const observation = generateObservation(this.gameState, 'player2');
    const player2 = this.gameState.entities.find(e => e.id === 'player2');
    
    let aiAction = AIAction.IDLE;
    
    // Training mode overrides AI
    if (this.gameState.trainingMode?.enabled) {
      const mode = this.gameState.trainingMode.dummyMode;
      
      if (mode === 'idle') {
        aiAction = AIAction.IDLE;
      } else if (mode === 'crouch') {
        aiAction = AIAction.CROUCH;
      } else if (mode === 'jump') {
        aiAction = AIAction.JUMP;
      } else if (mode === 'block') {
        aiAction = AIAction.BLOCK;
      } else if (mode === 'cpu') {
        // Use normal AI
        aiAction = (this.aiBot instanceof RandomBot || this.aiBot instanceof PersonalityBot)
          ? this.aiBot.selectAction(observation, this.gameState.frame)
          : AIAction.IDLE;
      }
    } else {
      // Normal AI
      aiAction = (this.aiBot instanceof RandomBot || this.aiBot instanceof PersonalityBot)
        ? this.aiBot.selectAction(observation, this.gameState.frame)
        : AIAction.IDLE;
    }
    
    const player2Input = actionToInputFrame(
      aiAction,
      player2?.facing || 1,
      this.gameState.frame
    );

    // Create input map
    const inputs = new Map([
      ['player1', player1Input],
      ['player2', player2Input],
    ]);

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
    if (this.gameState.isRoundOver && this.gameState.round.winner) {
      const winnerFighter = this.gameState.entities.find(
        (f) => f.id === this.gameState.round.winner
      );
      if (winnerFighter) {
        this.roundText.setText(
          `Round ${this.gameState.round.roundNumber} - ${winnerFighter.id} wins!`
        );
      }
    }

    // Check for match end
    if (this.gameState.isMatchOver && this.gameState.match.matchWinner) {
      const winnerFighter = this.gameState.entities.find(
        (f) => f.id === this.gameState.match.matchWinner
      );
      if (winnerFighter) {
        this.roundText.setText(`${winnerFighter.id} WINS THE MATCH!`);
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
        sprite.destroy();
        this.projectileSprites.delete(id);
      }
    }

    // Create or update projectile sprites
    for (const projectile of this.gameState.projectiles) {
      let sprite = this.projectileSprites.get(projectile.id);
      
      if (!sprite) {
        // Create new projectile sprite
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
          comboText.setText(`${fighter.comboCount} HIT COMBO!`);
          comboText.setPosition(fighter.position.x, fighter.position.y - 150);
          comboText.setAlpha(1.0);
        } else {
          comboText.setAlpha(0);
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
      // Cycle through dummy modes
      const modes: Array<typeof this.gameState.trainingMode.dummyMode> = 
        ['idle', 'crouch', 'jump', 'block', 'cpu'];
      const currentIndex = modes.indexOf(this.gameState.trainingMode.dummyMode);
      const nextIndex = (currentIndex + 1) % modes.length;
      this.gameState.trainingMode.dummyMode = modes[nextIndex];
      
      console.log(`Training Mode: ${this.gameState.trainingMode.dummyMode}`);
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
   * Update bot type text
   */
  private updateBotTypeText(): void {
    const typeNames = {
      'personality': 'Personality Bot (Aggressive)',
      'defensive': 'Defensive Bot (Zoner)',
      'neural': 'Neural Bot',
      'random': 'Random Bot',
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
    } else if (this.botType === 'defensive') {
      // Switch to neural bot
      this.aiBot = new NeuralBot(this.neuralPolicy, {
        temperature: 1.0,
        actionDuration: 5,
        useGreedy: false,
      });
      this.botType = 'neural';
      this.botTypeText.setText('AI: Neural Bot');
    } else if (this.botType === 'neural') {
      // Switch to random bot
      this.aiBot = new RandomBot();
      this.botType = 'random';
      this.botTypeText.setText('AI: Random Bot');
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
    }
  }

  /**
   * Create particle emitters for hit effects
   */
  private createHitParticles(): void {
    // Create simple circle graphics for particles (no texture needed)
    const graphics = this.add.graphics();
    graphics.fillStyle(0xffffff);
    graphics.fillCircle(2, 2, 2);
    graphics.generateTexture('particle', 4, 4);
    graphics.destroy();
  }

  /**
   * Spawn hit spark effect at position
   */
  private spawnHitSpark(x: number, y: number, wasBlocked: boolean, damage: number): void {
    const color = wasBlocked ? 0x888888 : (damage > 20 ? 0xff8800 : 0xffff00);
    const particleCount = wasBlocked ? 6 : (damage > 20 ? 20 : 12);
    const speed = damage > 20 ? 200 : 100;
    
    // Create temporary emitter
    const emitter = this.add.particles(x, y, 'particle', {
      speed: { min: speed * 0.5, max: speed },
      angle: { min: 0, max: 360 },
      scale: { start: damage > 20 ? 1.5 : 1, end: 0 },
      lifespan: 300,
      gravityY: 200,
      tint: color,
      emitting: false,
    });
    
    emitter.explode(particleCount);
    
    // Clean up after animation
    this.time.delayedCall(500, () => {
      emitter.destroy();
    });
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
   * Attempt to load trained neural model
   * 1. Try IndexedDB (cached from previous session)
   * 2. Try HTTP server (newly trained model)
   * 3. If HTTP succeeds, save to IndexedDB for next time
   */
  private async loadNeuralModel(): Promise<void> {
    const indexedDbPath = 'indexeddb://musashi_v1';
    const httpPath = 'http://localhost:8080/musashi_v1/model.json';

    try {
      // Try loading from IndexedDB first (fastest)
      await this.neuralPolicy.load(indexedDbPath);
      console.log('✓ Loaded trained neural model from IndexedDB');
      this.botTypeText.setText('AI: Random Bot | Neural Model: Loaded (Cached)');
      return;
    } catch (indexedDbError) {
      // IndexedDB failed, try HTTP server
      console.log('⚠ No cached model in IndexedDB, trying HTTP server...');
      
      try {
        // Load from HTTP server (must be running: npm run serve-models)
        await this.neuralPolicy.load(httpPath);
        console.log('✓ Loaded trained neural model from HTTP');
        
        // Save to IndexedDB for next time
        try {
          await this.neuralPolicy.save(indexedDbPath);
          console.log('✓ Cached model to IndexedDB for future sessions');
          this.botTypeText.setText('AI: Random Bot | Neural Model: Loaded (New)');
        } catch (saveError) {
          console.warn('⚠ Failed to cache model to IndexedDB:', saveError);
          this.botTypeText.setText('AI: Random Bot | Neural Model: Loaded (HTTP only)');
        }
        return;
      } catch (httpError) {
        // Both failed - no trained model available
        console.log('⚠ No trained model found');
        console.log('  1. Train a model: npm run train');
        console.log('  2. Serve models: npm run serve-models');
        console.log('  3. Reload this page');
        console.log('  Neural Bot will use random weights until trained model is loaded');
      }
    }
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
    
    this.neuralPolicy.dispose();
  }
}
