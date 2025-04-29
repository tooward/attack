import { Scene, Physics, GameObjects } from 'phaser';

export default class Player {
    /**
     * Static method to preload all player assets
     * @param {Scene} scene - The scene to use for loading
     */
    static preload(scene) {
        // Load player spritesheets
        scene.load.spritesheet('dude-run', 'assets/player/RUN.png', { frameWidth: 96, frameHeight: 96 });
        scene.load.spritesheet('dude-idle', 'assets/player/IDLE.png', { frameWidth: 96, frameHeight: 96 });
        scene.load.spritesheet('dude-jump', 'assets/player/JUMP.png', { frameWidth: 96, frameHeight: 96 });
        scene.load.spritesheet('dude-die', 'assets/player/DEATH.png', { frameWidth: 96, frameHeight: 96 });
    }
    
    /**
     * Static method to create animations
     * @param {Scene} scene - The scene to create animations in
     */
    static createAnims(scene) {
        // Create player animations
        scene.anims.create({
            key: 'left',
            frames: scene.anims.generateFrameNumbers('dude-run', { start: 0, end: 9 }),
            frameRate: 10,
            repeat: -1
        });

        scene.anims.create({
            key: 'right',
            frames: scene.anims.generateFrameNumbers('dude-run', { start: 0, end: 9 }),
            frameRate: 10,
            repeat: -1
        });

        scene.anims.create({
            key: 'idle',
            frames: scene.anims.generateFrameNumbers('dude-idle', { start: 0, end: 9 }),
            frameRate: 10,
            repeat: -1
        });

        scene.anims.create({
            key: 'jump',
            frames: scene.anims.generateFrameNumbers('dude-jump', { start: 0, end: 2 }),
            frameRate: 10
        });

        scene.anims.create({
            key: 'die',
            frames: scene.anims.generateFrameNumbers('dude-die', { start: 0, end: 9 }),
            frameRate: 20,
            repeat: 0
        });
    }

    constructor(scene, x, y) {
        this.scene = scene;
        
        // Create the player sprite
        this.sprite = scene.physics.add.sprite(x, y, 'dude-idle');
        
        // Set up physics body
        this.sprite.body.setSize(96, 96);
        this.sprite.body.setOffset(30, 10);
        this.sprite.setCollideWorldBounds(true);
        
        // Player state
        this.dead = false;
        this.canJump = true;
        this.isFighting = false;
        this.lastDirection = 1; // 1 for right, -1 for left
        
        // Player stats
        this.maxHealth = 100;
        this.health = 100;
        this.maxStamina = 100;
        this.stamina = 100;
        this.staminaRegenRate = 10;  // per second
        this.staminaDrainRate = 20;  // per second during fighting
        this.attackPower = 1.0;
        
        // Set up player input
        this.cursors = scene.input.keyboard.createCursorKeys();        
    }
    
    update(time, delta) {
        if (this.dead) return;
        
        const seconds = delta / 1000;
        this.handleMovement();
        this.handleStamina(seconds);
    }
    
    handleMovement() {
        // Only allow horizontal movement if on the floor
        if (this.sprite.body.onFloor()) {
            if (this.cursors.left.isDown) {
                // Move left
                this.lastDirection = -1;
                this.moveLeft();
            } 
            else if (this.cursors.right.isDown) {
                // Move right
                this.lastDirection = 1;
                this.moveRight();
            }
            else if (this.cursors.space.isDown) {
                this.attack();
            }
            else {
                this.idle();
            }
        } else {
            // Allow changing direction mid-air but don't apply velocity
            if (this.cursors.left.isDown) {
                this.lastDirection = -1;
                this.sprite.flipX = true; // Keep sprite facing the correct way
            } else if (this.cursors.right.isDown) {
                this.lastDirection = 1;
                this.sprite.flipX = false; // Keep sprite facing the correct way
            }
            // If no horizontal input, keep current animation unless jumping/falling
            if (!this.sprite.anims.currentAnim || this.sprite.anims.currentAnim.key !== 'jump') {
                 // Optionally play a falling animation here if you have one
                 // this.sprite.anims.play('fall', true);
            }
        }

        // Jumping is handled separately and allowed mid-air or on floor
        if (this.cursors.up.isDown && this.sprite.body.onFloor() && this.canJump) {
            this.jump();
        }
    }
    
    moveLeft() {
        this.sprite.setVelocityX(-160);
        this.sprite.flipX = true;
        this.sprite.anims.play('left', true);
    }
    
    moveRight() {
        this.sprite.setVelocityX(160);
        this.sprite.flipX = false;
        this.sprite.anims.play('right', true);
    }
    
    jump() {
        this.sprite.setVelocityY(-400);
        this.sprite.anims.play('jump', true);
        this.canJump = false;
        
        // Add delay before allowing another jump
        this.scene.time.delayedCall(1000, () => {
            this.canJump = true;
        });
    }
    
    attack() {
        this.isFighting = true;
        
        // Reset after a delay
        this.scene.time.delayedCall(1000, () => {
            this.isFighting = false;
        });
    }
    
    idle() {
        this.sprite.setVelocityX(0);
        this.sprite.anims.play('idle', true);
    }
    
    handleStamina(seconds) {
        // Handle stamina drain if fighting
        if (this.isFighting) {
            this.stamina -= this.staminaDrainRate * seconds;
            if (this.stamina < 0) this.stamina = 0;
        } else {
            // Regenerate stamina when not fighting
            if (this.stamina < this.maxStamina) {
                this.stamina += this.staminaRegenRate * seconds;
                if (this.stamina > this.maxStamina) this.stamina = this.maxStamina;
            }
        }
        
        // Adjust attack power based on stamina
        this.attackPower = this.stamina < 20 ? 0.5 : 1.0;
    }
    
    takeDamage(amount) {
        this.health -= amount;
        
        if (this.health <= 0) {
            this.health = 0;
            this.die();
        }
        
        // Signal that player health changed
        this.scene.events.emit('player-health-changed', this.health, this.maxHealth);
    }
    
    die() {
        if (this.dead) return;
        
        this.dead = true;
        this.sprite.setVelocity(0, -200);
        this.sprite.anims.play('die', true);
        
        // Emit death event for the game to handle
        this.scene.events.emit('player-died');
    }
    
    reset(x, y) {
        this.sprite.setPosition(x, y);
        this.sprite.setVelocity(0, 0);
        this.dead = false;
        this.health = this.maxHealth;
        this.stamina = this.maxStamina;
        this.scene.events.emit('player-health-changed', this.health, this.maxHealth);
    }
}