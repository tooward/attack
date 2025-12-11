/**
 * Audio Manager
 * 
 * Centralized audio playback system for the game.
 * Handles sound effects, music, and voice clips.
 */

export interface AudioConfig {
  sfxVolume: number;
  musicVolume: number;
  voiceVolume: number;
  masterVolume: number;
}

export class AudioManager {
  private scene: Phaser.Scene;
  private config: AudioConfig;
  private sounds: Map<string, Phaser.Sound.BaseSound>;
  private music: Phaser.Sound.BaseSound | null = null;

  constructor(scene: Phaser.Scene, config: Partial<AudioConfig> = {}) {
    this.scene = scene;
    this.config = {
      sfxVolume: config.sfxVolume ?? 0.7,
      musicVolume: config.musicVolume ?? 0.5,
      voiceVolume: config.voiceVolume ?? 0.8,
      masterVolume: config.masterVolume ?? 1.0,
    };
    this.sounds = new Map();
  }

  /**
   * Play a sound effect
   */
  playSfx(key: string, config?: Phaser.Types.Sound.SoundConfig): void {
    if (!this.scene.sound) return;
    
    // Check if sound exists
    if (!this.scene.cache.audio.exists(key)) {
      // Silently skip if audio not loaded
      return;
    }
    
    const volume = this.config.sfxVolume * this.config.masterVolume;
    const sound = this.scene.sound.add(key, { volume, ...config });
    sound.play();
    
    // Clean up after playback
    sound.once('complete', () => {
      sound.destroy();
    });
  }

  /**
   * Play hit sound based on damage
   */
  playHitSound(damage: number, wasBlocked: boolean): void {
    if (wasBlocked) {
      this.playSfx('block');
      return;
    }

    if (damage < 10) {
      this.playSfx('hit_light', { rate: 0.9 + Math.random() * 0.2 });
    } else if (damage < 20) {
      this.playSfx('hit_medium', { rate: 0.95 + Math.random() * 0.1 });
    } else {
      this.playSfx('hit_heavy', { rate: 1.0 });
    }
  }

  /**
   * Play whoosh sound for attacks
   */
  playWhoosh(moveType: 'punch' | 'kick' | 'special'): void {
    this.playSfx(`whoosh_${moveType}`, { rate: 0.9 + Math.random() * 0.2 });
  }

  /**
   * Play special move sound
   */
  playSpecialSound(moveId: string): void {
    // Map move IDs to sound keys
    const soundMap: Record<string, string> = {
      'fireball': 'sfx_fireball',
      'uppercut': 'sfx_uppercut',
      'super': 'sfx_super',
    };

    const soundKey = soundMap[moveId];
    if (soundKey) {
      this.playSfx(soundKey);
    }
  }

  /**
   * Play voice clip
   */
  playVoice(key: string): void {
    if (!this.scene.sound || !this.scene.cache.audio.exists(key)) return;
    
    const volume = this.config.voiceVolume * this.config.masterVolume;
    this.scene.sound.play(key, { volume });
  }

  /**
   * Play background music (looping)
   */
  playMusic(key: string, loop: boolean = true): void {
    if (!this.scene.sound || !this.scene.cache.audio.exists(key)) return;
    
    // Stop existing music
    if (this.music) {
      this.music.stop();
      this.music = null;
    }

    const volume = this.config.musicVolume * this.config.masterVolume;
    this.music = this.scene.sound.add(key, { volume, loop });
    this.music.play();
  }

  /**
   * Stop background music
   */
  stopMusic(): void {
    if (this.music) {
      this.music.stop();
      this.music = null;
    }
  }

  /**
   * Update volume settings
   */
  setVolume(category: keyof AudioConfig, volume: number): void {
    this.config[category] = Phaser.Math.Clamp(volume, 0, 1);

    // Update music volume if playing
    if (this.music && category === 'musicVolume') {
      (this.music as Phaser.Sound.WebAudioSound).setVolume(
        this.config.musicVolume * this.config.masterVolume
      );
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopMusic();
    this.sounds.clear();
  }
}
