import { Scene, Physics, Math as PhaserMath, GameObjects } from 'phaser';

export default class Explosion {
    /**
     * Static method to preload all explosion assets
     * @param {Scene} scene - The scene to use for loading
     */
    static preload(scene) {
        // Load explosion assets
        scene.load.spritesheet('explosion', 'assets/explosion.png', { frameWidth: 64, frameHeight: 64 });
        scene.load.audio('explosion-sound', 'assets/sounds/explosion.wav');
    }
    
    /**
     * Static method to create explosion animations
     * @param {Scene} scene - The scene to create animations in
     */
    static createAnims(scene) {
        // Create explosion animation
        scene.anims.create({
            key: 'explode',
            frames: scene.anims.generateFrameNumbers('explosion', { start: 0, end: 7 }),
            frameRate: 20,
            repeat: 0,
            hideOnComplete: true
        });
        
        // Debug the explosion animation
        const explosionAnim = scene.anims.get('explode');
        if (explosionAnim) {
            console.log("DEBUG: 'explode' animation details:", explosionAnim);
            explosionAnim.frames.forEach((frame, index) => {
                console.log(`Frame ${index}: key = ${frame.textureKey}, frame = ${frame.frame}`);
            });
        } else {
            console.error("DEBUG: 'explode' animation was not created properly!");
        }
    }

    constructor(scene) {
        this.scene = scene;
        
        // Create the explosions group with physics enabled
        this.group = scene.physics.add.group({
            defaultKey: 'explosion',
            maxSize: 10,
            allowGravity: true,
            bounceY: 0,
            collideWorldBounds: true
        });
        
        // Set up collision with platforms
        if (scene.platforms) {
            scene.physics.add.collider(this.group, scene.platforms, this.handleExplosionLanding, null, this);
        }
        
        // Timer for spawning explosions
        this.timer = scene.time.addEvent({
            delay: 3000,
            callback: this.spawn,
            callbackScope: this,
            loop: true
        });
        
        // Store landing timers for each explosion
        this.landingTimers = new Map();
        
        // Explosion damage radius in pixels
        this.explosionRadius = 150;
    }
    
    spawn() {
        // Choose a random x position along the width
        const gameWidth = this.scene.sys.game.config.width;
        const xPos = PhaserMath.Between(100, gameWidth - 100);
        
        console.log("Spawning explosion at x:", xPos);
        
        // Create the explosion using create 
        let explosion = this.group.create(xPos, 50, 'explosion');
        
        if (explosion) {
            explosion.setActive(true);
            explosion.setVisible(true);
            explosion.setScale(1.5);
            
            // Set a small collision box at the bottom of the explosion sprite
            explosion.body.setSize(48, 10);
            explosion.body.setOffset(8, 54);
            
            // Flag to track if this explosion has already exploded
            explosion.hasExploded = false;
            
            // Generate a unique ID for this explosion
            explosion.uniqueId = Date.now() + Math.random();
        } else {
            console.error("Failed to create explosion - group is likely full");
            this.recycleExplosion(xPos);
        }
    }
    
    recycleExplosion(xPos) {
        // Try to recycle an old explosion
        this.group.getChildren().some(oldExplosion => {
            if (!oldExplosion.active || !oldExplosion.visible) {
                oldExplosion.setPosition(xPos, 50);
                oldExplosion.setActive(true);
                oldExplosion.setVisible(true);
                oldExplosion.body.enable = true;
                oldExplosion.hasExploded = false;
                
                // Generate a unique ID for this explosion
                oldExplosion.uniqueId = Date.now() + Math.random();
                
                return true; // Break the loop
            }
            return false;
        });
    }
    
    handleExplosionLanding(explosion, platform) {
        // Only trigger if the explosion hasn't exploded yet
        if (explosion && explosion.active && !explosion.hasExploded) {
            console.log("Explosion landed on ground, playing animation");
            
            // Mark that this explosion has already exploded
            explosion.hasExploded = true;
            
            // Play the explosion animation
            explosion.anims.play('explode');
            
            // Play explosion sound
            this.scene.sound.play('explosion-sound');
            
            // Check if player is within damage radius
            this.checkPlayerProximity(explosion);
            
            // Clean up after animation completes
            explosion.once('animationcomplete', () => {
                explosion.setActive(false);
                explosion.setVisible(false);
                explosion.body.enable = false;
                explosion.disableBody(true, true);
            });
        }
    }
    
    checkPlayerProximity(explosion) {
        // Get player from the scene
        const player = this.scene.player;
        
        if (player && !player.dead) {
            // Calculate distance between player and explosion
            const distance = PhaserMath.Distance.Between(
                player.sprite.x, player.sprite.y,
                explosion.x, explosion.y
            );
            
            // Check if player is within explosion radius
            if (distance <= this.explosionRadius) {
                console.log(`Player in blast radius! Distance: ${distance}, taking damage`);
                
                // Damage player (50% of max health)
                player.takeDamage(player.maxHealth * 0.5);
                
                // Apply knockback force away from explosion
                const knockbackForce = 300;
                const angle = PhaserMath.Angle.Between(explosion.x, explosion.y, player.sprite.x, player.sprite.y);
                player.sprite.setVelocity(
                    Math.cos(angle) * knockbackForce,
                    Math.sin(angle) * knockbackForce
                );
            }
        }
    }
    
    setupPlayerCollision(player) {
        // No need for overlap handling as explosions now explode on ground contact
        // and damage is based on proximity
    }
    
    stopSpawning() {
        if (this.timer) {
            this.timer.remove();
        }
    }
    
    // Optional: Debug method to visualize explosion radius
    debugDrawRadius(explosion) {
        const graphics = this.scene.add.graphics();
        graphics.lineStyle(2, 0xff0000, 0.5);
        graphics.strokeCircle(explosion.x, explosion.y, this.explosionRadius);
        
        // Remove debug visual after explosion animation completes
        explosion.once('animationcomplete', () => {
            graphics.destroy();
        });
    }
}