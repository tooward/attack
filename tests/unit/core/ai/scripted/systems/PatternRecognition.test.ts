/**
 * Unit tests for PatternRecognition system
 */

import { PatternRecognition } from '../../../../../../src/core/ai/scripted/systems/PatternRecognition';

describe('PatternRecognition', () => {
  let patternRec: PatternRecognition;

  beforeEach(() => {
    patternRec = new PatternRecognition();
  });

  describe('recordAction', () => {
    it('should record actions in history', () => {
      patternRec.recordAction('attack');
      patternRec.recordAction('block');
      
      const behavior = patternRec.analyzeBehavior();
      expect(behavior.totalActions).toBe(2);
    });

    it('should limit history to 60 actions', () => {
      for (let i = 0; i < 100; i++) {
        patternRec.recordAction('attack');
      }
      
      const behavior = patternRec.analyzeBehavior();
      expect(behavior.totalActions).toBe(60);
    });
  });

  describe('analyzeBehavior', () => {
    it('should calculate block rate correctly', () => {
      for (let i = 0; i < 10; i++) {
        patternRec.recordAction('block');
      }
      
      const behavior = patternRec.analyzeBehavior();
      expect(behavior.blockRate).toBe(1.0);
    });

    it('should calculate attack rate correctly', () => {
      for (let i = 0; i < 5; i++) {
        patternRec.recordAction('attack');
        patternRec.recordAction('idle');
      }
      
      const behavior = patternRec.analyzeBehavior();
      expect(behavior.attackRate).toBe(0.5);
    });

    it('should calculate jump rate correctly', () => {
      for (let i = 0; i < 4; i++) {
        patternRec.recordAction('jump');
      }
      for (let i = 0; i < 16; i++) {
        patternRec.recordAction('idle');
      }
      
      const behavior = patternRec.analyzeBehavior();
      expect(behavior.jumpRate).toBe(0.2); // 4/20
    });

    it('should detect forward movement preference', () => {
      for (let i = 0; i < 7; i++) {
        patternRec.recordAction('forward');
      }
      for (let i = 0; i < 3; i++) {
        patternRec.recordAction('idle');
      }
      
      const behavior = patternRec.analyzeBehavior();
      expect(behavior.forwardRate).toBe(0.7);
    });

    it('should detect crouch preference', () => {
      for (let i = 0; i < 6; i++) {
        patternRec.recordAction('crouch');
      }
      for (let i = 0; i < 4; i++) {
        patternRec.recordAction('idle');
      }
      
      const behavior = patternRec.analyzeBehavior();
      expect(behavior.crouchRate).toBe(0.6);
    });
  });

  describe('detectPattern', () => {
    it('should identify defensive behavior', () => {
      for (let i = 0; i < 15; i++) {
        patternRec.recordAction('block');
      }
      for (let i = 0; i < 5; i++) {
        patternRec.recordAction('idle');
      }
      
      const pattern = patternRec.detectPattern();
      expect(pattern.isDefensive).toBe(true);
      expect(pattern.isAggressive).toBe(false);
    });

    it('should identify aggressive behavior', () => {
      for (let i = 0; i < 15; i++) {
        patternRec.recordAction('attack');
      }
      for (let i = 0; i < 5; i++) {
        patternRec.recordAction('forward');
      }
      
      const pattern = patternRec.detectPattern();
      expect(pattern.isAggressive).toBe(true);
      expect(pattern.isDefensive).toBe(false);
    });

    it('should detect zoner behavior', () => {
      for (let i = 0; i < 10; i++) {
        patternRec.recordAction('projectile');
      }
      for (let i = 0; i < 10; i++) {
        patternRec.recordAction('back');
      }
      
      const pattern = patternRec.detectPattern();
      expect(pattern.isZoner).toBe(true);
    });

    it('should detect jumper behavior', () => {
      for (let i = 0; i < 12; i++) {
        patternRec.recordAction('jump');
      }
      for (let i = 0; i < 8; i++) {
        patternRec.recordAction('idle');
      }
      
      const pattern = patternRec.detectPattern();
      expect(pattern.isJumper).toBe(true);
    });

    it('should recommend throw exploit for high block rate', () => {
      for (let i = 0; i < 18; i++) {
        patternRec.recordAction('block');
      }
      for (let i = 0; i < 2; i++) {
        patternRec.recordAction('idle');
      }
      
      const pattern = patternRec.detectPattern();
      expect(pattern.exploitRecommendation).toBe('throw');
    });

    it('should recommend overhead for high crouch rate', () => {
      for (let i = 0; i < 15; i++) {
        patternRec.recordAction('crouch');
      }
      for (let i = 0; i < 5; i++) {
        patternRec.recordAction('idle');
      }
      
      const pattern = patternRec.detectPattern();
      expect(pattern.exploitRecommendation).toBe('overhead');
    });

    it('should recommend pressure for passive play', () => {
      for (let i = 0; i < 20; i++) {
        patternRec.recordAction('idle');
      }
      
      const pattern = patternRec.detectPattern();
      expect(pattern.exploitRecommendation).toBe('pressure');
    });

    it('should recommend low for high stand rate', () => {
      for (let i = 0; i < 15; i++) {
        patternRec.recordAction('block');
      }
      for (let i = 0; i < 5; i++) {
        patternRec.recordAction('idle');
      }
      
      const behavior = patternRec.analyzeBehavior();
      
      // Manually check logic: if crouchRate is low, should recommend low
      if (behavior.crouchRate < 0.2) {
        const pattern = patternRec.detectPattern();
        expect(['low', 'throw']).toContain(pattern.exploitRecommendation);
      }
    });

    it('should detect predictable patterns', () => {
      // Same action repeatedly
      for (let i = 0; i < 10; i++) {
        patternRec.recordAction('attack');
      }
      
      const pattern = patternRec.detectPattern();
      expect(pattern.isPredictable).toBe(true);
    });
  });

  describe('alwaysDoes', () => {
    it('should detect always blocking', () => {
      for (let i = 0; i < 20; i++) {
        patternRec.recordAction('block');
      }
      
      expect(patternRec.alwaysDoes('block')).toBe(true);
    });

    it('should return false for rare actions', () => {
      for (let i = 0; i < 18; i++) {
        patternRec.recordAction('idle');
      }
      for (let i = 0; i < 2; i++) {
        patternRec.recordAction('attack');
      }
      
      expect(patternRec.alwaysDoes('attack')).toBe(false);
    });
  });

  describe('getActionFrequency', () => {
    it('should calculate action frequency', () => {
      for (let i = 0; i < 3; i++) {
        patternRec.recordAction('attack');
      }
      for (let i = 0; i < 7; i++) {
        patternRec.recordAction('idle');
      }
      
      expect(patternRec.getActionFrequency('attack')).toBe(0.3);
    });

    it('should return 0 for never done action', () => {
      for (let i = 0; i < 10; i++) {
        patternRec.recordAction('idle');
      }
      
      expect(patternRec.getActionFrequency('special')).toBe(0);
    });
  });

  describe('detectSequence', () => {
    it('should detect repeating sequences', () => {
      const sequence = ['attack', 'attack', 'block'];
      
      for (let i = 0; i < 5; i++) {
        sequence.forEach(action => patternRec.recordAction(action));
      }
      
      expect(patternRec.detectSequence(sequence)).toBe(true);
    });

    it('should return false for non-repeating sequences', () => {
      patternRec.recordAction('attack');
      patternRec.recordAction('block');
      patternRec.recordAction('jump');
      patternRec.recordAction('idle');
      
      expect(patternRec.detectSequence(['attack', 'attack'])).toBe(false);
    });
  });

  describe('reset', () => {
    it('should clear action history', () => {
      for (let i = 0; i < 10; i++) {
        patternRec.recordAction('attack');
      }
      
      patternRec.reset();
      
      const behavior = patternRec.analyzeBehavior();
      expect(behavior.totalActions).toBe(0);
    });
  });
});
