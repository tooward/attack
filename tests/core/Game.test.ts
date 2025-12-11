/**
 * Unit tests for Game.ts
 */

import { createInitialState, tick, checkMatchEnd, startNextRound } from '../../src/core/Game';
import { GameConfig, GameState } from '../../src/core/interfaces/types';

describe('Game Core', () => {
  const defaultConfig: GameConfig = {
    entities: [
      {
        characterId: 'musashi',
        id: 'player',
        teamId: 0,
        startPosition: { x: 300, y: 400 },
      },
      {
        characterId: 'ronin',
        id: 'enemy',
        teamId: 1,
        startPosition: { x: 700, y: 400 },
      },
    ],
    arena: {
      width: 1000,
      height: 600,
      groundLevel: 400,
      leftBound: 50,
      rightBound: 950,
    },
    roundsToWin: 2,
    roundTimeSeconds: 99,
  };

  describe('createInitialState', () => {
    it('should create a valid initial game state', () => {
      const state = createInitialState(defaultConfig);

      expect(state.frame).toBe(0);
      expect(state.entities).toHaveLength(2);
      expect(state.entities[0].id).toBe('player');
      expect(state.entities[1].id).toBe('enemy');
      expect(state.round.roundNumber).toBe(1);
      expect(state.round.timeRemaining).toBe(99 * 60); // 99 seconds at 60fps
      expect(state.isRoundOver).toBe(false);
      expect(state.isMatchOver).toBe(false);
    });

    it('should position entities at their start positions', () => {
      const state = createInitialState(defaultConfig);

      expect(state.entities[0].position).toEqual({ x: 300, y: 400 });
      expect(state.entities[1].position).toEqual({ x: 700, y: 400 });
    });

    it('should set entities to face each other', () => {
      const state = createInitialState(defaultConfig);

      expect(state.entities[0].facing).toBe(1);  // Player faces right
      expect(state.entities[1].facing).toBe(-1); // Enemy faces left
    });
  });

  describe('tick', () => {
    it('should advance frame count by 1', () => {
      const state = createInitialState(defaultConfig);
      const newState = tick(state, new Map());

      expect(newState.frame).toBe(1);
    });

    it('should decrement round timer', () => {
      const state = createInitialState(defaultConfig);
      const initialTime = state.round.timeRemaining;
      const newState = tick(state, new Map());

      expect(newState.round.timeRemaining).toBe(initialTime - 1);
    });

    it('should not mutate the original state', () => {
      const state = createInitialState(defaultConfig);
      const originalFrame = state.frame;
      const originalTime = state.round.timeRemaining;

      tick(state, new Map());

      expect(state.frame).toBe(originalFrame);
      expect(state.round.timeRemaining).toBe(originalTime);
    });

    it('should not advance if paused', () => {
      const state = { ...createInitialState(defaultConfig), isPaused: true };
      const newState = tick(state, new Map());

      expect(newState.frame).toBe(state.frame);
    });

    it('should not advance if round is over', () => {
      const state = { ...createInitialState(defaultConfig), isRoundOver: true };
      const newState = tick(state, new Map());

      expect(newState.frame).toBe(state.frame);
    });
  });

  describe('Round End Detection', () => {
    it('should end round when timer reaches 0', () => {
      let state = createInitialState(defaultConfig);
      state = { ...state, round: { ...state.round, timeRemaining: 1 } };
      
      const newState = tick(state, new Map());

      expect(newState.isRoundOver).toBe(true);
      expect(newState.round.winner).toBeDefined();
    });

    it('should determine winner by health when time runs out', () => {
      let state = createInitialState(defaultConfig);
      state.entities[0].health = 80;
      state.entities[1].health = 50;
      state.round.timeRemaining = 1;
      
      const newState = tick(state, new Map());

      expect(newState.round.winner).toBe('player');
    });

    it('should end round when a team has 0 health', () => {
      let state = createInitialState(defaultConfig);
      state.entities[1].health = 0;
      
      const newState = tick(state, new Map());

      expect(newState.isRoundOver).toBe(true);
      expect(newState.round.winner).toBe('player');
    });
  });

  describe('Match End Detection', () => {
    it('should end match when a player wins required rounds', () => {
      let state = createInitialState(defaultConfig);
      state.isRoundOver = true;
      state.round.winner = 'player';
      state.match.wins = { player: 1 }; // One win already

      const newState = checkMatchEnd(state);

      expect(newState.isMatchOver).toBe(true);
      expect(newState.match.matchWinner).toBe('player');
      expect(newState.match.wins.player).toBe(2);
    });

    it('should not end match if rounds to win not reached', () => {
      let state = createInitialState(defaultConfig);
      state.isRoundOver = true;
      state.round.winner = 'player';

      const newState = checkMatchEnd(state);

      expect(newState.isMatchOver).toBe(false);
      expect(newState.match.wins.player).toBe(1);
    });
  });

  describe('startNextRound', () => {
    it('should reset entities to starting positions', () => {
      let state = createInitialState(defaultConfig);
      state.entities[0].position = { x: 500, y: 300 };
      state.entities[0].health = 50;

      const newState = startNextRound(state, defaultConfig);

      expect(newState.entities[0].position).toEqual({ x: 300, y: 400 });
      expect(newState.entities[0].health).toBe(100);
    });

    it('should increment round number', () => {
      const state = createInitialState(defaultConfig);
      const newState = startNextRound(state, defaultConfig);

      expect(newState.round.roundNumber).toBe(2);
    });

    it('should reset round timer', () => {
      let state = createInitialState(defaultConfig);
      state.round.timeRemaining = 100;

      const newState = startNextRound(state, defaultConfig);

      expect(newState.round.timeRemaining).toBe(99 * 60);
    });

    it('should preserve super meter between rounds', () => {
      let state = createInitialState(defaultConfig);
      state.entities[0].superMeter = 150;

      const newState = startNextRound(state, defaultConfig);

      expect(newState.entities[0].superMeter).toBe(150);
    });
  });
});
