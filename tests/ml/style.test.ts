/**
 * Style Configuration Tests
 */

import {
  FightingStyle,
  STYLE_CONFIGS,
  getStyleConfig,
  createCustomStyle,
  blendStyles,
  getStyleOneHot,
  getStyleFromOneHot,
  validateRewardModifiers,
  validateBehaviorHints,
  formatStyleConfig,
  getAllStyles,
  sampleRandomStyle,
} from '../../src/ml/inference/StyleConfig';

describe('StyleConfig', () => {
  describe('STYLE_CONFIGS', () => {
    it('should have all 4 fighting styles', () => {
      const styles: FightingStyle[] = ['rushdown', 'zoner', 'turtle', 'mixup'];
      styles.forEach(style => {
        expect(STYLE_CONFIGS[style]).toBeDefined();
      });
    });

    it('should have valid metadata for all styles', () => {
      Object.values(STYLE_CONFIGS).forEach(config => {
        expect(config.metadata.name).toBeDefined();
        expect(config.metadata.displayName).toBeDefined();
        expect(config.metadata.description).toBeDefined();
        expect(config.metadata.playstyleDescription).toBeDefined();
        expect(config.metadata.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      });
    });

    it('should have distinct playstyles', () => {
      const rushdown = STYLE_CONFIGS.rushdown;
      const zoner = STYLE_CONFIGS.zoner;
      const turtle = STYLE_CONFIGS.turtle;

      // Rushdown is aggressive
      expect(rushdown.behaviorHints.aggressionBias).toBeGreaterThan(0.7);
      expect(rushdown.behaviorHints.preferredRange).toBe('close');

      // Zoner keeps distance
      expect(zoner.behaviorHints.preferredRange).toBe('far');
      expect(zoner.rewardModifiers.specialMoves).toBeGreaterThan(1.0);

      // Turtle is defensive
      expect(turtle.behaviorHints.blockFrequency).toBeGreaterThan(0.7);
      expect(turtle.rewardModifiers.defense).toBeGreaterThan(1.5);
    });
  });

  describe('getStyleConfig', () => {
    it('should return a copy of style config', () => {
      const config1 = getStyleConfig('rushdown');
      const config2 = getStyleConfig('rushdown');

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Different instances
    });

    it('should return valid config for all styles', () => {
      const styles: FightingStyle[] = ['rushdown', 'zoner', 'turtle', 'mixup'];
      styles.forEach(style => {
        const config = getStyleConfig(style);
        expect(config).toBeDefined();
        expect(config.metadata.name).toBe(style);
      });
    });
  });

  describe('createCustomStyle', () => {
    it('should apply reward overrides', () => {
      const custom = createCustomStyle('rushdown', {
        damageDealt: 5.0,
        aggression: 3.0,
      });

      expect(custom.rewardModifiers.damageDealt).toBe(5.0);
      expect(custom.rewardModifiers.aggression).toBe(3.0);
      expect(custom.rewardModifiers.defense).toBe(STYLE_CONFIGS.rushdown.rewardModifiers.defense);
    });

    it('should apply behavior overrides', () => {
      const custom = createCustomStyle('zoner', undefined, {
        aggressionBias: 0.9,
        blockFrequency: 0.1,
      });

      expect(custom.behaviorHints.aggressionBias).toBe(0.9);
      expect(custom.behaviorHints.blockFrequency).toBe(0.1);
    });

    it('should not modify original config', () => {
      const originalAggression = STYLE_CONFIGS.rushdown.rewardModifiers.aggression;
      createCustomStyle('rushdown', { aggression: 99.0 });

      expect(STYLE_CONFIGS.rushdown.rewardModifiers.aggression).toBe(originalAggression);
    });
  });

  describe('blendStyles', () => {
    it('should return style1 when weight=0', () => {
      const blended = blendStyles('rushdown', 'turtle', 0);
      
      expect(blended.behaviorHints.aggressionBias).toBeCloseTo(
        STYLE_CONFIGS.rushdown.behaviorHints.aggressionBias,
        2
      );
    });

    it('should return style2 when weight=1', () => {
      const blended = blendStyles('rushdown', 'turtle', 1);
      
      expect(blended.behaviorHints.aggressionBias).toBeCloseTo(
        STYLE_CONFIGS.turtle.behaviorHints.aggressionBias,
        2
      );
    });

    it('should interpolate at weight=0.5', () => {
      const blended = blendStyles('rushdown', 'turtle', 0.5);
      const rushdown = STYLE_CONFIGS.rushdown;
      const turtle = STYLE_CONFIGS.turtle;
      
      const expected = (rushdown.behaviorHints.aggressionBias + turtle.behaviorHints.aggressionBias) / 2;
      expect(blended.behaviorHints.aggressionBias).toBeCloseTo(expected, 2);
    });

    it('should blend reward modifiers', () => {
      const blended = blendStyles('rushdown', 'zoner', 0.5);
      const rushdown = STYLE_CONFIGS.rushdown;
      const zoner = STYLE_CONFIGS.zoner;

      const expectedAggression = (rushdown.rewardModifiers.aggression + zoner.rewardModifiers.aggression) / 2;
      expect(blended.rewardModifiers.aggression).toBeCloseTo(expectedAggression, 2);
    });
  });

  describe('getStyleOneHot', () => {
    it('should return correct one-hot encoding', () => {
      const rushdownOneHot = getStyleOneHot('rushdown');
      expect(rushdownOneHot).toEqual([1, 0, 0, 0]);

      const zonerOneHot = getStyleOneHot('zoner');
      expect(zonerOneHot).toEqual([0, 1, 0, 0]);

      const turtleOneHot = getStyleOneHot('turtle');
      expect(turtleOneHot).toEqual([0, 0, 1, 0]);

      const mixupOneHot = getStyleOneHot('mixup');
      expect(mixupOneHot).toEqual([0, 0, 0, 1]);
    });

    it('should have exactly one 1.0 value', () => {
      const styles: FightingStyle[] = ['rushdown', 'zoner', 'turtle', 'mixup'];
      styles.forEach(style => {
        const oneHot = getStyleOneHot(style);
        const sum = oneHot.reduce((a, b) => a + b, 0);
        expect(sum).toBe(1);
      });
    });

    it('should have length 4', () => {
      const oneHot = getStyleOneHot('rushdown');
      expect(oneHot).toHaveLength(4);
    });
  });

  describe('getStyleFromOneHot', () => {
    it('should decode one-hot encoding correctly', () => {
      expect(getStyleFromOneHot([1, 0, 0, 0])).toBe('rushdown');
      expect(getStyleFromOneHot([0, 1, 0, 0])).toBe('zoner');
      expect(getStyleFromOneHot([0, 0, 1, 0])).toBe('turtle');
      expect(getStyleFromOneHot([0, 0, 0, 1])).toBe('mixup');
    });

    it('should handle soft one-hot encoding', () => {
      // Should pick the max value
      expect(getStyleFromOneHot([0.9, 0.1, 0.05, 0.05])).toBe('rushdown');
      expect(getStyleFromOneHot([0.1, 0.8, 0.05, 0.05])).toBe('zoner');
    });

    it('should round-trip correctly', () => {
      const styles: FightingStyle[] = ['rushdown', 'zoner', 'turtle', 'mixup'];
      styles.forEach(style => {
        const oneHot = getStyleOneHot(style);
        const decoded = getStyleFromOneHot(oneHot);
        expect(decoded).toBe(style);
      });
    });
  });

  describe('validateRewardModifiers', () => {
    it('should validate valid modifiers', () => {
      const config = getStyleConfig('rushdown');
      const errors = validateRewardModifiers(config.rewardModifiers);
      expect(errors).toHaveLength(0);
    });

    it('should detect negative values', () => {
      const modifiers = { ...STYLE_CONFIGS.rushdown.rewardModifiers };
      modifiers.damageDealt = -1.0;
      const errors = validateRewardModifiers(modifiers);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should detect too large values', () => {
      const modifiers = { ...STYLE_CONFIGS.rushdown.rewardModifiers };
      modifiers.aggression = 5.0;
      const errors = validateRewardModifiers(modifiers);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateBehaviorHints', () => {
    it('should validate valid hints', () => {
      const config = getStyleConfig('rushdown');
      const errors = validateBehaviorHints(config.behaviorHints);
      expect(errors).toHaveLength(0);
    });

    it('should detect invalid range values', () => {
      const hints = { ...STYLE_CONFIGS.rushdown.behaviorHints };
      hints.aggressionBias = 1.5;
      const errors = validateBehaviorHints(hints);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should detect invalid preferredRange', () => {
      const hints = { ...STYLE_CONFIGS.rushdown.behaviorHints };
      (hints.preferredRange as any) = 'invalid';
      const errors = validateBehaviorHints(hints);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('formatStyleConfig', () => {
    it('should format config as readable string', () => {
      const config = getStyleConfig('rushdown');
      const formatted = formatStyleConfig(config);

      expect(formatted).toContain('Rushdown');
      expect(formatted).toContain('Reward Modifiers');
      expect(formatted).toContain('Behavior Hints');
    });

    it('should include key values', () => {
      const config = getStyleConfig('zoner');
      const formatted = formatStyleConfig(config);

      expect(formatted).toContain('Preferred Range');
      expect(formatted).toContain('Aggression');
      expect(formatted).toContain('Damage Dealt');
    });
  });

  describe('getAllStyles', () => {
    it('should return all 4 styles', () => {
      const styles = getAllStyles();
      expect(styles).toHaveLength(4);
    });

    it('should contain expected styles', () => {
      const styles = getAllStyles();
      expect(styles).toContain('rushdown');
      expect(styles).toContain('zoner');
      expect(styles).toContain('turtle');
      expect(styles).toContain('mixup');
    });
  });

  describe('sampleRandomStyle', () => {
    it('should return a valid style', () => {
      const style = sampleRandomStyle();
      const validStyles: FightingStyle[] = ['rushdown', 'zoner', 'turtle', 'mixup'];
      expect(validStyles).toContain(style);
    });

    it('should return different styles over multiple samples', () => {
      const samples = new Set<FightingStyle>();
      for (let i = 0; i < 50; i++) {
        samples.add(sampleRandomStyle());
      }
      
      // Should get at least 2 different styles in 50 samples
      expect(samples.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Style Characteristics', () => {
    it('rushdown should favor close range aggression', () => {
      const config = STYLE_CONFIGS.rushdown;
      
      expect(config.behaviorHints.preferredRange).toBe('close');
      expect(config.behaviorHints.aggressionBias).toBeGreaterThan(0.7);
      expect(config.behaviorHints.throwFrequency).toBeGreaterThan(0.5);
      expect(config.rewardModifiers.aggression).toBeGreaterThan(1.0);
    });

    it('zoner should favor distance and projectiles', () => {
      const config = STYLE_CONFIGS.zoner;
      
      expect(config.behaviorHints.preferredRange).toBe('far');
      expect(config.behaviorHints.retreatTendency).toBeGreaterThan(0.5);
      expect(config.behaviorHints.specialUsage).toBeGreaterThan(0.5);
      expect(config.rewardModifiers.specialMoves).toBeGreaterThan(1.0);
      expect(config.rewardModifiers.spacing).toBeGreaterThan(1.0);
    });

    it('turtle should favor defense and patience', () => {
      const config = STYLE_CONFIGS.turtle;
      
      expect(config.behaviorHints.blockFrequency).toBeGreaterThan(0.7);
      expect(config.behaviorHints.aggressionBias).toBeLessThan(0.5);
      expect(config.rewardModifiers.defense).toBeGreaterThan(1.5);
      expect(config.rewardModifiers.punishOpportunities).toBeGreaterThan(1.0);
      expect(config.rewardModifiers.riskTaking).toBeLessThan(1.0);
    });

    it('mixup should favor unpredictability', () => {
      const config = STYLE_CONFIGS.mixup;
      
      expect(config.behaviorHints.mixupFrequency).toBeGreaterThan(0.7);
      expect(config.behaviorHints.repeatSuccessful).toBeLessThan(0.5);
      expect(config.rewardModifiers.mixupVariety).toBeGreaterThan(1.5);
      expect(config.behaviorHints.adaptationRate).toBeGreaterThan(0.5);
    });
  });

  describe('Style Balance', () => {
    it('all styles should have balanced total reward modifiers', () => {
      const styles: FightingStyle[] = ['rushdown', 'zoner', 'turtle', 'mixup'];
      const totals = styles.map(style => {
        const config = STYLE_CONFIGS[style];
        const values = Object.values(config.rewardModifiers);
        return values.reduce((a, b) => a + b, 0) / values.length;
      });

      // Average modifier should be close to 1.0 for balance
      totals.forEach(total => {
        expect(total).toBeGreaterThan(0.7);
        expect(total).toBeLessThan(1.5);
      });
    });

    it('all behavior hints should sum to reasonable values', () => {
      const styles: FightingStyle[] = ['rushdown', 'zoner', 'turtle', 'mixup'];
      
      styles.forEach(style => {
        const config = STYLE_CONFIGS[style];
        const hints = config.behaviorHints;

        // Frequencies should be valid probabilities
        expect(hints.blockFrequency).toBeGreaterThanOrEqual(0);
        expect(hints.blockFrequency).toBeLessThanOrEqual(1);
        expect(hints.throwFrequency).toBeGreaterThanOrEqual(0);
        expect(hints.throwFrequency).toBeLessThanOrEqual(1);
      });
    });
  });
});
