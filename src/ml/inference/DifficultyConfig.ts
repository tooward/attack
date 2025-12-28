/**
 * Difficulty Configuration
 * 
 * Defines difficulty knobs and level presets (1-10) for fighting game bots.
 * Difficulty is implemented via intentional limitations, not policy quality.
 */

/**
 * Difficulty knobs that control bot behavior
 */
export interface DifficultyKnobs {
  // Reaction time
  reactionDelay: number;         // 0-20 frames delay before observing state
  reactionNoise: number;         // 0-1 (random jitter in reaction time)
  
  // Execution
  executionError: number;        // 0-0.5 (probability of dropping input)
  inputNoise: number;            // 0-1 (probability of wrong input)
  
  // Decision making
  temperature: number;           // 0.5-2.0 (action sampling randomness)
  greedyRate: number;            // 0-1 (probability of using best action)
  
  // Capability
  disableSpecials: boolean;
  disableSupers: boolean;
  disableCancels: boolean;
  disableAdvancedCombos: boolean;
  
  // Knowledge
  reactionToOpponent: number;    // 0-1 (how much to observe opponent state)
  prediction: number;            // 0-1 (anticipate opponent moves)
  
  // Elo targeting
  eloBand: [number, number];     // Expected Elo range for this level
}

/**
 * Difficulty level (1-10)
 */
export type DifficultyLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/**
 * Difficulty level presets
 */
export const DIFFICULTY_PRESETS: Record<DifficultyLevel, DifficultyKnobs> = {
  1: {
    // Beginner - Very easy
    reactionDelay: 20,
    reactionNoise: 0.4,
    executionError: 0.4,
    inputNoise: 0.2,
    temperature: 2.0,
    greedyRate: 0.0,
    disableSpecials: true,
    disableSupers: true,
    disableCancels: true,
    disableAdvancedCombos: true,
    reactionToOpponent: 0.3,
    prediction: 0.0,
    eloBand: [0, 800],
  },
  
  2: {
    // Very Easy
    reactionDelay: 18,
    reactionNoise: 0.35,
    executionError: 0.35,
    inputNoise: 0.15,
    temperature: 1.9,
    greedyRate: 0.05,
    disableSpecials: true,
    disableSupers: true,
    disableCancels: true,
    disableAdvancedCombos: true,
    reactionToOpponent: 0.4,
    prediction: 0.0,
    eloBand: [600, 1000],
  },
  
  3: {
    // Easy
    reactionDelay: 15,
    reactionNoise: 0.3,
    executionError: 0.3,
    inputNoise: 0.1,
    temperature: 1.8,
    greedyRate: 0.1,
    disableSpecials: false,
    disableSupers: true,
    disableCancels: true,
    disableAdvancedCombos: true,
    reactionToOpponent: 0.5,
    prediction: 0.0,
    eloBand: [800, 1200],
  },
  
  4: {
    // Medium-Easy
    reactionDelay: 12,
    reactionNoise: 0.25,
    executionError: 0.25,
    inputNoise: 0.08,
    temperature: 1.5,
    greedyRate: 0.2,
    disableSpecials: false,
    disableSupers: true,
    disableCancels: true,
    disableAdvancedCombos: true,
    reactionToOpponent: 0.6,
    prediction: 0.1,
    eloBand: [1000, 1400],
  },
  
  5: {
    // Medium
    reactionDelay: 10,
    reactionNoise: 0.2,
    executionError: 0.2,
    inputNoise: 0.05,
    temperature: 1.2,
    greedyRate: 0.3,
    disableSpecials: false,
    disableSupers: false,
    disableCancels: false,
    disableAdvancedCombos: true,
    reactionToOpponent: 0.7,
    prediction: 0.2,
    eloBand: [1200, 1600],
  },
  
  6: {
    // Medium-Hard
    reactionDelay: 8,
    reactionNoise: 0.15,
    executionError: 0.15,
    inputNoise: 0.03,
    temperature: 1.0,
    greedyRate: 0.4,
    disableSpecials: false,
    disableSupers: false,
    disableCancels: false,
    disableAdvancedCombos: false,
    reactionToOpponent: 0.8,
    prediction: 0.3,
    eloBand: [1400, 1800],
  },
  
  7: {
    // Hard
    reactionDelay: 5,
    reactionNoise: 0.1,
    executionError: 0.1,
    inputNoise: 0.02,
    temperature: 0.9,
    greedyRate: 0.5,
    disableSpecials: false,
    disableSupers: false,
    disableCancels: false,
    disableAdvancedCombos: false,
    reactionToOpponent: 0.85,
    prediction: 0.3,
    eloBand: [1600, 2000],
  },
  
  8: {
    // Very Hard
    reactionDelay: 3,
    reactionNoise: 0.05,
    executionError: 0.05,
    inputNoise: 0.01,
    temperature: 0.8,
    greedyRate: 0.6,
    disableSpecials: false,
    disableSupers: false,
    disableCancels: false,
    disableAdvancedCombos: false,
    reactionToOpponent: 0.9,
    prediction: 0.4,
    eloBand: [1800, 2200],
  },
  
  9: {
    // Expert
    reactionDelay: 1,
    reactionNoise: 0.02,
    executionError: 0.02,
    inputNoise: 0.005,
    temperature: 0.75,
    greedyRate: 0.65,
    disableSpecials: false,
    disableSupers: false,
    disableCancels: false,
    disableAdvancedCombos: false,
    reactionToOpponent: 0.95,
    prediction: 0.5,
    eloBand: [2000, 2400],
  },
  
  10: {
    // Master
    reactionDelay: 0,
    reactionNoise: 0.0,
    executionError: 0.0,
    inputNoise: 0.0,
    temperature: 0.7,
    greedyRate: 0.7,
    disableSpecials: false,
    disableSupers: false,
    disableCancels: false,
    disableAdvancedCombos: false,
    reactionToOpponent: 1.0,
    prediction: 0.6,
    eloBand: [2200, 3000],
  },
};

/**
 * Get difficulty knobs for a level
 */
export function getDifficultyKnobs(level: DifficultyLevel): DifficultyKnobs {
  return { ...DIFFICULTY_PRESETS[level] };
}

/**
 * Create custom difficulty knobs
 */
export function createCustomDifficulty(
  base: DifficultyLevel,
  overrides: Partial<DifficultyKnobs>
): DifficultyKnobs {
  return {
    ...DIFFICULTY_PRESETS[base],
    ...overrides,
  };
}

/**
 * Interpolate between two difficulty levels
 */
export function interpolateDifficulty(
  level1: DifficultyLevel,
  level2: DifficultyLevel,
  t: number
): DifficultyKnobs {
  const knobs1 = DIFFICULTY_PRESETS[level1];
  const knobs2 = DIFFICULTY_PRESETS[level2];
  
  const lerp = (a: number, b: number) => a + (b - a) * t;
  
  return {
    reactionDelay: Math.round(lerp(knobs1.reactionDelay, knobs2.reactionDelay)),
    reactionNoise: lerp(knobs1.reactionNoise, knobs2.reactionNoise),
    executionError: lerp(knobs1.executionError, knobs2.executionError),
    inputNoise: lerp(knobs1.inputNoise, knobs2.inputNoise),
    temperature: lerp(knobs1.temperature, knobs2.temperature),
    greedyRate: lerp(knobs1.greedyRate, knobs2.greedyRate),
    disableSpecials: t < 0.5 ? knobs1.disableSpecials : knobs2.disableSpecials,
    disableSupers: t < 0.5 ? knobs1.disableSupers : knobs2.disableSupers,
    disableCancels: t < 0.5 ? knobs1.disableCancels : knobs2.disableCancels,
    disableAdvancedCombos: t < 0.5 ? knobs1.disableAdvancedCombos : knobs2.disableAdvancedCombos,
    reactionToOpponent: lerp(knobs1.reactionToOpponent, knobs2.reactionToOpponent),
    prediction: lerp(knobs1.prediction, knobs2.prediction),
    eloBand: [
      Math.round(lerp(knobs1.eloBand[0], knobs2.eloBand[0])),
      Math.round(lerp(knobs1.eloBand[1], knobs2.eloBand[1])),
    ],
  };
}

/**
 * Find appropriate difficulty level for target Elo
 */
export function findDifficultyForElo(targetElo: number): DifficultyLevel {
  for (let level = 1; level <= 10; level++) {
    const knobs = DIFFICULTY_PRESETS[level as DifficultyLevel];
    if (targetElo >= knobs.eloBand[0] && targetElo <= knobs.eloBand[1]) {
      return level as DifficultyLevel;
    }
  }
  
  // Default to closest
  if (targetElo < 800) return 1;
  if (targetElo > 2400) return 10;
  return 5;
}

/**
 * Validate difficulty knobs
 */
export function validateDifficultyKnobs(knobs: DifficultyKnobs): string[] {
  const errors: string[] = [];
  
  if (knobs.reactionDelay < 0 || knobs.reactionDelay > 30) {
    errors.push('reactionDelay must be 0-30 frames');
  }
  
  if (knobs.reactionNoise < 0 || knobs.reactionNoise > 1) {
    errors.push('reactionNoise must be 0-1');
  }
  
  if (knobs.executionError < 0 || knobs.executionError > 0.5) {
    errors.push('executionError must be 0-0.5');
  }
  
  if (knobs.inputNoise < 0 || knobs.inputNoise > 1) {
    errors.push('inputNoise must be 0-1');
  }
  
  if (knobs.temperature < 0.1 || knobs.temperature > 3.0) {
    errors.push('temperature must be 0.1-3.0');
  }
  
  if (knobs.greedyRate < 0 || knobs.greedyRate > 1) {
    errors.push('greedyRate must be 0-1');
  }
  
  if (knobs.reactionToOpponent < 0 || knobs.reactionToOpponent > 1) {
    errors.push('reactionToOpponent must be 0-1');
  }
  
  if (knobs.prediction < 0 || knobs.prediction > 1) {
    errors.push('prediction must be 0-1');
  }
  
  if (knobs.eloBand[0] >= knobs.eloBand[1]) {
    errors.push('eloBand min must be less than max');
  }
  
  return errors;
}

/**
 * Get difficulty description
 */
export function getDifficultyDescription(level: DifficultyLevel): string {
  const descriptions: Record<DifficultyLevel, string> = {
    1: 'Beginner - Very slow reactions, frequent mistakes, basic moves only',
    2: 'Very Easy - Slow reactions, many mistakes, basic moves only',
    3: 'Easy - Moderate reactions, some mistakes, basic combos',
    4: 'Medium-Easy - Decent reactions, occasional mistakes, simple strategies',
    5: 'Medium - Good reactions, few mistakes, solid fundamentals',
    6: 'Medium-Hard - Fast reactions, rare mistakes, advanced combos',
    7: 'Hard - Very fast reactions, minimal mistakes, complex strategies',
    8: 'Very Hard - Near-instant reactions, very few mistakes, optimal punishes',
    9: 'Expert - Instant reactions, almost perfect execution, mind games',
    10: 'Master - Perfect reactions, flawless execution, predictive AI',
  };
  
  return descriptions[level];
}

/**
 * Format difficulty knobs as string
 */
export function formatDifficultyKnobs(knobs: DifficultyKnobs): string {
  let output = '=== Difficulty Configuration ===\n';
  output += `Reaction Delay: ${knobs.reactionDelay} frames\n`;
  output += `Reaction Noise: ${(knobs.reactionNoise * 100).toFixed(0)}%\n`;
  output += `Execution Error: ${(knobs.executionError * 100).toFixed(0)}%\n`;
  output += `Input Noise: ${(knobs.inputNoise * 100).toFixed(0)}%\n`;
  output += `Temperature: ${knobs.temperature.toFixed(2)}\n`;
  output += `Greedy Rate: ${(knobs.greedyRate * 100).toFixed(0)}%\n`;
  output += `\nCapabilities:\n`;
  output += `  Specials: ${knobs.disableSpecials ? 'Disabled' : 'Enabled'}\n`;
  output += `  Supers: ${knobs.disableSupers ? 'Disabled' : 'Enabled'}\n`;
  output += `  Cancels: ${knobs.disableCancels ? 'Disabled' : 'Enabled'}\n`;
  output += `  Advanced Combos: ${knobs.disableAdvancedCombos ? 'Disabled' : 'Enabled'}\n`;
  output += `\nKnowledge:\n`;
  output += `  Reaction to Opponent: ${(knobs.reactionToOpponent * 100).toFixed(0)}%\n`;
  output += `  Prediction: ${(knobs.prediction * 100).toFixed(0)}%\n`;
  output += `\nExpected Elo: ${knobs.eloBand[0]} - ${knobs.eloBand[1]}\n`;
  
  return output;
}
