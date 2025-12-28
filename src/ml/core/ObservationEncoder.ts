/**
 * Observation Encoder
 * 
 * Converts GameState into normalized observation vectors for neural network input.
 * Includes frame history for temporal information.
 */

import { GameState, FighterState } from '../../core/interfaces/types';

/**
 * Configuration for observation encoding
 */
export interface ObservationConfig {
  historyFrames: number;      // Number of frames to track (default: 4)
  includeVelocity: boolean;   // Include velocity information
  includeHistory: boolean;    // Include frame history
  includeStyle: boolean;      // Include style one-hot encoding
  normalize: boolean;         // Normalize values to [-1, 1] or [0, 1]
}

/**
 * Default observation configuration
 */
export const DEFAULT_OBSERVATION_CONFIG: ObservationConfig = {
  historyFrames: 4,
  includeVelocity: true,
  includeHistory: true,
  includeStyle: false,
  normalize: true,
};

/**
 * Ring buffer for efficient history tracking
 */
class RingBuffer<T> {
  private buffer: T[];
  private head: number = 0;
  private size: number;

  constructor(size: number, initialValue: T) {
    this.size = size;
    this.buffer = new Array(size).fill(initialValue);
  }

  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.size;
  }

  getAll(): T[] {
    // Return in chronological order (oldest to newest)
    const result: T[] = [];
    for (let i = 0; i < this.size; i++) {
      const index = (this.head + i) % this.size;
      result.push(this.buffer[index]);
    }
    return result;
  }

  clear(value: T): void {
    this.buffer.fill(value);
    this.head = 0;
  }
}

/**
 * Frame snapshot for history
 */
interface FrameSnapshot {
  selfX: number;
  selfY: number;
  selfVX: number;
  selfVY: number;
  oppX: number;
  oppY: number;
  oppVX: number;
  oppVY: number;
}

/**
 * Observation Encoder with history tracking
 */
export class ObservationEncoder {
  private config: ObservationConfig;
  private historyBuffers: Map<string, RingBuffer<FrameSnapshot>>;
  private arenaWidth: number;
  private arenaHeight: number;
  private arenaLeftBound: number;

  constructor(config: ObservationConfig = DEFAULT_OBSERVATION_CONFIG) {
    this.config = config;
    this.historyBuffers = new Map();
    this.arenaWidth = 2000; // Default, will be updated from GameState
    this.arenaHeight = 750;
    this.arenaLeftBound = 0;
  }

  /**
   * Encode observation for a specific entity
   */
  encode(state: GameState, entityId: string, style?: string): number[] {
    const self = state.entities.find(e => e.id === entityId);
    const opponent = state.entities.find(e => e.id !== entityId);

    if (!self || !opponent) {
      throw new Error(`Entity ${entityId} not found in game state`);
    }

    // Update arena dimensions
    this.arenaWidth = state.arena.rightBound - state.arena.leftBound;
    this.arenaHeight = state.arena.height;
    this.arenaLeftBound = state.arena.leftBound;

    // Initialize history buffer if needed
    if (!this.historyBuffers.has(entityId)) {
      this.historyBuffers.set(
        entityId,
        new RingBuffer<FrameSnapshot>(this.config.historyFrames, this.createEmptySnapshot())
      );
    }

    // Build current observation
    const obs: number[] = [];

    // Position (4 floats)
    const selfX = this.normalizeX(self.position.x);
    const selfY = this.normalizeY(self.position.y);
    const oppRelX = this.normalizeRelX(opponent.position.x - self.position.x);
    const oppRelY = this.normalizeRelY(opponent.position.y - self.position.y);
    obs.push(selfX, selfY, oppRelX, oppRelY);

    // Velocity (4 floats)
    if (this.config.includeVelocity) {
      const selfVX = this.normalizeVelocity(self.velocity.x);
      const selfVY = this.normalizeVelocity(self.velocity.y);
      const oppVX = this.normalizeVelocity(opponent.velocity.x);
      const oppVY = this.normalizeVelocity(opponent.velocity.y);
      obs.push(selfVX, selfVY, oppVX, oppVY);
    }

    // Health (2 floats)
    const selfHP = self.health / self.maxHealth;
    const oppHP = opponent.health / opponent.maxHealth;
    obs.push(selfHP, oppHP);

    // Resources (4 floats)
    const selfMeter = self.superMeter / self.maxSuperMeter;
    const oppMeter = opponent.superMeter / opponent.maxSuperMeter;
    const selfEnergy = self.energy / self.maxEnergy;
    const oppEnergy = opponent.energy / opponent.maxEnergy;
    obs.push(selfMeter, oppMeter, selfEnergy, oppEnergy);

    // State (4 floats)
    const selfStatus = this.normalizeStatus(self.status);
    const oppStatus = this.normalizeStatus(opponent.status);
    const selfStun = Math.min(self.stunFramesRemaining / 60, 1.0);
    const oppStun = Math.min(opponent.stunFramesRemaining / 60, 1.0);
    obs.push(selfStatus, oppStatus, selfStun, oppStun);

    // Combat info (5 floats)
    const facing = self.facing; // 1 or -1
    const distance = this.normalizeDistance(
      Math.abs(opponent.position.x - self.position.x)
    );
    const rangeCategory = this.categorizeRange(distance);
    const comboCount = Math.min(self.comboCount / 10, 1.0);
    const roundTime = state.round.timeRemaining / (60 * 60); // Normalize to [0, 1]
    obs.push(facing, distance, rangeCategory, comboCount, roundTime);

    // Ground state (2 floats)
    obs.push(self.isGrounded ? 1.0 : 0.0, opponent.isGrounded ? 1.0 : 0.0);

    // Current frame state complete (27 floats)

    // Add frame history
    if (this.config.includeHistory) {
      const buffer = this.historyBuffers.get(entityId)!;
      
      // Update buffer with current frame
      buffer.push({
        selfX: selfX,
        selfY: selfY,
        selfVX: this.config.includeVelocity ? this.normalizeVelocity(self.velocity.x) : 0,
        selfVY: this.config.includeVelocity ? this.normalizeVelocity(self.velocity.y) : 0,
        oppX: opponent.position.x,
        oppY: opponent.position.y,
        oppVX: this.config.includeVelocity ? this.normalizeVelocity(opponent.velocity.x) : 0,
        oppVY: this.config.includeVelocity ? this.normalizeVelocity(opponent.velocity.y) : 0,
      });

      // Add history to observation
      const history = buffer.getAll();
      for (const frame of history) {
        obs.push(
          frame.selfX,
          frame.selfY,
          frame.selfVX,
          frame.selfVY
        );
      }
      // History: 4 frames × 4 values = 16 floats
    }

    // Add style one-hot encoding
    if (this.config.includeStyle && style) {
      const styleOneHot = this.encodeStyle(style);
      obs.push(...styleOneHot);
      // Style: 4 floats
    }

    // Total: 27 (base) + 16 (history) + 4 (style) = 47 floats
    // Without style: 43 floats

    return obs;
  }

  /**
   * Encode an observation in a canonical left-right frame.
   *
   * If the entity is facing left (facing = -1), mirror X-related features so the
   * network always sees "forward" as +X (facing = +1). This makes playing as
   * player2 behave like the same task as playing as player1.
   */
  encodeCanonical(state: GameState, entityId: string, style?: string): number[] {
    const self = state.entities.find(e => e.id === entityId);
    if (!self) {
      throw new Error(`Entity ${entityId} not found in game state`);
    }

    const obs = this.encode(state, entityId, style);
    const facing = (self as any).facing ?? 1;
    if (facing === -1) {
      return this.mirrorHorizontalInPlace(obs);
    }
    return obs;
  }

  /**
   * Reset history for an entity
   */
  resetHistory(entityId: string): void {
    this.historyBuffers.set(
      entityId,
      new RingBuffer<FrameSnapshot>(this.config.historyFrames, this.createEmptySnapshot())
    );
  }

  /**
   * Get observation size
   */
  getObservationSize(): number {
    // Base: position(4) + health(2) + resources(4) + state(4) + combat(5) + ground(2) = 21
    let size = 21;
    
    if (this.config.includeVelocity) {
      size += 4; // selfVX, selfVY, oppVX, oppVY
    }

    if (this.config.includeHistory) {
      size += this.config.historyFrames * 4; // 4 values per frame
    }

    if (this.config.includeStyle) {
      size += 4; // Style one-hot
    }

    return size;
  }

  /**
   * Normalize X position to [0, 1]
   */
  private normalizeX(x: number): number {
    // Normalize to [0, 1] in arena-local coordinates.
    // Using absolute world X (without leftBound) breaks symmetry and mirroring.
    return (x - this.arenaLeftBound) / this.arenaWidth;
  }

  /**
   * Normalize Y position to [0, 1]
   */
  private normalizeY(y: number): number {
    return y / this.arenaHeight;
  }

  /**
   * Normalize relative X position to [-1, 1]
   */
  private normalizeRelX(dx: number): number {
    return Math.max(-1, Math.min(1, dx / this.arenaWidth));
  }

  /**
   * Normalize relative Y position to [-1, 1]
   */
  private normalizeRelY(dy: number): number {
    return Math.max(-1, Math.min(1, dy / this.arenaHeight));
  }

  /**
   * Normalize velocity to [-1, 1]
   */
  private normalizeVelocity(v: number): number {
    const maxVelocity = 20; // Typical max velocity
    return Math.max(-1, Math.min(1, v / maxVelocity));
  }

  /**
   * Normalize distance to [0, 1]
   */
  private normalizeDistance(distance: number): number {
    const maxDistance = this.arenaWidth;
    return Math.min(1, distance / maxDistance);
  }

  /**
   * Categorize range (0 = close, 0.5 = mid, 1 = far)
   */
  private categorizeRange(normalizedDistance: number): number {
    if (normalizedDistance < 0.2) return 0.0;      // Close
    if (normalizedDistance < 0.5) return 0.5;      // Mid
    return 1.0;                                     // Far
  }

  /**
   * Normalize fighter status to [0, 1]
   */
  private normalizeStatus(status: string): number {
    const statusMap: { [key: string]: number } = {
      idle: 0.0,
      walking: 0.125,
      jumping: 0.25,
      crouching: 0.375,
      attacking: 0.5,
      blocking: 0.625,
      hitstun: 0.75,
      blockstun: 0.875,
      knockdown: 1.0,
    };

    return statusMap[status] || 0.0;
  }

  /**
   * Encode fighting style as one-hot vector
   */
  private encodeStyle(style: string): number[] {
    const styles = ['rushdown', 'zoner', 'turtle', 'mixup'];
    const oneHot = styles.map(s => (s === style ? 1.0 : 0.0));
    return oneHot;
  }

  /**
   * Create empty frame snapshot
   */
  private createEmptySnapshot(): FrameSnapshot {
    return {
      selfX: 0,
      selfY: 0,
      selfVX: 0,
      selfVY: 0,
      oppX: 0,
      oppY: 0,
      oppVX: 0,
      oppVY: 0,
    };
  }

  private mirrorHorizontalInPlace(obs: number[]): number[] {
    // Layout depends on config; compute indices programmatically.
    // Position
    const idxSelfX = 0;
    const idxOppRelX = 2;

    // Optional velocity
    const hasVel = this.config.includeVelocity;
    const idxSelfVX = hasVel ? 4 : -1;
    const idxOppVX = hasVel ? 6 : -1;

    // Combat segment start
    const baseAfterPosVel = 4 + (hasVel ? 4 : 0);
    const idxFacing = baseAfterPosVel + 2 + 4 + 4; // health(2) + resources(4) + state(4)

    // Base length (including ground)
    const baseLen = idxFacing + 5 + 2;

    // Mirror current frame
    obs[idxSelfX] = 1 - obs[idxSelfX];
    obs[idxOppRelX] = -obs[idxOppRelX];
    if (hasVel) {
      obs[idxSelfVX] = -obs[idxSelfVX];
      obs[idxOppVX] = -obs[idxOppVX];
    }
    obs[idxFacing] = 1;

    // Mirror history (selfX, selfVX for each frame snapshot)
    if (this.config.includeHistory) {
      const frames = this.config.historyFrames;
      for (let i = 0; i < frames; i++) {
        const off = baseLen + i * 4;
        obs[off + 0] = 1 - obs[off + 0]; // selfX
        obs[off + 2] = -obs[off + 2]; // selfVX (0 if velocity disabled)
      }
    }

    return obs;
  }
}
