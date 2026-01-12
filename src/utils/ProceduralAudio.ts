/**
 * Procedural Audio Generation
 * 
 * Generates sound effects procedurally using Web Audio API
 * Creates realistic fighting game sounds without asset files
 */

export class ProceduralAudio {
  /**
   * Generate all procedural sounds
   */
  static generateAllSounds(scene: Phaser.Scene): void {
    const audioContext = (scene.sound.context as AudioContext);
    
    if (!audioContext) {
      console.log('Audio system initialized (Web Audio not available)');
      return;
    }
    
    // Generate hit sounds
    this.createHitSound(scene, 'hit_light', 0.3, 300, 150);
    this.createHitSound(scene, 'hit_medium', 0.5, 250, 120);
    this.createHitSound(scene, 'hit_heavy', 0.8, 180, 80);
    
    // Generate block sound
    this.createBlockSound(scene, 'block');
    
    // Generate whoosh sounds
    this.createWhooshSound(scene, 'whoosh_punch', 0.3, 400);
    this.createWhooshSound(scene, 'whoosh_kick', 0.4, 350);
    this.createWhooshSound(scene, 'whoosh_special', 0.5, 300);
    
    // Generate special move sounds
    this.createFireballSound(scene, 'sfx_fireball');
    this.createUppercutSound(scene, 'sfx_uppercut');
    this.createSuperSound(scene, 'sfx_super');
    
    console.log('✓ Procedural audio generated (11 sounds)');
  }
  
  /**
   * Create hit impact sound
   */
  private static createHitSound(
    scene: Phaser.Scene, 
    key: string, 
    volume: number, 
    frequency: number, 
    duration: number
  ): void {
    const audioContext = scene.sound.context as AudioContext;
    const sampleRate = audioContext.sampleRate;
    const numSamples = Math.floor(sampleRate * duration / 1000);
    const buffer = audioContext.createBuffer(1, numSamples, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const decay = Math.exp(-t * 10);
      const noise = (Math.random() * 2 - 1) * 0.3;
      const tone = Math.sin(2 * Math.PI * frequency * t * (1 - t * 2));
      data[i] = (noise * 0.7 + tone * 0.3) * decay * volume;
    }
    
    // Add to Phaser's cache
    (scene.game.cache.audio as any).add(key, buffer);
  }
  
  /**
   * Create block/deflect sound
   */
  private static createBlockSound(scene: Phaser.Scene, key: string): void {
    const audioContext = scene.sound.context as AudioContext;
    const sampleRate = audioContext.sampleRate;
    const numSamples = Math.floor(sampleRate * 0.1);
    const buffer = audioContext.createBuffer(1, numSamples, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const decay = Math.exp(-t * 20);
      const noise = (Math.random() * 2 - 1);
      const tone = Math.sin(2 * Math.PI * 800 * t);
      data[i] = (noise * 0.5 + tone * 0.5) * decay * 0.4;
    }
    
    (scene.game.cache.audio as any).add(key, buffer);
  }
  
  /**
   * Create whoosh/swing sound
   */
  private static createWhooshSound(
    scene: Phaser.Scene, 
    key: string, 
    volume: number, 
    startFreq: number
  ): void {
    const audioContext = scene.sound.context as AudioContext;
    const sampleRate = audioContext.sampleRate;
    const numSamples = Math.floor(sampleRate * 0.15);
    const buffer = audioContext.createBuffer(1, numSamples, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const progress = i / numSamples;
      const freq = startFreq - progress * 200; // Pitch sweep down
      const noise = (Math.random() * 2 - 1);
      const filtered = noise * (1 - progress * 0.5);
      data[i] = filtered * volume * (1 - progress * 0.3);
    }
    
    (scene.game.cache.audio as any).add(key, buffer);
  }
  
  /**
   * Create fireball projectile sound
   */
  private static createFireballSound(scene: Phaser.Scene, key: string): void {
    const audioContext = scene.sound.context as AudioContext;
    const sampleRate = audioContext.sampleRate;
    const numSamples = Math.floor(sampleRate * 0.3);
    const buffer = audioContext.createBuffer(1, numSamples, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const progress = i / numSamples;
      const rumble = Math.sin(2 * Math.PI * 60 * t);
      const hiss = (Math.random() * 2 - 1) * (1 - progress * 0.5);
      const tone = Math.sin(2 * Math.PI * 200 * t);
      data[i] = (rumble * 0.4 + hiss * 0.4 + tone * 0.2) * 0.5 * (1 - progress * 0.3);
    }
    
    (scene.game.cache.audio as any).add(key, buffer);
  }
  
  /**
   * Create uppercut/rising sound
   */
  private static createUppercutSound(scene: Phaser.Scene, key: string): void {
    const audioContext = scene.sound.context as AudioContext;
    const sampleRate = audioContext.sampleRate;
    const numSamples = Math.floor(sampleRate * 0.4);
    const buffer = audioContext.createBuffer(1, numSamples, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const progress = i / numSamples;
      const freq = 200 + progress * 400; // Pitch sweep up
      const tone = Math.sin(2 * Math.PI * freq * t);
      const envelope = progress < 0.1 ? progress * 10 : (1 - progress) * 1.2;
      data[i] = tone * envelope * 0.6;
    }
    
    (scene.game.cache.audio as any).add(key, buffer);
  }
  
  /**
   * Create super move dramatic sound
   */
  private static createSuperSound(scene: Phaser.Scene, key: string): void {
    const audioContext = scene.sound.context as AudioContext;
    const sampleRate = audioContext.sampleRate;
    const numSamples = Math.floor(sampleRate * 0.5);
    const buffer = audioContext.createBuffer(1, numSamples, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const progress = i / numSamples;
      
      // Complex waveform with multiple frequencies
      const bass = Math.sin(2 * Math.PI * 80 * t);
      const mid = Math.sin(2 * Math.PI * 240 * t * (1 + progress));
      const high = Math.sin(2 * Math.PI * 600 * t);
      
      const envelope = progress < 0.2 ? progress * 5 : (1 - progress) * 1.3;
      data[i] = (bass * 0.5 + mid * 0.3 + high * 0.2) * envelope * 0.7;
    }
    
    (scene.game.cache.audio as any).add(key, buffer);
  }
}

