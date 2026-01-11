import { MultiplayerReplay, ReplayFrame, ReplayMetadata } from './types/Replay';
import * as crypto from 'crypto';

/**
 * Server-side replay recording
 * Records complete match data for training
 */
export class ReplayRecorder {
  private frames: ReplayFrame[] = [];
  private metadata: Partial<ReplayMetadata> | null = null;
  private isRecording: boolean = false;
  private startTime: number = 0;

  startRecording(matchId: string, player1: any, player2: any, region: string = 'global') {
    this.isRecording = true;
    this.frames = [];
    this.startTime = Date.now();

    this.metadata = {
      id: matchId,
      date: this.startTime,
      version: '1.0.0',
      player1: {
        userId: player1.userId || player1.id,
        characterId: 'musashi', // TODO: Get from game state
        elo: player1.elo || 1000,
        wins: 0,
        losses: 0
      },
      player2: {
        userId: player2.userId || player2.id,
        characterId: 'musashi',
        elo: player2.elo || 1000,
        wins: 0,
        losses: 0
      },
      winner: null,
      matchDuration: 0,
      averagePing: 0,
      region,
      training: {
        skillLevel: this.determineSkillLevel(player1.elo, player2.elo),
        tags: [],
        qualityScore: 1.0 // Start at perfect, reduce for issues
      }
    };

    console.log(`Started recording replay: ${matchId}`);
  }

  recordFrame(frame: number, player1Input: number[], player2Input: number[]) {
    if (!this.isRecording) return;

    this.frames.push({
      frame,
      player1Input,
      player2Input
    });
  }

  stopRecording(winner: 1 | 2 | null): MultiplayerReplay | null {
    if (!this.isRecording || !this.metadata) {
      return null;
    }

    this.isRecording = false;
    
    const duration = Date.now() - this.startTime;
    const finalMetadata: ReplayMetadata = {
      ...this.metadata,
      winner,
      matchDuration: this.frames.length,
      training: {
        ...this.metadata.training!,
        tags: this.generateTags(winner, this.frames.length)
      }
    } as ReplayMetadata;

    const replay: MultiplayerReplay = {
      metadata: finalMetadata,
      frames: this.frames,
      compressed: false,
      checksum: this.generateChecksum(this.frames)
    };

    console.log(`Stopped recording replay: ${replay.metadata.id}`);
    console.log(`  Duration: ${(duration / 1000).toFixed(1)}s, Frames: ${this.frames.length}`);
    console.log(`  Winner: Player ${winner || 'Draw'}`);

    return replay;
  }

  private determineSkillLevel(elo1: number, elo2: number): 'beginner' | 'intermediate' | 'advanced' | 'expert' {
    const avgElo = (elo1 + elo2) / 2;
    
    if (avgElo < 1200) return 'beginner';
    if (avgElo < 1600) return 'intermediate';
    if (avgElo < 2000) return 'advanced';
    return 'expert';
  }

  private generateTags(winner: 1 | 2 | null, duration: number): string[] {
    const tags: string[] = [];
    
    if (winner === null) {
      tags.push('draw');
    }
    
    if (duration < 600) { // Less than 10 seconds at 60fps
      tags.push('quick-finish');
    }
    
    if (duration > 3600) { // More than 60 seconds
      tags.push('long-match');
    }
    
    return tags;
  }

  private generateChecksum(frames: ReplayFrame[]): string {
    const data = JSON.stringify(frames);
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  getFrameCount(): number {
    return this.frames.length;
  }
}
