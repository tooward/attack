import { Scene, Physics, GameObjects, Math as PhaserMath } from 'phaser';

export default class Bot {
    /**
     * Static method to preload bot assets
     * @param {Scene} scene - The scene to use for loading
     */
    static preload(scene) {
        // Load bot sprites
        scene.load.spritesheet('bot-idle', 'assets/enemy/idle.png', { frameWidth: 92, frameHeight: 64 });
        scene.load.spritesheet('bot-run', 'assets/enemy/run.png', { frameWidth: 92, frameHeight: 64 });
        scene.load.spritesheet('bot-dash', 'assets/enemy/dash.png', { frameWidth: 92, frameHeight: 64 });
        scene.load.spritesheet('bot-jump', 'assets/enemy/jump.png', { frameWidth: 92, frameHeight: 64 });
        scene.load.spritesheet('bot-attack', 'assets/enemy/attack.png', { frameWidth: 92, frameHeight: 64 });
        scene.load.spritesheet('bot-hit', 'assets/enemy/hit.png', { frameWidth: 92, frameHeight: 64 });
        scene.load.spritesheet('bot-die', 'assets/enemy/death.png', { frameWidth: 92, frameHeight: 64 });
    }
    
    /**
     * Static method to create bot animations
     * @param {Scene} scene - The scene to create animations in
     */
    static createAnims(scene) {
        // Create bot animations (can be expanded later)
        scene.anims.create({
            key: 'bot-idle',
            frames: scene.anims.generateFrameNumbers('bot-idle', { start: 0, end: 4 }),
            frameRate: 5,
            repeat: -1
        });
        scene.anims.create({
            key: 'bot-run',
            frames: scene.anims.generateFrameNumbers('bot-run', { start: 0, end: 4 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: 'bot-dash',
            frames: scene.anims.generateFrameNumbers('bot-dash', { start: 0, end: 4 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: 'bot-jump',
            frames: scene.anims.generateFrameNumbers('bot-jump', { start: 0, end: 4 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: 'bot-attack',
            frames: scene.anims.generateFrameNumbers('bot-attack', { start: 0, end: 4 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: 'bot-hit',
            frames: scene.anims.generateFrameNumbers('bot-hit', { start: 0, end: 4 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: 'bot-die',
            frames: scene.anims.generateFrameNumbers('bot-die', { start: 0, end: 4 }),
            frameRate: 10,
            repeat: -1
        });

    }

    constructor(scene, x, y, player) {
        this.scene = scene;
        this.player = player;

        // Create the bot sprite
        this.sprite = scene.physics.add.sprite(x, y, 'bot-idle');
        this.sprite.setCollideWorldBounds(true);
        this.sprite.body.setSize(92, 64);

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
    
    update() {
        if (!this.sprite.active || !this.player || !this.player.sprite.active) {
            // If bot or player is inactive, do nothing or play idle
            if (this.sprite.active) {
                this.sprite.setVelocityX(0);
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
        } else {
            // Player is out of range, stop chasing
            this.isChasing = false;
        }

        // Only allow horizontal movement if the bot is on the floor
        if (this.sprite.body.onFloor()) {
            if (this.isChasing) {
                // Move towards the player if chasing
                this.sprite.setVelocityX(this.chaseSpeed * this.direction);
                this.sprite.anims.play('bot-run', true);
            } else {
                // Simple patrol AI
                if (this.sprite.body.blocked.right || this.sprite.body.blocked.left) {
                    this.direction *= -1; // Reverse direction at walls/bounds
                }
                // Move in the current patrol direction
                this.sprite.setVelocityX(this.speed * this.direction);
                this.sprite.anims.play('bot-run', true);
            }
        } else {
            // If in the air, stop horizontal movement but keep facing the correct direction
            this.sprite.setVelocityX(0);
            // Optionally play a jump/fall animation here if available
            // this.sprite.anims.play('bot-jump', true);
        }

        // Flip sprite based on movement direction, regardless of being on floor
        this.sprite.flipX = this.direction < 0;
    }
    
    takeDamage(amount) {
        if (this.isHit) return;
        
        this.health -= amount;
        this.isHit = true;
        
        // Visual feedback
        this.sprite.tint = 0xff0000; // Red tint when hit
        
        // Reset after a short delay
        this.scene.time.delayedCall(500, () => {
            this.isHit = false;
            this.sprite.clearTint();
        });
        
        if (this.health <= 0) {
            this.die();
        }
    }
    
    die() {
        this.sprite.anims.play('bot-die', true);
        this.sprite.body.enable = false;

        this.sprite.once('animationcomplete-bot-die', () => {
            this.sprite.destroy();
        });
    }
    
    setupPlayerCollision(player) {
        // Set up collision between player and this bot
        this.scene.physics.add.overlap(player.sprite, this.sprite, () => {
            if (player.isFighting && !this.isHit) {
                // Player is fighting and can damage the bot
                this.takeDamage(player.attackPower * 20);
            } else if (!player.isRolling && !player.dead && !this.isHit) {
                // Player gets damaged if not rolling or fighting
                player.takeDamage(10);
                
                // Knockback effect
                const knockbackDirection = player.sprite.x < this.sprite.x ? -1 : 1;
                player.sprite.setVelocityX(knockbackDirection * 200);
            }
        });
    }
}