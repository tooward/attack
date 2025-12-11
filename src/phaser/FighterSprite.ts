/**
 * Fighter Sprite
 * Phaser visual representation of a FighterState
 * Reads from core state, never modifies it
 */

import { FighterState, FighterStatus } from '../core/interfaces/types';

export class FighterSprite extends Phaser.GameObjects.Container {
  private bodyRect: Phaser.GameObjects.Rectangle;
  private healthBar: Phaser.GameObjects.Graphics;
  private energyBar: Phaser.GameObjects.Graphics;
  private nameText: Phaser.GameObjects.Text;
  private currentAnimation: string = '';

  constructor(scene: Phaser.Scene, fighter: FighterState) {
    super(scene, fighter.position.x, fighter.position.y);

    // Create body as colored rectangle (placeholder until real sprites)
    const color = fighter.teamId === 0 ? 0x4488ff : 0xff4444;
    this.bodyRect = scene.add.rectangle(0, -40, 60, 80, color);
    this.add(this.bodyRect);

    // Create health bar
    this.healthBar = scene.add.graphics();
    this.add(this.healthBar);

    // Create energy bar
    this.energyBar = scene.add.graphics();
    this.add(this.energyBar);

    // Create name text
    this.nameText = scene.add.text(0, -100, fighter.id, {
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
   * Sync sprite with core fighter state
   * Called every frame after tick()
   */
  sync(fighter: FighterState): void {
    // Update position
    this.setPosition(fighter.position.x, fighter.position.y);

    // Update facing (flip sprite horizontally)
    this.bodyRect.setScale(fighter.facing, 1);

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
    let targetAnimation = '';

    // Determine animation from status
    switch (fighter.status) {
      case FighterStatus.IDLE:
        targetAnimation = 'idle';
        this.bodyRect.setFillStyle(fighter.teamId === 0 ? 0x4488ff : 0xff4444);
        break;

      case FighterStatus.WALK_FORWARD:
      case FighterStatus.WALK_BACKWARD:
        targetAnimation = 'walk';
        this.bodyRect.setFillStyle(fighter.teamId === 0 ? 0x5599ff : 0xff5555);
        break;

      case FighterStatus.JUMP:
        targetAnimation = 'jump';
        this.bodyRect.setFillStyle(fighter.teamId === 0 ? 0x66aaff : 0xff6666);
        break;

      case FighterStatus.CROUCH:
        targetAnimation = 'crouch';
        this.bodyRect.setFillStyle(fighter.teamId === 0 ? 0x3377dd : 0xdd3333);
        this.bodyRect.setSize(60, 60);
        this.bodyRect.setPosition(0, -30);
        break;

      case FighterStatus.ATTACK:
        targetAnimation = `attack_${fighter.currentMove || 'default'}`;
        this.bodyRect.setFillStyle(0xffff00); // Yellow when attacking
        break;

      case FighterStatus.BLOCK:
        targetAnimation = 'block';
        this.bodyRect.setFillStyle(0x00ff00); // Green when blocking
        break;

      case FighterStatus.HITSTUN:
        targetAnimation = 'hitstun';
        this.bodyRect.setFillStyle(0xff00ff); // Magenta in hitstun
        break;

      case FighterStatus.BLOCKSTUN:
        targetAnimation = 'blockstun';
        this.bodyRect.setFillStyle(0x00ffff); // Cyan in blockstun
        break;

      default:
        targetAnimation = 'idle';
    }

    // Reset body size if not crouching
    if (fighter.status !== FighterStatus.CROUCH) {
      this.bodyRect.setSize(60, 80);
      this.bodyRect.setPosition(0, -40);
    }

    this.currentAnimation = targetAnimation;
  }

  /**
   * Draw health bar above fighter
   */
  private drawHealthBar(health: number, maxHealth: number): void {
    const barWidth = 80;
    const barHeight = 6;
    const barX = -barWidth / 2;
    const barY = -90;
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
    const barY = -82; // Just below health bar
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
