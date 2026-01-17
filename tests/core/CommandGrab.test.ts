/**
 * Unit tests for Command Grab system
 */

import { SpecialMoveExecutor } from '../../src/core/special/SpecialMoveExecutor';
import {
  FighterState,
  FighterStatus,
  GameState,
  CharacterDefinition,
  SpecialMoveDefinition,
  MotionInputType,
  MotionButton,
} from '../../src/core/interfaces/types';
import { mockFighter, mockGameState } from '../helpers/mockData';

describe('Command Grab System', () => {
  let attacker: FighterState;
  let defender: FighterState;
  let gameState: GameState;
  let characterDef: CharacterDefinition;
  let commandGrabMove: SpecialMoveDefinition;

  beforeEach(() => {
    // Create mock fighters
    attacker = mockFighter('attacker', 300);
    defender = mockFighter('defender', 360); // 60 pixels away (within range)

    // Set different teams
    attacker.teamId = 0;
    defender.teamId = 1;

    // Both grounded
    attacker.isGrounded = true;
    defender.isGrounded = true;

    // Set up command grab special move
    commandGrabMove = {
      id: 'spinning_piledriver',
      name: 'Spinning Piledriver',
      input: {
        motion: MotionInputType.FULL_CIRCLE,
        button: MotionButton.PUNCH,
      },
      variants: {
        light: {
          damage: 25,
          startupFrames: 5,
          activeFrames: 3,
          recoveryFrames: 18,
          blockAdvantage: 0,
          hitAdvantage: 30,
          isCommandGrab: true,
          grabRange: 1.2, // 72 pixels
        },
        heavy: {
          damage: 35,
          startupFrames: 3,
          activeFrames: 3,
          recoveryFrames: 20,
          blockAdvantage: 0,
          hitAdvantage: 35,
          isCommandGrab: true,
          grabRange: 1.5, // 90 pixels
        },
      },
    };

    characterDef = {
      id: 'tetsuo',
      name: 'Tetsuo',
      moves: new Map(),
      specialMoves: [commandGrabMove],
    } as any;

    gameState = mockGameState();
    gameState.entities = [attacker, defender];
  });

  describe('checkCommandGrab', () => {
    it('should successfully grab opponent within range', () => {
      attacker.activeSpecialMove = 'spinning_piledriver';
      attacker.specialMoveFrame = 5; // Active frame
      attacker.currentMove = 'spinning_piledriver_light';

      const grabbed = SpecialMoveExecutor.checkCommandGrab(
        attacker,
        defender,
        commandGrabMove,
        'light',
        gameState
      );

      expect(grabbed).toBe(true);
      expect(defender.status).toBe(FighterStatus.HITSTUN);
      expect(defender.health).toBeLessThan(1000); // Took damage
    });

    it('should fail to grab opponent outside range', () => {
      defender.position.x = 500; // 200 pixels away
      attacker.activeSpecialMove = 'spinning_piledriver';
      attacker.specialMoveFrame = 5;
      attacker.currentMove = 'spinning_piledriver_light';

      const grabbed = SpecialMoveExecutor.checkCommandGrab(
        attacker,
        defender,
        commandGrabMove,
        'light',
        gameState
      );

      expect(grabbed).toBe(false);
      expect(defender.status).toBe(FighterStatus.IDLE);
      expect(defender.health).toBe(1000); // No damage
    });

    it('should grab with extended heavy range', () => {
      defender.position.x = 380; // 80 pixels away
      attacker.activeSpecialMove = 'spinning_piledriver';
      attacker.specialMoveFrame = 3;
      attacker.currentMove = 'spinning_piledriver_heavy';

      const grabbed = SpecialMoveExecutor.checkCommandGrab(
        attacker,
        defender,
        commandGrabMove,
        'heavy',
        gameState
      );

      expect(grabbed).toBe(true);
      expect(defender.health).toBe(1000 - 35); // Heavy damage
    });

    it('should not grab airborne opponents', () => {
      defender.isGrounded = false;
      attacker.activeSpecialMove = 'spinning_piledriver';
      attacker.specialMoveFrame = 5;
      attacker.currentMove = 'spinning_piledriver_light';

      const grabbed = SpecialMoveExecutor.checkCommandGrab(
        attacker,
        defender,
        commandGrabMove,
        'light',
        gameState
      );

      expect(grabbed).toBe(false);
    });

    it('should not grab invincible opponents', () => {
      defender.invincibilityState = {
        type: 'full',
        startFrame: 0,
        endFrame: 10,
      };
      attacker.activeSpecialMove = 'spinning_piledriver';
      attacker.specialMoveFrame = 5;
      attacker.currentMove = 'spinning_piledriver_light';

      const grabbed = SpecialMoveExecutor.checkCommandGrab(
        attacker,
        defender,
        commandGrabMove,
        'light',
        gameState
      );

      expect(grabbed).toBe(false);
    });

    it('should not grab already grabbed opponents', () => {
      defender.status = FighterStatus.HITSTUN;
      defender.currentMove = 'throw';
      attacker.activeSpecialMove = 'spinning_piledriver';
      attacker.specialMoveFrame = 5;
      attacker.currentMove = 'spinning_piledriver_light';

      const grabbed = SpecialMoveExecutor.checkCommandGrab(
        attacker,
        defender,
        commandGrabMove,
        'light',
        gameState
      );

      expect(grabbed).toBe(false);
    });

    it('should not grab opponents executing special moves', () => {
      defender.activeSpecialMove = 'shoryuken';
      attacker.activeSpecialMove = 'spinning_piledriver';
      attacker.specialMoveFrame = 5;
      attacker.currentMove = 'spinning_piledriver_light';

      const grabbed = SpecialMoveExecutor.checkCommandGrab(
        attacker,
        defender,
        commandGrabMove,
        'light',
        gameState
      );

      expect(grabbed).toBe(false);
    });

    it('should apply knockback to grabbed opponent', () => {
      attacker.facing = 1;
      attacker.activeSpecialMove = 'spinning_piledriver';
      attacker.specialMoveFrame = 5;
      attacker.currentMove = 'spinning_piledriver_light';

      const initialVelocity = { ...defender.velocity };

      SpecialMoveExecutor.checkCommandGrab(
        attacker,
        defender,
        commandGrabMove,
        'light',
        gameState
      );

      expect(defender.velocity.x).toBeGreaterThan(initialVelocity.x);
      expect(defender.velocity.y).toBeLessThan(0); // Launched upward
    });

    it('should pull defender toward attacker', () => {
      attacker.position.x = 300;
      attacker.facing = 1;
      defender.position.x = 360;
      attacker.activeSpecialMove = 'spinning_piledriver';
      attacker.specialMoveFrame = 5;
      attacker.currentMove = 'spinning_piledriver_light';

      SpecialMoveExecutor.checkCommandGrab(
        attacker,
        defender,
        commandGrabMove,
        'light',
        gameState
      );

      // Defender should be pulled closer to attacker
      expect(defender.position.x).toBeCloseTo(320, 0); // 300 + 20
    });

    it('should increment attacker combo count', () => {
      attacker.activeSpecialMove = 'spinning_piledriver';
      attacker.specialMoveFrame = 5;
      attacker.currentMove = 'spinning_piledriver_light';
      attacker.comboCount = 0;

      SpecialMoveExecutor.checkCommandGrab(
        attacker,
        defender,
        commandGrabMove,
        'light',
        gameState
      );

      expect(attacker.comboCount).toBe(1);
    });

    it('should reset defender combo count', () => {
      defender.comboCount = 5;
      attacker.activeSpecialMove = 'spinning_piledriver';
      attacker.specialMoveFrame = 5;
      attacker.currentMove = 'spinning_piledriver_light';

      SpecialMoveExecutor.checkCommandGrab(
        attacker,
        defender,
        commandGrabMove,
        'light',
        gameState
      );

      expect(defender.comboCount).toBe(0);
    });

    it('should not process non-command-grab moves', () => {
      const regularMove: SpecialMoveDefinition = {
        id: 'hadoken',
        name: 'Hadoken',
        input: {
          motion: MotionInputType.QUARTER_CIRCLE_FORWARD,
          button: MotionButton.PUNCH,
        },
        variants: {
          light: {
            damage: 8,
            startupFrames: 15,
            activeFrames: 3,
            recoveryFrames: 12,
            blockAdvantage: 4,
            hitAdvantage: 12,
          },
          heavy: {
            damage: 15,
            startupFrames: 22,
            activeFrames: 3,
            recoveryFrames: 15,
            blockAdvantage: 0,
            hitAdvantage: 8,
          },
        },
      };

      attacker.activeSpecialMove = 'hadoken';
      attacker.specialMoveFrame = 15;
      attacker.currentMove = 'hadoken_light';

      const grabbed = SpecialMoveExecutor.checkCommandGrab(
        attacker,
        defender,
        regularMove,
        'light',
        gameState
      );

      expect(grabbed).toBe(false);
    });
  });

  describe('processCommandGrabs', () => {
    it('should check all active command grabs in game state', () => {
      const characterDefs = new Map<string, CharacterDefinition>([
        ['tetsuo', characterDef],
      ]);

      attacker.characterId = 'tetsuo';
      attacker.activeSpecialMove = 'spinning_piledriver';
      attacker.specialMoveFrame = 5; // Active frame
      attacker.currentMove = 'spinning_piledriver_light';
      gameState.entities = [attacker, defender];

      SpecialMoveExecutor.processCommandGrabs(gameState, characterDefs);

      expect(defender.status).toBe(FighterStatus.HITSTUN);
      expect(defender.health).toBeLessThan(1000);
    });

    it('should not process during startup frames', () => {
      const characterDefs = new Map<string, CharacterDefinition>([
        ['tetsuo', characterDef],
      ]);

      attacker.characterId = 'tetsuo';
      attacker.activeSpecialMove = 'spinning_piledriver';
      attacker.specialMoveFrame = 2; // Before active (startup = 5)
      attacker.currentMove = 'spinning_piledriver_light';
      gameState.entities = [attacker, defender];

      SpecialMoveExecutor.processCommandGrabs(gameState, characterDefs);

      expect(defender.status).toBe(FighterStatus.IDLE);
      expect(defender.health).toBe(1000);
    });

    it('should not process after active frames', () => {
      const characterDefs = new Map<string, CharacterDefinition>([
        ['tetsuo', characterDef],
      ]);

      attacker.characterId = 'tetsuo';
      attacker.activeSpecialMove = 'spinning_piledriver';
      attacker.specialMoveFrame = 10; // After active (startup + active = 8)
      attacker.currentMove = 'spinning_piledriver_light';
      gameState.entities = [attacker, defender];

      SpecialMoveExecutor.processCommandGrabs(gameState, characterDefs);

      expect(defender.status).toBe(FighterStatus.IDLE);
      expect(defender.health).toBe(1000);
    });

    it('should only grab one opponent per execution', () => {
      const defender2 = mockFighter('defender2', 365);
      defender2.isGrounded = true;
      defender2.teamId = 1; // Different team from attacker
      const characterDefs = new Map<string, CharacterDefinition>([
        ['tetsuo', characterDef],
      ]);

      attacker.characterId = 'tetsuo';
      attacker.activeSpecialMove = 'spinning_piledriver';
      attacker.specialMoveFrame = 5;
      attacker.currentMove = 'spinning_piledriver_light';
      gameState.entities = [attacker, defender, defender2];

      SpecialMoveExecutor.processCommandGrabs(gameState, characterDefs);

      // Only one should be grabbed
      const grabbedCount = [defender, defender2].filter(
        (f) => f.status === FighterStatus.HITSTUN
      ).length;
      expect(grabbedCount).toBe(1);
    });
  });
});
