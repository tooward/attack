/**
 * Tests for BehaviorAnalyzer
 */

import { BehaviorAnalyzer, DEFAULT_BEHAVIOR_CONFIG, isDegenerateBehavior } from '../../src/ml/evaluation/BehaviorAnalysis';
import { GameState } from '../../src/core/interfaces/types';

describe('BehaviorAnalyzer', () => {
  let analyzer: BehaviorAnalyzer;

  beforeEach(() => {
    analyzer = new BehaviorAnalyzer();
  });

  // Mock game state helper
  function createMockState(
    p1x: number,
    p2x: number,
    p1vx: number = 0,
    p2vx: number = 0,
    p1attacking: boolean = false,
    p2attacking: boolean = false
  ): GameState {
    return {
      frame: 0,
      entities: [
        {
          id: 'player1',
          position: { x: p1x, y: 0 },
          velocity: { x: p1vx, y: 0 },
          health: 100,
          status: p1attacking ? 'attack' as any : 'idle',
        } as any,
        {
          id: 'player2',
          position: { x: p2x, y: 0 },
          velocity: { x: p2vx, y: 0 },
          health: 100,
          status: p2attacking ? 'attack' as any : 'idle',
        } as any,
      ],
      projectiles: [],
      round: {} as any,
      match: {} as any,
      arena: {} as any,
      cameraPosition: { x: 0, y: 0 },
      isPaused: false,
      isRoundOver: false,
      isMatchOver: false,
      freezeFrames: 0,
      screenShake: null,
    } as GameState;
  }

  describe('State Recording', () => {
    test('should record game states', () => {
      const state = createMockState(100, 300);
      analyzer.recordState(state, 0);
      
      const history = analyzer.getStateHistory();
      expect(history).toHaveLength(1);
      expect(history[0].distance).toBe(200);
    });

    test('should record multiple states', () => {
      for (let i = 0; i < 10; i++) {
        const state = createMockState(100 + i * 10, 300);
        analyzer.recordState(state, i);
      }
      
      const history = analyzer.getStateHistory();
      expect(history).toHaveLength(10);
    });
  });

  describe('Action Recording', () => {
    test('should record actions', () => {
      analyzer.recordAction(0);
      analyzer.recordAction(1);
      analyzer.recordAction(2);
      
      const history = analyzer.getActionHistory();
      expect(history).toEqual([0, 1, 2]);
    });
  });

  describe('Stalling Detection', () => {
    test('should detect no stalling with active combat', () => {
      for (let i = 0; i < 100; i++) {
        const state = createMockState(100, 200, 2, -2, true, false);
        analyzer.recordState(state, i);
      }
      
      const report = analyzer.detectStalling();
      expect(report.stallingRate).toBeLessThan(0.1);
    });

    test('should detect stalling when fighters are far apart and idle', () => {
      for (let i = 0; i < 100; i++) {
        // Far apart (500 pixels), not moving, not attacking
        const state = createMockState(100, 600, 0, 0, false, false);
        analyzer.recordState(state, i);
      }
      
      const report = analyzer.detectStalling();
      expect(report.stallingRate).toBeGreaterThan(0.8);
      expect(report.stallingFrames).toBeGreaterThan(80);
    });

    test('should track longest stalling streak', () => {
      // 50 frames stalling, 20 frames active, 30 frames stalling
      for (let i = 0; i < 50; i++) {
        const state = createMockState(100, 600, 0, 0, false, false);
        analyzer.recordState(state, i);
      }
      for (let i = 50; i < 70; i++) {
        const state = createMockState(100, 200, 2, -2, true, false);
        analyzer.recordState(state, i);
      }
      for (let i = 70; i < 100; i++) {
        const state = createMockState(100, 600, 0, 0, false, false);
        analyzer.recordState(state, i);
      }
      
      const report = analyzer.detectStalling();
      expect(report.longestStallingStreak).toBeGreaterThanOrEqual(49);
    });

    test('should return zero for empty history', () => {
      const report = analyzer.detectStalling();
      expect(report.stallingRate).toBe(0);
      expect(report.stallingFrames).toBe(0);
    });
  });

  describe('Loop Detection', () => {
    test('should not detect loops with diverse actions', () => {
      // Use pseudo-random diverse actions to avoid patterns
      const actions = [0, 5, 2, 8, 1, 9, 3, 7, 4, 6];
      for (let i = 0; i < 100; i++) {
        analyzer.recordAction(actions[(i * 7) % 10]); // Avoid simple patterns
      }
      
      const report = analyzer.detectLoops();
      expect(report.loopRate).toBeLessThan(0.3); // Allow some minor loops
    });

    test('should detect repeated action sequences', () => {
      // Repeat sequence [0, 1, 2] many times
      for (let i = 0; i < 50; i++) {
        analyzer.recordAction(0);
        analyzer.recordAction(1);
        analyzer.recordAction(2);
      }
      
      const report = analyzer.detectLoops();
      expect(report.detectedLoops).toBe(true);
      expect(report.maxRepeats).toBeGreaterThan(10);
    });

    test('should identify most common sequence', () => {
      for (let i = 0; i < 20; i++) {
        analyzer.recordAction(3);
        analyzer.recordAction(4);
        analyzer.recordAction(5);
      }
      
      const report = analyzer.detectLoops();
      expect(report.mostCommonSequence).toBeDefined();
      expect(report.mostCommonSequence![0]).toBe('3,4,5');
    });

    test('should handle insufficient action history', () => {
      analyzer.recordAction(0);
      analyzer.recordAction(1);
      
      const report = analyzer.detectLoops();
      expect(report.detectedLoops).toBe(false);
      expect(report.loopRate).toBe(0);
    });
  });

  describe('Diversity Analysis', () => {
    test('should compute entropy for uniform distribution', () => {
      // Use all 10 actions equally
      for (let repeat = 0; repeat < 10; repeat++) {
        for (let action = 0; action < 10; action++) {
          analyzer.recordAction(action);
        }
      }
      
      const report = analyzer.computeDiversity(10);
      expect(report.entropy).toBeCloseTo(1.0, 1); // Maximum entropy
      expect(report.uniqueActions).toBe(10);
    });

    test('should compute low entropy for repetitive actions', () => {
      // Use only action 0
      for (let i = 0; i < 100; i++) {
        analyzer.recordAction(0);
      }
      
      const report = analyzer.computeDiversity(10);
      expect(report.entropy).toBeCloseTo(0.0, 1); // Minimum entropy
      expect(report.uniqueActions).toBe(1);
      expect(report.dominantAction).toBe(0);
      expect(report.dominantActionRate).toBe(1.0);
    });

    test('should identify dominant action', () => {
      // Action 3 used 70 times, others 30 times total
      for (let i = 0; i < 70; i++) {
        analyzer.recordAction(3);
      }
      for (let i = 0; i < 30; i++) {
        analyzer.recordAction(i % 10);
      }
      
      const report = analyzer.computeDiversity(10);
      expect(report.dominantAction).toBe(3);
      expect(report.dominantActionRate).toBeCloseTo(0.7, 1);
    });

    test('should handle empty action history', () => {
      const report = analyzer.computeDiversity(10);
      expect(report.entropy).toBe(0);
      expect(report.uniqueActions).toBe(0);
    });
  });

  describe('Engagement', () => {
    test('should compute high engagement when fighters are close', () => {
      for (let i = 0; i < 100; i++) {
        const state = createMockState(200, 300); // 100 pixels apart
        analyzer.recordState(state, i);
      }
      
      const engagement = analyzer.computeEngagement();
      expect(engagement).toBeGreaterThan(0.9);
    });

    test('should compute low engagement when fighters are far', () => {
      for (let i = 0; i < 100; i++) {
        const state = createMockState(100, 600); // 500 pixels apart
        analyzer.recordState(state, i);
      }
      
      const engagement = analyzer.computeEngagement();
      expect(engagement).toBeLessThan(0.1);
    });
  });

  describe('Aggression', () => {
    test('should compute high aggression when frequently attacking', () => {
      for (let i = 0; i < 100; i++) {
        const attacking = i % 2 === 0; // Attack 50% of time
        const state = createMockState(100, 200, 0, 0, attacking, false);
        analyzer.recordState(state, i);
      }
      
      const aggression = analyzer.computeAggression();
      expect(aggression).toBeCloseTo(0.5, 1);
    });

    test('should compute low aggression when rarely attacking', () => {
      for (let i = 0; i < 100; i++) {
        const state = createMockState(100, 200, 0, 0, false, false);
        analyzer.recordState(state, i);
      }
      
      const aggression = analyzer.computeAggression();
      expect(aggression).toBe(0);
    });
  });

  describe('Comprehensive Report', () => {
    test('should generate full behavior report', () => {
      // Simulate some gameplay
      for (let i = 0; i < 100; i++) {
        const state = createMockState(100 + i, 300, 1, -1, i % 5 === 0, false);
        analyzer.recordState(state, i);
        analyzer.recordAction(i % 10);
      }
      
      const report = analyzer.generateReport(10);
      
      expect(report.stalling).toBeDefined();
      expect(report.loops).toBeDefined();
      expect(report.diversity).toBeDefined();
      expect(report.engagement).toBeGreaterThan(0);
      expect(report.aggression).toBeGreaterThan(0);
      expect(report.mobility).toBeGreaterThan(0);
    });
  });

  describe('Reset', () => {
    test('should clear all history', () => {
      const state = createMockState(100, 300);
      analyzer.recordState(state, 0);
      analyzer.recordAction(0);
      
      analyzer.reset();
      
      expect(analyzer.getStateHistory()).toHaveLength(0);
      expect(analyzer.getActionHistory()).toHaveLength(0);
    });
  });

  describe('Export', () => {
    test('should export analyzer state', () => {
      const state = createMockState(100, 300);
      analyzer.recordState(state, 0);
      analyzer.recordAction(5);
      
      const exported = analyzer.export();
      
      expect(exported.stateHistory).toHaveLength(1);
      expect(exported.actionHistory).toEqual([5]);
      expect(exported.config).toEqual(DEFAULT_BEHAVIOR_CONFIG);
    });
  });
});

describe('Degenerate Behavior Detection', () => {
  test('should flag high stalling as degenerate', () => {
    const report = {
      stalling: { stallingRate: 0.3, stallingFrames: 300, totalFrames: 1000, longestStallingStreak: 100 },
      loops: { detectedLoops: false, loopRate: 0.1, mostCommonSequence: undefined, maxRepeats: 2 },
      diversity: { entropy: 0.8, actionCounts: new Map(), uniqueActions: 8, totalActions: 100, dominantAction: 0, dominantActionRate: 0.2 },
      engagement: 0.5,
      aggression: 0.3,
      mobility: 0.4,
    };
    
    const { degenerate, reasons } = isDegenerateBehavior(report, { maxStalling: 0.2 });
    expect(degenerate).toBe(true);
    expect(reasons.some(r => r.toLowerCase().includes('stalling'))).toBe(true);
  });

  test('should flag repetitive moves as degenerate', () => {
    const report = {
      stalling: { stallingRate: 0.1, stallingFrames: 100, totalFrames: 1000, longestStallingStreak: 50 },
      loops: { detectedLoops: true, loopRate: 0.4, mostCommonSequence: ['0,1,2', 10] as [string, number], maxRepeats: 15 },
      diversity: { entropy: 0.3, actionCounts: new Map(), uniqueActions: 3, totalActions: 100, dominantAction: 0, dominantActionRate: 0.5 },
      engagement: 0.5,
      aggression: 0.3,
      mobility: 0.4,
    };
    
    const { degenerate, reasons } = isDegenerateBehavior(report, { maxLoopRate: 0.3 });
    expect(degenerate).toBe(true);
    expect(reasons.some(r => r.toLowerCase().includes('repetitive'))).toBe(true);
  });

  test('should flag low diversity as degenerate', () => {
    const report = {
      stalling: { stallingRate: 0.1, stallingFrames: 100, totalFrames: 1000, longestStallingStreak: 50 },
      loops: { detectedLoops: false, loopRate: 0.1, mostCommonSequence: undefined, maxRepeats: 2 },
      diversity: { entropy: 0.2, actionCounts: new Map(), uniqueActions: 2, totalActions: 100, dominantAction: 0, dominantActionRate: 0.8 },
      engagement: 0.5,
      aggression: 0.3,
      mobility: 0.4,
    };
    
    const { degenerate, reasons } = isDegenerateBehavior(report, { minDiversity: 0.4 });
    expect(degenerate).toBe(true);
    expect(reasons.some(r => r.toLowerCase().includes('diversity'))).toBe(true);
  });

  test('should not flag good behavior as degenerate', () => {
    const report = {
      stalling: { stallingRate: 0.05, stallingFrames: 50, totalFrames: 1000, longestStallingStreak: 20 },
      loops: { detectedLoops: false, loopRate: 0.1, mostCommonSequence: undefined, maxRepeats: 3 },
      diversity: { entropy: 0.8, actionCounts: new Map(), uniqueActions: 9, totalActions: 100, dominantAction: 2, dominantActionRate: 0.2 },
      engagement: 0.7,
      aggression: 0.4,
      mobility: 0.6,
    };
    
    const { degenerate } = isDegenerateBehavior(report, {
      maxStalling: 0.2,
      maxLoopRate: 0.3,
      minDiversity: 0.4,
      minEngagement: 0.3,
    });
    
    expect(degenerate).toBe(false);
  });
});
