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

  constructor(scene: Phaser.Scene, fighter: FighterState) {
    super(scene, fighter.position.x, fighter.position.y);

    console.log(`[FighterSprite] Constructor called for ${fighter.id}, team ${fighter.teamId}`);
    this.teamId = fighter.teamId;
    
    // Create sprite based on team (player vs enemy) - use frame 0 initially
    const spritePrefix = fighter.teamId === 0 ? 'player' : 'enemy';
    this.sprite = new Phaser.GameObjects.Sprite(scene, 0, -10, `${spritePrefix}_idle`, 0);
    this.sprite.setOrigin(0.5, 1.0); // Anchor to bottom center for ground alignment
    this.sprite.setScale(2); // Make sprites larger
    this.add(this.sprite);
    console.log(`[FighterSprite] Sprite image created and added to container`);

    // Create health bar
    this.healthBar = new Phaser.GameObjects.Graphics(scene);
    this.add(this.healthBar);

    // Create energy bar
    this.energyBar = new Phaser.GameObjects.Graphics(scene);
    this.add(this.energyBar);

    // Create name text
    this.nameText = new Phaser.GameObjects.Text(scene, 0, -140, fighter.id, {
      fontSize: '12px',
      color: '#ffffff',
      align: 'center',
    });
    this.nameText.setOrigin(0.5, 0.5);
    this.add(this.nameText);

    scene.add.existing(this);
    this.setDepth(10);
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
    this.sprite.setScale(fighter.facing * 2, 2);

    // Update animation based on status
    this.updateVisuals(fighter);

    // Update health bar
    this.drawHealthBar(fighter.health, fighter.maxHealth);
    
    // Update energy bar
    this.drawEnergyBar(fighter.energy, fighter.maxEnergy);
  }

  /**
   * Update visual representation based on fighter state
   */
  private updateVisuals(fighter: FighterState): void {
    const spritePrefix = this.teamId === 0 ? 'player' : 'enemy';
    let spriteKey = '';

    // Determine sprite from status
    switch (fighter.status) {
      case FighterStatus.IDLE:
        spriteKey = `${spritePrefix}_idle`;
        break;

      case FighterStatus.WALK_FORWARD:
      case FighterStatus.WALK_BACKWARD:
        // Use walk for player, run for enemy (since enemy doesn't have walk)
        spriteKey = this.teamId === 0 ? `${spritePrefix}_walk` : `${spritePrefix}_run`;
        break;

      case FighterStatus.JUMP:
        spriteKey = this.teamId === 0 ? `${spritePrefix}_jump` : `${spritePrefix}_jump`;
        break;

      case FighterStatus.CROUCH:
        // No crouch sprite, use idle for now
        spriteKey = `${spritePrefix}_idle`;
        break;

      case FighterStatus.ATTACK:
        // Map attack moves to sprite keys
        if (fighter.currentMove === 'lightPunch' || fighter.currentMove === 'crLightPunch') {
          spriteKey = `${spritePrefix}_attack1`;
        } else if (fighter.currentMove === 'heavyPunch' || fighter.currentMove === 'crHeavyPunch') {
          spriteKey = `${spritePrefix}_attack2`;
        } else if (fighter.currentMove === 'lightKick' || fighter.currentMove === 'heavyKick') {
          spriteKey = `${spritePrefix}_attack3`;
        } else if (fighter.currentMove === 'hadoken' || fighter.currentMove === 'shoryuken') {
          spriteKey = this.teamId === 0 ? `${spritePrefix}_special` : `${spritePrefix}_dash`;
        } else {
          spriteKey = `${spritePrefix}_attack1`;
        }
        break;

      case FighterStatus.BLOCK:
        spriteKey = this.teamId === 0 ? `${spritePrefix}_defend` : `${spritePrefix}_defence`;
        break;

      case FighterStatus.HITSTUN:
        spriteKey = `${spritePrefix}_hurt`;
        break;

      case FighterStatus.BLOCKSTUN:
        spriteKey = this.teamId === 0 ? `${spritePrefix}_defend` : `${spritePrefix}_defence`;
        break;

      default:
        spriteKey = `${spritePrefix}_idle`;
    }

    // Only update texture if it changed
    if (spriteKey !== this.currentAnimation) {
      this.sprite.setTexture(spriteKey, 0); // Use frame 0
      this.currentAnimation = spriteKey;
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

    // Health (red to yellow to green based on percentage)
    let healthColor = 0xff0000;
    if (healthPercent > 0.5) {
      healthColor = 0x00ff00;
    } else if (healthPercent > 0.25) {
      healthColor = 0xffff00;
    }

    this.healthBar.fillStyle(healthColor);
    this.healthBar.fillRect(barX, barY, barWidth * healthPercent, barHeight);

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
