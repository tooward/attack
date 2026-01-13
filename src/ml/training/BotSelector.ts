/**
 * Bot Selector - Unified interface for selecting training opponents
 * 
 * Provides easy access to all available bot types:
 * - Legacy scripted bots (Easy/Tight)
 * - Advanced scripted bots (Guardian, Aggressor, Tactician, Wildcard, Tutorial)
 * - Self-play opponents
 * - Neural network opponents
 */

import { ActionBundle } from '../core/Environment';
import { 
  GuardianBot, 
  AggressorBot, 
  TacticianBot, 
  WildcardBot, 
  TutorialBot,
  AdvancedScriptedBot
} from '../../core/ai/scripted';

// Re-export legacy scripted opponents for convenience
export { scriptedOpponentActionEasy, scriptedOpponentActionTight } from '../evaluation/evalRunner';

/**
 * Bot types available for training
 */
export enum BotType {
  // Legacy bots
  LEGACY_EASY = 'legacy-easy',
  LEGACY_TIGHT = 'legacy-tight',
  
  // Advanced scripted bots
  GUARDIAN = 'guardian',      // Defensive/turtle
  AGGRESSOR = 'aggressor',    // Rushdown/pressure
  TACTICIAN = 'tactician',    // Zoner/keepaway
  WILDCARD = 'wildcard',      // Mixup/adaptive
  TUTORIAL = 'tutorial',      // Beginner-friendly
}

/**
 * Bot instance cache to avoid recreating bots every frame
 */
class BotCache {
  private bots: Map<string, AdvancedScriptedBot> = new Map();

  get(type: BotType, difficulty: number): AdvancedScriptedBot {
    const key = `${type}-${difficulty}`;
    
    if (!this.bots.has(key)) {
      this.bots.set(key, this.createBot(type, difficulty));
    }
    
    return this.bots.get(key)!;
  }

  private createBot(type: BotType, difficulty: number): AdvancedScriptedBot {
    switch (type) {
      case BotType.GUARDIAN:
        return new GuardianBot(difficulty);
      case BotType.AGGRESSOR:
        return new AggressorBot(difficulty);
      case BotType.TACTICIAN:
        return new TacticianBot(difficulty);
      case BotType.WILDCARD:
        return new WildcardBot(difficulty);
      case BotType.TUTORIAL:
        return new TutorialBot(difficulty);
      default:
        throw new Error(`Invalid bot type: ${type}`);
    }
  }

  reset(): void {
    for (const bot of this.bots.values()) {
      bot.reset();
    }
  }

  clear(): void {
    this.bots.clear();
  }
}

const botCache = new BotCache();

/**
 * Get bot action using unified interface
 * 
 * @param botType - Type of bot to use
 * @param state - Current game state
 * @param actorId - ID of the bot entity
 * @param targetId - ID of the opponent entity
 * @param difficulty - Bot difficulty level (1-10), default 5
 * @returns Action to perform
 */
export function getBotAction(
  botType: BotType,
  state: any,
  actorId: string,
  targetId: string,
  difficulty: number = 5
): ActionBundle {
  // Legacy bots use old functions
  if (botType === BotType.LEGACY_EASY || botType === BotType.LEGACY_TIGHT) {
    const { scriptedOpponentActionEasy, scriptedOpponentActionTight } = require('../evaluation/evalRunner');
    return botType === BotType.LEGACY_EASY
      ? scriptedOpponentActionEasy(state, actorId, targetId)
      : scriptedOpponentActionTight(state, actorId, targetId);
  }

  // Advanced scripted bots
  const bot = botCache.get(botType, difficulty);
  return bot.decide(state, actorId, targetId);
}

/**
 * Reset all cached bots (call between episodes)
 */
export function resetBotCache(): void {
  botCache.reset();
}

/**
 * Clear bot cache (call when changing bot configuration)
 */
export function clearBotCache(): void {
  botCache.clear();
}

/**
 * Get recommended curriculum progression
 * Maps training steps to appropriate bot types and difficulties
 */
export interface CurriculumStage {
  minStep: number;
  maxStep: number;
  botType: BotType;
  difficulty: number;
  description: string;
}

/**
 * Default training curriculum
 * Progressively harder opponents as training progresses
 */
export const DEFAULT_CURRICULUM: CurriculumStage[] = [
  // Stage 1: Learn basics (0-500k steps)
  {
    minStep: 0,
    maxStep: 500_000,
    botType: BotType.TUTORIAL,
    difficulty: 3,
    description: 'Tutorial bot (diff 3) - Learn basic controls and movement'
  },
  {
    minStep: 500_000,
    maxStep: 1_000_000,
    botType: BotType.TUTORIAL,
    difficulty: 5,
    description: 'Tutorial bot (diff 5) - Practice simple attacks and defense'
  },
  
  // Stage 2: Learn defense (1M-2M steps)
  {
    minStep: 1_000_000,
    maxStep: 1_500_000,
    botType: BotType.GUARDIAN,
    difficulty: 5,
    description: 'Guardian bot (diff 5) - Learn blocking and anti-air'
  },
  {
    minStep: 1_500_000,
    maxStep: 2_000_000,
    botType: BotType.GUARDIAN,
    difficulty: 7,
    description: 'Guardian bot (diff 7) - Master defensive fundamentals'
  },
  
  // Stage 3: Learn offense (2M-4M steps)
  {
    minStep: 2_000_000,
    maxStep: 2_500_000,
    botType: BotType.AGGRESSOR,
    difficulty: 3,
    description: 'Aggressor bot (diff 3) - Learn pressure and mixups'
  },
  {
    minStep: 2_500_000,
    maxStep: 3_000_000,
    botType: BotType.AGGRESSOR,
    difficulty: 5,
    description: 'Aggressor bot (diff 5) - Master offensive pressure'
  },
  {
    minStep: 3_000_000,
    maxStep: 3_500_000,
    botType: BotType.TACTICIAN,
    difficulty: 3,
    description: 'Tactician bot (diff 3) - Learn zoning and spacing'
  },
  {
    minStep: 3_500_000,
    maxStep: 4_000_000,
    botType: BotType.TACTICIAN,
    difficulty: 5,
    description: 'Tactician bot (diff 5) - Master keepaway and projectiles'
  },
  
  // Stage 4: Face adaptive opponent (4M-6M steps)
  {
    minStep: 4_000_000,
    maxStep: 5_000_000,
    botType: BotType.WILDCARD,
    difficulty: 5,
    description: 'Wildcard bot (diff 5) - Face unpredictable adaptive opponent'
  },
  {
    minStep: 5_000_000,
    maxStep: 6_000_000,
    botType: BotType.WILDCARD,
    difficulty: 7,
    description: 'Wildcard bot (diff 7) - Master adaptation'
  },
  
  // Stage 5: Elite opponents (6M+ steps)
  {
    minStep: 6_000_000,
    maxStep: 8_000_000,
    botType: BotType.GUARDIAN,
    difficulty: 8,
    description: 'Guardian bot (diff 8) - Face elite defensive play'
  },
  {
    minStep: 8_000_000,
    maxStep: 10_000_000,
    botType: BotType.AGGRESSOR,
    difficulty: 8,
    description: 'Aggressor bot (diff 8) - Face elite pressure'
  },
  {
    minStep: 10_000_000,
    maxStep: Infinity,
    botType: BotType.WILDCARD,
    difficulty: 10,
    description: 'Wildcard bot (diff 10) - Ultimate challenge'
  },
];

/**
 * Get current curriculum stage for a given training step
 */
export function getCurriculumStage(step: number, curriculum: CurriculumStage[] = DEFAULT_CURRICULUM): CurriculumStage {
  for (const stage of curriculum) {
    if (step >= stage.minStep && step < stage.maxStep) {
      return stage;
    }
  }
  
  // Return last stage if beyond curriculum
  return curriculum[curriculum.length - 1];
}

/**
 * Get bot configuration for current training step
 */
export function getBotForStep(step: number, curriculum: CurriculumStage[] = DEFAULT_CURRICULUM): {
  botType: BotType;
  difficulty: number;
  description: string;
} {
  const stage = getCurriculumStage(step, curriculum);
  return {
    botType: stage.botType,
    difficulty: stage.difficulty,
    description: stage.description,
  };
}

/**
 * Create a bot action function for use in training/evaluation
 */
export function createBotActionFn(
  botType: BotType,
  difficulty: number = 5
): (state: any, actorId: string, targetId: string) => ActionBundle {
  return (state, actorId, targetId) => getBotAction(botType, state, actorId, targetId, difficulty);
}
