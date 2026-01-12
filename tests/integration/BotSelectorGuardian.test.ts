/**
 * Test BotSelector GuardianBot integration
 */

import { BotType, getBotAction, getBotForStep, getCurriculumStage } from '../../src/ml/training/BotSelector';
import { createMockGameState } from '../helpers/mockState';

describe('BotSelector GuardianBot Integration', () => {
  test('getBotAction works with GuardianBot', () => {
    const state = createMockGameState();
    const action = getBotAction(BotType.GUARDIAN, state, 'player', 'opponent', 5);
    
    expect(action).toHaveProperty('direction');
    expect(action).toHaveProperty('button');
    expect(action).toHaveProperty('holdDuration');
  });

  test('GuardianBot appears in curriculum at 1M-2M steps', () => {
    const stage1M = getCurriculumStage(1_000_000);
    const stage1_5M = getCurriculumStage(1_500_000);
    const stage2M = getCurriculumStage(2_000_000);
    
    expect(stage1M?.botType).toBe(BotType.GUARDIAN);
    expect(stage1_5M?.botType).toBe(BotType.GUARDIAN);
    expect(stage2M?.botType).not.toBe(BotType.GUARDIAN); // Should move to Aggressor
  });

  test('GuardianBot difficulty scales with training progress', () => {
    const stage1M = getCurriculumStage(1_000_000);
    const stage1_5M = getCurriculumStage(1_500_000);
    
    expect(stage1M?.difficulty).toBe(3);
    expect(stage1_5M?.difficulty).toBeGreaterThan(3);
  });

  test('getBotForStep returns GuardianBot at correct steps', () => {
    const bot1M = getBotForStep(1_000_000);
    const bot1_5M = getBotForStep(1_500_000);
    
    expect(bot1M.botType).toBe(BotType.GUARDIAN);
    expect(bot1_5M.botType).toBe(BotType.GUARDIAN);
  });

  test('GuardianBot returns valid actions for multiple frames', () => {
    const state = createMockGameState();
    
    for (let i = 0; i < 50; i++) {
      const action = getBotAction(BotType.GUARDIAN, state, 'player', 'opponent', 5);
      
      expect(['left', 'right', 'neutral', 'forward', 'back']).toContain(action.direction);
      expect(['lp', 'hp', 'lk', 'hk', 'block', 'none']).toContain(action.button);
      expect(action.holdDuration).toBeGreaterThanOrEqual(0);
    }
  });
});
