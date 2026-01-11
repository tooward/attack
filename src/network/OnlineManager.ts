/**
 * Online multiplayer manager for PhaserGameScene
 * Handles network sync, input delay, and rollback
 */

import { NetworkClient } from '../network/NetworkClient';
import { InputFrame } from '../core/interfaces/types';

export interface OnlineMatchConfig {
  networkClient: NetworkClient;
  roomId: string;
  opponentId: string;
  opponentElo: number;
  playerSide: 0 | 1; // 0 = player1 (left), 1 = player2 (right)
}

export class OnlineManager {
  private networkClient: NetworkClient;
  private config: OnlineMatchConfig;
  private currentFrame: number = 0;
  
  // Input buffers
  private localInputBuffer: Map<number, InputFrame> = new Map();
  private remoteInputBuffer: Map<number, InputFrame> = new Map();
  
  // Network stats
  private ping: number = 0;
  private frameDelay: number = 2; // Default 2-frame delay for 60fps
  
  // Disconnect handling
  private onDisconnect: (() => void) | null = null;
  
  constructor(config: OnlineMatchConfig) {
    this.config = config;
    this.networkClient = config.networkClient;
    
    // Calculate frame delay based on ping
    this.calculateFrameDelay();
    
    // Pre-fill input buffers with empty inputs for frames 0 to delay
    // This allows the game to start immediately without deadlock
    const emptyInput: InputFrame = {
      actions: new Set(),
      timestamp: 0
    };
    
    for (let i = 0; i < this.frameDelay; i++) {
      this.localInputBuffer.set(i, { ...emptyInput, timestamp: i });
      this.remoteInputBuffer.set(i, { ...emptyInput, timestamp: i });
    }
    
    console.log(`[OnlineManager] Pre-filled ${this.frameDelay} frames of empty inputs`);
    
    // Set up message handlers
    this.setupHandlers();
  }

  /**
   * Setup network message handlers
   */
  private setupHandlers() {
    // Receive opponent input
    this.networkClient.on('OPPONENT_INPUT', (message) => {
      const { frame, actions } = message;
      
      // Store opponent's input (convert array to Set)
      this.remoteInputBuffer.set(frame, {
        actions: new Set(actions),
        timestamp: frame
      });
    });

    // Handle opponent disconnect
    this.networkClient.on('OPPONENT_DISCONNECTED', () => {
      console.log('Opponent disconnected');
      if (this.onDisconnect) {
        this.onDisconnect();
      }
    });

    // Handle our own disconnect
    this.networkClient.on('DISCONNECTED', () => {
      console.log('Lost connection to server');
      if (this.onDisconnect) {
        this.onDisconnect();
      }
    });
  }

  /**
   * Calculate optimal frame delay based on ping
   */
  private calculateFrameDelay() {
    this.ping = this.networkClient.getPing();
    
    // Convert ping to frames (60fps = 16.67ms per frame)
    // Add buffer for stability
    const pingFrames = Math.ceil(this.ping / 16.67);
    this.frameDelay = Math.max(2, Math.min(8, pingFrames + 1));
    
    console.log(`Network delay: ${this.frameDelay} frames (ping: ${this.ping}ms)`);
  }

  /**
   * Send local input to opponent
   */
  sendInput(frame: number, actions: number[]) {
    // Don't send frames before we're ready (below the frame delay)
    if (frame < this.frameDelay) {
      console.log(`[OnlineManager] Skipping send for frame ${frame} (below delay ${this.frameDelay})`);
      return;
    }
    
    // Store locally (convert array to Set)
    this.localInputBuffer.set(frame, {
      actions: new Set(actions),
      timestamp: frame
    });
    
    // Send to server
    this.networkClient.sendInput(frame, actions);
    
    // Clean up old inputs (keep last 60 frames)
    this.cleanupOldInputs(frame - 60);
  }

  /**
   * Get inputs for both players for a given frame
   * Returns null if either player's input is not available yet
   */
  getFrameInputs(frame: number): {
    player1: InputFrame | null;
    player2: InputFrame | null;
  } | null {
    // Apply delay - we execute past frames, not current frame
    // This gives time for opponent's input to arrive over network
    const delayedFrame = frame - this.frameDelay;
    
    // Can't execute frames before delay period
    if (delayedFrame < 0) {
      return null;
    }
    
    // Check if we have both inputs for the delayed frame
    const localInput = this.localInputBuffer.get(delayedFrame);
    const remoteInput = this.remoteInputBuffer.get(delayedFrame);
    
    if (!localInput || !remoteInput) {
      return null; // Wait for both inputs
    }

    // Determine which is player1 and player2 based on our side
    if (this.config.playerSide === 0) {
      // We are player1
      return {
        player1: localInput,
        player2: remoteInput
      };
    } else {
      // We are player2
      return {
        player1: remoteInput,
        player2: localInput
      };
    }
  }

  /**
   * Check if we can advance to the given frame
   */
  canAdvanceToFrame(frame: number): boolean {
    const delayedFrame = frame - this.frameDelay;
    
    if (delayedFrame < 0) {
      return false;
    }

    const hasLocalInput = this.localInputBuffer.has(delayedFrame);
    const hasRemoteInput = this.remoteInputBuffer.has(delayedFrame);
    
    return hasLocalInput && hasRemoteInput;
  }

  /**
   * Clean up old input buffers
   */
  private cleanupOldInputs(beforeFrame: number) {
    for (const frame of this.localInputBuffer.keys()) {
      if (frame < beforeFrame) {
        this.localInputBuffer.delete(frame);
      }
    }
    
    for (const frame of this.remoteInputBuffer.keys()) {
      if (frame < beforeFrame) {
        this.remoteInputBuffer.delete(frame);
      }
    }
  }

  /**
   * Set disconnect callback
   */
  setDisconnectHandler(callback: () => void) {
    this.onDisconnect = callback;
  }

  /**
   * Get current frame delay
   */
  getFrameDelay(): number {
    return this.frameDelay;
  }

  /**
   * Get ping
   */
  getPing(): number {
    return this.ping;
  }

  /**
   * Get player side
   */
  getPlayerSide(): 0 | 1 {
    return this.config.playerSide;
  }

  /**
   * Get opponent info
   */
  getOpponentInfo() {
    return {
      id: this.config.opponentId,
      elo: this.config.opponentElo
    };
  }

  /**
   * Clean up
   */
  destroy() {
    // Unregister handlers
    this.networkClient.off('OPPONENT_INPUT');
    this.networkClient.off('OPPONENT_DISCONNECTED');
    this.networkClient.off('DISCONNECTED');
    
    // Clear buffers
    this.localInputBuffer.clear();
    this.remoteInputBuffer.clear();
  }
}
