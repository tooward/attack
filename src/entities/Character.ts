// filepath: /Users/mike/Development/attack/src/entities/Character.ts
import { Scene, Physics, GameObjects, Math as PhaserMath, Types, Animations } from 'phaser';
import SpriteUtils from '../utils/SpriteUtils';

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
            body.setDragX(300); // Horizontal drag for smoother movement/stopping
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
        
        // Handle hitbox adjustment for sprite flipping
        this.updateHitboxForFlip();
        
        // Child classes should override this method
    }
    
    /**
     * Update the hitbox offset when character changes direction
     * This handles the pixel-perfect collision adjustment for flipped sprites
     */
    updateHitboxForFlip(): void {
        // Skip if sprite is inactive or has no body
        if (!this.sprite.active || !this.sprite.body) return;
        
        // Get the last recorded flip state
        const lastFlipX = this.sprite.getData('lastFlipX');
        
        // If flip state changed and we have the necessary data
        if (lastFlipX !== undefined && lastFlipX !== this.sprite.flipX) {
            const leftOffset = this.sprite.getData('leftOffset');
            const rightOffset = this.sprite.getData('rightOffset');
            const topOffset = this.sprite.getData('topOffset');
            
            // If we have the necessary offset data
            if (leftOffset !== undefined && rightOffset !== undefined) {
                const body = this.sprite.body as Physics.Arcade.Body;
                // Apply the appropriate offset based on current flip state
                body.offset.x = this.sprite.flipX ? rightOffset : leftOffset;
                
                // Update the stored flip state
                this.sprite.setData('lastFlipX', this.sprite.flipX);
            }
        }
    }
    
    /**
     * Handle taking damage
     * @param amount Amount of damage to take
     */
    takeDamage(amount: number): void {
        if (this.dead) return;
        
        this.health -= amount;
        
        // Visual feedback (can be overridden by child classes)
        // this.sprite.setTint(0xff0000);
        // this.scene.time.delayedCall(100, () => {
        //     if (this.sprite.active) this.sprite.clearTint();
        // });
        
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

    /**
     * Set up collision with platforms
     * @param platforms The tilemap layer to collide with
     */
    setupPlatformCollision(platforms: Phaser.Tilemaps.TilemapLayer): void {
        if (platforms) {
            this.scene.physics.add.collider(this.sprite, platforms);
        }
    }
    
    /**
     * Apply pixel-perfect collision based on sprite image
     * @param padding Optional padding around the collision shape
     * @param debug Whether to show debug visualization of the collision shape
     */
    setupPixelPerfectCollision(padding: number = 5, debug: boolean = false): void {
        // Wait for the next frame to ensure the texture is fully loaded
        this.scene.time.delayedCall(0, () => {
            if (this.sprite.active) {
                // Apply pixel-perfect collision body with padding and optional debug
                SpriteUtils.trimBodyToSprite(this.scene, this.sprite, padding, debug);
                
                if (debug) {
                    // Set up a check to wait until the character has landed
                    const waitForLanding = () => {
                        // Safety check: if sprite is no longer active or body is gone, clean up and exit
                        if (!this.sprite || !this.sprite.active || !this.sprite.body) {
                            this.scene.events.off('update', waitForLanding);
                            return;
                        }
                        
                        const body = this.sprite.body as Physics.Arcade.Body;
                        // Only show debug once character is on ground and settled
                        if (body.onFloor() && Math.abs(body.velocity.y) < 10) {
                            // Show debug hitbox now that character has landed
                            const showDebugFn = this.sprite.getData('showDebugHitbox');
                            if (typeof showDebugFn === 'function') {
                                showDebugFn();
                            }
                            // Stop checking
                            this.scene.events.off('update', waitForLanding);
                        }
                    };
                    
                    // Start checking each frame for landing
                    this.scene.events.on('update', waitForLanding);
                    
                    // Safety timeout - show debug anyway after 2 seconds if not landed
                    this.scene.time.delayedCall(2000, () => {
                        const showDebugFn = this.sprite.getData('showDebugHitbox');
                        if (typeof showDebugFn === 'function' && this.sprite.active) {
                            this.scene.events.off('update', waitForLanding);
                            showDebugFn();
                        }
                    });
                }
            }
        });
    }
}