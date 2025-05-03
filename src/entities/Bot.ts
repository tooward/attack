import { Scene, Physics, GameObjects, Math as PhaserMath, Types, Animations } from 'phaser';
import Character from './Character';
import Player from './Player';
import SpriteUtils from '../utils/SpriteUtils';

export default class Bot extends Character {
    player: Player;
    isHit: boolean;
    chaseSpeed: number;
    detectionRange: number;
    isChasing: boolean;
    attackCooldown: boolean;

    /**
     * Static method to preload bot assets
     * @param {Scene} scene - The scene to use for loading
     */
    static preload(scene: Scene): void {
        // Load bot sprites
        scene.load.spritesheet('bot-idle', 'assets/enemy/IDLE.png', { frameWidth: 92, frameHeight: 64 });
        scene.load.spritesheet('bot-run', 'assets/enemy/RUN.png', { frameWidth: 92, frameHeight: 64 });
        scene.load.spritesheet('bot-dash', 'assets/enemy/DASH.png', { frameWidth: 92, frameHeight: 64 });
        scene.load.spritesheet('bot-jump', 'assets/enemy/JUMP.png', { frameWidth: 92, frameHeight: 64 });
        scene.load.spritesheet('bot-attack1', 'assets/enemy/ATTACK1.png', { frameWidth: 92, frameHeight: 64 });
        scene.load.spritesheet('bot-attack2', 'assets/enemy/ATTACK2.png', { frameWidth: 92, frameHeight: 64 });
        scene.load.spritesheet('bot-attack3', 'assets/enemy/ATTACK3.png', { frameWidth: 92, frameHeight: 64 });
        scene.load.spritesheet('bot-hurt', 'assets/enemy/HURT.png', { frameWidth: 92, frameHeight: 64 });
        scene.load.spritesheet('bot-die', 'assets/enemy/DEATH.png', { frameWidth: 92, frameHeight: 64 });
    }

    /**
     * Static method to create bot animations
     * @param {Scene} scene - The scene to create animations in
     */
    static createAnims(scene: Scene): void {
        // Create bot animations
        scene.anims.create({
            key: 'bot-idle',
            frames: scene.anims.generateFrameNumbers('bot-idle', { start: 0, end: 4 }), // Assuming 5 frames for idle
            frameRate: 5,
            repeat: -1
        });
        scene.anims.create({
            key: 'bot-run',
            frames: scene.anims.generateFrameNumbers('bot-run', { start: 0, end: 7 }), // Assuming 8 frames for run
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: 'bot-dash',
            frames: scene.anims.generateFrameNumbers('bot-dash', { start: 0, end: 3 }), // Assuming 4 frames for dash
            frameRate: 10,
            repeat: 0 // Dash might not repeat
        });
        scene.anims.create({
            key: 'bot-jump',
            frames: scene.anims.generateFrameNumbers('bot-jump', { start: 0, end: 2 }), // Assuming 3 frames for jump
            frameRate: 10,
            repeat: 0
        });
        // Combine attack animations or create separate ones
        scene.anims.create({
            key: 'bot-attack',
            frames: [
                ...scene.anims.generateFrameNumbers('bot-attack1', { start: 0, end: 4 }),
                ...scene.anims.generateFrameNumbers('bot-attack2', { start: 0, end: 4 }),
                ...scene.anims.generateFrameNumbers('bot-attack3', { start: 0, end: 9 })
            ],
            frameRate: 12,
            repeat: 0
        });
        scene.anims.create({
            key: 'bot-hurt',
            frames: scene.anims.generateFrameNumbers('bot-hurt', { start: 0, end: 1 }), // Assuming 2 frames for hurt
            frameRate: 10,
            repeat: 0
        });
        scene.anims.create({
            key: 'bot-die',
            frames: scene.anims.generateFrameNumbers('bot-die', { start: 0, end: 9 }), // Assuming 10 frames for death
            frameRate: 10,
            repeat: 0
        });
    }

    constructor(scene: Scene, x: number, y: number, player: Player) {
        // Call the parent constructor with bot-specific configuration
        super(scene, x, y, 'bot-idle', {
            maxHealth: 100,
            moveSpeed: 50,
            bodyWidth: 60, 
            bodyHeight: 40,
            bodyOffsetX: 15,
            bodyOffsetY: 24
        });
        
        this.player = player;
        
        // Apply pixel-perfect collision with debug enabled temporarily
        this.setupPixelPerfectCollision(5, true);

        // Bot state
        this.isHit = false;
        this.direction = 1; // 1 for right, -1 for left
        this.chaseSpeed = 75;
        this.detectionRange = 200;
        this.isChasing = false;
        this.attackCooldown = false;

        // Store bot reference on the sprite for targeting during attacks
        this.sprite.setData('isBot', true);
        this.sprite.setData('botRef', this);
        
        // Set up sprite animations
        this.sprite.anims.play('bot-idle', true);
    }

    update(): void {
        // Call the base class update method
        super.update(0, 0);
        
        // Return early if bot is dead or sprite is inactive
        if (this.dead || !this.sprite.body || !this.sprite.active) {
            return;
        }

        // Ensure player and player.sprite exist and are active
        if (!this.player?.sprite?.active) {
            // If player is inactive, do nothing or play idle
            this.sprite.setVelocityX(0);
            if (this.sprite.anims.exists('bot-idle')) {
                this.sprite.anims.play('bot-idle', true);
            }
            return;
        }

        const distanceToPlayer = PhaserMath.Distance.Between(
            this.sprite.x, this.sprite.y,
            this.player.sprite.x, this.player.sprite.y
        );

        // Determine if the bot should be chasing based on distance
        if (distanceToPlayer <= this.detectionRange) {
            this.isChasing = true;
            // Determine direction towards player
            const targetDirection = (this.player.sprite.x > this.sprite.x) ? 1 : -1;
            // Update direction if needed
            if (this.direction !== targetDirection) {
                 this.direction = targetDirection;
            }
            
            // Attack if close enough (within attack range)
            if (distanceToPlayer <= 60 && !this.isHit && !this.attackCooldown) {
                this.attack();
            }
            // Stop movement if very close to player (prevents pushing)
            else if (distanceToPlayer <= 40) {
                if (this.sprite.body) {
                    (this.sprite.body as Physics.Arcade.Body).setVelocityX(0);
                }
                if (this.sprite.anims.exists('bot-idle')) {
                    this.sprite.anims.play('bot-idle', true);
                }
            }
        } else {
            // Player is out of range, stop chasing
            this.isChasing = false;
        }

        // Type guard for body (already checked at the start of update)
        const body = this.sprite.body as Physics.Arcade.Body;

        // Only allow horizontal movement if the bot is on the floor
        if (body.onFloor()) {
            if (this.isChasing) {
                // Move towards the player if chasing and not attacking
                // Only move if not too close (prevents pushing)
                const tooClose = distanceToPlayer <= 40;
                if (!tooClose && (!this.sprite.anims.isPlaying || this.sprite.anims.currentAnim?.key !== 'bot-attack')) {
                    body.setVelocityX(this.chaseSpeed * this.direction);
                    if (this.sprite.anims.exists('bot-run')) {
                        this.sprite.anims.play('bot-run', true);
                    }
                }
            } else {
                // Simple patrol AI
                if (body.blocked.right || body.blocked.left) {
                    this.direction *= -1; // Reverse direction at walls/bounds
                }
                // Move in the current patrol direction
                body.setVelocityX(this.speed * this.direction);
                if (this.sprite.anims.exists('bot-run')) {
                    this.sprite.anims.play('bot-run', true);
                }
            }
        } else {
            // If in the air, stop horizontal movement but keep facing the correct direction
            body.setVelocityX(0);
            // Optionally play a jump/fall animation here if available
            if (this.sprite.anims.exists('bot-jump')) {
                // this.sprite.anims.play('bot-jump', true);
            }
        }

        // Flip sprite based on movement direction, regardless of being on floor
        this.sprite.setFlipX(this.direction < 0);
    }

    attack(): void {
        // Don't attack if already hit or attacking
        if (this.isHit || this.attackCooldown || 
            (this.sprite.anims.isPlaying && 
             this.sprite.anims.currentAnim?.key === 'bot-attack')) {
            return;
        }
        
        // Set attack cooldown at the beginning of the attack
        this.attackCooldown = true;
        
        // Stop movement during attack
        if (this.sprite.body) {
            (this.sprite.body as Physics.Arcade.Body).setVelocityX(0);
        }
        
        // Play attack animation
        this.sprite.anims.play('bot-attack', true);
        
        // On attack animation completion, attempt to damage player
        this.sprite.once(Animations.Events.ANIMATION_COMPLETE_KEY + 'bot-attack', () => {
            // Check if player is in range
            if (this.player && this.player.sprite.active) {
                const distanceToPlayer = PhaserMath.Distance.Between(
                    this.sprite.x, this.sprite.y,
                    this.player.sprite.x, this.player.sprite.y
                );
                
                // Only damage player if in attack range
                if (distanceToPlayer <= 60 && !this.player.dead) {
                    this.player.takeDamage(15); // Deal damage to player
                    
                    // Knockback effect on player
                    const knockbackDirection = this.player.sprite.x < this.sprite.x ? -1 : 1;
                    if (this.player.sprite.body) {
                        (this.player.sprite.body as Physics.Arcade.Body).setVelocityX(knockbackDirection * 150);
                    }
                }
            }
            
            // Reset attack cooldown after a delay (same as player's 500ms)
            this.scene.time.delayedCall(500, () => {
                this.attackCooldown = false; // Reset attack cooldown
                // Return to run animation if still chasing
                if (this.isChasing && this.sprite.active) {
                    this.sprite.anims.play('bot-run', true);
                }
            });
        });
    }

    takeDamage(amount: number): void {
        if (this.isHit || this.dead) return;

        // Call the parent takeDamage method
        super.takeDamage(amount);
        
        this.isHit = true;

        // Visual feedback
        if (this.sprite.anims.exists('bot-hurt')) {
            this.sprite.anims.play('bot-hurt', true);
        }

        // Reset after a short delay
        this.scene.time.delayedCall(500, () => {
            this.isHit = false;
            // Optionally return to idle or run animation
            if (!this.dead) {
                if (this.sprite.body?.velocity.x !== 0 && this.sprite.anims.exists('bot-run')) {
                    this.sprite.anims.play('bot-run', true);
                } else if (this.sprite.anims.exists('bot-idle')) {
                    this.sprite.anims.play('bot-idle', true);
                }
            }
        });
    }

    die(): void {
        if (this.dead) return;
        
        // Call parent die method
        super.die();

        if (this.sprite.anims.exists('bot-die')) {
            this.sprite.anims.play('bot-die', true);
        }

        // Use 'animationcomplete-key' format
        this.sprite.once(Animations.Events.ANIMATION_COMPLETE_KEY + 'bot-die', () => {
            this.sprite.destroy();
        });
    }

    setupPlayerCollision(player: Player): void {
        // Ensure player sprite exists before setting up overlap
        if (!player.sprite) {
            console.error("Player sprite not available for collision setup.");
            return;
        }
        
        // Use an overlap instead of a collider to prevent pushing
        this.scene.physics.add.overlap(player.sprite, this.sprite, () => {
            // The overlap callback is empty because combat is handled in the update method
            // This just triggers overlap detection without solid physics collision
        });
    }
}