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
    energy: number;
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
    | { type: 'OUT_OF_ENERGY' }
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
        energy: 100,
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
                ATTACK_READY: [
                    {
                        target: 'attacking',
                        guard: ({ context }) => !context.attackCooldownActive && context.energy > 0
                    }
                ],
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
    
    // Attack-related properties
    attackCooldown: boolean;
    attackDelayActive: boolean;
    lastAttackTime: number;
    minimumAttackInterval: number;
    
    // Direction stability tracking
    lastDirection: number = 1;
    lastDirectionChangeTime: number = 0;
    directionStabilityThreshold: number = 500; // Increased from 300 to 500ms for more stability
    attackPreparing: boolean = false; // Flag to lock movement when preparing to attack
    
    // Properties for obstacle detection and jumping
    stuckDetectionTime: number;
    lastMovingX: number;
    stuckStartTime: number;
    isStuck: boolean;
    jumpCooldown: boolean;
    canJump: boolean;

    // Health bar components
    healthBarBackground!: Phaser.GameObjects.Graphics;
    healthBar!: Phaser.GameObjects.Graphics;
    healthBarWidth: number = 40; // Width of health bar
    healthBarHeight: number = 5; // Height of health bar
    
    // State machine
    botMachine: ReturnType<typeof createBotMachine>;
    botService: ActorRefFrom<ReturnType<typeof createBotMachine>>;
    currentState: string = 'idle';

    // Track state transitions to prevent repeated execution of entry actions
    lastProcessedState: string = '';

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
        
        // Remove any existing 'bot-attack' animation first to prevent conflicts
        if (scene.anims.exists('bot-attack')) {
            scene.anims.remove('bot-attack');
        }
        
        // Create or recreate the attack animation
        scene.anims.create({
            key: 'bot-attack',
            frames: [
                ...scene.anims.generateFrameNumbers('bot-attack1', { start: 0, end: 4 }),
                ...scene.anims.generateFrameNumbers('bot-attack2', { start: 0, end: 4 }),
                ...scene.anims.generateFrameNumbers('bot-attack3', { start: 0, end: 9 })
            ],
            frameRate: 10,
            repeat: 0
        });
        
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
            bodyOffsetY: 24,
            maxEnergy: 100,
            energyRegenRate: 15, // Bots regenerate energy faster than players
            attackRange: 120,    // Increased from 60 to 120 to make attacks more likely
            attackDamage: 15
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
        
        // Additional properties for attack management
        this.attackCooldown = false;
        this.attackDelayActive = false;
        this.lastAttackTime = 0; // Track when the last attack was executed
        this.minimumAttackInterval = 1200; // Minimum ms between attacks

        // Direction stability tracking
        this.lastDirection = this.direction;
        this.lastDirectionChangeTime = scene.time.now;
        this.directionStabilityThreshold = 500; // Increased from 300 to 500ms for more stability
        this.attackPreparing = false; // Flag to lock movement when preparing to attack

        // Properties for obstacle detection and jumping
        this.stuckDetectionTime = 300;
        this.lastMovingX = this.sprite.x;
        this.stuckStartTime = 0;
        this.isStuck = false;
        this.jumpCooldown = false;
        this.canJump = true;

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
                player: this.player,
                health: this.health,
                energy: this.energy
            }
        });
            
        // Subscribe to state changes with one-shot entry actions
        this.botService.subscribe((snapshot) => {
            const newState = snapshot.value as string;
            
            // Only process state entry actions if the state has actually changed
            // This prevents repeated calls to performAttack() while in the attacking state
            if (this.currentState !== newState) {
                console.log(`Bot state transition: ${this.currentState} -> ${newState}`);
                
                // Save the previous state before updating
                const previousState = this.currentState;
                this.currentState = newState;
                
                // Handle state entry actions - only once per state change
                switch(newState) {
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
                        // Only trigger attack once when entering this state
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
                
                // Update last processed state
                this.lastProcessedState = newState;
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

    update(time: number, delta: number): void {

        // Call the base class update method
        super.update(time, delta);
        
        // Return early if bot is dead or sprite is inactive
        if (this.dead || !this.sprite.body || !this.sprite.active) {
            return;
        }

        const seconds = delta / 1000;
        
        // Handle energy regeneration - bots always regenerate energy unless attacking
        const isRegenAllowed = this.currentState !== 'attacking';
        this.handleEnergy(seconds, isRegenAllowed);

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
        
        // Update distance and energy in state machine context
        this.botService.send({ 
            type: 'UPDATE_CONTEXT', 
            context: { 
                distanceToPlayer,
                energy: this.energy,
                health: this.health,
                attackCooldownActive: this.attackCooldown || this.attackDelayActive
            } 
        });
        
        // Stuck detection that works in any state (except dead)
        if (!this.dead && body.onFloor() && Math.abs(body.velocity.x) > 10) {
            // We're trying to move, check if we're actually moving
            const movedLessThanThreshold = Math.abs(this.sprite.x - this.lastMovingX) < 0.5;
            
            if (movedLessThanThreshold) {
                // We haven't moved much despite having velocity
                if (!this.isStuck) {
                    this.stuckStartTime = this.scene.time.now;
                    this.isStuck = true;
                } else if (this.scene.time.now - this.stuckStartTime > this.stuckDetectionTime) {
                    // We've been stuck for the threshold time, attempt to jump
                    this.jumpOverObstacle();
                }
            } else {
                // We've moved, so we're not stuck
                this.isStuck = false;
            }
            
            // Store current position for next frame comparison
            this.lastMovingX = this.sprite.x;
        }
        
        // Check if enough time has passed since the last attack
        const canStartNewAttack = !this.attackCooldown && 
                                !this.attackDelayActive && 
                                (time - this.lastAttackTime >= this.minimumAttackInterval);
        
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
                
                // Calculate new direction to face player
                const newDirection = this.player.sprite.x < this.sprite.x ? -1 : 1;
                
                // Only change direction if not preparing to attack or attacking
                const directionChangeThreshold = 20; // Increased from 10 to 20 pixels
                const horizontalDifference = Math.abs(this.player.sprite.x - this.sprite.x);
                
                // Don't change direction if attack is being prepared or we're close to attacking
                const inAttackRange = distanceToPlayer <= this.attackRange * 1.2;
                const attackPreparation = this.attackDelayActive || this.attackPreparing;
                const shouldUpdateDirection = !attackPreparation && 
                                           (!inAttackRange || horizontalDifference > 60); // Increased from 40 to 60
                
                if (shouldUpdateDirection && newDirection !== this.direction) {
                    // Track direction change time for stability calculations
                    this.lastDirection = this.direction;
                    this.direction = newDirection;
                    this.lastDirectionChangeTime = time;
                    this.sprite.setFlipX(this.direction < 0);
                }
                
                // Calculate time in current direction for stability check
                const timeInCurrentDirection = time - this.lastDirectionChangeTime;
                const directionStable = timeInCurrentDirection > this.directionStabilityThreshold;
                
                // --- BEGIN ADDED DEBUG LOG ---
                const attackCheckTime = time; // Use consistent time for checks
                const timeSinceLastAttack = attackCheckTime - this.lastAttackTime;
                const energySufficient = this.energy >= 10; // Use the actual energy cost check value
                const attackInitiationRange = this.attackRange * 0.6; // Attack when within 60% of attackRange
                const conditions = {
                    distance: distanceToPlayer <= attackInitiationRange, // Use the new initiation range
                    cooldown: !this.attackCooldown,
                    delayActive: !this.attackDelayActive,
                    preparing: !this.attackPreparing,
                    interval: timeSinceLastAttack >= this.minimumAttackInterval,
                    energy: energySufficient,
                    stable: directionStable
                };
                const allConditionsMet = conditions.distance && conditions.cooldown && conditions.delayActive && conditions.preparing && conditions.interval && conditions.energy && conditions.stable;

                // Log conditions only if close enough to potentially attack
                if (distanceToPlayer <= this.attackRange * 1.5) { // Log slightly outside attack range too
                    // Add checks to prevent toFixed error on undefined values
                    const logTime = typeof attackCheckTime === 'number' ? attackCheckTime.toFixed(0) : 'undef';
                    const logDist = typeof distanceToPlayer === 'number' ? distanceToPlayer.toFixed(1) : 'undef';
                    const logInterval = typeof timeSinceLastAttack === 'number' ? timeSinceLastAttack.toFixed(0) : 'undef';
                    const logEnergy = typeof this.energy === 'number' ? this.energy.toFixed(0) : 'undef';

                    console.log(`[${logTime}] Attack Check: Met=${allConditionsMet}, Dist=${logDist}/${attackInitiationRange.toFixed(1)} (actual: ${this.attackRange}), CD=${!this.attackCooldown}, Delay=${!this.attackDelayActive}, Prep=${!this.attackPreparing}, Interval=${logInterval}/${this.minimumAttackInterval}, Energy=${logEnergy}/10, Stable=${directionStable}`);
                }
                // --- END ADDED DEBUG LOG ---

                // Attack when close enough, energy available, not on cooldown, and direction is stable
                const attackConditionsMet = allConditionsMet; // Use the calculated value

                if (attackConditionsMet) {
                    console.log(`[${attackCheckTime.toFixed(0)}] Attack conditions MET. Setting attackPreparing=true. LastAttackTime=${this.lastAttackTime.toFixed(0)}`); // Log when prep starts
                    
                    // NEW: Set flag to lock direction during attack preparation
                    this.attackPreparing = true;
                    this.lastAttackTime = time; // Use the current time
                    
                    // Create a delay before sending the attack ready event (gives player chance to react)
                    this.scene.time.delayedCall(200, () => {
                        if (this.sprite && this.sprite.active) {
                            // Stop movement completely while preparing to attack
                            (this.sprite.body as Physics.Arcade.Body).setVelocityX(0);
                            this.attackDelayActive = true;
                            this.attackPreparing = false; // Reset the preparation flag
                            
                            // Only send attack event if we're still in chasing state
                            if (this.currentState === 'chasing') {
                                this.botService.send({ type: 'ATTACK_READY' });
                            }                        
                        }
                    });
                    break;
                }
                
                // Move toward player when chasing
                // KEY FIX: Don't move if preparing to attack or attack delay is active
                if (!this.attackDelayActive && !this.attackPreparing) {
                    (this.sprite.body as Physics.Arcade.Body).setVelocityX(this.direction * this.chaseSpeed);
                } else {
                    // Stop movement when preparing to attack
                    (this.sprite.body as Physics.Arcade.Body).setVelocityX(0);
                }
                break;
                
            case 'attacking':
                // When in attacking state, DO NOT change direction or velocity
                // Ensure we stay locked in attack position
                (this.sprite.body as Physics.Arcade.Body).setVelocityX(0);
                break;
                
            case 'hurt':
                // Hurt state is handled by animation, do nothing here
                break;
                
            case 'dead':
                // Dead state is final, do nothing
                break;
        }
        
        // Update health bar position to follow the bot
        this.updateHealthBarPosition();
    }

    /**
     * Performs an attack action triggered by the state machine
     */
    performAttack(): void {
        
        // Don't proceed if cooldown is active or no energy
        if (this.attackCooldown || this.energy <= 0) {
            // Clear delay active if we can't proceed
            this.attackDelayActive = false;
            this.attackPreparing = false; // Also clear the preparation flag
            // Revert to chasing state if we couldn't attack
            if (this.currentState === 'attacking') {
                this.botService.send({ type: 'ATTACK_COMPLETED' });
            }
            return;
        }
        
        // Set attack cooldown state
        this.attackCooldown = true;
        this.isFighting = true;
        
        // Update state machine context
        this.botService.send({ 
            type: 'UPDATE_CONTEXT', 
            context: { attackCooldownActive: true } 
        });
        
        // Stop movement during attack
        if (this.sprite.body) {
            (this.sprite.body as Physics.Arcade.Body).setVelocityX(0);
        }
        
        // Play attack animation - make sure we have valid sprite and anims
        if (this.sprite && this.sprite.anims) {
            // Force stop any current animation
            this.sprite.anims.stop();
            
            // Play attack animation
            try {
                this.sprite.anims.play('bot-attack', true);
                
                // Listen for animation completion
                this.sprite.once('animationcomplete', (animation: any) => {
                    if (animation.key === 'bot-attack') {
                        console.log("Bot attack animation complete event fired");
                        this.completeAttack();
                    }
                });
            } catch (error) {
                console.error("Error playing attack animation:", error);
                // If animation fails, still complete the attack after a delay
                this.scene.time.delayedCall(800, () => this.completeAttack());
            }
        } else {
            console.error("Cannot play attack animation: sprite or anims is invalid");
            // If sprite/anims invalid, still complete the attack after a delay
            this.scene.time.delayedCall(800, () => this.completeAttack());
        }
        
        // Consume energy
        this.energy -= 10;
        if (this.energy < 0) this.energy = 0;
        
        // Apply damage mid-animation
        this.scene.time.delayedCall(300, () => {
            // Check if bot still exists
            if (!this.sprite || !this.sprite.active) return;
            
            // Check if player is in range
            if (this.player && this.player.sprite.active && !this.player.dead) {
                const distanceToPlayer = PhaserMath.Distance.Between(
                    this.sprite.x, this.sprite.y,
                    this.player.sprite.x, this.player.sprite.y
                );
                
                // Only damage player if in attack range
                if (distanceToPlayer <= this.attackRange) {
                    this.player.takeDamage(this.attackDamage * this.getAttackPower(), 
                        { x: this.sprite.x, y: this.sprite.y });
                    
                    // Knockback effect
                    const knockbackDirection = this.player.sprite.x < this.sprite.x ? -1 : 1;
                    if (this.player.sprite.body) {
                        (this.player.sprite.body as Physics.Arcade.Body).setVelocityX(knockbackDirection * 150);
                    }
                }
            }
        });
        
        // Backup safety timer in case animation completion doesn't fire
        this.scene.time.delayedCall(1000, () => {
            if (this.currentState === 'attacking') {
                this.completeAttack();
            }
        });
    }
    
    /**
     * Handles the completion of an attack and reset of states
     */
    completeAttack(): void {
        // Only proceed if we're still in the attacking state and sprite exists
        if (this.currentState !== 'attacking' || !this.sprite || !this.sprite.active) return;
                
        // End the fighting state
        this.isFighting = false;
        this.attackCooldown = false;
        this.attackPreparing = false; // Reset the preparation flag
        
        // First update the context
        this.botService.send({ 
            type: 'UPDATE_CONTEXT', 
            context: { attackCooldownActive: false }
        });
        
        // Then notify state machine the attack is complete
        this.botService.send({ type: 'ATTACK_COMPLETED' });
        
        // Remove animation completion listener to prevent multiple calls
        if (this.sprite && this.sprite.anims) {
            this.sprite.off('animationcomplete');
        }
                
        // Keep delay active for a period to prevent immediate follow-up attacks
        this.attackDelayActive = true;
        this.scene.time.delayedCall(600, () => {
            if (this.sprite && this.sprite.active) {
                this.attackDelayActive = false;
            }
        });
    }

    takeDamage(amount: number, attackerPosition?: {x: number, y: number}): void {
        // Don't take damage if already hit, dead, or if sprite is inactive/being destroyed
        if (this.isHit || this.dead || !this.sprite || !this.sprite.active || !this.sprite.anims) return;

        // Set hit state to prevent multiple rapid damage events
        this.isHit = true;

        // Call the parent takeDamage method
        super.takeDamage(amount, attackerPosition);

        // Update the state machine with damage event
        this.botService.send({ type: 'DAMAGE_TAKEN', damage: amount });

        // Visual feedback - make sure anims exists before checking if animation exists
        if (this.sprite.anims && this.scene.anims.exists('bot-hurt')) {
            this.sprite.anims.play('bot-hurt', true);
        }

        // Update health bar to reflect new health
        this.updateHealthBar();

        // Reset after a short delay
        this.scene.time.delayedCall(500, () => {
            this.isHit = false;
            
            // Send RECOVER event to the state machine
            this.botService.send({ type: 'RECOVER' });
            
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
        if (this.scene.anims.exists('bot-die')) {
            this.scene.anims.remove('bot-die');
        }
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
        
        // Add a delay before starting the death animation
        this.scene.time.delayedCall(300, () => {
            if (!this.sprite || !this.sprite.active) return; // Guard in case sprite is destroyed during delay

            // Clear the tint
            this.sprite.clearTint();
            
            // Set the texture and play death frames
            try {
                this.sprite.anims.play('bot-die');
                
                // Listen for animation completion specifically for 'bot-die'
                this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, (animation: Phaser.Animations.Animation) => {
                    if (animation.key === 'bot-die') {
                        this.destroyBot();
                    }
                });
                
                // Increased timeout for slower animation (10 frames / 4fps = 2500ms. Total: 300ms delay + 2500ms anim = 2800ms)
                this.scene.time.delayedCall(3000, () => { // Safety net
                    if (this.sprite && this.sprite.active) { // Check if not already destroyed
                        this.destroyBot();
                    }
                });
            } catch (error) {
                console.error("Error playing bot death animation:", error);
                this.destroyBot(); // Destroy if an error occurs during animation playback
            }
        });
    }
    
    /**
     * Helper method to ensure consistent destruction of bot resources
     */
    destroyBot(): void {
        // Drop a coin at the bot's position
        this.dropCoin();
        
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
    
    /**
     * Drops a coin at the bot's position when defeated
     */
    dropCoin(): void {
        // Make sure player reference and sprite exist
        if (!this.player || !this.sprite || !this.sprite.active) return;
        
        // Get bot's current position
        const x = this.sprite.x;
        const y = this.sprite.y;
        
        // Directly add a coin to the player's purse
        // This is a simple implementation without visual effects or animations
        this.player.addCoins(1);
        
        console.log(`Bot destroyed, coin added to player purse. Player now has ${this.player.getCoins()} coins.`);
    }

    setupPlayerCollision(player: Player): void {
        // Ensure player sprite exists before setting up overlap
        if (!player.sprite) {
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

    /**
     * Checks if there's a landing spot after a jump
     * @returns Boolean indicating if there's a safe landing spot
     */
    checkForLandingSpot(): boolean {
        // Get the tilemap layer from the scene
        const platforms = (this.scene as any).platforms as Phaser.Tilemaps.TilemapLayer;
        if (!platforms) {
            return false;
        }

        // Force jump detection even if we don't detect a good landing spot
        // This simulates the bot making a "desperate" jump attempt when stuck too long
        const forceJumpDetection = this.isStuck && 
            (this.scene.time.now - this.stuckStartTime > this.stuckDetectionTime * 3);
        
        if (forceJumpDetection) {
            return true;
        }

        const map = platforms.tilemap;
        if (!map) {
            return false;
        }

        // Bot position
        const body = this.sprite.body as Physics.Arcade.Body;
        const botX = this.sprite.x;
        const botY = this.sprite.y;
        const tileSize = map.tileWidth;

        // Direction we're trying to go (toward player)
        const lookAheadDistance = this.direction * 3; // Look ahead 3 tiles
        
        // Current position in tile coordinates
        const currentTileX = Math.floor(botX / tileSize);
        const currentTileY = Math.floor((botY + body.height / 2) / tileSize);
        
        // The obstacle is directly in front of us
        const obstacleTileX = currentTileX + this.direction;
        
        // Check for obstacle directly in front
        // First, check if there's a colliding tile at the current level
        const frontTile = map.getTileAt(obstacleTileX, currentTileY);
        
        // Then check if there's a colliding tile one level up (for taller obstacles)
        const frontTileUp = map.getTileAt(obstacleTileX, currentTileY - 1);
        
        if ((frontTile && frontTile.collides) || (frontTileUp && frontTileUp.collides)) {
            
            // Now check for landing spot
            const landingTileX = currentTileX + lookAheadDistance;
            
            // Check for ground at multiple levels to land on
            for (let y = currentTileY - 1; y <= currentTileY + 2; y++) {
                const tile = map.getTileAt(landingTileX, y);
                if (tile && tile.collides) {
                    return true;
                }
            }
        }
        
        // Special case: check for slightly higher ground ahead (small step up)
        const stepUpTile = map.getTileAt(obstacleTileX, currentTileY - 1);
        if (stepUpTile && stepUpTile.collides) {
            // There's a step up, consider it jumpable
            return true;
        }
        
        // No obstacle or no landing spot
        return false;
    }

    /**
     * Makes the bot jump over an obstacle if stuck
     */
    jumpOverObstacle(): void {
        if (this.jumpCooldown || !this.canJump) {
            return;
        }

        // Force jump when stuck - we'll jump regardless of landing spot in some cases
        const forceJump = this.isStuck && (this.scene.time.now - this.stuckStartTime > this.stuckDetectionTime * 2);
        
        // Check for landing spot
        const hasLandingSpot = this.checkForLandingSpot();
        
        if (!hasLandingSpot && !forceJump) {
            
            // Reset stuck state to allow detection again after a shorter delay
            this.scene.time.delayedCall(1000, () => {
                this.isStuck = false;
                this.stuckStartTime = 0;
            });
            
            return;
        }

        // Set jump cooldown
        this.jumpCooldown = true;
        this.canJump = false;

        // Use base class jump with stronger impulse
        super.jump(-350);

        // Boost horizontal velocity during jump to clear the obstacle
        if (this.sprite.body) {
            const jumpBoost = 1.8; // 80% boost to help clear obstacles better
            (this.sprite.body as Physics.Arcade.Body).setVelocityX(this.direction * this.chaseSpeed * jumpBoost);
        }

        // Play jump animation
        if (this.sprite.anims && this.scene.anims.exists('bot-jump')) {
            this.sprite.anims.play('bot-jump', true);
        }
        
        // Clear the stuck flag immediately when jumping
        this.isStuck = false;
        
        // Wait for landing before allowing another jump
        const checkForLanding = () => {
            // Safety check - make sure sprite and body still exist
            if (!this.sprite?.body) {
                this.scene.events.off('update', checkForLanding);
                return;
            }
            
            if (this.isOnGround()) {
                
                // Re-enable jumping after landing with a short delay
                this.scene.time.delayedCall(300, () => {
                    this.jumpCooldown = false;
                    this.canJump = true;
                    
                    // Return to running animation if not engaged in other actions
                    if (this.currentState === 'chasing' && this.sprite?.active && this.sprite?.anims) {
                        this.sprite.anims.play('bot-run', true);
                    }
                });
                
                // Remove the event listener
                this.scene.events.off('update', checkForLanding);
            }
        };
        
        // Start checking for landing
        this.scene.events.on('update', checkForLanding);
        
        // Safety timeout - enable jumping after 2 seconds regardless
        this.scene.time.delayedCall(2000, () => {
            if (this.scene.events.listenerCount('update') > 0) {
                this.scene.events.off('update', checkForLanding);
                this.jumpCooldown = false;
                this.canJump = true;
            }
        });
    }
}