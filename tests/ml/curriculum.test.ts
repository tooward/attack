/**
 * Tests for CurriculumManager
 */

import { CurriculumManager, CurriculumConfig, DEFAULT_CURRICULUM } from '../../src/ml/training/CurriculumManager';

describe('CurriculumManager', () => {
  let curriculum: CurriculumManager;

  beforeEach(() => {
    curriculum = new CurriculumManager(DEFAULT_CURRICULUM);
  });

  describe('Initialization', () => {
    test('should start at first stage', () => {
      expect(curriculum.getCurrentStageIndex()).toBe(0);
      expect(curriculum.getCurrentStage().name).toBe('neutral_footsies');
    });

    test('should not be complete initially', () => {
      expect(curriculum.isComplete()).toBe(false);
    });

    test('should have correct total stages', () => {
      expect(curriculum.getTotalStages()).toBe(5);
    });
  });

  describe('Progress Tracking', () => {
    test('should initialize progress with zeros', () => {
      const progress = curriculum.getProgress();
      
      expect(progress.gamesPlayed).toBe(0);
      expect(progress.wins).toBe(0);
      expect(progress.losses).toBe(0);
      expect(progress.draws).toBe(0);
      expect(progress.totalReward).toBe(0);
    });

    test('should record wins correctly', () => {
      curriculum.recordMatch(true, 10.5, 0.1, 0.7);
      
      const progress = curriculum.getProgress();
      expect(progress.wins).toBe(1);
      expect(progress.losses).toBe(0);
      expect(progress.gamesPlayed).toBe(1);
      expect(progress.totalReward).toBe(10.5);
    });

    test('should record losses correctly', () => {
      curriculum.recordMatch(false, -5.2, 0.2, 0.6);
      
      const progress = curriculum.getProgress();
      expect(progress.wins).toBe(0);
      expect(progress.losses).toBe(1);
      expect(progress.gamesPlayed).toBe(1);
    });

    test('should track running averages', () => {
      curriculum.recordMatch(true, 10, 0.1, 0.7);
      curriculum.recordMatch(false, 5, 0.3, 0.5);
      curriculum.recordMatch(true, 8, 0.2, 0.6);
      
      const progress = curriculum.getProgress();
      expect(progress.gamesPlayed).toBe(3);
      expect(progress.stallingRate).toBeCloseTo(0.2, 2);
      expect(progress.diversityScore).toBeCloseTo(0.6, 2);
    });
  });

  describe('Success Criteria', () => {
    test('should not meet criteria with insufficient games', () => {
      // First stage requires 200 games minimum
      for (let i = 0; i < 100; i++) {
        curriculum.recordMatch(true, 10, 0.05, 0.8);
      }
      
      const { met } = curriculum.checkSuccessCriteria();
      expect(met).toBe(false);
    });

    test('should not meet criteria with low win rate', () => {
      // First stage requires 60% win rate
      for (let i = 0; i < 200; i++) {
        const won = i < 100; // 50% win rate
        curriculum.recordMatch(won, 10, 0.05, 0.8);
      }
      
      const { met } = curriculum.checkSuccessCriteria();
      expect(met).toBe(false);
    });

    test('should not meet criteria with high stalling', () => {
      // First stage requires < 15% stalling
      for (let i = 0; i < 200; i++) {
        curriculum.recordMatch(true, 10, 0.3, 0.8); // 30% stalling
      }
      
      const { met } = curriculum.checkSuccessCriteria();
      expect(met).toBe(false);
    });

    test('should meet criteria when all requirements satisfied', () => {
      // 200 games, 65% win rate, 10% stalling
      for (let i = 0; i < 200; i++) {
        const won = i < 130; // 65% win rate
        curriculum.recordMatch(won, 10, 0.1, 0.8);
      }
      
      const { met, reasons } = curriculum.checkSuccessCriteria();
      expect(met).toBe(true);
      expect(reasons).toContain('All criteria met!');
    });

    test('should force advance at max games', () => {
      const config: CurriculumConfig = {
        stages: [{
          name: 'test_stage',
          constraints: {},
          successCriteria: {
            winRate: 0.9, // Unrealistic
            minGames: 100,
            maxGames: 150,
          },
        }],
      };
      
      const testCurriculum = new CurriculumManager(config);
      
      // Play 150 games with low win rate
      for (let i = 0; i < 150; i++) {
        testCurriculum.recordMatch(false, 0, 0, 0.5);
      }
      
      const { met } = testCurriculum.checkSuccessCriteria();
      expect(met).toBe(true); // Forced by max games
    });
  });

  describe('Stage Advancement', () => {
    test('should advance to next stage', () => {
      // Meet criteria for first stage
      for (let i = 0; i < 200; i++) {
        curriculum.recordMatch(true, 10, 0.1, 0.8);
      }
      
      const advanced = curriculum.advanceStage();
      expect(advanced).toBe(true);
      expect(curriculum.getCurrentStageIndex()).toBe(1);
      expect(curriculum.getCurrentStage().name).toBe('punish_training');
    });

    test('should reset progress on stage advance', () => {
      // Meet first stage criteria
      for (let i = 0; i < 200; i++) {
        curriculum.recordMatch(true, 10, 0.1, 0.8);
      }
      
      curriculum.advanceStage();
      
      const progress = curriculum.getProgress();
      expect(progress.gamesPlayed).toBe(0);
      expect(progress.wins).toBe(0);
      expect(progress.stageName).toBe('punish_training');
    });

    test('should not advance when complete', () => {
      // Advance through all stages
      for (let stage = 0; stage < 5; stage++) {
        for (let i = 0; i < 500; i++) {
          curriculum.recordMatch(true, 10, 0.05, 0.8);
        }
        curriculum.advanceStage();
      }
      
      expect(curriculum.isComplete()).toBe(true);
      const advanced = curriculum.advanceStage();
      expect(advanced).toBe(false);
    });

    test('should try advance only when criteria met', () => {
      // Not enough games
      for (let i = 0; i < 50; i++) {
        curriculum.recordMatch(true, 10, 0.1, 0.8);
      }
      
      const advanced = curriculum.tryAdvance();
      expect(advanced).toBe(false);
      expect(curriculum.getCurrentStageIndex()).toBe(0);
    });
  });

  describe('Constraints', () => {
    test('should return current stage constraints', () => {
      const constraints = curriculum.getConstraints();
      
      expect(constraints.allowedMoves).toBeDefined();
      expect(constraints.disableSpecials).toBe(true);
      expect(constraints.opponentType).toBe('passive');
    });

    test('should check if move is allowed', () => {
      expect(curriculum.isMoveAllowed('walk')).toBe(true);
      expect(curriculum.isMoveAllowed('lightPunch')).toBe(true);
      expect(curriculum.isMoveAllowed('special')).toBe(false);
    });

    test('should allow all moves when no whitelist', () => {
      // Advance to stage without move restrictions
      for (let i = 0; i < 200; i++) {
        curriculum.recordMatch(true, 10, 0.05, 0.8);
      }
      curriculum.advanceStage();
      
      expect(curriculum.isMoveAllowed('anything')).toBe(true);
    });
  });

  describe('Reward Overrides', () => {
    test('should merge stage rewards with base weights', () => {
      const baseWeights = {
        ...require('../../src/ml/core/RewardFunction').DEFAULT_REWARD_WEIGHTS,
        rangeControl: 0.1,
        stalling: -0.01,
      };
      
      const stageWeights = curriculum.getRewardWeights(baseWeights);
      
      // First stage overrides rangeControl and stalling
      expect(stageWeights.rangeControl).toBe(0.3);
      expect(stageWeights.stalling).toBe(-0.1);
      expect(stageWeights.damageDealt).toBe(baseWeights.damageDealt); // Unchanged from base
    });

    test('should return base weights when no overrides', () => {
      // Advance to stage 2 (no reward overrides)
      for (let i = 0; i < 200; i++) {
        curriculum.recordMatch(true, 10, 0.05, 0.8);
      }
      curriculum.advanceStage();
      
      const baseWeights = {
        ...require('../../src/ml/core/RewardFunction').DEFAULT_REWARD_WEIGHTS,
        rangeControl: 0.1,
      };
      
      const stageWeights = curriculum.getRewardWeights(baseWeights);
      expect(stageWeights).not.toBe(baseWeights); // Different object
      expect(stageWeights.damageDealt).toBe(baseWeights.damageDealt);
      expect(stageWeights.rangeControl).toBe(0.1);
    });
  });

  describe('Summary and Reports', () => {
    test('should generate curriculum summary', () => {
      const summary = curriculum.getSummary();
      
      expect(summary).toContain('Total stages: 5');
      expect(summary).toContain('Current stage: 1');
      expect(summary).toContain('neutral_footsies');
      expect(summary).toContain('→'); // Current stage marker
    });

    test('should generate progress report', () => {
      curriculum.recordMatch(true, 10, 0.1, 0.7);
      curriculum.recordMatch(false, 5, 0.15, 0.6);
      
      const report = curriculum.getProgressReport();
      
      expect(report).toContain('neutral_footsies');
      expect(report).toContain('Games played: 2');
      expect(report).toContain('1W - 1L');
      expect(report).toContain('Win rate: 50.0%');
    });
  });

  describe('State Management', () => {
    test('should export curriculum state', () => {
      curriculum.recordMatch(true, 10, 0.1, 0.7);
      
      const exported = curriculum.export();
      
      expect(exported.config).toBeDefined();
      expect(exported.currentStageIndex).toBe(0);
      expect(exported.stageProgress.gamesPlayed).toBe(1);
      expect(exported.elapsedTime).toBeGreaterThanOrEqual(0);
    });

    test('should reset curriculum', () => {
      // Make progress
      for (let i = 0; i < 100; i++) {
        curriculum.recordMatch(true, 10, 0.05, 0.8);
      }
      curriculum.advanceStage();
      
      // Reset
      curriculum.reset();
      
      expect(curriculum.getCurrentStageIndex()).toBe(0);
      expect(curriculum.getProgress().gamesPlayed).toBe(0);
    });
  });

  describe('Force Advance', () => {
    test('should not allow force advance when disabled', () => {
      const advanced = curriculum.forceAdvance();
      expect(advanced).toBe(false);
    });

    test('should allow force advance when enabled', () => {
      const config: CurriculumConfig = {
        ...DEFAULT_CURRICULUM,
        allowSkipping: true,
      };
      
      const testCurriculum = new CurriculumManager(config);
      const advanced = testCurriculum.forceAdvance();
      
      expect(advanced).toBe(true);
      expect(testCurriculum.getCurrentStageIndex()).toBe(1);
    });
  });
});
