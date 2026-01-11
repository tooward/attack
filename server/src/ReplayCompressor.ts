import { MultiplayerReplay, ReplayFrame, DeltaFrame } from './types/Replay';

/**
 * Compresses replay data using delta encoding
 * Reduces size by 80-90% by only storing changed inputs
 */
export class ReplayCompressor {
  /**
   * Compress a replay using delta encoding
   */
  static compress(replay: MultiplayerReplay): MultiplayerReplay {
    if (replay.compressed) {
      console.warn('Replay already compressed');
      return replay;
    }

    const deltaFrames = this.encodeDelta(replay.frames);
    
    return {
      ...replay,
      frames: deltaFrames as any, // Delta frames stored in same field
      compressed: true
    };
  }

  /**
   * Decompress a replay with delta encoding
   */
  static decompress(replay: MultiplayerReplay): MultiplayerReplay {
    if (!replay.compressed) {
      console.warn('Replay not compressed');
      return replay;
    }

    const fullFrames = this.decodeDelta(replay.frames as any);
    
    return {
      ...replay,
      frames: fullFrames,
      compressed: false
    };
  }

  /**
   * Encode frames using delta compression
   * Only store frames where inputs changed
   */
  private static encodeDelta(frames: ReplayFrame[]): DeltaFrame[] {
    if (frames.length === 0) return [];

    const deltaFrames: DeltaFrame[] = [];
    let lastP1Input = frames[0].player1Input;
    let lastP2Input = frames[0].player2Input;

    // Always store first frame
    deltaFrames.push({
      frame: frames[0].frame,
      inputs: {
        p1: lastP1Input,
        p2: lastP2Input
      }
    });

    // Store only frames with changed inputs
    for (let i = 1; i < frames.length; i++) {
      const frame = frames[i];
      const p1Changed = !this.arraysEqual(frame.player1Input, lastP1Input);
      const p2Changed = !this.arraysEqual(frame.player2Input, lastP2Input);

      if (p1Changed || p2Changed) {
        const deltaInputs: any = {};
        
        if (p1Changed) {
          deltaInputs.p1 = frame.player1Input;
          lastP1Input = frame.player1Input;
        }
        
        if (p2Changed) {
          deltaInputs.p2 = frame.player2Input;
          lastP2Input = frame.player2Input;
        }

        deltaFrames.push({
          frame: frame.frame,
          inputs: deltaInputs
        });
      }
    }

    const compressionRatio = (1 - deltaFrames.length / frames.length) * 100;
    console.log(`Delta compression: ${frames.length} frames → ${deltaFrames.length} frames (${compressionRatio.toFixed(1)}% reduction)`);

    return deltaFrames;
  }

  /**
   * Decode delta frames back to full frames
   */
  private static decodeDelta(deltaFrames: DeltaFrame[]): ReplayFrame[] {
    if (deltaFrames.length === 0) return [];

    const fullFrames: ReplayFrame[] = [];
    const firstDelta = deltaFrames[0];
    
    let currentP1Input = firstDelta.inputs.p1!;
    let currentP2Input = firstDelta.inputs.p2!;

    fullFrames.push({
      frame: firstDelta.frame,
      player1Input: currentP1Input,
      player2Input: currentP2Input
    });

    let deltaIdx = 1;
    let currentFrame = firstDelta.frame + 1;
    const lastFrame = deltaFrames[deltaFrames.length - 1].frame;

    // Reconstruct all frames
    while (currentFrame <= lastFrame) {
      // Check if we have a delta for this frame
      if (deltaIdx < deltaFrames.length && deltaFrames[deltaIdx].frame === currentFrame) {
        const delta = deltaFrames[deltaIdx];
        
        if (delta.inputs.p1) {
          currentP1Input = delta.inputs.p1;
        }
        if (delta.inputs.p2) {
          currentP2Input = delta.inputs.p2;
        }
        
        deltaIdx++;
      }

      fullFrames.push({
        frame: currentFrame,
        player1Input: currentP1Input,
        player2Input: currentP2Input
      });

      currentFrame++;
    }

    return fullFrames;
  }

  /**
   * Compare two input arrays for equality
   */
  private static arraysEqual(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false;
    
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    
    return true;
  }

  /**
   * Get compression statistics
   */
  static getStats(replay: MultiplayerReplay): {
    originalSize: number;
    compressedSize: number;
    ratio: number;
  } {
    const originalSize = JSON.stringify(replay.frames).length;
    const compressed = this.compress(replay);
    const compressedSize = JSON.stringify(compressed.frames).length;
    
    return {
      originalSize,
      compressedSize,
      ratio: (1 - compressedSize / originalSize) * 100
    };
  }
}
