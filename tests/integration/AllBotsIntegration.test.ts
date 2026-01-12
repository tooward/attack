/**
 * Integration tests for all advanced scripted bots with training system
 */

import { 
  BotType, 
  getBotAction, 
  getBotForStep, 
  getCurriculumStage,
  DEFAULT_CURRICULUM 
} from '../../src/ml/training/BotSelector';
import { TutorialBot } from '../../src/core/ai/scripted/bots/TutorialBot';
import { AggressorBot } from '../../src/core/ai/scripted/bots/AggressorBot';
import { TacticianBot } from '../../src/core/ai/scripted/bots/TacticianBot';
import { WildcardBot } from '../../src/core/ai/scripted/bots/WildcardBot';
import { GuardianBot } from '../../src/core/ai/scripted/bots/GuardianBot';
import { createMockGameState } from '../helpers/mockState';

describe('All Advanced Bots Integration', () => {
  describe('TutorialBot', () => {
    test('Bot can be instantiated with different difficulties', () => {
      const bot1 = new TutorialBot(1);
      const bot4 = new TutorialBot(4);
      
      expect(bot1).toBeInstanceOf(TutorialBot);
      expect(bot4).toBeInstanceOf(TutorialBot);
    });

    test('Bot has decide() method that returns ActionBundle', () => {
      const bot = new TutorialBot(2);
      const state = createMockGameState();
      
      const action = bot.decide(state, 'player', 'opponent');
      
      expect(action).toHaveProperty('direction');
      expect(action).toHaveProperty('button');
      expect(action).toHaveProperty('holdDuration');
    });

    test('getBotAction works with TutorialBot', () => {
      const state = createMockGameState();
      const action = getBotAction(BotType.TUTORIAL, state, 'player', 'opponent', 2);
      
      expect(action).toHaveProperty('direction');
      expect(action).toHaveProperty('button');
      expect(action).toHaveProperty('holdDuration');
    });

    test('TutorialBot appears in curriculum at 0-1M steps', () => {
      const stage0 = getCurriculumStage(0);
      const stage500k = getCurriculumStage(500_000);
      const stage1M = getCurriculumStage(1_000_000);
      
      expect(stage0?.botType).toBe(BotType.TUTORIAL);
      expect(stage500k?.botType).toBe(BotType.TUTORIAL);
      expect(stage1M?.botType).not.toBe(BotType.TUTORIAL); // Should move to Guardian
    });
  });

  describe('AggressorBot', () => {
    test('Bot can be instantiated with different difficulties', () => {
      const bot4 = new AggressorBot(4);
      const bot6 = new AggressorBot(6);
      
      expect(bot4).toBeInstanceOf(AggressorBot);
      expect(bot6).toBeInstanceOf(AggressorBot);
    });

    test('Bot has decide() method that returns ActionBundle', () => {
      const bot = new AggressorBot(5);
      const state = createMockGameState();
      
      const action = bot.decide(state, 'player', 'opponent');
      
      expect(action).toHaveProperty('direction');
      expect(action).toHaveProperty('button');
      expect(action).toHaveProperty('holdDuration');
    });

    test('getBotAction works with AggressorBot', () => {
      const state = createMockGameState();
      const action = getBotAction(BotType.AGGRESSOR, state, 'player', 'opponent', 5);
      
      expect(action).toHaveProperty('direction');
      expect(action).toHaveProperty('button');
    });

    test('AggressorBot appears in curriculum at 2M-3M steps', () => {
      const stage2M = getCurriculumStage(2_000_000);
      const stage2_5M = getCurriculumStage(2_500_000);
      
      expect(stage2M?.botType).toBe(BotType.AGGRESSOR);
      expect(stage2_5M?.botType).toBe(BotType.AGGRESSOR);
    });
  });

  describe('TacticianBot', () => {
    test('Bot can be instantiated with different difficulties', () => {
      const bot5 = new TacticianBot(5);
      const bot7 = new TacticianBot(7);
      
      expect(bot5).toBeInstanceOf(TacticianBot);
      expect(bot7).toBeInstanceOf(TacticianBot);
    });

    test('Bot has decide() method that returns ActionBundle', () => {
      const bot = new TacticianBot(6);
      const state = createMockGameState();
      
      const action = bot.decide(state, 'player', 'opponent');
      
      expect(action).toHaveProperty('direction');
      expect(action).toHaveProperty('button');
      expect(action).toHaveProperty('holdDuration');
    });

    test('getBotAction works with TacticianBot', () => {
      const state = createMockGameState();
      const action = getBotAction(BotType.TACTICIAN, state, 'player', 'opponent', 6);
      
      expect(action).toHaveProperty('direction');
      expect(action).toHaveProperty('button');
    });

    test('TacticianBot appears in curriculum at 3M-4M steps', () => {
      const stage3M = getCurriculumStage(3_000_000);
      const stage3_5M = getCurriculumStage(3_500_000);
      
      expect(stage3M?.botType).toBe(BotType.TACTICIAN);
      expect(stage3_5M?.botType).toBe(BotType.TACTICIAN);
    });
  });

  describe('WildcardBot', () => {
    test('Bot can be instantiated with different difficulties', () => {
      const bot9 = new WildcardBot(9);
      const bot10 = new WildcardBot(10);
      
      expect(bot9).toBeInstanceOf(WildcardBot);
      expect(bot10).toBeInstanceOf(WildcardBot);
    });

    test('Bot has decide() method that returns ActionBundle', () => {
      const bot = new WildcardBot(9);
      const state = createMockGameState();
      
      const action = bot.decide(state, 'player', 'opponent');
      
      expect(action).toHaveProperty('direction');
      expect(action).toHaveProperty('button');
      expect(action).toHaveProperty('holdDuration');
    });

    test('getBotAction works with WildcardBot', () => {
      const state = createMockGameState();
      const action = getBotAction(BotType.WILDCARD, state, 'player', 'opponent', 9);
      
      expect(action).toHaveProperty('direction');
      expect(action).toHaveProperty('button');
    });

    test('WildcardBot appears in curriculum at 4M-6M and 10M+ steps', () => {
      const stage4M = getCurriculumStage(4_000_000);
      const stage5M = getCurriculumStage(5_000_000);
      const stage10M = getCurriculumStage(10_000_000);
      
      expect(stage4M?.botType).toBe(BotType.WILDCARD);
      expect(stage5M?.botType).toBe(BotType.WILDCARD);
      expect(stage10M?.botType).toBe(BotType.WILDCARD);
    });
  });

  describe('Full Curriculum Coverage', () => {
    test('All curriculum stages have valid bot types', () => {
      DEFAULT_CURRICULUM.forEach(stage => {
        expect(stage.botType).toBeDefined();
        expect(stage.difficulty).toBeGreaterThanOrEqual(1);
        expect(stage.difficulty).toBeLessThanOrEqual(10);
      });
    });

    test('Curriculum progresses through all 5 bots', () => {
      const botTypes = new Set(DEFAULT_CURRICULUM.map(s => s.botType));
      
      expect(botTypes.has(BotType.TUTORIAL)).toBe(true);
      expect(botTypes.has(BotType.GUARDIAN)).toBe(true);
      expect(botTypes.has(BotType.AGGRESSOR)).toBe(true);
      expect(botTypes.has(BotType.TACTICIAN)).toBe(true);
      expect(botTypes.has(BotType.WILDCARD)).toBe(true);
    });

    test('All bots return valid actions for 50 frames', () => {
      const state = createMockGameState();
      const botTypes = [
        BotType.TUTORIAL,
        BotType.GUARDIAN,
        BotType.AGGRESSOR,
        BotType.TACTICIAN,
        BotType.WILDCARD
      ];

      botTypes.forEach(botType => {
        for (let i = 0; i < 50; i++) {
          const action = getBotAction(botType, state, 'player', 'opponent', 5);
          
          expect(['left', 'right', 'neutral', 'forward', 'back', 'down', 'up']).toContain(action.direction);
          expect(['lp', 'hp', 'lk', 'hk', 'block', 'none']).toContain(action.button);
          expect(action.holdDuration).toBeGreaterThanOrEqual(0);
        }
      });
    });

    test('getBotForStep returns correct bot at each major milestone', () => {
      const milestones = [
        { step: 0, expected: BotType.TUTORIAL },
        { step: 500_000, expected: BotType.TUTORIAL },
        { step: 1_000_000, expected: BotType.GUARDIAN },
        { step: 2_000_000, expected: BotType.AGGRESSOR },
        { step: 3_000_000, expected: BotType.TACTICIAN },
        { step: 4_000_000, expected: BotType.WILDCARD },
        { step: 6_000_000, expected: BotType.GUARDIAN }, // Elite Guardian
        { step: 8_000_000, expected: BotType.AGGRESSOR }, // Elite Aggressor
        { step: 10_000_000, expected: BotType.WILDCARD }, // Ultimate Wildcard
      ];

      milestones.forEach(({ step, expected }) => {
        const bot = getBotForStep(step);
        expect(bot.botType).toBe(expected);
      });
    });

    test('Difficulty increases in early curriculum stages', () => {
      const stage1 = getCurriculumStage(0);         // Tutorial diff 1
      const stage2 = getCurriculumStage(500_000);   // Tutorial diff 3
      const stage3 = getCurriculumStage(1_000_000); // Guardian diff 3
      const stage4 = getCurriculumStage(1_500_000); // Guardian diff 5
      const stage5 = getCurriculumStage(2_000_000); // Aggressor diff 3

      expect(stage1!.difficulty).toBeLessThanOrEqual(stage2!.difficulty);
      expect(stage2!.difficulty).toBeLessThanOrEqual(stage3!.difficulty);
      expect(stage3!.difficulty).toBeLessThanOrEqual(stage4!.difficulty);
      // Difficulty may drop when switching bot types
      expect(stage5!.difficulty).toBeGreaterThanOrEqual(1);
    });
  });
});
