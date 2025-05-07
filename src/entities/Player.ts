import { Scene, Physics, GameObjects, Input, Animations, Types, Math as PhaserMath, Geom } from 'phaser'; // Added Geom
import Character from './Character';
import Bot from './Bot';
import SpriteUtils from '../utils/SpriteUtils';
import { createMachine, createActor, type ActorRefFrom } from 'xstate';
import type GameScene from '../scenes/GameScene'; // Import GameScene type for casting

// Define the context and events for the player state machine
type PlayerContext = {
    health: number;
    energy: number; // Renamed from stamina for consistency
    attackCooldownActive: boolean;
    defendDirection: number;
    coins: number; // Added coins property to context
};

type PlayerEvent = 
    | { type: 'MOVE_LEFT' }
    | { type: 'MOVE_RIGHT' }
    | { type: 'STOP_MOVING' }
    | { type: 'JUMP' }
    | { type: 'ATTACK_PRESSED' }
    | { type: 'ATTACK_COMPLETED' }
    | { type: 'DEFEND_PRESSED' }
    | { type: 'DEFEND_RELEASED' }
    | { type: 'HEAL_PRESSED' } // New event for starting healing
    | { type: 'HEAL_COMPLETED' } // New event for when healing action finishes
    | { type: 'DAMAGE_TAKEN', damage: number, attackerPosition?: {x: number, y: number} }
    | { type: 'DEATH' }
    | { type: 'OUT_OF_ENERGY' }
    | { type: 'UPDATE_CONTEXT', context: Partial<PlayerContext> };

// Create the player state machine
const createPlayerMachine = () => createMachine({
    id: 'player',
    types: {} as {
        context: PlayerContext;
        events: PlayerEvent;
    },
    context: {
        health: 100,
        energy: 100,
        attackCooldownActive: false,
        defendDirection: 0,
        coins: 10 // Initialize with 10 coins
    },
    initial: 'idle',
    states: {
        idle: {
            on: {
                MOVE_LEFT: { target: 'moving' },
                MOVE_RIGHT: { target: 'moving' },
                JUMP: { target: 'jumping' },
                ATTACK_PRESSED: [
                    {
                        target: 'attacking',
                        guard: ({ context }) => !context.attackCooldownActive && context.energy > 0
                    }
                ],
                DEFEND_PRESSED: [
                    {
                        target: 'defending',
                        guard: ({ context }) => context.energy > 0
                    }
                ],
                HEAL_PRESSED: { target: 'healing' }, // Transition to healing
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
        moving: {
            on: {
                STOP_MOVING: { target: 'idle' },
                JUMP: { target: 'jumping' },
                ATTACK_PRESSED: [
                    {
                        target: 'attacking',
                        guard: ({ context }) => !context.attackCooldownActive && context.energy > 0
                    }
                ],
                DEFEND_PRESSED: [
                    {
                        target: 'defending',
                        guard: ({ context }) => context.energy > 0
                    }
                ],
                HEAL_PRESSED: { target: 'healing' }, // Transition to healing
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
        jumping: {
            on: {
                MOVE_LEFT: { target: 'moving' }, // Allow direct transition to moving when landing
                MOVE_RIGHT: { target: 'moving' }, // Allow direct transition to moving when landing
                ATTACK_PRESSED: [
                    {
                        target: 'airAttacking',
                        guard: ({ context }) => !context.attackCooldownActive && context.energy > 0
                    }
                ],
                STOP_MOVING: { target: 'idle' },
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
                ATTACK_COMPLETED: { target: 'idle' },
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
        airAttacking: {
            on: {
                ATTACK_COMPLETED: { target: 'jumping' },
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
        defending: {
            on: {
                DEFEND_RELEASED: { target: 'idle' },
                OUT_OF_ENERGY: { target: 'idle' },
                DAMAGE_TAKEN: { target: 'defending' }, // Stay in defending if taking damage while defending
                UPDATE_CONTEXT: {
                    actions: ({ context, event }) => {
                        if (event.context) {
                            Object.assign(context, event.context);
                        }
                    }
                }
            }
        },
        healing: { // New healing state
            on: {
                HEAL_COMPLETED: { target: 'idle' },
                DAMAGE_TAKEN: { target: 'hurt' }, // Can be interrupted by damage
                // Add other potential interruptions if needed (e.g., movement input)
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
                DEATH: { target: 'dead' },
                STOP_MOVING: { target: 'idle' },
                UPDATE_CONTEXT: {
                    actions: ({ context, event }) => {
                        if (event.context) {
                            Object.assign(context, event.context);
                        }
                    }
                }
            },
            after: {
                500: { target: 'idle' } // Automatically return to idle after 500ms
            }
        },
        dead: {
            type: 'final'
        }
    }
});

export default class Player extends Character {
    canJump: boolean;
    isDefending: boolean;
    defendDirection: number; // The direction player is defending in
    defendDrainRate: number; // Energy drain rate while defending
    cursors: Types.Input.Keyboard.CursorKeys;
    attackKey: Input.Keyboard.Key | null;
    defendKey: Input.Keyboard.Key | null;
    healKey: Input.Keyboard.Key | null; // Key for healing
    coins: number; // Player's purse with gold coins
    
    // State machine
    playerMachine: ReturnType<typeof createPlayerMachine>;
    playerService: ActorRefFrom<ReturnType<typeof createPlayerMachine>>;
    currentState: string = 'idle';
    // Track state transitions to prevent repeated execution of entry actions
    lastProcessedState: string = '';

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
        scene.load.spritesheet('dude-defend', 'assets/player/DEFEND.png', { frameWidth: 96, frameHeight: 96 });
        scene.load.spritesheet('dude-heal', 'assets/player/HEALING.png', { frameWidth: 96, frameHeight: 96 }); // Healing spritesheet
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
        
        scene.anims.create({
            key: 'defend',
            frames: scene.anims.generateFrameNumbers('dude-defend', { start: 0, end: 5 }),
            frameRate: 15,
            repeat: 0
        });

        scene.anims.create({ // Healing animation
            key: 'heal',
            frames: scene.anims.generateFrameNumbers('dude-heal', { start: 0, end: 14 }),
            frameRate: 15,
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
            moveSpeed: 160,
            maxEnergy: 100,
            energyRegenRate: 10,
            energyDrainRate: 20,
            attackRange: 50,
            attackDamage: 20
        });

        // Apply pixel-perfect collision with debug enabled temporarily
        // to help verify hitbox alignment
        this.setupPixelPerfectCollision(5, true);

        // Player-specific state
        this.canJump = true;
        this.isDefending = false;
        this.defendDirection = 0;
        this.defendDrainRate = 5;   // per second while defending
        this.coins = 10; // Start with 10 coins

        // Set up player input
        if (scene.input.keyboard) {
            this.cursors = scene.input.keyboard.createCursorKeys();
            this.attackKey = scene.input.keyboard.addKey('H');
            this.defendKey = scene.input.keyboard.addKey('J');
            this.healKey = scene.input.keyboard.addKey('Y'); // Initialize heal key
        } else {
            console.error("Keyboard input not available.");
            this.cursors = {} as Types.Input.Keyboard.CursorKeys;
            this.attackKey = null;
            this.defendKey = null;
            this.healKey = null; // Initialize heal key as null
        }

        // Initialize state machine
        this.playerMachine = createPlayerMachine();
        this.playerService = createActor(this.playerMachine, {
            input: {
                health: this.health,
                energy: this.energy,
                attackCooldownActive: false,
                defendDirection: 0,
                coins: this.coins // Include coins in initial context
            }
        });
            
        // Subscribe to state changes
        this.playerService.subscribe((snapshot) => {
            const newState = snapshot.value as string;
            
            // Only process state entry actions if the state has actually changed
            // This prevents repeated calls to performAttack() while in the attacking state
            if (this.currentState !== newState) {
                console.log(`Player state transition: ${this.currentState} -> ${newState}`);
                
                // Save the previous state before updating
                const previousState = this.currentState;
                this.currentState = newState;
                
                // Handle state entry actions - only once per state change
                switch(newState) {
                    case 'idle':
                        this.idle();
                        this.sprite.anims.play('idle', true);
                        break;
                    case 'moving':
                        // Movement direction is handled in update
                        break;
                    case 'jumping':
                        // Jumping physics are applied when the event is sent
                        break;
                    case 'attacking':
                        // Only call performAttack once when entering this state
                        this.performAttack();
                        break;
                    case 'airAttacking':
                        // Only call performAttack once when entering this state
                        this.performAttack();
                        break;
                    case 'defending':
                        this.startDefending();
                        break;
                    case 'healing': // Handle healing state entry
                        this.performHealing();
                        break;
                    case 'hurt':
                        // Visual feedback handled in takeDamage
                        this.sprite.setVelocityX(0);
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
        this.playerService.start();
    }

    update(time: number, delta: number): void {
        // Call base class update first to handle common checks
        super.update(time, delta);
        
        // If already determined to be dead or no body, return early
        if (this.dead || !this.sprite.body) return;

        const seconds = delta / 1000;
        const body = this.sprite.body as Phaser.Physics.Arcade.Body;
        
        // Check if player has landed on the ground and reset jump ability
        if (body.onFloor() && !this.canJump) {
            this.canJump = true;
            
            // If we're in the jumping state and we've landed, transition to the correct state
            if (this.currentState === 'jumping') {
                console.log("Player landed on ground, transitioning from jumping state");
                
                // If horizontal movement keys are pressed, go to moving state
                if (this.cursors.left?.isDown || this.cursors.right?.isDown) {
                    this.playerService.send({ type: 'MOVE_LEFT' }); // or MOVE_RIGHT, doesn't matter as handleInput will set correct direction
                } else {
                    this.playerService.send({ type: 'STOP_MOVING' });
                }
            }
        }
        
        // Update state machine context with current values
        this.playerService.send({
            type: 'UPDATE_CONTEXT',
            context: {
                health: this.health,
                energy: this.energy
            }
        });
        
        // Handle energy management - different drain rates based on state
        if (this.currentState === 'defending') {
            // Handle energy drain while defending
            this.handleEnergy(seconds, false, this.defendDrainRate);
            
            // Check if we ran out of energy while defending
            if (this.energy <= 0) {
                this.playerService.send({ type: 'OUT_OF_ENERGY' });
            }
        } else {
            // Normal energy handling - regenerate when not in combat states
            const isRegenAllowed = !['attacking', 'airAttacking'].includes(this.currentState);
            this.handleEnergy(seconds, isRegenAllowed);
        }
        
        // Always check input regardless of state
        this.handleInput(body);
        
        // Check for healing input
        if (this.healKey?.isDown && !['attacking', 'airAttacking', 'defending', 'hurt', 'dead', 'healing'].includes(this.currentState)) {
            // Check if player is near a tree
            const gameScene = this.scene as GameScene; // Cast scene to GameScene
            let canHeal = false;
            if (gameScene.treeGroup) {
                const playerBounds = this.sprite.getBounds();
                gameScene.treeGroup.getChildren().forEach(treeChild => {
                    const tree = treeChild as Phaser.GameObjects.Image;
                    if (tree.active) {
                        const treeBounds = tree.getBounds();
                        if (Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, treeBounds)) {
                            canHeal = true;
                        }
                    }
                });
            }

            if (canHeal) {
                this.playerService.send({ type: 'HEAL_PRESSED' });
            }
        }
        
        // Emit stamina changed event for UI
        this.scene.events.emit('player-stamina-changed', this.energy, this.maxEnergy);
    }

    handleInput(body: Phaser.Physics.Arcade.Body): void {
        // Don't handle movement input in certain states
        const canMove = !['attacking', 'airAttacking', 'defending', 'hurt', 'dead'].includes(this.currentState);
        
        if (canMove) {
            // Handle horizontal movement
            if (this.cursors.left?.isDown) {
                // Send move left event if in idle state
                if (this.currentState === 'idle') {
                    this.playerService.send({ type: 'MOVE_LEFT' });
                }
                this.direction = -1;
                this.sprite.setVelocityX(-this.moveSpeed);
                this.sprite.flipX = true;
                if (body.onFloor() && this.currentState === 'moving') {
                    this.sprite.anims.play('left', true);
                }
            } 
            else if (this.cursors.right?.isDown) {
                // Send move right event if in idle state
                if (this.currentState === 'idle') {
                    this.playerService.send({ type: 'MOVE_RIGHT' });
                }
                this.direction = 1;
                this.sprite.setVelocityX(this.moveSpeed);
                this.sprite.flipX = false;
                if (body.onFloor() && this.currentState === 'moving') {
                    this.sprite.anims.play('right', true);
                }
            }
            else if (body.onFloor()) {
                // No movement input and on floor - return to idle
                if (this.currentState === 'moving' || this.currentState === 'jumping') {
                    this.playerService.send({ type: 'STOP_MOVING' });
                }
                this.sprite.setVelocityX(0);
            } else {
                // In air with no input - maintain some momentum
                this.sprite.setVelocityX(body.velocity.x * 0.98);
            }
        }

        // Jumping - process the jump if we're on the floor and allowed to jump
        // Allow jumping from any state where the player can move and is on the floor
        if (this.cursors.up?.isDown && body.onFloor() && this.canJump) {
            if (['idle', 'moving'].includes(this.currentState)) {
                console.log("Jump key pressed, sending JUMP event");
                this.playerService.send({ type: 'JUMP' });
                this.playerJump();
            }
        }

        // Attack - check if attack key was just pressed
        if (this.attackKey?.isDown && !this.attackCooldown && 
            !['attacking', 'airAttacking', 'defending', 'hurt', 'dead'].includes(this.currentState)) {
            this.playerService.send({ type: 'ATTACK_PRESSED' });
        }

        // Defend - toggle based on key state
        if (this.defendKey?.isDown && this.energy > 0 && 
            !['attacking', 'airAttacking', 'defending', 'hurt', 'dead'].includes(this.currentState)) {
            this.playerService.send({ type: 'DEFEND_PRESSED' });
        } 
        else if (this.defendKey?.isUp && this.currentState === 'defending') {
            this.playerService.send({ type: 'DEFEND_RELEASED' });
        }
    }

    // Player-specific jump implementation
    playerJump(): void {
        // Use the base jump method
        super.jump(-350);
        
        this.sprite.anims.play('jump', true);
        this.canJump = false;

        // Instead of using a fixed timer, we'll check for landing in the update method
    }

    performAttack(): void {
        console.log("Player.performAttack() called, attackCooldown:", this.attackCooldown, "energy:", this.energy, "state:", this.currentState);
        
        // IMPORTANT: Force reset the cooldown flag if we're in an attacking state
        // This ensures we don't get stuck with attackCooldown = true
        if (this.attackCooldown && ['attacking', 'airAttacking'].includes(this.currentState)) {
            console.log("WARNING: Attack cooldown was still true in attacking state - forcing reset");
            this.attackCooldown = false;
        }
        
        if (this.attackCooldown || this.energy <= 0) {
            console.log("Attack prevented - cooldown:", this.attackCooldown, "energy:", this.energy);
            return;
        }

        // Set attack cooldown
        this.attackCooldown = true;
        this.isFighting = true;
        
        // Update state machine context
        this.playerService.send({ 
            type: 'UPDATE_CONTEXT', 
            context: { attackCooldownActive: true } 
        });
        
        console.log("Player attack started - cooldown set to TRUE");
        
        // Stop horizontal movement during attack
        this.sprite.setVelocityX(0);

        // Play attack animation
        this.sprite.anims.play('attack', true);
        
        // Consume energy
        this.energy -= 10;
        if (this.energy < 0) this.energy = 0;

        // Apply damage mid-animation at fixed time
        this.scene.time.delayedCall(300, this.applyAttackDamage, [this]);
        
        // Schedule the end of the attack
        this.scene.time.delayedCall(500, () => {
            // Only proceed if sprite is still valid
            if (!this.sprite || !this.sprite.active) return;
            
            console.log("Player attack completion - resetting cooldown");
            
            // Reset cooldown flags
            this.attackCooldown = false;
            this.isFighting = false;
            
            // First update the context
            this.playerService.send({ 
                type: 'UPDATE_CONTEXT', 
                context: { attackCooldownActive: false }
            });
            
            // Then notify state machine the attack is complete
            this.playerService.send({ type: 'ATTACK_COMPLETED' });
        });
        
        // Add backup reset in case the main one fails
        this.scene.time.delayedCall(1000, () => {
            if (this.attackCooldown && this.sprite && this.sprite.active) {
                console.log("BACKUP: Attack cooldown still true after 1000ms - forcing reset");
                this.attackCooldown = false;
                this.isFighting = false;
                
                // First update the context
                this.playerService.send({ 
                    type: 'UPDATE_CONTEXT', 
                    context: { attackCooldownActive: false }
                });
                
                // Then send the completion event
                this.playerService.send({ type: 'ATTACK_COMPLETED' });
            }
        });
    }
    
    /**
     * Helper method to apply damage to enemies in range
     */
    applyAttackDamage(playerInstance: Player): void {
        // Use the provided player instance or fallback to 'this'
        const player = playerInstance || this;
        
        if (!player.sprite || !player.sprite.active) return;
        
        console.log("Player attack damage check triggered");
        
        // Find all bots in the scene that could be hit
        const gameObjects = player.scene.physics.world.bodies.getArray()
            .map(body => body.gameObject)
            .filter(obj => obj && obj.active);
        
        console.log("Checking", gameObjects.length, "possible targets");
        
        // Calculate attack position based on player direction
        const attackX = player.sprite.x + (player.direction * player.attackRange/2);
        const attackY = player.sprite.y;

        // Check each potential target
        gameObjects.forEach(obj => {
            // Skip if not a bot or already destroyed
            if (!obj.getData('isBot') || !obj.active) return;
            
            // Calculate distance to potential target
            const targetSprite = obj as unknown as Physics.Arcade.Sprite;
            const distance = PhaserMath.Distance.Between(
                attackX, attackY,
                targetSprite.x, targetSprite.y
            );
            
            console.log("Bot found at distance:", distance, "attackRange:", player.attackRange);
            
            // If in range, get the bot reference and damage it
            if (distance <= player.attackRange) {
                const bot = obj.getData('botRef');
                if (bot && typeof bot.takeDamage === 'function') {
                    console.log("Damaging bot");
                    bot.takeDamage(player.attackDamage * player.getAttackPower());
                }
            }
        });
    }

    startDefending(): void {
        if (this.energy <= 0) return;
        
        this.isDefending = true;
        this.defendDirection = this.direction;
        this.sprite.anims.play('defend', true);
        this.sprite.setVelocityX(0);
        
        // Update state machine context
        this.playerService.send({ 
            type: 'UPDATE_CONTEXT', 
            context: { defendDirection: this.direction } 
        });
    }
    
    stopDefending(): void {
        this.isDefending = false;
        this.defendDirection = 0;
        
        // Return to idle animation if on the ground
        if ((this.sprite.body as Phaser.Physics.Arcade.Body).onFloor()) {
            this.sprite.anims.play('idle', true);
        }
    }

    takeDamage(amount: number, attackerPosition?: {x: number, y: number}): void {
        // Check if already dead
        if (this.dead) return;

        // Check if we're defending and the attack is coming from the direction we're defending
        if (this.currentState === 'defending' && attackerPosition) {
            // Get the attacker direction relative to player
            let attackerDirection = attackerPosition.x > this.sprite.x ? 1 : -1;
            
            // If defending in the right direction, block the damage
            if (attackerDirection === this.defendDirection) {
                console.log("Attack blocked by defense!");
                
                // Play a block feedback animation/effect
                this.sprite.setTintFill(0xffffff);
                this.scene.time.delayedCall(100, () => {
                    this.sprite.clearTint();
                });
                
                return; // No damage taken
            }
        }
        
        // Not defending or wrong direction - take full damage
        super.takeDamage(amount, attackerPosition);

        // If healing, interrupt it
        if (this.currentState === 'healing') {
            this.sprite.anims.stop(); // Stop healing animation
            // Optionally, you might want to send a HEAL_COMPLETED or a new HEAL_INTERRUPTED event
            // For now, taking damage will transition to 'hurt' state as per the state machine
        }

        // Send damage event to state machine
        this.playerService.send({ 
            type: 'DAMAGE_TAKEN', 
            damage: amount,
            attackerPosition 
        });

        // If health <= 0, send death event
        if (this.health <= 0) {
            this.playerService.send({ type: 'DEATH' });
        }

        // Signal that player health changed
        this.scene.events.emit('player-health-changed', this.health, this.maxHealth);
    }

    die(): void {
        if (this.dead) return;

        super.die();
        this.sprite.anims.play('die', true);

        // Emit death event for the game to handle
        this.scene.events.emit('player-died');
    }

    performHealing(): void {
        if (this.health >= this.maxHealth) {
            this.playerService.send({ type: 'HEAL_COMPLETED' });
            return; // Already at max health
        }

        this.sprite.anims.play('heal', true);
        this.health += this.maxHealth * 0.10; // Increase health by 10%
        if (this.health > this.maxHealth) {
            this.health = this.maxHealth;
        }
        this.scene.events.emit('player-health-changed', this.health, this.maxHealth);

        // Complete healing after animation finishes
        this.sprite.once(Animations.Events.ANIMATION_COMPLETE_KEY + 'heal', () => {
            this.playerService.send({ type: 'HEAL_COMPLETED' });
        });
    }

    reset(x: number, y: number): void {
        super.reset(x, y);
        
        this.energy = this.maxEnergy;
        this.coins = 10; // Reset coins to 10
        this.scene.events.emit('player-health-changed', this.health, this.maxHealth);
        this.scene.events.emit('player-stamina-changed', this.energy, this.maxEnergy);
        this.scene.events.emit('player-coins-changed', this.coins); // Emit coin update
        
        // Create a new state machine or reset the existing one
        this.playerService.stop();
        this.playerService = createActor(this.playerMachine, {
            input: {
                health: this.health,
                energy: this.energy,
                attackCooldownActive: false,
                defendDirection: 0,
                coins: this.coins // Add coins to state machine input
            }
        });
        this.playerService.start();
    }

    /**
     * Add coins to the player's purse
     * @param amount Number of coins to add
     */
    addCoins(amount: number): void {
        if (amount <= 0) return;
        this.coins += amount;
        
        // Update state machine context
        this.playerService.send({
            type: 'UPDATE_CONTEXT',
            context: { coins: this.coins }
        });
        
        // Emit event for UI update
        this.scene.events.emit('player-coins-changed', this.coins);
    }
    
    /**
     * Remove coins from the player's purse
     * @param amount Number of coins to remove
     * @returns boolean True if the player had enough coins and they were removed
     */
    removeCoins(amount: number): boolean {
        if (amount <= 0) return true;
        if (this.coins < amount) return false;
        
        this.coins -= amount;
        
        // Update state machine context
        this.playerService.send({
            type: 'UPDATE_CONTEXT',
            context: { coins: this.coins }
        });
        
        // Emit event for UI update
        this.scene.events.emit('player-coins-changed', this.coins);
        return true;
    }
    
    /**
     * Get the current coin balance
     * @returns number Current coin balance
     */
    getCoins(): number {
        return this.coins;
    }
}