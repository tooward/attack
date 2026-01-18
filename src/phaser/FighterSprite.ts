/**
 * Fighter Sprite
 * Phaser visual representation of a FighterState
 * Reads from core state, never modifies it
 */

import { FighterState, FighterStatus } from '../core/interfaces/types';

export class FighterSprite extends Phaser.GameObjects.Container {
  private sprite: Phaser.GameObjects.Sprite;
  private healthBar: Phaser.GameObjects.Graphics;
  private energyBar: Phaser.GameObjects.Graphics;
  private nameText: Phaser.GameObjects.Text;
  private currentAnimation: string = '';
  private teamId: number;
  private characterId: string; // Store character ID for sprite selection
  
  // Health bar animation
  private displayedHealth: number = 100;
  private targetHealth: number = 100;
  private recentDamageHealth: number = 100; // Shows recent damage in red

  constructor(scene: Phaser.Scene, fighter: FighterState, displayName?: string) {
    super(scene, fighter.position.x, fighter.position.y);

    this.teamId = fighter.teamId;
    this.characterId = fighter.characterId;
    
    // Create sprite based on character ID
    // Map character IDs to sprite prefixes
    let spritePrefix: string;
    let spriteYOffset: number; // Character-specific vertical offset to align with hurtboxes
    switch (fighter.characterId) {
      case 'musashi':
        spritePrefix = 'player'; // Musashi uses player sprites (96x96)
        spriteYOffset = 30; // Aligned
        break;
      case 'kaze':
        spritePrefix = 'kaze'; // Kaze uses enemy2 sprites (64x64)
        spriteYOffset = 10; // Kaze sprites sit lower, less offset needed
        break;
      case 'tetsuo':
        spritePrefix = 'tetsuo'; // Tetsuo uses enemy4 sprites (64x64)
        spriteYOffset = 50; // Tetsuo sprites have more padding, more offset needed
        break;
      default:
        spritePrefix = 'player'; // Fallback
        spriteYOffset = 30;
    }
    
    this.sprite = new Phaser.GameObjects.Sprite(scene, 0, spriteYOffset, `${spritePrefix}_idle`, 0);
    this.sprite.setOrigin(0.5, 1.0); // Anchor to bottom center for ground alignment
    this.sprite.setScale(2); // Make sprites larger
    this.add(this.sprite);

    // Create health bar
    this.healthBar = new Phaser.GameObjects.Graphics(scene);
    this.add(this.healthBar);

    // Create energy bar
    this.energyBar = new Phaser.GameObjects.Graphics(scene);
    this.add(this.energyBar);

    // Create name text - use displayName if provided, otherwise use fighter.id
    const labelText = displayName || fighter.id;
    this.nameText = new Phaser.GameObjects.Text(scene, 0, -140, labelText, {
      fontSize: '12px',
      color: '#ffffff',
      align: 'center',
    });
    this.nameText.setOrigin(0.5, 0.5);
    this.add(this.nameText);

    scene.add.existing(this);
    this.setDepth(10);
    
    // Initialize health values
    this.displayedHealth = fighter.health;
    this.targetHealth = fighter.health;
    this.recentDamageHealth = fighter.health;
  }

  /**
   * Flash fighter white when taking damage
   */
  flashDamage(): void {
    // Flash white tint
    this.sprite.setTint(0xffffff);
    
    // Return to normal after 100ms
    this.scene.time.delayedCall(100, () => {
      this.sprite.clearTint();
    });
  }

  /**
   * Sync sprite with core fighter state
   * Called every frame after tick()
   */
  sync(fighter: FighterState): void {
    // Update position
    this.setPosition(fighter.position.x, fighter.position.y);

    // Update facing (flip sprite horizontally)
    // Note: enemy2 (Kaze) sprites naturally face LEFT, so flip logic is inverted
    const shouldFlip = fighter.characterId === 'kaze' 
      ? fighter.facing === 1  // Kaze: flip when facing right (since sprites face left)
      : fighter.facing === -1; // Others: flip when facing left (sprites face right)
    
    this.sprite.setFlipX(shouldFlip);
    this.sprite.setScale(2, 2);

    // Update animation based on status
    this.updateVisuals(fighter);

    // Update health bar with animation
    this.updateHealthAnimation(fighter.health);
    this.drawHealthBar(fighter.health, fighter.maxHealth);
    
    // Update energy bar
    this.drawEnergyBar(fighter.energy, fighter.maxEnergy);
  }
  
  /**
   * Update health animation for smooth transitions
   */
  private updateHealthAnimation(currentHealth: number): void {
    // Detect damage
    if (currentHealth < this.targetHealth) {
      // Health decreased - start damage animation
      this.recentDamageHealth = this.displayedHealth; // Save where we were
      this.targetHealth = currentHealth;
    } else if (currentHealth > this.targetHealth) {
      // Health increased (healing)
      this.targetHealth = currentHealth;
      this.recentDamageHealth = currentHealth;
    }
    
    // Smoothly animate displayed health towards target
    const healthDiff = this.targetHealth - this.displayedHealth;
    if (Math.abs(healthDiff) > 0.1) {
      this.displayedHealth += healthDiff * 0.15; // Smooth lerp
    } else {
      this.displayedHealth = this.targetHealth;
    }
    
    // Slowly animate recent damage indicator
    const recentDamageDiff = this.displayedHealth - this.recentDamageHealth;
    if (recentDamageDiff > 0.1) {
      this.recentDamageHealth += recentDamageDiff * 0.03; // Slower than main bar
    } else {
      this.recentDamageHealth = this.displayedHealth;
    }
  }

  /**
   * Update visual representation based on fighter state
   */
  private updateVisuals(fighter: FighterState): void {
    // Map character IDs to sprite prefixes
    let spritePrefix: string;
    switch (fighter.characterId) {
      case 'musashi':
        spritePrefix = 'player';
        break;
      case 'kaze':
        spritePrefix = 'kaze';
        break;
      case 'tetsuo':
        spritePrefix = 'tetsuo';
        break;
      default:
        spritePrefix = 'player';
    }
    
    let animKey = '';

    // Determine animation from status
    switch (fighter.status) {
      case FighterStatus.IDLE:
        animKey = `${spritePrefix}_idle_anim`;
        break;

      case FighterStatus.WALK_FORWARD:
      case FighterStatus.WALK_BACKWARD:
        // Musashi has walk animation, Kaze and Tetsuo use run
        if (fighter.characterId === 'musashi') {
          animKey = `${spritePrefix}_walk_anim`;
        } else {
          animKey = `${spritePrefix}_run_anim`;
        }
        break;

      case FighterStatus.JUMP:
        animKey = `${spritePrefix}_jump_anim`;
        break;

      case FighterStatus.CROUCH:
        // No crouch sprite, use idle for now
        animKey = `${spritePrefix}_idle_anim`;
        break;

      case FighterStatus.ATTACK:
        // Map attack moves to animation keys
        if (fighter.currentMove === 'light_punch' || fighter.currentMove === 'cr_light_punch') {
          animKey = `${spritePrefix}_attack1_anim`;
        } else if (fighter.currentMove === 'heavy_punch' || fighter.currentMove === 'cr_heavy_punch') {
          animKey = `${spritePrefix}_attack2_anim`;
        } else if (fighter.currentMove === 'light_kick' || fighter.currentMove === 'heavy_kick') {
          animKey = `${spritePrefix}_attack3_anim`;
        } else if (fighter.currentMove === 'hadoken' || fighter.currentMove === 'shoryuken') {
          // Musashi specials use special animation, others use dash attack
          if (fighter.characterId === 'musashi') {
            animKey = `${spritePrefix}_special_anim`;
          } else {
            animKey = `${spritePrefix}_dash_attack_anim`;
          }
        } else {
          animKey = `${spritePrefix}_attack1_anim`;
        }
        break;

      case FighterStatus.BLOCK:
        // Musashi has defend sprite, others use idle + visual effect (placeholder)
        if (fighter.characterId === 'musashi') {
          animKey = `${spritePrefix}_defend_anim`;
        } else {
          animKey = `${spritePrefix}_idle_anim`; // Placeholder for missing DEFEND sprite
        }
        break;

      case FighterStatus.HITSTUN:
        animKey = `${spritePrefix}_hurt_anim`;
        break;

      case FighterStatus.BLOCKSTUN:
        // Same as BLOCK
        if (fighter.characterId === 'musashi') {
          animKey = `${spritePrefix}_defend_anim`;
        } else {
          animKey = `${spritePrefix}_idle_anim`; // Placeholder
        }
        break;

      default:
        animKey = `${spritePrefix}_idle_anim`;
    }

    // Only update animation if it changed
    if (animKey !== this.currentAnimation) {
      if (this.scene.anims.exists(animKey)) {
        this.sprite.play(animKey);
        this.currentAnimation = animKey;
      } else {
        console.warn(`[FighterSprite] Animation not found: ${animKey}`);
      }
    }
  }

  /**
   * Draw health bar above fighter
   */
  private drawHealthBar(health: number, maxHealth: number): void {
    const barWidth = 80;
    const barHeight = 6;
    const barX = -barWidth / 2;
    const barY = -130; // Adjusted for new sprite origin
    const healthPercent = Math.max(0, health / maxHealth);

    this.healthBar.clear();

    // Background (black)
    this.healthBar.fillStyle(0x000000, 0.8);
    this.healthBar.fillRect(barX, barY, barWidth, barHeight);
    
    // Recent damage indicator (red bar showing damage taken)
    const recentDamagePercent = Math.max(0, this.recentDamageHealth / maxHealth);
    if (recentDamagePercent > healthPercent) {
      this.healthBar.fillStyle(0xcc0000, 0.6); // Dark red
      this.healthBar.fillRect(barX, barY, barWidth * recentDamagePercent, barHeight);
    }

    // Current displayed health (smoothly animated)
    const displayedPercent = Math.max(0, this.displayedHealth / maxHealth);
    let healthColor = 0xff0000;
    if (displayedPercent > 0.5) {
      healthColor = 0x00ff00;
    } else if (displayedPercent > 0.25) {
      healthColor = 0xffff00;
    }

    this.healthBar.fillStyle(healthColor);
    this.healthBar.fillRect(barX, barY, barWidth * displayedPercent, barHeight);

    // Border (white)
    this.healthBar.lineStyle(1, 0xffffff);
    this.healthBar.strokeRect(barX, barY, barWidth, barHeight);
  }

  /**
   * Draw energy bar above fighter (below health bar)
   */
  private drawEnergyBar(energy: number, maxEnergy: number): void {
    const barWidth = 80;
    const barHeight = 4;
    const barX = -barWidth / 2;
    const barY = -122; // Adjusted for new sprite origin (just below health bar)
    const energyPercent = Math.max(0, energy / maxEnergy);

    this.energyBar.clear();

    // Background (black)
    this.energyBar.fillStyle(0x000000, 0.6);
    this.energyBar.fillRect(barX, barY, barWidth, barHeight);

    // Energy (cyan)
    this.energyBar.fillStyle(0x00ffff);
    this.energyBar.fillRect(barX, barY, barWidth * energyPercent, barHeight);

    // Border (white)
    this.energyBar.lineStyle(1, 0xffffff, 0.5);
    this.energyBar.strokeRect(barX, barY, barWidth, barHeight);
  }

  /**
   * Cleanup
   */
  destroy(fromScene?: boolean): void {
    this.healthBar.destroy();
    this.energyBar.destroy();
    this.nameText.destroy();
    super.destroy(fromScene);
  }
}
