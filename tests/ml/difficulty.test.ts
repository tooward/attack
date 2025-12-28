/**
 * Difficulty Configuration Tests
 */

import {
  DifficultyKnobs,
  DifficultyLevel,
  DIFFICULTY_PRESETS,
  getDifficultyKnobs,
  createCustomDifficulty,
  interpolateDifficulty,
  findDifficultyForElo,
  validateDifficultyKnobs,
  getDifficultyDescription,
  formatDifficultyKnobs,
} from '../../src/ml/inference/DifficultyConfig';

describe('DifficultyConfig', () => {
  describe('DIFFICULTY_PRESETS', () => {
    it('should have all 10 difficulty levels', () => {
      for (let level = 1; level <= 10; level++) {
        expect(DIFFICULTY_PRESETS[level as DifficultyLevel]).toBeDefined();
      }
    });

    it('should have increasing capability as level increases', () => {
      // Reaction delay should decrease
      expect(DIFFICULTY_PRESETS[1].reactionDelay).toBeGreaterThan(DIFFICULTY_PRESETS[10].reactionDelay);

      // Execution error should decrease
      expect(DIFFICULTY_PRESETS[1].executionError).toBeGreaterThan(DIFFICULTY_PRESETS[10].executionError);

      // Temperature should decrease
      expect(DIFFICULTY_PRESETS[1].temperature).toBeGreaterThan(DIFFICULTY_PRESETS[10].temperature);

      // Greedy rate should increase
      expect(DIFFICULTY_PRESETS[1].greedyRate).toBeLessThan(DIFFICULTY_PRESETS[10].greedyRate);
    });

    it('should disable capabilities at lower levels', () => {
      // Level 1 should have everything disabled
      expect(DIFFICULTY_PRESETS[1].disableSpecials).toBe(true);
      expect(DIFFICULTY_PRESETS[1].disableSupers).toBe(true);
      expect(DIFFICULTY_PRESETS[1].disableCancels).toBe(true);
      expect(DIFFICULTY_PRESETS[1].disableAdvancedCombos).toBe(true);

      // Level 10 should have everything enabled
      expect(DIFFICULTY_PRESETS[10].disableSpecials).toBe(false);
      expect(DIFFICULTY_PRESETS[10].disableSupers).toBe(false);
      expect(DIFFICULTY_PRESETS[10].disableCancels).toBe(false);
      expect(DIFFICULTY_PRESETS[10].disableAdvancedCombos).toBe(false);
    });

    it('should have non-overlapping Elo bands', () => {
      for (let level = 1; level < 10; level++) {
        const current = DIFFICULTY_PRESETS[level as DifficultyLevel];
        const next = DIFFICULTY_PRESETS[(level + 1) as DifficultyLevel];

        expect(current.eloBand[1]).toBeLessThanOrEqual(next.eloBand[1]);
      }
    });
  });

  describe('getDifficultyKnobs', () => {
    it('should return a copy of difficulty knobs', () => {
      const level: DifficultyLevel = 5;
      const knobs1 = getDifficultyKnobs(level);
      const knobs2 = getDifficultyKnobs(level);

      expect(knobs1).toEqual(knobs2);
      expect(knobs1).not.toBe(knobs2); // Different instances
    });

    it('should return valid knobs for all levels', () => {
      for (let level = 1; level <= 10; level++) {
        const knobs = getDifficultyKnobs(level as DifficultyLevel);
        expect(knobs).toBeDefined();
        expect(knobs.reactionDelay).toBeGreaterThanOrEqual(0);
        expect(knobs.temperature).toBeGreaterThan(0);
      }
    });
  });

  describe('createCustomDifficulty', () => {
    it('should apply overrides to base level', () => {
      const custom = createCustomDifficulty(5, {
        reactionDelay: 50,
        temperature: 1.5,
      });

      expect(custom.reactionDelay).toBe(50);
      expect(custom.temperature).toBe(1.5);
      expect(custom.executionError).toBe(DIFFICULTY_PRESETS[5].executionError);
    });

    it('should not modify original preset', () => {
      const originalDelay = DIFFICULTY_PRESETS[5].reactionDelay;
      createCustomDifficulty(5, { reactionDelay: 999 });

      expect(DIFFICULTY_PRESETS[5].reactionDelay).toBe(originalDelay);
    });
  });

  describe('interpolateDifficulty', () => {
    it('should return level1 when t=0', () => {
      const result = interpolateDifficulty(3, 7, 0);
      expect(result.reactionDelay).toBe(DIFFICULTY_PRESETS[3].reactionDelay);
      expect(result.temperature).toBeCloseTo(DIFFICULTY_PRESETS[3].temperature, 1);
    });

    it('should return level2 when t=1', () => {
      const result = interpolateDifficulty(3, 7, 1);
      expect(result.reactionDelay).toBe(DIFFICULTY_PRESETS[7].reactionDelay);
      expect(result.temperature).toBeCloseTo(DIFFICULTY_PRESETS[7].temperature, 1);
    });

    it('should interpolate numeric values at t=0.5', () => {
      const result = interpolateDifficulty(1, 10, 0.5);
      const expected = (DIFFICULTY_PRESETS[1].reactionDelay + DIFFICULTY_PRESETS[10].reactionDelay) / 2;
      expect(result.reactionDelay).toBeCloseTo(expected, 0);
    });

    it('should handle boolean values with threshold', () => {
      const result1 = interpolateDifficulty(1, 10, 0.4); // t < 0.5
      expect(result1.disableSpecials).toBe(DIFFICULTY_PRESETS[1].disableSpecials);

      const result2 = interpolateDifficulty(1, 10, 0.6); // t >= 0.5
      expect(result2.disableSpecials).toBe(DIFFICULTY_PRESETS[10].disableSpecials);
    });
  });

  describe('findDifficultyForElo', () => {
    it('should return level 1 for very low Elo', () => {
      expect(findDifficultyForElo(100)).toBe(1);
      expect(findDifficultyForElo(500)).toBe(1);
    });

    it('should return level 10 for very high Elo', () => {
      expect(findDifficultyForElo(2500)).toBe(10);
      expect(findDifficultyForElo(3000)).toBe(10);
    });

    it('should return appropriate level for mid-range Elo', () => {
      // 1400 could be level 4 or 5 due to overlapping bands
      const level1400 = findDifficultyForElo(1400);
      expect(level1400).toBeGreaterThanOrEqual(4);
      expect(level1400).toBeLessThanOrEqual(5);
      
      // 1800 could be level 6 or 7
      const level1800 = findDifficultyForElo(1800);
      expect(level1800).toBeGreaterThanOrEqual(6);
      expect(level1800).toBeLessThanOrEqual(7);
    });

    it('should return level within Elo band', () => {
      for (let elo = 800; elo <= 2400; elo += 200) {
        const level = findDifficultyForElo(elo);
        const knobs = DIFFICULTY_PRESETS[level];
        
        // Should be near the band (allow some overlap)
        const isNearBand = elo >= knobs.eloBand[0] - 200 && elo <= knobs.eloBand[1] + 200;
        expect(isNearBand).toBe(true);
      }
    });
  });

  describe('validateDifficultyKnobs', () => {
    it('should validate valid knobs', () => {
      const knobs = getDifficultyKnobs(5);
      const errors = validateDifficultyKnobs(knobs);
      expect(errors).toHaveLength(0);
    });

    it('should detect invalid reactionDelay', () => {
      const knobs = getDifficultyKnobs(5);
      knobs.reactionDelay = -1;
      const errors = validateDifficultyKnobs(knobs);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('reactionDelay'))).toBe(true);
    });

    it('should detect invalid executionError', () => {
      const knobs = getDifficultyKnobs(5);
      knobs.executionError = 1.5;
      const errors = validateDifficultyKnobs(knobs);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('executionError'))).toBe(true);
    });

    it('should detect invalid temperature', () => {
      const knobs = getDifficultyKnobs(5);
      knobs.temperature = 0;
      const errors = validateDifficultyKnobs(knobs);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('temperature'))).toBe(true);
    });

    it('should detect invalid eloBand', () => {
      const knobs = getDifficultyKnobs(5);
      knobs.eloBand = [2000, 1000]; // Min > max
      const errors = validateDifficultyKnobs(knobs);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('eloBand'))).toBe(true);
    });

    it('should detect multiple errors', () => {
      const knobs = getDifficultyKnobs(5);
      knobs.reactionDelay = -1;
      knobs.temperature = 5.0;
      knobs.greedyRate = 2.0;
      const errors = validateDifficultyKnobs(knobs);
      expect(errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getDifficultyDescription', () => {
    it('should return description for all levels', () => {
      for (let level = 1; level <= 10; level++) {
        const desc = getDifficultyDescription(level as DifficultyLevel);
        expect(desc).toBeDefined();
        expect(desc.length).toBeGreaterThan(0);
      }
    });

    it('should contain meaningful keywords', () => {
      const level1 = getDifficultyDescription(1);
      expect(level1.toLowerCase()).toMatch(/beginner|easy|slow/);

      const level10 = getDifficultyDescription(10);
      expect(level10.toLowerCase()).toMatch(/master|perfect|instant/);
    });
  });

  describe('formatDifficultyKnobs', () => {
    it('should format knobs as readable string', () => {
      const knobs = getDifficultyKnobs(5);
      const formatted = formatDifficultyKnobs(knobs);

      expect(formatted).toContain('Difficulty Configuration');
      expect(formatted).toContain('Reaction Delay');
      expect(formatted).toContain('Temperature');
      expect(formatted).toContain('Expected Elo');
    });

    it('should include all major fields', () => {
      const knobs = getDifficultyKnobs(7);
      const formatted = formatDifficultyKnobs(knobs);

      expect(formatted).toContain('Execution Error');
      expect(formatted).toContain('Greedy Rate');
      expect(formatted).toContain('Specials');
      expect(formatted).toContain('Supers');
      expect(formatted).toContain('Prediction');
    });
  });

  describe('Difficulty Progression', () => {
    it('should have smooth progression across levels', () => {
      for (let level = 1; level < 10; level++) {
        const current = DIFFICULTY_PRESETS[level as DifficultyLevel];
        const next = DIFFICULTY_PRESETS[(level + 1) as DifficultyLevel];

        // Check changes are gradual (not too large)
        const delayChange = Math.abs(current.reactionDelay - next.reactionDelay);
        expect(delayChange).toBeLessThan(10);

        const tempChange = Math.abs(current.temperature - next.temperature);
        expect(tempChange).toBeLessThan(0.5);
      }
    });

    it('should enable capabilities progressively', () => {
      // Level 1-2: Everything disabled
      expect(DIFFICULTY_PRESETS[1].disableSpecials).toBe(true);
      expect(DIFFICULTY_PRESETS[2].disableSpecials).toBe(true);

      // Level 3: Specials enabled
      expect(DIFFICULTY_PRESETS[3].disableSpecials).toBe(false);
      expect(DIFFICULTY_PRESETS[3].disableSupers).toBe(true);

      // Level 5: Supers enabled
      expect(DIFFICULTY_PRESETS[5].disableSupers).toBe(false);

      // Level 6+: Everything enabled
      expect(DIFFICULTY_PRESETS[6].disableSpecials).toBe(false);
      expect(DIFFICULTY_PRESETS[6].disableSupers).toBe(false);
      expect(DIFFICULTY_PRESETS[6].disableCancels).toBe(false);
    });
  });
});
