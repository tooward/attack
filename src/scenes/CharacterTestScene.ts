/**
 * Character Test Scene
 * Rapid character switching and matchup testing for balance
 */

import Phaser from 'phaser';
import { GameState, FighterState, FighterStatus, InputAction, MotionInputType, MotionButton } from '../core/interfaces/types';
import { createInitialState, tick } from '../core/Game';
import { MUSASHI } from '../core/data/musashi';
import { KAZE } from '../core/data/kaze';
import { TETSUO } from '../core/data/tetsuo';
import { InputHandler } from '../phaser/InputHandler';
import { TouchControlsOverlay } from '../phaser/ui/TouchControlsOverlay';

const CHARACTERS = {
  musashi: MUSASHI,
  kaze: KAZE,
  tetsuo: TETSUO,
};

type CharacterId = keyof typeof CHARACTERS;

export default class CharacterTestScene extends Phaser.Scene {
  private gameState!: GameState;
  private inputHandler!: InputHandler;
  private characterDefs!: Map<string, typeof MUSASHI>;
  
  // Character selection
  private player1Character: CharacterId = 'musashi';
  private player2Character: CharacterId = 'musashi';
  
  // Debug UI
  private debugText!: Phaser.GameObjects.Text;
  private frameDataText!: Phaser.GameObjects.Text;
  private moveListText!: Phaser.GameObjects.Text;
  private matchupText!: Phaser.GameObjects.Text;
  private instructionsText!: Phaser.GameObjects.Text;
  
  // Character switching keys
  private keys: {
    switchP1?: Phaser.Input.Keyboard.Key;
    switchP2?: Phaser.Input.Keyboard.Key;
    reset?: Phaser.Input.Keyboard.Key;
    frameDataToggle?: Phaser.Input.Keyboard.Key;
    controlsToggle?: Phaser.Input.Keyboard.Key;
  } = {};
  
  private showFrameData = false;
  private touchControls?: TouchControlsOverlay;
  private showTouchControls = false;

  constructor() {
    super({ key: 'CharacterTestScene' });
  }

  create() {
    // Initialize character definitions
    this.characterDefs = new Map([
      ['musashi', MUSASHI],
      ['kaze', KAZE],
      ['tetsuo', TETSUO],
    ]);

    // Create game state
    this.gameState = createInitialState({
      entities: [
        {
          id: 'player1',
          characterId: this.player1Character,
          teamId: 0,
          startPosition: { x: 200, y: 400 },
        },
        {
          id: 'player2',
          characterId: this.player2Character,
          teamId: 1,
          startPosition: { x: 600, y: 400 },
        },
      ],
      arena: {
        width: 800,
        height: 600,
        groundLevel: 400,
        leftBound: 50,
        rightBound: 750,
      },
      roundTimeSeconds: 99,
      roundsToWin: 2,
    });

    // Initialize input handler
    this.inputHandler = new InputHandler(this, true);

    // Setup character switching keys
    if (this.input.keyboard) {
      this.keys.switchP1 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
      this.keys.switchP2 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
      this.keys.reset = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
      this.keys.frameDataToggle = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
      this.keys.controlsToggle = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);
    }

    // Create touch controls (hidden by default)
    this.touchControls = new TouchControlsOverlay(this);
    this.touchControls.setVisible(false);
    this.add.existing(this.touchControls);

    // Create background
    this.add.rectangle(400, 300, 800, 600, 0x1a1a2e);
    this.add.rectangle(400, 400, 800, 40, 0x0f0f1e); // Ground

    // Create debug UI
    this.createDebugUI();
    
    // Create fighters
    this.createFighters();
  }

  private createDebugUI() {
    // Instructions
    this.instructionsText = this.add.text(400, 20, '', {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 10, y: 5 },
    }).setOrigin(0.5, 0);
    this.updateInstructions();

    // Matchup display
    this.matchupText = this.add.text(400, 60, '', {
      fontSize: '20px',
      color: '#ffff00',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.updateMatchupText();

    // Debug info
    this.debugText = this.add.text(10, 100, '', {
      fontSize: '12px',
      color: '#00ff00',
      backgroundColor: '#000000aa',
      padding: { x: 5, y: 5 },
    });

    // Frame data display (toggle with F key)
    this.frameDataText = this.add.text(600, 100, '', {
      fontSize: '11px',
      color: '#ffaa00',
      backgroundColor: '#000000aa',
      padding: { x: 5, y: 5 },
    });
    this.frameDataText.setVisible(this.showFrameData);

    // Move list (always visible)
    this.moveListText = this.add.text(600, 100, '', {
      fontSize: '12px',
      color: '#00ffff',
      backgroundColor: '#000000cc',
      padding: { x: 8, y: 8 },
    });
    this.updateMoveList();
  }

  private updateInstructions() {
    const text = [
      'CHARACTER TEST SCENE',
      '1: P1 Char | 2: P2 Char | R: Reset | F: Frame Data | C: On-Screen Controls',
      'Keyboard: WASD/Arrows + JKUI (Punch/Kick) | See move list on right →',
    ].join('\n');
    this.instructionsText.setText(text);
  }

  private updateMatchupText() {
    const p1Name = this.player1Character.toUpperCase();
    const p2Name = this.player2Character.toUpperCase();
    this.matchupText.setText(`${p1Name} vs ${p2Name}`);
  }

  private createFighters() {
    // Clear existing fighters
    this.children.list
      .filter(child => child.getData('isFighter'))
      .forEach(child => child.destroy());

    const p1 = this.gameState.entities[0];
    const p2 = this.gameState.entities[1];

    // Player 1 (left)
    const p1Sprite = this.add.rectangle(p1.position.x, p1.position.y, 60, 80, 0x4444ff);
    p1Sprite.setData('isFighter', true);
    p1Sprite.setData('fighterId', 'player1');
    
    const p1Label = this.add.text(p1.position.x, p1.position.y - 60, p1.characterId.toUpperCase(), {
      fontSize: '14px',
      color: '#4444ff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    p1Label.setData('isFighter', true);

    // Player 2 (right)
    const p2Sprite = this.add.rectangle(p2.position.x, p2.position.y, 60, 80, 0xff4444);
    p2Sprite.setData('isFighter', true);
    p2Sprite.setData('fighterId', 'player2');
    
    const p2Label = this.add.text(p2.position.x, p2.position.y - 60, p2.characterId.toUpperCase(), {
      fontSize: '14px',
      color: '#ff4444',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    p2Label.setData('isFighter', true);
  }

  private cycleCharacter(current: CharacterId): CharacterId {
    const chars: CharacterId[] = ['musashi', 'kaze', 'tetsuo'];
    const currentIndex = chars.indexOf(current);
    return chars[(currentIndex + 1) % chars.length];
  }

  private switchPlayer1Character() {
    this.player1Character = this.cycleCharacter(this.player1Character);
    this.resetMatch();
  }

  private switchPlayer2Character() {
    this.player2Character = this.cycleCharacter(this.player2Character);
    this.resetMatch();
  }

  private resetMatch() {
    this.gameState = createInitialState({
      entities: [
        {
          id: 'player1',
          characterId: this.player1Character,
          teamId: 0,
          startPosition: { x: 200, y: 400 },
        },
        {
          id: 'player2',
          characterId: this.player2Character,
          teamId: 1,
          startPosition: { x: 600, y: 400 },
        },
      ],
      arena: this.gameState.arena,
      roundTimeSeconds: 99,
      roundsToWin: 2,
    });

    this.updateMatchupText();
    this.updateMoveList();
    this.createFighters();
  }

  update(time: number, delta: number) {
    // Handle character switching
    if (Phaser.Input.Keyboard.JustDown(this.keys.switchP1!)) {
      this.switchPlayer1Character();
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.switchP2!)) {
      this.switchPlayer2Character();
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.reset!)) {
      this.resetMatch();
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.frameDataToggle!)) {
      this.showFrameData = !this.showFrameData;
      this.frameDataText.setVisible(this.showFrameData);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.controlsToggle!)) {
      this.showTouchControls = !this.showTouchControls;
      this.touchControls?.setVisible(this.showTouchControls);
    }

    // Capture input
    const input = this.inputHandler.captureInput(this.gameState.frame);

    // Update game state
    const inputs = new Map([['player1', input]]);
    this.gameState = tick(this.gameState, inputs, this.characterDefs);

    // Update visuals
    this.updateFighterPositions();
    this.updateDebugText();
    if (this.showFrameData) {
      this.updateFrameDataText();
    }
  }

  private updateFighterPositions() {
    const p1 = this.gameState.entities[0];
    const p2 = this.gameState.entities[1];

    // Update sprites
    this.children.list.forEach(child => {
      if (child.getData('isFighter')) {
        const fighterId = child.getData('fighterId');
        if (fighterId === 'player1' && child instanceof Phaser.GameObjects.Rectangle) {
          child.setPosition(p1.position.x, p1.position.y);
        } else if (fighterId === 'player2' && child instanceof Phaser.GameObjects.Rectangle) {
          child.setPosition(p2.position.x, p2.position.y);
        }
      }
    });

    // Update labels
    this.children.list.forEach(child => {
      if (child instanceof Phaser.GameObjects.Text && child.getData('isFighter')) {
        const text = child.text.toLowerCase();
        if (text === this.player1Character.toUpperCase()) {
          child.setPosition(p1.position.x, p1.position.y - 60);
        } else if (text === this.player2Character.toUpperCase()) {
          child.setPosition(p2.position.x, p2.position.y - 60);
        }
      }
    });
  }

  private updateDebugText() {
    const p1 = this.gameState.entities[0];
    const p2 = this.gameState.entities[1];
    const p1Char = this.characterDefs.get(p1.characterId)!;
    const p2Char = this.characterDefs.get(p2.characterId)!;

    const lines = [
      `Frame: ${this.gameState.frame}`,
      '',
      '=== PLAYER 1 ===',
      `Character: ${p1.characterId.toUpperCase()}`,
      `Health: ${p1.health}/${p1.maxHealth}`,
      `Status: ${p1.status}`,
      `Position: (${Math.round(p1.position.x)}, ${Math.round(p1.position.y)})`,
      `Velocity: (${p1.velocity.x.toFixed(1)}, ${p1.velocity.y.toFixed(1)})`,
      `Facing: ${p1.facing > 0 ? 'Right' : 'Left'}`,
      `Grounded: ${p1.isGrounded}`,
      p1.currentMove ? `Move: ${p1.currentMove} (${p1.moveFrame}f)` : '',
      p1.activeSpecialMove ? `Special: ${p1.activeSpecialMove} (${p1.specialMoveFrame}f)` : '',
      p1.invincibilityState ? `Invincible: ${p1.invincibilityState.type}` : '',
      p1.armorState ? `Armor: ${p1.armorState.hitsRemaining} hits` : '',
      '',
      '=== PLAYER 2 ===',
      `Character: ${p2.characterId.toUpperCase()}`,
      `Health: ${p2.health}/${p2.maxHealth}`,
      `Status: ${p2.status}`,
    ].filter(Boolean);

    this.debugText.setText(lines.join('\n'));
  }

  private updateFrameDataText() {
    const p1 = this.gameState.entities[0];
    const p1Char = this.characterDefs.get(p1.characterId)!;

    const lines = [
      '=== DETAILED FRAME DATA ===',
      '(Format: Startup/Active/Recovery)',
      '',
    ];

    p1Char.specialMoves?.forEach(move => {
      lines.push(`${move.name}:`);
      const light = move.variants.light;
      const heavy = move.variants.heavy;
      lines.push(`  Light: ${light.startupFrames}f/${light.activeFrames}f/${light.recoveryFrames}f`);
      lines.push(`  Heavy: ${heavy.startupFrames}f/${heavy.activeFrames}f/${heavy.recoveryFrames}f`);
      lines.push(`  Damage: ${light.damage} / ${heavy.damage}`);
      lines.push(`  Block Adv: ${light.blockAdvantage > 0 ? '+' : ''}${light.blockAdvantage} / ${heavy.blockAdvantage > 0 ? '+' : ''}${heavy.blockAdvantage}`);
      
      if (light.invincibility && light.invincibility.length > 0) {
        const inv = light.invincibility[0];
        lines.push(`  Invincibility: ${inv.start}-${inv.end}f (${inv.type})`);
      }
      
      if (light.armor) {
        lines.push(`  Armor: ${light.armor.hits} hits, ${(light.armor.damageReduction * 100).toFixed(0)}% reduction`);
      }

      if (light.isCommandGrab) {
        lines.push(`  Command Grab: ${(light.grabRange || 1.0)}x range`);
      }
      lines.push('');
    });

    this.frameDataText.setText(lines.join('\n'));
  }

  private updateMoveList() {
    const p1 = this.gameState.entities[0];
    const p1Char = this.characterDefs.get(p1.characterId)!;

    const lines = [
      `=== ${p1.characterId.toUpperCase()} MOVELIST ===`,
      '',
      'KEYBOARD CONTROLS:',
      'Move: WASD or Arrow Keys',
      'Light Punch: J | Heavy Punch: U',
      'Light Kick: K | Heavy Kick: I',
      'Block: Hold Back',
      '',
      'SPECIAL MOVES:',
    ];

    // Helper to get motion notation
    const getMotionNotation = (motion: MotionInputType): string => {
      switch (motion) {
        case MotionInputType.QUARTER_CIRCLE_FORWARD: return '↓↘→';
        case MotionInputType.QUARTER_CIRCLE_BACK: return '↓↙←';
        case MotionInputType.DRAGON_PUNCH: return '→↓↘';
        case MotionInputType.HALF_CIRCLE_FORWARD: return '←↙↓↘→';
        case MotionInputType.HALF_CIRCLE_BACK: return '→↘↓↙←';
        case MotionInputType.FULL_CIRCLE: return '⭕360°';
        case MotionInputType.CHARGE_DOWN_UP: return '↓(hold)↑';
        case MotionInputType.CHARGE_BACK_FORWARD: return '←(hold)→';
        case MotionInputType.DOUBLE_TAP_BACK: return '←←';
        case MotionInputType.DOUBLE_TAP_FORWARD: return '→→';
        default: return '?';
      }
    };

    const getButtonName = (button: MotionButton): string => {
      switch (button) {
        case MotionButton.PUNCH: return 'P (J/U)';
        case MotionButton.KICK: return 'K (K/I)';
        case MotionButton.ANY: return 'Any';
        default: return '?';
      }
    };

    p1Char.specialMoves?.forEach(move => {
      const motion = getMotionNotation(move.input.motion);
      const button = getButtonName(move.input.button);
      const light = move.variants.light;
      const heavy = move.variants.heavy;
      
      lines.push(`${move.name}`);
      lines.push(`  Input: ${motion} + ${button}`);
      lines.push(`  Light: ${light.damage} dmg, ${light.startupFrames}f startup`);
      lines.push(`  Heavy: ${heavy.damage} dmg, ${heavy.startupFrames}f startup`);
      
      // Special properties
      if (light.projectile) {
        lines.push(`  • Projectile`);
      }
      if (light.invincibility && light.invincibility.length > 0) {
        lines.push(`  • Invincible (${light.invincibility[0].type})`);
      }
      if (light.armor) {
        lines.push(`  • Armor (${light.armor.hits} hits)`);
      }
      if (light.isCommandGrab) {
        lines.push(`  • Command Grab (Unblockable)`);
      }
      lines.push('');
    });

    this.moveListText.setText(lines.join('\n'));
  }
}
