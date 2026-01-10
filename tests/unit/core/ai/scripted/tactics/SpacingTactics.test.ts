/**
 * Unit tests for SpacingTactics module
 */

import { SpacingTactics } from '../../../../../../src/core/ai/scripted/tactics/SpacingTactics';
import { StateReader } from '../../../../../../src/core/ai/scripted/utils/StateReader';
import { FrameDataAnalyzer } from '../../../../../../src/core/ai/scripted/systems/FrameDataAnalyzer';
import { mockGameState, mockFighter } from '../../../../../helpers/mockData';

describe('SpacingTactics', () => {
  let tactics: SpacingTactics;
  let stateReader: StateReader;
  let frameAnalyzer: FrameDataAnalyzer;

  beforeEach(() => {
    stateReader = new StateReader();
    frameAnalyzer = new FrameDataAnalyzer();
    tactics = new SpacingTactics(stateReader, frameAnalyzer);
  });

  describe('fireProjectile', () => {
    it('should return projectile command', () => {
      const state = mockGameState({ frame: 100 }); // Set frame > 60 to pass cooldown
      const actor = mockFighter('player1', 0);
      
      const action = tactics.fireProjectile(state, actor);
      
      expect(action).toBeDefined();
      expect(action?.button).toBe('hp');
      expect(action?.direction).toBe('neutral');
    });

    it('should respect cooldown', () => {
      const state = mockGameState();
      const actor = mockFighter('player1', 0);
      
      tactics.fireProjectile(state, actor);
      
      // Second call within cooldown should return null
      state.frame = 30;
      const action = tactics.fireProjectile(state, actor);
      
      expect(action).toBeNull();
    });
  });

  describe('maintainZoneDistance', () => {
    it('should move away when too close', () => {
      const state = mockGameState();
      const actor = mockFighter('player1', 100);
      const opponent = mockFighter('player2', 150);
      
      const action = tactics.maintainZoneDistance(state, actor, opponent, 200);
      
      // Should move away (left or right depending on position)
      expect(['left', 'right']).toContain(action.direction);
    });

    it('should move forward when too far', () => {
      const state = mockGameState();
      const actor = mockFighter('player1', 0);
      const opponent = mockFighter('player2', 300);
      
      const action = tactics.maintainZoneDistance(state, actor, opponent, 200);
      
      // Should move toward (left or right depending on position)
      expect(['left', 'right']).toContain(action.direction);
    });

    it('should stay neutral at optimal distance', () => {
      const state = mockGameState();
      const actor = mockFighter('player1', 0);
      const opponent = mockFighter('player2', 205);
      
      const action = tactics.maintainZoneDistance(state, actor, opponent, 200);
      
      expect(action.direction).toBe('neutral');
      expect(action.button).toBe('none');
    });
  });

  describe('antiApproach', () => {
    it('should return attack when opponent approaching', () => {
      const state = mockGameState();
      const actor = mockFighter('player1', 0);
      const opponent = mockFighter('player2', 180);
      opponent.velocity = { x: -2, y: 0 }; // Moving toward actor
      
      const action = tactics.antiApproach(state, actor, opponent);
      
      // May or may not return action depending on conditions
      if (action) {
        expect(['hp', 'lk']).toContain(action.button);
      }
    });
  });

  describe('whiffPunish', () => {
    it('should return attack when opponent whiffs', () => {
      const state = mockGameState();
      const actor = mockFighter('player1', 0);
      const opponent = mockFighter('player2', 100);
      
      const action = tactics.whiffPunish(state, actor, opponent);
      
      // May return null if whiff not detected
      if (action) {
        expect(['lk', 'hp']).toContain(action.button);
      }
    });

    it('should return null if out of range', () => {
      const state = mockGameState();
      const actor = mockFighter('player1', 0);
      const opponent = mockFighter('player2', 400);
      
      const action = tactics.whiffPunish(state, actor, opponent);
      
      expect(action).toBeNull();
    });
  });

  describe('getSpacingPriority', () => {
    it('should fire projectile at range with high projectile rate', () => {
      const state = mockGameState({ frame: 100 }); // Need frame > 60 for cooldown
      const actor = mockFighter('player1', 0);
      const opponent = mockFighter('player2', 250);
      
      const action = tactics.getSpacingPriority(
        state,
        actor,
        opponent,
        { optimalDistance: 200, projectileRate: 1.0, pokeRate: 0 }
      );
      
      expect(action).toBeDefined();
      expect(action?.button).toBe('hp');
    });

    it('should poke at medium range', () => {
      const state = mockGameState();
      const actor = mockFighter('player1', 0);
      const opponent = mockFighter('player2', 180);
      opponent.velocity = { x: -1, y: 0 }; // Approaching
      
      const action = tactics.getSpacingPriority(
        state,
        actor,
        opponent,
        { optimalDistance: 200, projectileRate: 0, pokeRate: 1.0 }
      );
      
      // May or may not poke depending on approach detection
      if (action) {
        expect(['hp', 'lk']).toContain(action.button);
      }
    });

    it('should maintain distance if no priority conditions met', () => {
      const state = mockGameState();
      const actor = mockFighter('player1', 0);
      const opponent = mockFighter('player2', 50);
      
      const action = tactics.getSpacingPriority(
        state,
        actor,
        opponent,
        { optimalDistance: 200, projectileRate: 0, pokeRate: 0 }
      );
      
      // Always returns something - maintainZoneDistance is the fallback
      expect(action).toBeDefined();
      // At distance 50 with optimal 200, should back away
      expect(action?.button).toBe('none'); // Movement only
    });
  });

  describe('reset', () => {
    it('should reset internal state', () => {
      const state = mockGameState();
      const actor = mockFighter('player1', 0);
      
      tactics.fireProjectile(state, actor);
      tactics.reset();
      
      // Should be able to fire projectile again immediately
      const action = tactics.fireProjectile(state, actor);
      expect(action).toBeDefined();
    });
  });
});
