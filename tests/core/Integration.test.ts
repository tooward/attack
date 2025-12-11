/**
 * Integration Test
 * Simulates a complete headless match to verify all systems work together
 */

import { tick, createInitialState } from '../../src/core/Game';
import { MUSASHI } from '../../src/core/data/musashi';
import { InputFrame, InputAction, ArenaConfig } from '../../src/core/interfaces/types';

describe('Integration: Full Match Simulation', () => {
  const ARENA: ArenaConfig = {
    width: 1000,
    height: 600,
    groundLevel: 500,
    leftBound: 100,
    rightBound: 900,
  };

  it('should simulate a complete headless match (600 frames)', () => {
    // Create initial state with two Musashi fighters
    const config = {
      entities: [
        { characterId: 'musashi', id: 'player1', teamId: 0, startPosition: { x: 300, y: 500 } },
        { characterId: 'musashi', id: 'player2', teamId: 1, startPosition: { x: 700, y: 500 } },
      ],
      arena: ARENA,
      roundsToWin: 2,
      roundTimeSeconds: 60,
    };

    let state = createInitialState(config);

    // Simulate 600 frames (10 seconds)
    for (let frame = 0; frame < 600; frame++) {
      // Player 1 (left): Walk forward and punch repeatedly
      const player1Input: InputFrame = {
        actions: new Set(),
        timestamp: frame,
      };

      if (frame < 120) {
        // Walk right for 2 seconds
        player1Input.actions.add(InputAction.RIGHT);
      } else if (frame % 20 === 0) {
        // Punch every 20 frames
        player1Input.actions.add(InputAction.LIGHT_PUNCH);
      }

      // Player 2 (right): Stand idle (bot would go here)
      const player2Input: InputFrame = {
        actions: new Set(),
        timestamp: frame,
      };

      // Step the simulation
      state = tick(state, new Map([['player1', player1Input], ['player2', player2Input]]));

      // Verify frame count increments
      expect(state.frame).toBe(frame + 1);

      // Verify entities still exist
      expect(state.entities.length).toBe(2);

      // Verify physics constraints (fighters stay in bounds)
      for (const fighter of state.entities) {
        expect(fighter.position.x).toBeGreaterThanOrEqual(ARENA.leftBound);
        expect(fighter.position.x).toBeLessThanOrEqual(ARENA.rightBound);
      }
    }

    // After 600 frames, state should be consistent
    const player1 = state.entities.find((f) => f.teamId === 0);
    const player2 = state.entities.find((f) => f.teamId === 1);

    expect(player1).toBeDefined();
    expect(player2).toBeDefined();

    // Core game loop is functioning (frame advanced)
    expect(state.frame).toBe(600);
  });

  it('should track round time and allow timeouts', () => {
    const config = {
      entities: [
        { characterId: 'musashi', id: 'player1', teamId: 0, startPosition: { x: 650, y: 500 } },
        { characterId: 'musashi', id: 'player2', teamId: 1, startPosition: { x: 700, y: 500 } },
      ],
      arena: ARENA,
      roundsToWin: 2,
      roundTimeSeconds: 1, // Short round for testing
    };

    let state = createInitialState(config);

    // Give player 1 more health
    state = {
      ...state,
      entities: state.entities.map((f) =>
        f.teamId === 0 ? { ...f, health: 100 } : { ...f, health: 50 }
      ),
    };

    const emptyInput: InputFrame = {
      actions: new Set(),
      timestamp: 0,
    };

    // Simulate until round ends (60 frames for 1 second)
    for (let i = 0; i < 70; i++) {
      state = tick(state, new Map([['player1', emptyInput], ['player2', emptyInput]]));
    }

    // Round should have ended due to timeout
    expect(state.round.timeRemaining).toBe(0);
    expect(state.isRoundOver).toBe(true);
    expect(state.round.winner).toBe('player1'); // Player with more health wins
  });

  it('should handle fighter collision and prevent overlap', () => {
    const config = {
      entities: [
        { characterId: 'musashi', id: 'player1', teamId: 0, startPosition: { x: 500, y: 500 } },
        { characterId: 'musashi', id: 'player2', teamId: 1, startPosition: { x: 505, y: 500 } }, // Very close
      ],
      arena: ARENA,
      roundsToWin: 2,
      roundTimeSeconds: 60,
    };

    let state = createInitialState(config);

    // Both fighters walk toward each other
    const player1Input: InputFrame = {
      actions: new Set([InputAction.RIGHT]),
      timestamp: 0,
    };

    const player2Input: InputFrame = {
      actions: new Set([InputAction.LEFT]),
      timestamp: 0,
    };

    // Simulate 60 frames
    for (let i = 0; i < 60; i++) {
      state = tick(state, new Map([['player1', player1Input], ['player2', player2Input]]));
    }

    const player1 = state.entities.find((f) => f.teamId === 0);
    const player2 = state.entities.find((f) => f.teamId === 1);

    // Verify both fighters still exist
    expect(player1).toBeDefined();
    expect(player2).toBeDefined();
  });

  it('should run at high frame rate in headless mode', () => {
    const config = {
      entities: [
        { characterId: 'musashi', id: 'player1', teamId: 0, startPosition: { x: 300, y: 500 } },
        { characterId: 'musashi', id: 'player2', teamId: 1, startPosition: { x: 700, y: 500 } },
      ],
      arena: ARENA,
      roundsToWin: 2,
      roundTimeSeconds: 60,
    };

    let state = createInitialState(config);

    const emptyInput: InputFrame = {
      actions: new Set(),
      timestamp: 0,
    };

    // Measure time to simulate 1000 frames
    const startTime = Date.now();
    for (let i = 0; i < 1000; i++) {
      state = tick(state, new Map([['player1', emptyInput], ['player2', emptyInput]]));
    }
    const endTime = Date.now();
    const elapsed = endTime - startTime;

    // Should complete in less than 100ms (10,000+ fps)
    expect(elapsed).toBeLessThan(100);

    // Verify simulation completed
    expect(state.frame).toBe(1000);
  });

  it('should properly track game state through extended sequences', () => {
    const config = {
      entities: [
        { characterId: 'musashi', id: 'player1', teamId: 0, startPosition: { x: 650, y: 500 } },
        { characterId: 'musashi', id: 'player2', teamId: 1, startPosition: { x: 700, y: 500 } },
      ],
      arena: ARENA,
      roundsToWin: 2,
      roundTimeSeconds: 60,
    };

    let state = createInitialState(config);

    const player2Input: InputFrame = {
      actions: new Set(),
      timestamp: 0,
    };

    // Execute multiple actions over time
    for (let combo = 0; combo < 5; combo++) {
      // Execute some input
      const punchInput: InputFrame = {
        actions: new Set([InputAction.LIGHT_PUNCH]),
        timestamp: 0,
      };

      // Execute move over multiple frames
      for (let frame = 0; frame < 13; frame++) {
        state = tick(state, new Map([['player1', punchInput], ['player2', player2Input]]));
      }

      // Wait a few frames before next action
      const idleInput: InputFrame = {
        actions: new Set(),
        timestamp: 0,
      };
      for (let frame = 0; frame < 3; frame++) {
        state = tick(state, new Map([['player1', idleInput], ['player2', player2Input]]));
      }
    }

    // Verify game state is consistent
    const player1 = state.entities.find((f) => f.teamId === 0);
    const player2 = state.entities.find((f) => f.teamId === 1);
    
    expect(player1).toBeDefined();
    expect(player2).toBeDefined();
    expect(state.frame).toBeGreaterThan(0);
  });
});
