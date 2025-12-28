/**
 * Style Configuration
 * 
 * Defines distinct fighting styles for bots with reward modifiers
 * and behavior hints to create diverse playstyles.
 */

/**
 * Fighting style types
 */
export type FightingStyle = 'rushdown' | 'zoner' | 'turtle' | 'mixup';

/**
 * Style metadata
 */
export interface StyleMetadata {
  name: FightingStyle;
  displayName: string;
  description: string;
  color: string;           // Visual identification
  playstyleDescription: string;
}

/**
 * Reward modifiers for a style
 * These get applied during training to shape behavior
 */
export interface StyleRewardModifiers {
  // Combat
  damageDealt: number;       // Multiplier for damage rewards
  damageReceived: number;    // Multiplier for damage penalties
  
  // Positioning
  aggression: number;        // Bonus for moving toward opponent
  defense: number;           // Bonus for blocking/parrying
  spacing: number;           // Bonus for maintaining optimal range
  
  // Actions
  normalAttacks: number;     // Bonus for using normals
  specialMoves: number;      // Bonus for using specials
  throws: number;            // Bonus for using throws
  blocks: number;            // Bonus for blocking
  
  // Strategy
  comboLength: number;       // Bonus for longer combos
  mixupVariety: number;      // Bonus for varying attack patterns
  punishOpportunities: number; // Bonus for whiff punishes
  riskTaking: number;        // Bonus for risky moves
}

/**
 * Behavior hints for a style
 * These guide the policy without hard constraints
 */
export interface StyleBehaviorHints {
  // Range preferences
  preferredRange: 'close' | 'mid' | 'far';
  rangeChangeRate: number;   // 0-1 (how often to change range)
  
  // Aggression
  aggressionBias: number;    // 0-1 (0=defensive, 1=aggressive)
  pressureIntensity: number; // 0-1 (how much to maintain offense)
  
  // Defense
  blockFrequency: number;    // 0-1 (tendency to block)
  parryAttempts: number;     // 0-1 (tendency to attempt parries)
  retreatTendency: number;   // 0-1 (tendency to back away)
  
  // Offense
  throwFrequency: number;    // 0-1 (tendency to throw)
  specialUsage: number;      // 0-1 (tendency to use specials)
  comboDepth: number;        // 0-1 (0=single hits, 1=max combos)
  
  // Pattern
  mixupFrequency: number;    // 0-1 (how often to vary patterns)
  repeatSuccessful: number;  // 0-1 (tendency to repeat what works)
  adaptationRate: number;    // 0-1 (how quickly to adapt to opponent)
}

/**
 * Complete style configuration
 */
export interface StyleConfig {
  metadata: StyleMetadata;
  rewardModifiers: StyleRewardModifiers;
  behaviorHints: StyleBehaviorHints;
}

/**
 * Style configurations for all 4 fighting styles
 */
export const STYLE_CONFIGS: Record<FightingStyle, StyleConfig> = {
  rushdown: {
    metadata: {
      name: 'rushdown',
      displayName: 'Rushdown',
      description: 'Aggressive pressure-heavy fighter',
      color: '#ff4444',
      playstyleDescription: 'Constantly applies pressure, stays close, chains attacks relentlessly',
    },
    rewardModifiers: {
      damageDealt: 1.2,
      damageReceived: 0.9,
      aggression: 1.5,
      defense: 0.5,
      spacing: 0.8,
      normalAttacks: 1.3,
      specialMoves: 1.0,
      throws: 1.4,
      blocks: 0.6,
      comboLength: 1.2,
      mixupVariety: 1.3,
      punishOpportunities: 1.0,
      riskTaking: 1.2,
    },
    behaviorHints: {
      preferredRange: 'close',
      rangeChangeRate: 0.3,
      aggressionBias: 0.9,
      pressureIntensity: 0.9,
      blockFrequency: 0.2,
      parryAttempts: 0.3,
      retreatTendency: 0.1,
      throwFrequency: 0.6,
      specialUsage: 0.5,
      comboDepth: 0.7,
      mixupFrequency: 0.7,
      repeatSuccessful: 0.6,
      adaptationRate: 0.5,
    },
  },
  
  zoner: {
    metadata: {
      name: 'zoner',
      displayName: 'Zoner',
      description: 'Keeps distance with projectiles and pokes',
      color: '#4444ff',
      playstyleDescription: 'Maintains distance, uses projectiles, controls space with long-range attacks',
    },
    rewardModifiers: {
      damageDealt: 1.0,
      damageReceived: 0.7,
      aggression: 0.5,
      defense: 1.2,
      spacing: 1.8,
      normalAttacks: 0.8,
      specialMoves: 1.5,
      throws: 0.4,
      blocks: 1.2,
      comboLength: 0.6,
      mixupVariety: 0.8,
      punishOpportunities: 1.3,
      riskTaking: 0.5,
    },
    behaviorHints: {
      preferredRange: 'far',
      rangeChangeRate: 0.4,
      aggressionBias: 0.3,
      pressureIntensity: 0.2,
      blockFrequency: 0.6,
      parryAttempts: 0.4,
      retreatTendency: 0.7,
      throwFrequency: 0.2,
      specialUsage: 0.8,
      comboDepth: 0.3,
      mixupFrequency: 0.4,
      repeatSuccessful: 0.7,
      adaptationRate: 0.6,
    },
  },
  
  turtle: {
    metadata: {
      name: 'turtle',
      displayName: 'Turtle',
      description: 'Defensive patient counter-attacker',
      color: '#44ff44',
      playstyleDescription: 'Waits patiently, blocks often, punishes mistakes with devastating counters',
    },
    rewardModifiers: {
      damageDealt: 0.9,
      damageReceived: 0.5,
      aggression: 0.4,
      defense: 2.0,
      spacing: 1.3,
      normalAttacks: 0.9,
      specialMoves: 0.8,
      throws: 0.5,
      blocks: 1.8,
      comboLength: 1.0,
      mixupVariety: 0.6,
      punishOpportunities: 1.8,
      riskTaking: 0.3,
    },
    behaviorHints: {
      preferredRange: 'mid',
      rangeChangeRate: 0.2,
      aggressionBias: 0.2,
      pressureIntensity: 0.1,
      blockFrequency: 0.9,
      parryAttempts: 0.7,
      retreatTendency: 0.6,
      throwFrequency: 0.3,
      specialUsage: 0.4,
      comboDepth: 0.6,
      mixupFrequency: 0.3,
      repeatSuccessful: 0.8,
      adaptationRate: 0.7,
    },
  },
  
  mixup: {
    metadata: {
      name: 'mixup',
      displayName: 'Mixup',
      description: 'Unpredictable with varied attack patterns',
      color: '#ff44ff',
      playstyleDescription: 'Constantly changes patterns, hard to predict, uses all tools equally',
    },
    rewardModifiers: {
      damageDealt: 1.1,
      damageReceived: 1.0,
      aggression: 1.0,
      defense: 1.0,
      spacing: 1.0,
      normalAttacks: 1.0,
      specialMoves: 1.1,
      throws: 1.2,
      blocks: 0.9,
      comboLength: 0.9,
      mixupVariety: 2.0,
      punishOpportunities: 1.1,
      riskTaking: 1.1,
    },
    behaviorHints: {
      preferredRange: 'mid',
      rangeChangeRate: 0.7,
      aggressionBias: 0.6,
      pressureIntensity: 0.6,
      blockFrequency: 0.5,
      parryAttempts: 0.5,
      retreatTendency: 0.4,
      throwFrequency: 0.5,
      specialUsage: 0.6,
      comboDepth: 0.5,
      mixupFrequency: 0.9,
      repeatSuccessful: 0.2,
      adaptationRate: 0.8,
    },
  },
};

/**
 * Get style configuration
 */
export function getStyleConfig(style: FightingStyle): StyleConfig {
  return JSON.parse(JSON.stringify(STYLE_CONFIGS[style]));
}

/**
 * Create custom style configuration
 */
export function createCustomStyle(
  base: FightingStyle,
  rewardOverrides?: Partial<StyleRewardModifiers>,
  behaviorOverrides?: Partial<StyleBehaviorHints>
): StyleConfig {
  const config = getStyleConfig(base);
  
  if (rewardOverrides) {
    config.rewardModifiers = { ...config.rewardModifiers, ...rewardOverrides };
  }
  
  if (behaviorOverrides) {
    config.behaviorHints = { ...config.behaviorHints, ...behaviorOverrides };
  }
  
  return config;
}

/**
 * Blend two styles together
 */
export function blendStyles(
  style1: FightingStyle,
  style2: FightingStyle,
  weight: number
): StyleConfig {
  const config1 = STYLE_CONFIGS[style1];
  const config2 = STYLE_CONFIGS[style2];
  
  const lerp = (a: number, b: number) => a + (b - a) * weight;
  
  // Blend reward modifiers
  const rewardModifiers: StyleRewardModifiers = {
    damageDealt: lerp(config1.rewardModifiers.damageDealt, config2.rewardModifiers.damageDealt),
    damageReceived: lerp(config1.rewardModifiers.damageReceived, config2.rewardModifiers.damageReceived),
    aggression: lerp(config1.rewardModifiers.aggression, config2.rewardModifiers.aggression),
    defense: lerp(config1.rewardModifiers.defense, config2.rewardModifiers.defense),
    spacing: lerp(config1.rewardModifiers.spacing, config2.rewardModifiers.spacing),
    normalAttacks: lerp(config1.rewardModifiers.normalAttacks, config2.rewardModifiers.normalAttacks),
    specialMoves: lerp(config1.rewardModifiers.specialMoves, config2.rewardModifiers.specialMoves),
    throws: lerp(config1.rewardModifiers.throws, config2.rewardModifiers.throws),
    blocks: lerp(config1.rewardModifiers.blocks, config2.rewardModifiers.blocks),
    comboLength: lerp(config1.rewardModifiers.comboLength, config2.rewardModifiers.comboLength),
    mixupVariety: lerp(config1.rewardModifiers.mixupVariety, config2.rewardModifiers.mixupVariety),
    punishOpportunities: lerp(config1.rewardModifiers.punishOpportunities, config2.rewardModifiers.punishOpportunities),
    riskTaking: lerp(config1.rewardModifiers.riskTaking, config2.rewardModifiers.riskTaking),
  };
  
  // Blend behavior hints
  const behaviorHints: StyleBehaviorHints = {
    preferredRange: weight < 0.5 ? config1.behaviorHints.preferredRange : config2.behaviorHints.preferredRange,
    rangeChangeRate: lerp(config1.behaviorHints.rangeChangeRate, config2.behaviorHints.rangeChangeRate),
    aggressionBias: lerp(config1.behaviorHints.aggressionBias, config2.behaviorHints.aggressionBias),
    pressureIntensity: lerp(config1.behaviorHints.pressureIntensity, config2.behaviorHints.pressureIntensity),
    blockFrequency: lerp(config1.behaviorHints.blockFrequency, config2.behaviorHints.blockFrequency),
    parryAttempts: lerp(config1.behaviorHints.parryAttempts, config2.behaviorHints.parryAttempts),
    retreatTendency: lerp(config1.behaviorHints.retreatTendency, config2.behaviorHints.retreatTendency),
    throwFrequency: lerp(config1.behaviorHints.throwFrequency, config2.behaviorHints.throwFrequency),
    specialUsage: lerp(config1.behaviorHints.specialUsage, config2.behaviorHints.specialUsage),
    comboDepth: lerp(config1.behaviorHints.comboDepth, config2.behaviorHints.comboDepth),
    mixupFrequency: lerp(config1.behaviorHints.mixupFrequency, config2.behaviorHints.mixupFrequency),
    repeatSuccessful: lerp(config1.behaviorHints.repeatSuccessful, config2.behaviorHints.repeatSuccessful),
    adaptationRate: lerp(config1.behaviorHints.adaptationRate, config2.behaviorHints.adaptationRate),
  };
  
  return {
    metadata: {
      name: 'mixup',
      displayName: `${config1.metadata.displayName}/${config2.metadata.displayName}`,
      description: `Blend of ${style1} and ${style2}`,
      color: '#888888',
      playstyleDescription: `Combines elements of ${style1} and ${style2}`,
    },
    rewardModifiers,
    behaviorHints,
  };
}

/**
 * Get style one-hot encoding
 */
export function getStyleOneHot(style: FightingStyle): number[] {
  const styles: FightingStyle[] = ['rushdown', 'zoner', 'turtle', 'mixup'];
  return styles.map(s => (s === style ? 1.0 : 0.0));
}

/**
 * Get style from one-hot encoding
 */
export function getStyleFromOneHot(oneHot: number[]): FightingStyle {
  const styles: FightingStyle[] = ['rushdown', 'zoner', 'turtle', 'mixup'];
  const index = oneHot.indexOf(Math.max(...oneHot));
  return styles[index];
}

/**
 * Validate style reward modifiers
 */
export function validateRewardModifiers(modifiers: StyleRewardModifiers): string[] {
  const errors: string[] = [];
  
  const checkRange = (value: number, name: string, min: number, max: number) => {
    if (value < min || value > max) {
      errors.push(`${name} must be ${min}-${max}, got ${value}`);
    }
  };
  
  // All modifiers should be 0-3 (reasonable multipliers)
  Object.entries(modifiers).forEach(([key, value]) => {
    checkRange(value, key, 0, 3);
  });
  
  return errors;
}

/**
 * Validate style behavior hints
 */
export function validateBehaviorHints(hints: StyleBehaviorHints): string[] {
  const errors: string[] = [];
  
  const checkRange = (value: number, name: string) => {
    if (value < 0 || value > 1) {
      errors.push(`${name} must be 0-1, got ${value}`);
    }
  };
  
  // Check all numeric hints are 0-1
  checkRange(hints.rangeChangeRate, 'rangeChangeRate');
  checkRange(hints.aggressionBias, 'aggressionBias');
  checkRange(hints.pressureIntensity, 'pressureIntensity');
  checkRange(hints.blockFrequency, 'blockFrequency');
  checkRange(hints.parryAttempts, 'parryAttempts');
  checkRange(hints.retreatTendency, 'retreatTendency');
  checkRange(hints.throwFrequency, 'throwFrequency');
  checkRange(hints.specialUsage, 'specialUsage');
  checkRange(hints.comboDepth, 'comboDepth');
  checkRange(hints.mixupFrequency, 'mixupFrequency');
  checkRange(hints.repeatSuccessful, 'repeatSuccessful');
  checkRange(hints.adaptationRate, 'adaptationRate');
  
  if (!['close', 'mid', 'far'].includes(hints.preferredRange)) {
    errors.push(`preferredRange must be close/mid/far, got ${hints.preferredRange}`);
  }
  
  return errors;
}

/**
 * Format style configuration as string
 */
export function formatStyleConfig(config: StyleConfig): string {
  let output = `=== ${config.metadata.displayName} Style ===\n`;
  output += `${config.metadata.description}\n`;
  output += `${config.metadata.playstyleDescription}\n\n`;
  
  output += 'Reward Modifiers:\n';
  output += `  Damage Dealt: ${config.rewardModifiers.damageDealt.toFixed(1)}x\n`;
  output += `  Aggression: ${config.rewardModifiers.aggression.toFixed(1)}x\n`;
  output += `  Defense: ${config.rewardModifiers.defense.toFixed(1)}x\n`;
  output += `  Mixup Variety: ${config.rewardModifiers.mixupVariety.toFixed(1)}x\n`;
  
  output += '\nBehavior Hints:\n';
  output += `  Preferred Range: ${config.behaviorHints.preferredRange}\n`;
  output += `  Aggression: ${(config.behaviorHints.aggressionBias * 100).toFixed(0)}%\n`;
  output += `  Block Frequency: ${(config.behaviorHints.blockFrequency * 100).toFixed(0)}%\n`;
  output += `  Throw Frequency: ${(config.behaviorHints.throwFrequency * 100).toFixed(0)}%\n`;
  output += `  Mixup Frequency: ${(config.behaviorHints.mixupFrequency * 100).toFixed(0)}%\n`;
  
  return output;
}

/**
 * Get all styles
 */
export function getAllStyles(): FightingStyle[] {
  return ['rushdown', 'zoner', 'turtle', 'mixup'];
}

/**
 * Sample random style
 */
export function sampleRandomStyle(): FightingStyle {
  const styles = getAllStyles();
  return styles[Math.floor(Math.random() * styles.length)];
}
