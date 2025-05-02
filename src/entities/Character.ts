// filepath: /Users/mike/Development/attack/src/entities/Character.ts
import { Scene, Physics, GameObjects, Math as PhaserMath, Types, Animations } from 'phaser';

/**
 * Base class for characters in the game (player and bots).
 * Contains shared functionality for all character types.
 */
export default abstract class Character {
    scene: Scene;
    sprite: Physics.Arcade.Sprite;
    health: number;
    maxHealth: number;
    dead: boolean;
    direction: number; // 1 for right, -1 for left
    moveSpeed: number;

    /**
     * Constructor for the base character
     * @param scene The current game scene
     * @param x Initial x position
     * @param y Initial y position 
     * @param textureKey Key for the initial texture
     * @param config Additional configuration options
     */
    constructor(
        scene: Scene, 
        x: number, 
        y: number, 
        textureKey: string,
        config: {
            maxHealth?: number;
            moveSpeed?: number;
            bodyWidth?: number;
            bodyHeight?: number;
            bodyOffsetX?: number;
            bodyOffsetY?: number;
        } = {}
    ) {
        this.scene = scene;
        
        // Create the character sprite
        this.sprite = scene.physics.add.sprite(x, y, textureKey);
        
        // Set up physics body
        if (this.sprite.body) {
            const body = this.sprite.body as Physics.Arcade.Body;
            
            // Set body properties with defaults that can be overridden
            body.setSize(
                config.bodyWidth || 60, 
                config.bodyHeight || 80
            );
            body.setOffset(
                config.bodyOffsetX || 20, 
                config.bodyOffsetY || 10
            );
            body.setCollideWorldBounds(true);
            body.setGravityY(600);
        } else {
            console.error("Character sprite body not created.");
        }
        
        // Character stats with defaults
        this.maxHealth = config.maxHealth || 100;
        this.health = this.maxHealth;
        this.moveSpeed = config.moveSpeed || 160;
        this.dead = false;
        this.direction = 1; // Default facing right
    }
    
    /**
     * Update method to be called each frame
     * @param time Current time
     * @param delta Time since last frame
     */
    update(time: number, delta: number): void {
        if (this.dead || !this.sprite.body) return;
        // Child classes should override this method
    }
    
    /**
     * Handle taking damage
     * @param amount Amount of damage to take
     */
    takeDamage(amount: number): void {
        if (this.dead) return;
        
        this.health -= amount;
        
        // Visual feedback (can be overridden by child classes)
        this.sprite.setTint(0xff0000);
        this.scene.time.delayedCall(100, () => {
            if (this.sprite.active) this.sprite.clearTint();
        });
        
        if (this.health <= 0) {
            this.health = 0;
            this.die();
        }
    }
    
    /**
     * Handle death
     */
    die(): void {
        if (this.dead) return;
        
        this.dead = true;
        if (this.sprite.body) {
            this.sprite.setVelocity(0, -200); // Small upward force on death
        }
        
        // Child classes should implement animation playing and cleanup
    }
    
    /**
     * Reset character to initial state
     * @param x Position x to reset to
     * @param y Position y to reset to
     */
    reset(x: number, y: number): void {
        this.sprite.setPosition(x, y);
        if (this.sprite.body) {
            this.sprite.setVelocity(0, 0);
        }
        this.dead = false;
        this.health = this.maxHealth;
    }
    
    /**
     * Common movement helper: move left
     */
    moveLeft(): void {
        if (!this.sprite.body) return;
        this.sprite.setVelocityX(-this.moveSpeed);
        this.sprite.flipX = true;
        this.direction = -1;
    }
    
    /**
     * Common movement helper: move right
     */
    moveRight(): void {
        if (!this.sprite.body) return;
        this.sprite.setVelocityX(this.moveSpeed);
        this.sprite.flipX = false;
        this.direction = 1;
    }
    
    /**
     * Common movement helper: stop horizontal movement
     */
    idle(): void {
        if (!this.sprite.body) return;
        this.sprite.setVelocityX(0);
    }
    
    /**
     * Common movement helper: jump
     * @param jumpForce Force of the jump (negative for up)
     */
    jump(jumpForce: number = -500): void {
        if (!this.sprite.body) return;
        this.sprite.setVelocityY(jumpForce);
    }
    
    /**
     * Check if character is on the ground
     * @returns true if on floor, false otherwise
     */
    isOnGround(): boolean {
        if (!this.sprite.body) return false;
        return (this.sprite.body as Physics.Arcade.Body).onFloor();
    }
    
    /**
     * Utility to check if another sprite is within range
     * @param target Target sprite to check distance to
     * @param range Maximum range to consider "in range"
     * @returns true if target is within range, false otherwise
     */
    isTargetInRange(target: Physics.Arcade.Sprite, range: number): boolean {
        if (!target || !target.active) return false;
        
        const distance = PhaserMath.Distance.Between(
            this.sprite.x, this.sprite.y,
            target.x, target.y
        );
        
        return distance <= range;
    }
}