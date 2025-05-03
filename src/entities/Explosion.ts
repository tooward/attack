import { Scene, Physics, Math as PhaserMath, GameObjects, Time, Tilemaps, Animations } from 'phaser';
// Import GameScene to access scene-specific properties like player and platforms
import GameScene from '../scenes/GameScene';
import Player from './Player'; // Ensure Player is imported

export default class Explosion {
    scene: GameScene; // Use GameScene type for better access to properties
    group: Physics.Arcade.Group;
    timer: Time.TimerEvent | null = null; // Initialize as null or handle potential undefined
    landingTimers: Map<number, Time.TimerEvent>; // Assuming key is uniqueId (number)
    explosionRadius: number;

    /**
     * Static method to preload all explosion assets
     * @param {Scene} scene - The scene to use for loading
     */
    static preload(scene: Scene): void { // Add Scene type
        // Load explosion assets
        scene.load.spritesheet('explosion', 'assets/explosion.png', { frameWidth: 64, frameHeight: 64 });
        scene.load.audio('explosion-sound', 'assets/sounds/explosion.wav');
    }

    /**
     * Static method to create explosion animations
     * @param {Scene} scene - The scene to create animations in
     */
    static createAnims(scene: Scene): void { // Add Scene type
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

    constructor(scene: GameScene) { // Use GameScene type
        this.scene = scene;

        // Create the explosions group with physics enabled
        this.group = scene.physics.add.group({
            defaultKey: 'explosion',
            maxSize: 10,
            allowGravity: true, // Explosions should likely fall
            bounceY: 0,
            collideWorldBounds: true
        });

        // Set up collision with platforms (accessing platforms from GameScene)
        if (this.scene.platforms) {
            this.scene.physics.add.collider(
                this.group,
                this.scene.platforms,
                this.handleExplosionLanding as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
                undefined,
                this
            );
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

    spawn(): void { // Add return type void
        // Choose a random x position along the width
        const gameWidth: number = this.scene.sys.game.config.width as number; // Assert type
        const xPos: number = PhaserMath.Between(100, gameWidth - 100);

        console.log("Spawning explosion at x:", xPos);

        // Create the explosion using create
        let explosion = this.group.get(xPos, 50, 'explosion') as Physics.Arcade.Sprite | null; // Use get() for recycling, cast result

        if (explosion) {
            explosion.setActive(true);
            explosion.setVisible(true);
            explosion.setScale(1.5);

            // Enable physics body and set properties
            this.scene.physics.world.enable(explosion);
            const body = explosion.body as Physics.Arcade.Body; // Cast body
            if (body) {
                body.setSize(48, 10);
                body.setOffset(8, 54);
                body.setAllowGravity(true); // Ensure gravity is enabled
                body.setVelocityY(0); // Reset velocity if recycled
                body.setVelocityX(0);
            }

            // Flag to track if this explosion has already exploded
            // Use setData for custom properties on sprites
            explosion.setData('hasExploded', false);

            // Generate a unique ID for this explosion
            explosion.setData('uniqueId', Date.now() + Math.random());
        } else {
            console.error("Failed to create/recycle explosion - group might be full or inactive objects unavailable");
            // No need to call recycleExplosion here as group.get() handles recycling
        }
    }

    /**
     * Checks all characters within explosion radius and applies damage/knockback
     */
    checkCharacterProximity(explosion: Physics.Arcade.Sprite): void {
        const charactersToCheck = [
            this.scene.player,
            ...this.scene.bots
        ];

        // Check each character (player and bots)
        charactersToCheck.forEach(character => {
            // Skip if character doesn't exist, sprite is invalid, or already dead
            if (!character?.sprite || !character.sprite.active || character.dead) {
                return;
            }

            // Calculate distance between character and explosion
            const distance: number = PhaserMath.Distance.Between(
                character.sprite.x, character.sprite.y,
                explosion.x, explosion.y
            );

            // Check if character is within explosion radius
            if (distance <= this.explosionRadius) {
                console.log(`Character in blast radius! Distance: ${distance}, taking damage`);

                // Damage character (50% of max health)
                character.takeDamage(character.maxHealth * 0.5);

                // Apply knockback force away from explosion
                const knockbackForce: number = 300;
                const angle: number = PhaserMath.Angle.Between(
                    explosion.x, explosion.y, 
                    character.sprite.x, character.sprite.y
                );

                // Ensure character sprite body exists and is enabled before setting velocity
                const characterBody = character.sprite.body as Physics.Arcade.Body;
                if (characterBody && characterBody.enable) {
                    characterBody.setVelocity(
                        Math.cos(angle) * knockbackForce,
                        Math.sin(angle) * knockbackForce
                    );
                }
            }
        });
    }

    handleExplosionLanding(explosion: GameObjects.GameObject, platform: GameObjects.GameObject): void {
        // Cast explosion to the correct type
        const expSprite = explosion as Physics.Arcade.Sprite;

        // Check if it's an active sprite and hasn't exploded (using getData)
        if (expSprite && expSprite.active && !expSprite.getData('hasExploded')) {
            console.log("Explosion landed, playing animation");

            // Mark that this explosion has exploded
            expSprite.setData('hasExploded', true);

            // Disable physics body slightly before animation to prevent further collision checks
            if (expSprite.body) {
                (expSprite.body as Physics.Arcade.Body).enable = false;
            }

            // Play the explosion animation
            expSprite.anims.play('explode', true); // Play even if body disabled

            // Play explosion sound
            this.scene.sound.play('explosion-sound');

            // Check all characters' proximity to the explosion
            this.checkCharacterProximity(expSprite);

            // Optional: Draw debug radius
            // this.debugDrawRadius(expSprite);

            // Clean up after animation completes using the animation's complete event
            expSprite.once(Animations.Events.ANIMATION_COMPLETE, () => {
                console.log("Explosion animation complete, disabling sprite.");
                // Make inactive instead of destroying if using a group for recycling
                this.group.killAndHide(expSprite);
                // Ensure body is disabled again if necessary
                if (expSprite.body) {
                    (expSprite.body as Physics.Arcade.Body).enable = false;
                }
            });
        }
    }

    stopSpawning(): void { // Add return type void
        if (this.timer) {
            this.timer.remove();
            this.timer = null; // Clear the timer reference
        }
    }

    // Optional: Debug method to visualize explosion radius
    debugDrawRadius(explosion: Physics.Arcade.Sprite): void { // Type explosion parameter
        const graphics: GameObjects.Graphics = this.scene.add.graphics(); // Type graphics
        graphics.lineStyle(2, 0xff0000, 0.5);
        graphics.strokeCircle(explosion.x, explosion.y, this.explosionRadius);

        // Remove debug visual after explosion animation completes
        explosion.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
            graphics.destroy();
        });
    }
}