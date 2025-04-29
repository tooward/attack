import { Scene, Physics, GameObjects, Math as PhaserMath, Types, Animations } from 'phaser';
import Player from './Player'; // Assuming Player class is in the same directory

export default class Bot {
    scene: Scene;
    player: Player;
    sprite: Physics.Arcade.Sprite;
    isHit: boolean;
    health: number;
    direction: number;
    speed: number;
    chaseSpeed: number;
    detectionRange: number;
    isChasing: boolean;

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
                ...scene.anims.generateFrameNumbers('bot-attack1', { start: 0, end: 5 }), // Assuming 6 frames
                ...scene.anims.generateFrameNumbers('bot-attack2', { start: 0, end: 5 }), // Assuming 6 frames
                ...scene.anims.generateFrameNumbers('bot-attack3', { start: 0, end: 5 })  // Assuming 6 frames
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
        this.scene = scene;
        this.player = player;

        // Create the bot sprite
        this.sprite = scene.physics.add.sprite(x, y, 'bot-idle');

        // Add null check for the body before setting properties
        if (this.sprite.body) {
            const body = this.sprite.body as Physics.Arcade.Body;
            body.setCollideWorldBounds(true);
            // Adjust body size if necessary based on actual sprite dimensions
            body.setSize(40, 60); // Example: Adjusted size
            body.setOffset(26, 4); // Example: Adjusted offset
        } else {
            console.error("Bot sprite body not created.");
            // Handle error appropriately, maybe disable the bot or throw
        }

        // Bot state
        this.isHit = false;
        this.health = 100;
        this.direction = 1; // 1 for right, -1 for left
        this.speed = 50;
        this.chaseSpeed = 75;
        this.detectionRange = 200;
        this.isChasing = false;

        // Set up sprite animations
        this.sprite.anims.play('bot-idle', true);
    }

    update(): void {
        // Add null check for bot's own sprite body
        if (!this.sprite.body || !this.sprite.active) {
            return;
        }
        // Ensure player and player.sprite exist and are active
        // Access player properties correctly (e.g., player.sprite)
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
            this.player.sprite.x, this.player.sprite.y // Correct access
        );

        // Determine if the bot should be chasing based on distance
        if (distanceToPlayer <= this.detectionRange) {
            this.isChasing = true;
            // Determine direction towards player
            const targetDirection = (this.player.sprite.x > this.sprite.x) ? 1 : -1; // Correct access
            // Update direction if needed
            if (this.direction !== targetDirection) {
                 this.direction = targetDirection;
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
                // Move towards the player if chasing
                body.setVelocityX(this.chaseSpeed * this.direction);
                if (this.sprite.anims.exists('bot-run')) {
                    this.sprite.anims.play('bot-run', true);
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
                // this.sprite.anims.play('bot-jump', true); // Decide if jump anim should play continuously
            }
        }

        // Flip sprite based on movement direction, regardless of being on floor
        this.sprite.setFlipX(this.direction < 0);
    }

    takeDamage(amount: number): void {
        if (this.isHit || this.health <= 0) return;

        this.health -= amount;
        this.isHit = true;

        // Visual feedback
        this.sprite.setTint(0xff0000); // Red tint when hit
        if (this.sprite.anims.exists('bot-hurt')) {
            this.sprite.anims.play('bot-hurt', true);
        }

        // Reset after a short delay
        this.scene.time.delayedCall(500, () => {
            this.isHit = false;
            this.sprite.clearTint();
            // Optionally return to idle or run animation
            if (this.sprite.body?.velocity.x !== 0 && this.sprite.anims.exists('bot-run')) {
                this.sprite.anims.play('bot-run', true);
            } else if (this.sprite.anims.exists('bot-idle')) {
                this.sprite.anims.play('bot-idle', true);
            }
        });

        if (this.health <= 0) {
            this.die();
        }
    }

    die(): void {
        if (!this.sprite.active) return; // Prevent multiple calls

        this.health = 0; // Ensure health is 0
        if (this.sprite.anims.exists('bot-die')) {
            this.sprite.anims.play('bot-die', true);
        }
        // Add null check before disabling body
        if (this.sprite.body) {
            this.sprite.body.enable = false; // Disable physics body
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
        // Set up collision between player and this bot
        this.scene.physics.add.overlap(player.sprite, this.sprite, (playerSprite, botSprite) => {
            // Type assertion for safety, though overlap usually provides correct types
            const p = player; // Use the passed player instance
            const b = this;   // Use the current bot instance

            // Check activity and health, access player properties correctly
            if (!p?.sprite?.active || !b?.sprite?.active || b.health <= 0) return;

            // Access player properties correctly (isFighting, attackPower, dead)
            // Note: Player class doesn't have isRolling, assuming you meant !p.dead or similar state
            if (p.isFighting && !b.isHit) {
                // Player is fighting and can damage the bot
                b.takeDamage((p.attackPower ?? 1) * 20);
            } else if (!p.dead && !b.isHit) { // Removed isRolling check as it's not in Player
                // Player gets damaged if not dead, or bot is already hit
                p.takeDamage(10);

                // Knockback effect
                const knockbackDirection = p.sprite.x < b.sprite.x ? -1 : 1;
                // Ensure player sprite body exists before setting velocity
                if (p.sprite.body) {
                    (p.sprite.body as Physics.Arcade.Body).setVelocityX(knockbackDirection * 200);
                }
            }
        });
    }
}