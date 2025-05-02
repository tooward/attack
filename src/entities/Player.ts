import { Scene, Physics, GameObjects, Input, Animations, Types, Math as PhaserMath } from 'phaser';
import Character from './Character';
import Bot from './Bot';

export default class Player extends Character {
    canJump: boolean;
    isFighting: boolean;
    maxStamina: number;
    stamina: number;
    staminaRegenRate: number;
    staminaDrainRate: number;
    attackPower: number;
    cursors: Types.Input.Keyboard.CursorKeys;
    attackKey: Input.Keyboard.Key | null;
    attackCooldown: boolean;
    attackRange: number;
    attackDamage: number;

    /**
     * Static method to preload all player assets
     * @param {Scene} scene - The scene to use for loading
     */
    static preload(scene: Scene): void {
        // Load player spritesheets
        scene.load.spritesheet('dude-run', 'assets/player/RUN.png', { frameWidth: 96, frameHeight: 96 });
        scene.load.spritesheet('dude-idle', 'assets/player/IDLE.png', { frameWidth: 96, frameHeight: 96 });
        scene.load.spritesheet('dude-jump', 'assets/player/JUMP.png', { frameWidth: 96, frameHeight: 96 });
        scene.load.spritesheet('dude-die', 'assets/player/DEATH.png', { frameWidth: 96, frameHeight: 96 });
        scene.load.spritesheet('dude-attack', 'assets/player/ATTACK1.png', { frameWidth: 96, frameHeight: 96 });
    }

    /**
     * Static method to create animations
     * @param {Scene} scene - The scene to create animations in
     */
    static createAnims(scene: Scene): void {
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

        scene.anims.create({
            key: 'attack',
            frames: scene.anims.generateFrameNumbers('dude-attack', { start: 0, end: 6 }),
            frameRate: 20,
            repeat: 0
        });
    }

    constructor(scene: Scene, x: number, y: number) {
        // Call the parent constructor with player-specific configuration
        super(scene, x, y, 'dude-idle', {
            bodyWidth: 96,
            bodyHeight: 96,
            bodyOffsetX: 30,
            bodyOffsetY: 10,
            moveSpeed: 160
        });

        // Set up physics body with player-specific properties
        if (this.sprite.body) {
            const body = this.sprite.body as Physics.Arcade.Body;
            body.setDragX(300); // Horizontal drag to slow down player when not moving
        }

        // Player-specific state
        this.canJump = true;
        this.isFighting = false;
        this.maxStamina = 100;
        this.stamina = 100;
        this.staminaRegenRate = 10;  // per second
        this.staminaDrainRate = 20;  // per second during fighting
        this.attackPower = 1.0;
        this.attackCooldown = false;
        this.attackRange = 50; // Melee attack range
        this.attackDamage = 20; // Base damage for attacks

        // Set up player input
        if (scene.input.keyboard) {
            this.cursors = scene.input.keyboard.createCursorKeys();
            this.attackKey = scene.input.keyboard.addKey('H');
        } else {
            console.error("Keyboard input not available.");
            this.cursors = {} as Types.Input.Keyboard.CursorKeys;
            this.attackKey = null;
        }
    }

    update(time: number, delta: number): void {
        // Call base class update first to handle common checks
        super.update(time, delta);
        
        // If already determined to be dead or no body, return early
        if (this.dead || !this.sprite.body) return;

        const seconds = delta / 1000;
        this.handleMovement();
        this.handleStamina(seconds);
        
        // Check attack key input separately from movement
        if (this.attackKey?.isDown && !this.attackCooldown) {
            this.attack();
        }
    }

    handleMovement(): void {
        const body = this.sprite.body as Phaser.Physics.Arcade.Body;
        if (!body) return;

        // Handle horizontal movement both on floor and in air
        if (this.cursors.left?.isDown) {
            // Move left
            this.direction = -1;
            this.sprite.setVelocityX(-this.moveSpeed);
            this.sprite.flipX = true;
            if (body.onFloor() && !this.attackCooldown) {
                this.sprite.anims.play('left', true);
            }
        } 
        else if (this.cursors.right?.isDown) {
            // Move right
            this.direction = 1;
            this.sprite.setVelocityX(this.moveSpeed);
            this.sprite.flipX = false;
            if (body.onFloor() && !this.attackCooldown) {
                this.sprite.anims.play('right', true);
            }
        }
        else if (body.onFloor()) {
            // Only idle when on the floor and not moving horizontally or attacking
            if (!this.attackCooldown) {
                this.idle();
                this.sprite.anims.play('idle', true);
            }
        } else {
            // In air with no input - keep current horizontal velocity with some air drag
            // This allows maintaining momentum while still providing some air control
            this.sprite.setVelocityX(body.velocity.x * 0.98);
        }

        // Jumping is handled separately and only allowed on floor
        if (this.cursors.up?.isDown && body.onFloor() && this.canJump && !this.attackCooldown) {
            this.playerJump();
        }
    }

    // Override the idle method to include animation
    idle(): void {
        super.idle();
        this.sprite.anims.play('idle', true);
    }

    // Player-specific jump implementation
    playerJump(): void {
        // Use the base jump method
        super.jump(-500);
        
        this.sprite.anims.play('jump', true);
        this.canJump = false;

        // Add delay before allowing another jump
        this.scene.time.delayedCall(1000, () => {
            this.canJump = true;
        });
    }

    attack(): void {
        if (this.attackCooldown || this.stamina <= 0) return;

        this.isFighting = true;
        this.attackCooldown = true;
        
        // Stop horizontal movement during attack
        this.sprite.setVelocityX(0);

        // Play attack animation
        this.sprite.anims.play('attack', true);
        
        // Consume stamina
        this.stamina -= 10;
        if (this.stamina < 0) this.stamina = 0;

        // On animation complete, check for hits
        this.sprite.once(Animations.Events.ANIMATION_COMPLETE_KEY + 'attack', () => {
            // Find all bots in the scene that could be hit
            const gameObjects = this.scene.physics.world.bodies.getArray()
                .map(body => body.gameObject)
                .filter(obj => obj && obj.active);
                
            // Calculate attack position based on player direction
            const attackX = this.sprite.x + (this.direction * this.attackRange/2);
            const attackY = this.sprite.y;

            // Check each potential target
            gameObjects.forEach(obj => {
                // Skip if not a bot or already destroyed
                if (!obj.getData('isBot') || !obj.active) return;
                
                // Calculate distance to potential target - cast to Phaser.GameObjects.Sprite for position access
                const targetSprite = obj as unknown as Physics.Arcade.Sprite;
                const distance = PhaserMath.Distance.Between(
                    attackX, attackY,
                    targetSprite.x, targetSprite.y
                );
                
                // If in range, get the bot reference and damage it
                if (distance <= this.attackRange) {
                    const bot = obj.getData('botRef');
                    if (bot && typeof bot.takeDamage === 'function') {
                        bot.takeDamage(this.attackDamage * this.attackPower);
                    }
                }
            });
            
            // Reset attack state after a delay
            this.scene.time.delayedCall(500, () => {
                this.isFighting = false;
                this.attackCooldown = false;
            });
        });
    }

    handleStamina(seconds: number): void {
        // Only regenerate stamina when not fighting
        if (!this.isFighting && this.stamina < this.maxStamina) {
            this.stamina += this.staminaRegenRate * seconds;
            if (this.stamina > this.maxStamina) {
                this.stamina = this.maxStamina;
            }
        }

        // Adjust attack power based on stamina
        this.attackPower = Math.max(0.5, this.stamina / this.maxStamina);
        
        // Emit stamina changed event for UI
        this.scene.events.emit('player-stamina-changed', this.stamina, this.maxStamina);
    }

    // Override takeDamage to add player-specific behavior
    takeDamage(amount: number): void {
        super.takeDamage(amount);

        // Signal that player health changed
        this.scene.events.emit('player-health-changed', this.health, this.maxHealth);
    }

    // Override die to add player-specific death behavior
    die(): void {
        if (this.dead) return;

        super.die();
        this.sprite.anims.play('die', true);

        // Emit death event for the game to handle
        this.scene.events.emit('player-died');
    }

    // Override reset to include player-specific reset logic
    reset(x: number, y: number): void {
        super.reset(x, y);
        
        this.stamina = this.maxStamina;
        this.scene.events.emit('player-health-changed', this.health, this.maxHealth);
    }
}