import { Scene, Physics, GameObjects, Math as PhaserMath, Types, Animations } from 'phaser';
import Character from './Character';
import Player from './Player';
import SpriteUtils from '../utils/SpriteUtils';
import { createMachine, createActor, type ActorRefFrom } from 'xstate';

// Define the context and events for the bot state machine
type BotContext = {
    player: Player;
    distanceToPlayer: number;
    health: number;
    attackCooldownActive: boolean;
};

type BotEvent = 
    | { type: 'PLAYER_DETECTED' }
    | { type: 'PLAYER_LOST' }
    | { type: 'ATTACK_READY' }
    | { type: 'ATTACK_COMPLETED' }
    | { type: 'DAMAGE_TAKEN', damage: number }
    | { type: 'DEATH' }
    | { type: 'RECOVER' }
    | { type: 'UPDATE_CONTEXT', context: Partial<BotContext> };

// Create the bot state machine
const createBotMachine = () => createMachine({
    id: 'bot',
    types: {} as {
        context: BotContext;
        events: BotEvent;
    },
    context: {
        player: undefined as unknown as Player, // Will be set on initialization
        distanceToPlayer: 1000,
        health: 100,
        attackCooldownActive: false
    },
    initial: 'idle',
    states: {
        idle: {
            on: {
                PLAYER_DETECTED: { target: 'chasing' },
                UPDATE_CONTEXT: {
                    actions: ({ context, event }) => {
                        if (event.context) {
                            Object.assign(context, event.context);
                        }
                    }
                }
            }
        },
        chasing: {
            on: {
                PLAYER_LOST: { target: 'idle' },
                ATTACK_READY: { target: 'attacking' },
                DAMAGE_TAKEN: { target: 'hurt' },
                UPDATE_CONTEXT: {
                    actions: ({ context, event }) => {
                        if (event.context) {
                            Object.assign(context, event.context);
                        }
                    }
                }
            }
        },
        attacking: {
            on: {
                ATTACK_COMPLETED: { target: 'chasing' },
                DAMAGE_TAKEN: { target: 'hurt' },
                UPDATE_CONTEXT: {
                    actions: ({ context, event }) => {
                        if (event.context) {
                            Object.assign(context, event.context);
                        }
                    }
                }
            }
        },
        hurt: {
            on: {
                RECOVER: [
                    {
                        target: 'dead',
                        guard: ({ context }) => context.health <= 0
                    },
                    {
                        target: 'chasing',
                        guard: ({ context }) => context.distanceToPlayer <= 200
                    },
                    {
                        target: 'idle'
                    }
                ],
                UPDATE_CONTEXT: {
                    actions: ({ context, event }) => {
                        if (event.context) {
                            Object.assign(context, event.context);
                        }
                    }
                }
            }
        },
        dead: {
            type: 'final'
        }
    }
});

export default class Bot extends Character {
    // Bot-specific properties
    player: Player;
    isHit: boolean;
    chaseSpeed: number;
    detectionRange: number;
    isChasing: boolean;
    attackCooldown: boolean;

    // Health bar components
    healthBarBackground!: Phaser.GameObjects.Graphics;
    healthBar!: Phaser.GameObjects.Graphics;
    healthBarWidth: number = 40; // Width of health bar
    healthBarHeight: number = 5; // Height of health bar
    
    // State machine
    botMachine: ReturnType<typeof createBotMachine>;
    botService: ActorRefFrom<ReturnType<typeof createBotMachine>>;
    currentState: string = 'idle';

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
     * Ensures all bot animations are available in the current scene
     * @param scene The scene to create animations in
     */
    static createAnimsInScene(scene: Scene): void {
        // Only create animations that don't already exist in this scene
        if (!scene.anims.exists('bot-idle')) {
            scene.anims.create({
                key: 'bot-idle',
                frames: scene.anims.generateFrameNumbers('bot-idle', { start: 0, end: 4 }),
                frameRate: 5,
                repeat: -1
            });
        }
        
        if (!scene.anims.exists('bot-run')) {
            scene.anims.create({
                key: 'bot-run',
                frames: scene.anims.generateFrameNumbers('bot-run', { start: 0, end: 6 }),
                frameRate: 10,
                repeat: -1
            });
        }
        
        if (!scene.anims.exists('bot-dash')) {
            scene.anims.create({
                key: 'bot-dash',
                frames: scene.anims.generateFrameNumbers('bot-dash', { start: 0, end: 3 }),
                frameRate: 10,
                repeat: 0
            });
        }
        
        if (!scene.anims.exists('bot-jump')) {
            scene.anims.create({
                key: 'bot-jump',
                frames: scene.anims.generateFrameNumbers('bot-jump', { start: 0, end: 2 }),
                frameRate: 10,
                repeat: 0
            });
        }
        
        if (!scene.anims.exists('bot-attack')) {
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
        }
        
        if (!scene.anims.exists('bot-hurt')) {
            scene.anims.create({
                key: 'bot-hurt',
                frames: scene.anims.generateFrameNumbers('bot-hurt', { start: 0, end: 1 }),
                frameRate: 10,
                repeat: 0
            });
        }
        
        if (!scene.anims.exists('bot-die')) {
            scene.anims.create({
                key: 'bot-die',
                frames: scene.anims.generateFrameNumbers('bot-die', { start: 0, end: 9 }),
                frameRate: 10,
                repeat: 0
            });
        }
    }

    /**
     * Static method to create bot animations in the boot scene
     * @param {Scene} scene - The scene to create animations in
     */
    static createAnims(scene: Scene): void {
        // This method is kept for compatibility with the existing codebase
        // It delegates to the createAnimsInScene method which handles animation creation
        Bot.createAnimsInScene(scene);
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
        
        // Ensure animations are available for this instance
        this.createOrRetrieveAnimations();
        
        // Set up sprite animations
        this.sprite.anims.play('bot-idle', true);
        
        // Create health bar
        this.createHealthBar();

        // Initialize state machine
        this.botMachine = createBotMachine();
        this.botService = createActor(this.botMachine, {
            input: {
                player: this.player
            }
        });
            
        // Subscribe to state changes
        this.botService.subscribe((snapshot) => {
            this.currentState = snapshot.value as string;
            console.log(`Bot state transitioned to: ${this.currentState}`);
            
            // Handle state entry actions
            switch(this.currentState) {
                case 'idle':
                    if (this.sprite && this.sprite.anims) {
                        this.sprite.anims.play('bot-idle', true);
                    }
                    if (this.sprite.body) {
                        (this.sprite.body as Physics.Arcade.Body).setVelocityX(0);
                    }
                    break;
                case 'chasing':
                    if (this.sprite && this.sprite.anims) {
                        this.sprite.anims.play('bot-run', true);
                    }
                    break;
                case 'attacking':
                    this.performAttack();
                    break;
                case 'hurt':
                    if (this.sprite && this.sprite.anims) {
                        this.sprite.anims.play('bot-hurt', true);
                    }
                    if (this.sprite.body) {
                        (this.sprite.body as Physics.Arcade.Body).setVelocityX(0);
                    }
                    break;
                case 'dead':
                    this.die();
                    break;
            }
        });
            
        // Start the state machine
        this.botService.start();
    }

    /**
     * Ensures all bot animations are available for this specific instance
     */
    createOrRetrieveAnimations(): void {
        // Ensure all animations are created in this specific scene
        Bot.createAnimsInScene(this.scene);
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
            // If player is inactive, send PLAYER_LOST event if we're not already idle
            if (this.currentState !== 'idle') {
                this.botService.send({ type: 'PLAYER_LOST' });
            }
            return;
        }

        // Type guard for body (already checked at the start of update)
        const body = this.sprite.body as Physics.Arcade.Body;

        // Calculate distance to player
        const distanceToPlayer = PhaserMath.Distance.Between(
            this.sprite.x, this.sprite.y,
            this.player.sprite.x, this.player.sprite.y
        );
        
        // Update distance in state machine context
        this.botService.send({ type: 'UPDATE_CONTEXT', context: { distanceToPlayer } });
        
        // Debug distance info when in hurt state to understand recovery decisions
        if (this.currentState === 'hurt') {
            console.log(`Bot in hurt state - Distance to player: ${distanceToPlayer}, Detect range: ${this.detectionRange}`);
        }
        
        // State machine driven behavior
        switch (this.currentState) {
            case 'idle':
                // Check if player is detected
                if (distanceToPlayer <= this.detectionRange) {
                    this.botService.send({ type: 'PLAYER_DETECTED' });
                }
                break;
                
            case 'chasing':
                // Lost player detection
                if (distanceToPlayer > this.detectionRange) {
                    this.botService.send({ type: 'PLAYER_LOST' });
                    break;
                }
                
                // Attack when close enough
                if (distanceToPlayer <= 60 && !this.attackCooldown) {
                    console.log("Bot sending ATTACK_READY event, distance:", distanceToPlayer);
                    this.attackCooldown = true; // Set cooldown when initiating attack
                    this.botService.send({ type: 'ATTACK_READY' });
                    break;
                }
                
                // Move toward player when chasing
                body.setVelocityX(this.direction * this.chaseSpeed);
                break;
                
            case 'attacking':
                // Attack logic is handled in the performAttack method
                // The state will transition back to chasing after the attack completes
                break;
                
            case 'hurt':
                // Hurt state is handled by animation, do nothing here
                break;
                
            case 'dead':
                // Dead state is final, do nothing
                break;
        }
        
        // Update direction to face player
        this.direction = this.player.sprite.x < this.sprite.x ? -1 : 1;
        this.sprite.setFlipX(this.direction < 0);
        
        // Update health bar position to follow the bot
        this.updateHealthBarPosition();
    }

    /**
     * Performs an attack action triggered by the state machine
     */
    performAttack(): void {
        // Don't attack if already hit or attacking
        if (this.isHit || 
            (this.sprite.anims.isPlaying && 
             this.sprite.anims.currentAnim?.key === 'bot-attack')) {
            return;
        }
        
        console.log("Bot performing attack");
        
        // Stop movement during attack
        if (this.sprite.body) {
            (this.sprite.body as Physics.Arcade.Body).setVelocityX(0);
        }
        
        // Play attack animation
        this.sprite.anims.play('bot-attack', true);
        
        // On attack animation completion, attempt to damage player
        this.sprite.once(Animations.Events.ANIMATION_COMPLETE, () => {
            console.log("Bot attack animation completed");
            
            // Check if player is in range
            if (this.player && this.player.sprite.active) {
                const distanceToPlayer = PhaserMath.Distance.Between(
                    this.sprite.x, this.sprite.y,
                    this.player.sprite.x, this.player.sprite.y
                );
                
                // Only damage player if in attack range
                if (distanceToPlayer <= 60 && !this.player.dead) {
                    console.log("Bot dealing damage to player");
                    // Pass bot position to takeDamage so player can determine attack direction
                    this.player.takeDamage(15, { x: this.sprite.x, y: this.sprite.y });
                    
                    // Knockback effect on player
                    const knockbackDirection = this.player.sprite.x < this.sprite.x ? -1 : 1;
                    if (this.player.sprite.body) {
                        (this.player.sprite.body as Physics.Arcade.Body).setVelocityX(knockbackDirection * 150);
                    }
                }
            }
            
            // Reset attack cooldown after a delay
            this.scene.time.delayedCall(500, () => {
                this.attackCooldown = false;
                // Transition back to chasing state
                this.botService.send({ type: 'ATTACK_COMPLETED' });
            });
        }, this);
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
        // Don't take damage if already hit, dead, or if sprite is inactive/being destroyed
        if (this.isHit || this.dead || !this.sprite || !this.sprite.active || !this.sprite.anims) return;

        console.log(`Bot taking damage: ${amount}. Current health: ${this.health}, State: ${this.currentState}`);

        // Call the parent takeDamage method
        super.takeDamage(amount);
        
        this.isHit = true;

        // Update the state machine with damage event
        this.botService.send({ type: 'DAMAGE_TAKEN', damage: amount });
        console.log(`Bot after damage: Health=${this.health}, New state: ${this.currentState}`);

        // Visual feedback - make sure anims exists before checking if animation exists
        if (this.sprite.anims && this.scene.anims.exists('bot-hurt')) {
            this.sprite.anims.play('bot-hurt', true);
        }

        // Update health bar to reflect new health
        this.updateHealthBar();

        // Check if health is zero or below
        if (this.health <= 0) {
            this.health = 0;
            this.die();
            return;
        }

        // Reset after a short delay
        this.scene.time.delayedCall(500, () => {
            this.isHit = false;
            console.log(`Bot recovery after hit. Current state: ${this.currentState}, Health: ${this.health}`);
            
            // Send RECOVER event to the state machine
            this.botService.send({ type: 'RECOVER' });
            console.log(`Bot state after RECOVER event: ${this.currentState}`);
            
            // Make sure we still have valid references before attempting animations
            if (!this.dead && this.sprite && this.sprite.active && this.sprite.anims) {
                if (this.sprite.body?.velocity.x !== 0 && this.scene.anims.exists('bot-run')) {
                    this.sprite.anims.play('bot-run', true);
                } else if (this.scene.anims.exists('bot-idle')) {
                    this.sprite.anims.play('bot-idle', true);
                }
            }
        });
    }

    die(): void {
        if (this.dead) return;
        
        // Call parent die method
        super.die();

        // Disable physics to prevent further interactions
        if (this.sprite.body) {
            (this.sprite.body as Physics.Arcade.Body).setEnable(false);
        }

        // Force bot to stay in place
        if (this.sprite.body) {
            (this.sprite.body as Physics.Arcade.Body).setVelocity(0, 0);
        }

        // Ensure animations exist
        this.createOrRetrieveAnimations();
        
        // Recreate the animation with a slower frame rate
        this.scene.anims.remove('bot-die');
        this.scene.anims.create({
            key: 'bot-die',
            frames: this.scene.anims.generateFrameNumbers('bot-die', { start: 0, end: 9 }),
            frameRate: 4, // Even slower frame rate
            repeat: 0
        });
        
        // Stop any current animation immediately
        this.sprite.anims.stop();
        
        // Add a visible "dying" effect before playing the animation
        this.sprite.setTint(0xff0000); // Red tint
        
        console.log("Adding delay before death animation");
        
        // Add a delay before starting the death animation
        this.scene.time.delayedCall(300, () => {
            console.log("Playing death animation with slower frameRate");
            
            // Clear the tint
            this.sprite.clearTint();
            
            // Set the texture and play death frames
            try {
                this.sprite.setTexture('bot-die', 0);
                this.sprite.anims.play('bot-die');
                
                // Listen for animation completion
                this.sprite.on('animationcomplete', () => {
                    console.log("Death animation completed");
                    this.destroyBot();
                });
                
                // Increased timeout for slower animation
                this.scene.time.delayedCall(3000, () => {
                    if (this.sprite && this.sprite.active) {
                        console.log("Death animation timeout - destroying bot");
                        this.destroyBot();
                    }
                });
            } catch (error) {
                console.error("Error playing bot-die animation:", error);
                this.destroyBot();
            }
        });
    }
    
    /**
     * Helper method to ensure consistent destruction of bot resources
     */
    destroyBot(): void {
        // Destroy the sprite if it still exists
        if (this.sprite && this.sprite.active) {
            this.sprite.destroy();
        }
        
        // Destroy health bar graphics if they exist
        if (this.healthBarBackground && this.healthBarBackground.active) {
            this.healthBarBackground.destroy();
        }
        
        if (this.healthBar && this.healthBar.active) {
            this.healthBar.destroy();
        }
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

    /**
     * Creates the health bar graphics that will float above the bot
     */
    createHealthBar(): void {
        // Create background of health bar (dark gray)
        this.healthBarBackground = this.scene.add.graphics()
            .fillStyle(0x222222, 0.8)
            .fillRect(0, 0, this.healthBarWidth, this.healthBarHeight);
            
        // Create foreground of health bar (initially green)
        this.healthBar = this.scene.add.graphics()
            .fillStyle(0x00ff00, 1)
            .fillRect(0, 0, this.healthBarWidth, this.healthBarHeight);
            
        // Set the health bar depth to ensure it's drawn above other elements
        this.healthBarBackground.setDepth(100);
        this.healthBar.setDepth(101);
        
        // Position health bar above the bot's head
        this.updateHealthBarPosition();
    }
    
    /**
     * Updates the position of the health bar to follow the bot
     */
    updateHealthBarPosition(): void {
        // Early return if sprite is inactive or destroyed
        if (!this.sprite || !this.sprite.active) return;
        
        // Position health bar above bot's head with a small offset
        const offsetY = -30; // Pixels above bot's head
        const x = this.sprite.x - this.healthBarWidth / 2;
        const y = this.sprite.y + offsetY;
        
        // Ensure health bar components exist before positioning
        if (this.healthBarBackground && this.healthBarBackground.active) {
            this.healthBarBackground.setPosition(x, y);
        }
        
        if (this.healthBar && this.healthBar.active) {
            this.healthBar.setPosition(x, y);
        }
    }
    
    /**
     * Updates the health bar to reflect current health
     */
    updateHealthBar(): void {
        // Don't update if health bar is no longer active/available
        if (!this.healthBar || !this.healthBar.active) return;
        
        // Clear previous graphics
        this.healthBar.clear();
        
        // Calculate health percentage
        const percentage = Math.max(0, this.health / this.maxHealth);
        
        // Choose color based on health
        let color;
        if (percentage > 0.6) color = 0x00ff00; // Green
        else if (percentage > 0.3) color = 0xffff00; // Yellow
        else color = 0xff0000; // Red
        
        // Draw health bar with new width based on percentage
        this.healthBar.fillStyle(color, 1);
        this.healthBar.fillRect(0, 0, this.healthBarWidth * percentage, this.healthBarHeight);
    }
}