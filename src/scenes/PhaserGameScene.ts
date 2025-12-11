/**
 * Phaser Game Scene with Core Engine Integration
 * 
 * This scene is a thin wrapper around the core engine.
 * It captures input, calls tick(), and renders the result.
 */

import { Scene } from 'phaser';
import { GameState, CharacterDefinition, InputFrame } from '../core/interfaces/types';
import { createInitialState, tick } from '../core/Game';
import { MUSASHI } from '../core/data/musashi';
import { FighterSprite } from '../phaser/FighterSprite';
import { InputHandler } from '../phaser/InputHandler';
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
  private debugGraphics!: Phaser.GameObjects.Graphics;
  private debugMode: boolean = false;

  // Input
  private inputHandler!: InputHandler;
  private debugKey!: Phaser.Input.Keyboard.Key;
  private botSwitchKey!: Phaser.Input.Keyboard.Key;

  // AI
  private aiBot!: RandomBot | PersonalityBot | NeuralBot;
  private botType: 'random' | 'personality' | 'neural' = 'random';
  private neuralPolicy!: NeuralPolicy;

  // UI Text
  private roundText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private fpsText!: Phaser.GameObjects.Text;
  private botTypeText!: Phaser.GameObjects.Text;

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

    // Create debug graphics
    this.debugGraphics = this.add.graphics();
    this.debugGraphics.setDepth(100);

    // Initialize input
    this.inputHandler = new InputHandler(this);
    this.debugKey = this.input.keyboard!.addKey('F1');
    this.botSwitchKey = this.input.keyboard!.addKey('F2');

    // Initialize AI bots
    this.aiBot = new RandomBot();
    this.neuralPolicy = new NeuralPolicy();
    this.botType = 'random';

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
      'Player 1: Arrow Keys + Z/X/C/V | F1: Toggle Hitboxes | F2: Switch AI Bot', {
      fontSize: '12px',
      color: '#888888',
      align: 'center',
    });
    instructions.setOrigin(0.5, 1);

    // Bot type indicator
    this.botTypeText = this.add.text(500, 580, 
      'AI: Random Bot', {
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

    // Don't update if round/match is over
    if (this.gameState.isRoundOver || this.gameState.isMatchOver) {
      this.updateUI();
      return;
    }

    // Capture player 1 input
    const player1Input = this.inputHandler.captureInput(this.gameState.frame);

    // Player 2 (AI bot) - Note: Neural bot is async, so it's best with non-neural for now
    const observation = generateObservation(this.gameState, 'player2');
    const player2 = this.gameState.entities.find(e => e.id === 'player2');
    
    // Use RandomBot or PersonalityBot for synchronous operation
    const aiAction = (this.aiBot instanceof RandomBot || this.aiBot instanceof PersonalityBot)
      ? this.aiBot.selectAction(observation, this.gameState.frame)
      : AIAction.IDLE; // Neural bot needs async handling
    
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

    // Tick core engine (this is where the magic happens)
    this.gameState = tick(this.gameState, inputs, this.characterDefs);

    // Sync sprites with new state
    for (const fighter of this.gameState.entities) {
      const sprite = this.fighterSprites.get(fighter.id);
      if (sprite) {
        sprite.sync(fighter);
      }
    }

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
  }

  /**
   * Switch between different AI bot types
   */
  private switchBotType(): void {
    if (this.botType === 'random') {
      // Switch to personality bot
      this.aiBot = new PersonalityBot({
        aggression: 0.7,
        riskTolerance: 0.6,
        defenseBias: 0.3,
        spacingTarget: 0.3,
        comboAmbition: 0.7,
        jumpRate: 0.2,
        throwRate: 0.1,
        fireballRate: 0.3,
        antiAirCommitment: 0.6,
        adaptivity: 0.5,
        discipline: 0.7,
        patternAddiction: 0.3,
        tiltThreshold: 0.6,
      });
      this.botType = 'personality';
      this.botTypeText.setText('AI: Personality Bot (Balanced)');
    } else if (this.botType === 'personality') {
      // Switch to neural bot
      this.aiBot = new NeuralBot(this.neuralPolicy, {
        temperature: 1.0,
        actionDuration: 5,
        useGreedy: false,
      });
      this.botType = 'neural';
      this.botTypeText.setText('AI: Neural Bot (Untrained)');
    } else {
      // Switch back to random bot
      this.aiBot = new RandomBot();
      this.botType = 'random';
      this.botTypeText.setText('AI: Random Bot');
    }
  }

  /**
   * Cleanup
   */
  shutdown(): void {
    this.inputHandler.destroy();
    this.fighterSprites.clear();
    this.neuralPolicy.dispose();
  }
}
