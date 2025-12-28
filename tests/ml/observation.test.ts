/**
 * Tests for ObservationEncoder
 */

import { ObservationEncoder, DEFAULT_OBSERVATION_CONFIG } from '../../src/ml/core/ObservationEncoder';
import { GameState } from '../../src/core/interfaces/types';
import { createInitialState } from '../../src/core/Game';
import { MUSASHI as musashi } from '../../src/core/data/musashi';

describe('ObservationEncoder', () => {
  let encoder: ObservationEncoder;
  let gameState: GameState;

  beforeEach(() => {
    encoder = new ObservationEncoder(DEFAULT_OBSERVATION_CONFIG);
    gameState = createInitialState({
      entities: [
        { characterId: 'musashi', id: 'player1', teamId: 0, startPosition: { x: 300, y: 500 } },
        { characterId: 'musashi', id: 'player2', teamId: 1, startPosition: { x: 700, y: 500 } },
      ],
      arena: {
        width: 1000,
        height: 600,
        groundLevel: 500,
        leftBound: 100,
        rightBound: 900,
      },
      roundsToWin: 2,
      roundTimeSeconds: 60,
    });
  });

  describe('encode', () => {
    it('should return array of correct size', () => {
      const obs = encoder.encode(gameState, 'player1');
      const expectedSize = encoder.getObservationSize();
      
      expect(obs.length).toBe(expectedSize);
    });

    it('should normalize all values', () => {
      const obs = encoder.encode(gameState, 'player1');
      
      // All values should be in reasonable range [-1, 1] or [0, 1]
      for (const value of obs) {
        expect(value).toBeGreaterThanOrEqual(-1.5);
        expect(value).toBeLessThanOrEqual(1.5);
        expect(isNaN(value)).toBe(false);
      }
    });

    it('should include velocity when enabled', () => {
      const configWithVel = { ...DEFAULT_OBSERVATION_CONFIG, includeVelocity: true };
      const encoderWithVel = new ObservationEncoder(configWithVel);
      
      const obsWithVel = encoderWithVel.encode(gameState, 'player1');
      
      const configNoVel = { ...DEFAULT_OBSERVATION_CONFIG, includeVelocity: false };
      const encoderNoVel = new ObservationEncoder(configNoVel);
      
      const obsNoVel = encoderNoVel.encode(gameState, 'player1');
      
      expect(obsWithVel.length).toBeGreaterThan(obsNoVel.length);
    });

    it('should include history when enabled', () => {
      const configWithHistory = { ...DEFAULT_OBSERVATION_CONFIG, includeHistory: true, historyFrames: 4 };
      const encoderWithHistory = new ObservationEncoder(configWithHistory);
      
      const obsWithHistory = encoderWithHistory.encode(gameState, 'player1');
      
      const configNoHistory = { ...DEFAULT_OBSERVATION_CONFIG, includeHistory: false };
      const encoderNoHistory = new ObservationEncoder(configNoHistory);
      
      const obsNoHistory = encoderNoHistory.encode(gameState, 'player1');
      
      expect(obsWithHistory.length).toBeGreaterThan(obsNoHistory.length);
    });

    it('should encode style as one-hot when enabled', () => {
      const configWithStyle = { ...DEFAULT_OBSERVATION_CONFIG, includeStyle: true };
      const encoderWithStyle = new ObservationEncoder(configWithStyle);
      
      const obs = encoderWithStyle.encode(gameState, 'player1', 'rushdown');
      
      // Last 4 values should be one-hot
      const styleEncoding = obs.slice(-4);
      const sum = styleEncoding.reduce((a, b) => a + b, 0);
      
      expect(sum).toBe(1); // One-hot should sum to 1
      expect(styleEncoding.filter(v => v === 1).length).toBe(1); // Exactly one 1
      expect(styleEncoding.filter(v => v === 0).length).toBe(3); // Three 0s
    });

    it('should throw error for invalid entity', () => {
      expect(() => {
        encoder.encode(gameState, 'invalid_entity');
      }).toThrow();
    });
  });

  describe('getObservationSize', () => {
    it('should return correct size with default config', () => {
      const size = encoder.getObservationSize();
      
      // Base: 25 (21 + 4 velocity), History: 4 frames * 4 values = 16, Total: 41
      expect(size).toBe(41);
    });

    it('should return correct size with style enabled', () => {
      const configWithStyle = { ...DEFAULT_OBSERVATION_CONFIG, includeStyle: true };
      const encoderWithStyle = new ObservationEncoder(configWithStyle);
      
      const size = encoderWithStyle.getObservationSize();
      
      // Base: 25 (21 + 4 velocity), History: 16 (4 frames * 4), Style: 4, Total: 45
      expect(size).toBe(45);
    });

    it('should return correct size without history', () => {
      const configNoHistory = { ...DEFAULT_OBSERVATION_CONFIG, includeHistory: false };
      const encoderNoHistory = new ObservationEncoder(configNoHistory);
      
      const size = encoderNoHistory.getObservationSize();
      
      // Base: 25 (21 + 4 velocity)
      expect(size).toBe(25);
    });
  });

  describe('resetHistory', () => {
    it('should clear history buffer', () => {
      // Encode a few times to build history
      encoder.encode(gameState, 'player1');
      encoder.encode(gameState, 'player1');
      encoder.encode(gameState, 'player1');
      
      // Reset history
      encoder.resetHistory('player1');
      
      // Observation should still work
      const obs = encoder.encode(gameState, 'player1');
      expect(obs.length).toBe(encoder.getObservationSize());
    });
  });
});
