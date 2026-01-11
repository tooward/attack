/**
 * Replay Format for AI Training
 * Captures every frame of multiplayer matches for training data
 */

export interface MultiplayerReplay {
  metadata: ReplayMetadata;
  frames: ReplayFrame[];
  compressed: boolean;
  checksum?: string; // For integrity validation
}

export interface ReplayMetadata {
  id: string;
  date: number;
  version: string;
  player1: PlayerInfo;
  player2: PlayerInfo;
  winner: 1 | 2 | null;
  matchDuration: number; // in frames
  averagePing: number;
  region: string;
  
  // Training metadata
  training: {
    skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    tags: string[]; // e.g., ['comeback', 'perfect', 'timeout']
    qualityScore: number; // 0-1, based on disconnects, lag, etc.
  };
}

export interface PlayerInfo {
  userId: string;
  characterId: string;
  elo: number;
  wins: number;
  losses: number;
}

export interface ReplayFrame {
  frame: number;
  player1Input: number[]; // InputAction enum values
  player2Input: number[]; // InputAction enum values
  gameStateSnapshot?: any; // Optional, every N frames for validation
}

// Delta-compressed frame (stores only input changes)
export interface DeltaFrame {
  frame: number;
  inputs: {
    p1?: number[]; // Only present if changed
    p2?: number[]; // Only present if changed
  };
  stateChecksum?: string; // For validation
}
