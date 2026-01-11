import * as fs from 'fs/promises';
import * as path from 'path';
import { MultiplayerReplay } from '../types/Replay';
import { ReplayCompressor } from '../ReplayCompressor';

export interface ReplayStorageOptions {
  directory?: string;
  compress?: boolean;
  maxReplaysPerDirectory?: number;
}

/**
 * Server-side replay storage
 * Saves replays to disk with compression
 */
export class ReplayStorage {
  private directory: string;
  private compress: boolean;
  private maxReplaysPerDirectory: number;

  constructor(options: ReplayStorageOptions = {}) {
    this.directory = options.directory || path.join(process.cwd(), 'replays');
    this.compress = options.compress !== undefined ? options.compress : true;
    this.maxReplaysPerDirectory = options.maxReplaysPerDirectory || 1000;
  }

  /**
   * Initialize storage (create directories)
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.directory, { recursive: true });
      console.log(`Replay storage initialized at: ${this.directory}`);
    } catch (error) {
      console.error('Failed to initialize replay storage:', error);
      throw error;
    }
  }

  /**
   * Save a replay to disk
   */
  async saveReplay(replay: MultiplayerReplay): Promise<string> {
    try {
      // Compress if enabled
      const replayToSave = this.compress ? ReplayCompressor.compress(replay) : replay;

      // Get subdirectory based on date
      const date = new Date(replay.metadata.date);
      const subdirName = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const subdir = path.join(this.directory, subdirName);
      
      await fs.mkdir(subdir, { recursive: true });

      // Generate filename
      const filename = `${replay.metadata.id}.json`;
      const filepath = path.join(subdir, filename);

      // Write to disk
      await fs.writeFile(filepath, JSON.stringify(replayToSave, null, 2), 'utf-8');

      console.log(`Replay saved: ${filepath} (${this.compress ? 'compressed' : 'uncompressed'})`);
      
      return filepath;
    } catch (error) {
      console.error('Failed to save replay:', error);
      throw error;
    }
  }

  /**
   * Load a replay from disk
   */
  async loadReplay(replayId: string): Promise<MultiplayerReplay | null> {
    try {
      // Search for replay in subdirectories
      const filepath = await this.findReplayFile(replayId);
      
      if (!filepath) {
        console.warn(`Replay not found: ${replayId}`);
        return null;
      }

      const data = await fs.readFile(filepath, 'utf-8');
      const replay: MultiplayerReplay = JSON.parse(data);

      // Decompress if needed
      return replay.compressed ? ReplayCompressor.decompress(replay) : replay;
    } catch (error) {
      console.error('Failed to load replay:', error);
      return null;
    }
  }

  /**
   * Find a replay file by ID
   */
  private async findReplayFile(replayId: string): Promise<string | null> {
    try {
      const subdirs = await fs.readdir(this.directory);
      
      for (const subdir of subdirs) {
        const subdirPath = path.join(this.directory, subdir);
        const stat = await fs.stat(subdirPath);
        
        if (stat.isDirectory()) {
          const filepath = path.join(subdirPath, `${replayId}.json`);
          
          try {
            await fs.access(filepath);
            return filepath;
          } catch {
            // File doesn't exist in this subdir, continue
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error searching for replay:', error);
      return null;
    }
  }

  /**
   * List all replays (metadata only)
   */
  async listReplays(limit: number = 100): Promise<MultiplayerReplay[]> {
    try {
      const replays: MultiplayerReplay[] = [];
      const subdirs = await fs.readdir(this.directory);
      
      for (const subdir of subdirs) {
        const subdirPath = path.join(this.directory, subdir);
        const stat = await fs.stat(subdirPath);
        
        if (stat.isDirectory()) {
          const files = await fs.readdir(subdirPath);
          
          for (const file of files) {
            if (file.endsWith('.json')) {
              const filepath = path.join(subdirPath, file);
              const data = await fs.readFile(filepath, 'utf-8');
              const replay = JSON.parse(data);
              replays.push(replay);
              
              if (replays.length >= limit) {
                return replays;
              }
            }
          }
        }
      }
      
      return replays;
    } catch (error) {
      console.error('Failed to list replays:', error);
      return [];
    }
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    totalReplays: number;
    totalSize: number;
    oldestReplay: number | null;
    newestReplay: number | null;
  }> {
    try {
      let totalReplays = 0;
      let totalSize = 0;
      let oldestDate: number | null = null;
      let newestDate: number | null = null;

      const subdirs = await fs.readdir(this.directory);
      
      for (const subdir of subdirs) {
        const subdirPath = path.join(this.directory, subdir);
        const stat = await fs.stat(subdirPath);
        
        if (stat.isDirectory()) {
          const files = await fs.readdir(subdirPath);
          
          for (const file of files) {
            if (file.endsWith('.json')) {
              const filepath = path.join(subdirPath, file);
              const fileStat = await fs.stat(filepath);
              
              totalReplays++;
              totalSize += fileStat.size;
              
              const mtime = fileStat.mtime.getTime();
              if (!oldestDate || mtime < oldestDate) oldestDate = mtime;
              if (!newestDate || mtime > newestDate) newestDate = mtime;
            }
          }
        }
      }
      
      return {
        totalReplays,
        totalSize,
        oldestReplay: oldestDate,
        newestReplay: newestDate
      };
    } catch (error) {
      console.error('Failed to get storage stats:', error);
      return {
        totalReplays: 0,
        totalSize: 0,
        oldestReplay: null,
        newestReplay: null
      };
    }
  }

  /**
   * Delete old replays to manage disk space
   */
  async cleanup(olderThanDays: number): Promise<number> {
    try {
      const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
      let deletedCount = 0;

      const subdirs = await fs.readdir(this.directory);
      
      for (const subdir of subdirs) {
        const subdirPath = path.join(this.directory, subdir);
        const stat = await fs.stat(subdirPath);
        
        if (stat.isDirectory()) {
          const files = await fs.readdir(subdirPath);
          
          for (const file of files) {
            if (file.endsWith('.json')) {
              const filepath = path.join(subdirPath, file);
              const fileStat = await fs.stat(filepath);
              
              if (fileStat.mtime.getTime() < cutoffTime) {
                await fs.unlink(filepath);
                deletedCount++;
              }
            }
          }
        }
      }
      
      console.log(`Cleaned up ${deletedCount} old replays`);
      return deletedCount;
    } catch (error) {
      console.error('Failed to cleanup replays:', error);
      return 0;
    }
  }
}
