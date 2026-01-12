/**
 * Integration test for GuardianBot with training system
 */

import { GuardianBot } from '../../src/core/ai/scripted/bots/GuardianBot';
import { createMockGameState } from '../helpers/mockState';

describe('GuardianBot Integration', () => {
  test('Bot can be instantiated with different difficulties', () => {
    const bot1 = new GuardianBot(1);
    const bot5 = new GuardianBot(5);
    const bot10 = new GuardianBot(10);
    
    expect(bot1).toBeInstanceOf(GuardianBot);
    expect(bot5).toBeInstanceOf(GuardianBot);
    expect(bot10).toBeInstanceOf(GuardianBot);
  });

  test('Bot has decide() method that returns ActionBundle', () => {
    const bot = new GuardianBot(5);
    const state = createMockGameState();
    
    const action = bot.decide(state, 'player', 'opponent');
    
    expect(action).toHaveProperty('direction');
    expect(action).toHaveProperty('button');
    expect(action).toHaveProperty('holdDuration');
    expect(typeof action.direction).toBe('string');
    expect(typeof action.button).toBe('string');
    expect(typeof action.holdDuration).toBe('number');
  });

  test('Bot difficulty scales block probability', () => {
    const easyBot = new GuardianBot(1);
    const hardBot = new GuardianBot(10);
    
    const easyStats = easyBot.getStats();
    const hardStats = hardBot.getStats();
    
    expect(easyStats.blockProbability!).toBeLessThan(hardStats.blockProbability!);
    expect(easyStats.blockProbability).toBeGreaterThan(0.4);
    expect(hardStats.blockProbability).toBeGreaterThan(0.6);
  });

  test('Bot difficulty scales anti-air accuracy', () => {
    const easyBot = new GuardianBot(1);
    const hardBot = new GuardianBot(10);
    
    const easyStats = easyBot.getStats();
    const hardStats = hardBot.getStats();
    
    expect(easyStats.antiAirAccuracy!).toBeLessThan(hardStats.antiAirAccuracy!);
    expect(easyStats.antiAirAccuracy).toBeGreaterThan(0.4);
    expect(hardStats.antiAirAccuracy).toBeGreaterThan(0.6);
  });

  test('Bot returns valid action directions', () => {
    const bot = new GuardianBot(5);
    const state = createMockGameState();
    
    for (let i = 0; i < 20; i++) {
      const action = bot.decide(state, 'player', 'opponent');
      expect(['left', 'right', 'neutral', 'forward', 'back']).toContain(action.direction);
    }
  });

  test('Bot returns valid action buttons', () => {
    const bot = new GuardianBot(5);
    const state = createMockGameState();
    
    for (let i = 0; i < 20; i++) {
      const action = bot.decide(state, 'player', 'opponent');
      expect(['lp', 'hp', 'lk', 'hk', 'block', 'none']).toContain(action.button);
    }
  });

  test('Bot getStats returns expected properties', () => {
    const bot = new GuardianBot(7);
    const stats = bot.getStats();
    
    expect(stats).toHaveProperty('name');
    expect(stats).toHaveProperty('difficulty');
    expect(stats).toHaveProperty('blockProbability');
    expect(stats).toHaveProperty('antiAirAccuracy');
    expect(stats).toHaveProperty('consecutiveBlocks');
    expect(stats.name).toBe('GuardianBot');
    expect(stats.difficulty).toBe(7);
  });
});
