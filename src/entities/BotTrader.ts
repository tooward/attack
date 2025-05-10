import { Scene, Physics, GameObjects, Math as PhaserMath, Types, Animations } from 'phaser';
import Character from './Character';
import Player from './Player';
import SpriteUtils from '../utils/SpriteUtils';
import { createMachine, createActor, type ActorRefFrom } from 'xstate';

// Define the context and events for the trader state machine
type TraderContext = {
    player: Player;
    distanceToPlayer: number;
    health: number;
    energy: number;
    isTrading: boolean;
};

type TraderEvent = 
    | { type: 'PLAYER_DETECTED' }
    | { type: 'PLAYER_LOST' }
    | { type: 'TRADING_STARTED' }
    | { type: 'TRADING_COMPLETED' }
    | { type: 'DAMAGE_TAKEN', damage: number }
    | { type: 'DEATH' }
    | { type: 'UPDATE_CONTEXT', context: Partial<TraderContext> };

// Create the trader state machine
const createTraderMachine = () => createMachine({
    id: 'trader',
    types: {} as {
        context: TraderContext;
        events: TraderEvent;
    },
    context: {
        player: undefined as unknown as Player, // Will be set on initialization
        distanceToPlayer: 1000,
        health: 100,
        energy: 100,
        isTrading: false
    },
    initial: 'idle',
    states: {
        idle: {
            on: {
                PLAYER_DETECTED: { target: 'greeting' },
                UPDATE_CONTEXT: {
                    actions: ({ context, event }) => {
                        if (event.context) {
                            Object.assign(context, event.context);
                        }
                    }
                }
            }
        },
        greeting: {
            on: {
                PLAYER_LOST: { target: 'idle' },
                TRADING_STARTED: { target: 'trading' },
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
        trading: {
            on: {
                TRADING_COMPLETED: { target: 'idle' },
                PLAYER_LOST: { target: 'idle' },
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
                DEATH: { target: 'dead' },
                PLAYER_LOST: { target: 'idle' },
                PLAYER_DETECTED: { target: 'greeting' },
                UPDATE_CONTEXT: {
                    actions: ({ context, event }) => {
                        if (event.context) {
                            Object.assign(context, event.context);
                        }
                    }
                }
            },
            after: {
                500: [
                    { target: 'greeting', guard: ({ context }) => context.distanceToPlayer <= 200 },
                    { target: 'idle' }
                ]
            }
        },
        dead: {
            type: 'final'
        }
    }
});

export default class BotTrader extends Character {
    // Trader-specific properties
    player: Player;
    isHit: boolean;
    detectionRange: number;
    interactionRange: number;
    
    // Trade-related properties
    isTrading: boolean;
    availableItems: { id: string, price: number, quantity: number }[];
    
    // Health bar components
    healthBarBackground!: Phaser.GameObjects.Graphics;
    healthBar!: Phaser.GameObjects.Graphics;
    healthBarWidth: number = 40;
    healthBarHeight: number = 5;
    
    // Indicator for interactivity
    interactionIndicator!: Phaser.GameObjects.Text;
    
    // State machine
    traderMachine: ReturnType<typeof createTraderMachine>;
    traderService: ActorRefFrom<ReturnType<typeof createTraderMachine>>;
    currentState: string = 'idle';

    // Animation and state tracking
    lastProcessedState: string = '';
    isDeathAnimationPlaying: boolean = false;

    /**
     * Static method to preload trader assets
     * @param {Scene} scene - The scene to use for loading
     */
    static preload(scene: Scene): void {
        // Load trader sprites
        scene.load.spritesheet('trader-idle', 'assets/bot_trader/IDLE.png', { frameWidth: 92, frameHeight: 64 });
        scene.load.spritesheet('trader-run', 'assets/bot_trader/RUN.png', { frameWidth: 92, frameHeight: 64 });
        scene.load.spritesheet('trader-dash', 'assets/bot_trader/DASH.png', { frameWidth: 92, frameHeight: 64 });
        scene.load.spritesheet('trader-jump', 'assets/bot_trader/JUMP.png', { frameWidth: 92, frameHeight: 64 });
        scene.load.spritesheet('trader-attack1', 'assets/bot_trader/ATTACK 1.png', { frameWidth: 92, frameHeight: 64 });
        scene.load.spritesheet('trader-attack2', 'assets/bot_trader/ATTACK 2.png', { frameWidth: 92, frameHeight: 64 });
        scene.load.spritesheet('trader-attack3', 'assets/bot_trader/ATTACK 3.png', { frameWidth: 92, frameHeight: 64 });
        scene.load.spritesheet('trader-hurt', 'assets/bot_trader/HURT.png', { frameWidth: 92, frameHeight: 64 });
        scene.load.spritesheet('trader-death', 'assets/bot_trader/DEATH.png', { frameWidth: 92, frameHeight: 64 });
    }

    /**
     * Ensures all trader animations are available in the current scene
     * @param scene The scene to create animations in
     */
    static createAnimsInScene(scene: Scene): void {
        // Only create animations that don't already exist in this scene
        if (!scene.anims.exists('trader-idle')) {
            scene.anims.create({
                key: 'trader-idle',
                frames: scene.anims.generateFrameNumbers('trader-idle', { start: 0, end: 4 }),
                frameRate: 5,
                repeat: -1
            });
        }
        
        if (!scene.anims.exists('trader-run')) {
            scene.anims.create({
                key: 'trader-run',
                frames: scene.anims.generateFrameNumbers('trader-run', { start: 0, end: 6 }),
                frameRate: 10,
                repeat: -1
            });
        }
        
        if (!scene.anims.exists('trader-hurt')) {
            scene.anims.create({
                key: 'trader-hurt',
                frames: scene.anims.generateFrameNumbers('trader-hurt', { start: 0, end: 1 }),
                frameRate: 10,
                repeat: 0
            });
        }
        
        // Remove existing die animation if it exists
        if (scene.anims.exists('trader-die')) {
            scene.anims.remove('trader-die');
        }
        
        // Create death animation
        scene.anims.create({
            key: 'trader-die',
            frames: scene.anims.generateFrameNumbers('trader-death', { start: 0, end: 9 }),
            frameRate: 8,
            repeat: 0,
            showOnStart: true,
            hideOnComplete: false
        });
    }

    /**
     * Static method to create trader animations in the boot scene
     * @param {Scene} scene - The scene to create animations in
     */
    static createAnims(scene: Scene): void {
        // This method delegates to the createAnimsInScene method
        BotTrader.createAnimsInScene(scene);
    }

    constructor(scene: Scene, x: number, y: number, player: Player) {
        // Call the parent constructor with trader-specific configuration
        super(scene, x, y, 'trader-idle', {
            maxHealth: 100,
            moveSpeed: 30, // Slower than combat bots
            bodyWidth: 60, 
            bodyHeight: 40,
            bodyOffsetX: 15,
            bodyOffsetY: 24,
            maxEnergy: 100,
            energyRegenRate: 15,
            attackRange: 60,
            attackDamage: 5 // Weaker than combat bots
        });
        
        this.player = player;
        
        // Apply pixel-perfect collision
        this.setupPixelPerfectCollision(5, false);

        // Trader state
        this.isHit = false;
        this.direction = 1; // 1 for right, -1 for left
        this.detectionRange = 150;
        this.interactionRange = 60;
        
        // Trading properties
        this.isTrading = false;
        this.availableItems = [
            { id: 'health_potion', price: 5, quantity: 10 },
            { id: 'sword', price: 15, quantity: 1 },
            { id: 'shield', price: 20, quantity: 1 }
        ];

        // Store trader reference on the sprite for interaction
        this.sprite.setData('isTrader', true);
        this.sprite.setData('traderRef', this);
        
        // Ensure animations are available for this instance
        this.createOrRetrieveAnimations();
        
        // Set up sprite animations
        this.sprite.anims.play('trader-idle', true);
        
        // Create health bar
        this.createHealthBar();
        
        // Create interaction indicator
        this.createInteractionIndicator();

        // Initialize state machine
        this.traderMachine = createTraderMachine();
        this.traderService = createActor(this.traderMachine, {
            input: {
                player: this.player,
                health: this.health,
                energy: this.energy,
                isTrading: false
            }
        });
            
        // Subscribe to state changes with one-shot entry actions
        this.traderService.subscribe((snapshot) => {
            const newState = snapshot.value as string;
            
            if (this.currentState !== newState) {
                console.log(`Trader state transition: ${this.currentState} -> ${newState}`);
                
                const previousState = this.currentState;
                this.currentState = newState;
                
                // Handle state entry actions
                switch(newState) {
                    case 'idle':
                        if (this.sprite && this.sprite.anims) {
                            this.sprite.anims.play('trader-idle', true);
                        }
                        if (this.sprite.body) {
                            (this.sprite.body as Physics.Arcade.Body).setVelocityX(0);
                        }
                        this.hideInteractionIndicator();
                        break;
                    case 'greeting':
                        if (this.sprite && this.sprite.anims) {
                            this.sprite.anims.play('trader-idle', true);
                        }
                        this.showInteractionIndicator();
                        break;
                    case 'trading':
                        if (this.sprite && this.sprite.anims) {
                            this.sprite.anims.play('trader-idle', true);
                        }
                        this.isTrading = true;
                        this.startTrading();
                        break;
                    case 'hurt':
                        if (this.sprite && this.sprite.anims) {
                            this.sprite.anims.play('trader-hurt', true);
                        }
                        if (this.sprite.body) {
                            (this.sprite.body as Physics.Arcade.Body).setVelocityX(0);
                        }
                        break;
                    case 'dead':
                        this.die();
                        break;
                }
                
                this.lastProcessedState = newState;
            }
        });
            
        // Start the state machine
        this.traderService.start();
    }

    /**
     * Ensures all trader animations are available for this specific instance
     */
    createOrRetrieveAnimations(): void {
        BotTrader.createAnimsInScene(this.scene);
    }

    update(time: number, delta: number): void {
        // Call the base class update method
        super.update(time, delta);
        
        // Return early if trader is dead or sprite is inactive
        if (this.dead || !this.sprite.body || !this.sprite.active) {
            return;
        }

        const seconds = delta / 1000;
        
        // Handle energy regeneration
        this.handleEnergy(seconds, true);

        // Ensure player and player.sprite exist and are active
        if (!this.player?.sprite?.active) {
            if (this.currentState !== 'idle') {
                this.traderService.send({ type: 'PLAYER_LOST' });
            }
            return;
        }

        // Type guard for body
        const body = this.sprite.body as Physics.Arcade.Body;

        // Calculate distance to player
        const distanceToPlayer = PhaserMath.Distance.Between(
            this.sprite.x, this.sprite.y,
            this.player.sprite.x, this.player.sprite.y
        );
        
        // Update distance in state machine context
        this.traderService.send({ 
            type: 'UPDATE_CONTEXT', 
            context: { 
                distanceToPlayer,
                energy: this.energy,
                health: this.health,
                isTrading: this.isTrading
            } 
        });
        
        // State machine driven behavior
        switch (this.currentState) {
            case 'idle':
                // Check if player is detected
                if (distanceToPlayer <= this.detectionRange) {
                    this.traderService.send({ type: 'PLAYER_DETECTED' });
                }
                break;
                
            case 'greeting':
                // Face the player
                this.direction = this.player.sprite.x < this.sprite.x ? -1 : 1;
                this.sprite.setFlipX(this.direction < 0);
                
                // Lost player detection
                if (distanceToPlayer > this.detectionRange) {
                    this.traderService.send({ type: 'PLAYER_LOST' });
                    break;
                }
                
                // Check for interaction (e.g., player pressing interaction key)
                if (distanceToPlayer <= this.interactionRange && this.checkForInteraction()) {
                    this.traderService.send({ type: 'TRADING_STARTED' });
                }
                break;
                
            case 'trading':
                // Face the player
                this.direction = this.player.sprite.x < this.sprite.x ? -1 : 1;
                this.sprite.setFlipX(this.direction < 0);
                
                // Lost player detection
                if (distanceToPlayer > this.interactionRange) {
                    this.endTrading();
                    this.traderService.send({ type: 'TRADING_COMPLETED' });
                }
                break;
                
            case 'hurt':
                // Hurt state is handled by animation, do nothing here
                break;
                
            case 'dead':
                // Dead state is final, do nothing
                break;
        }
        
        // Update health bar position to follow the trader
        this.updateHealthBarPosition();
        
        // Update interaction indicator position
        this.updateInteractionIndicatorPosition();
    }

    /**
     * Check if the player is trying to interact with the trader
     */
    checkForInteraction(): boolean {
        // Check for interaction key press (e.g., 'E')
        // For this example, we'll use the 'E' key
        
        // Get the keyboard reference
        const keyboard = this.scene.input.keyboard;
        if (!keyboard) return false;
        
        // Check if the E key was just pressed this frame
        const eKey = keyboard.addKey('E');
        
        return Phaser.Input.Keyboard.JustDown(eKey);
    }

    /**
     * Start the trading interaction
     */
    startTrading(): void {
        console.log("Starting trade with player");
        
        // Set trading flag
        this.isTrading = true;
        
        // The actual trading UI is now handled by the TradeScene
        // This method is still called by the state machine when trading starts
        // but doesn't need to create UI elements anymore
    }

    /**
     * End the trading interaction
     */
    endTrading(): void {
        console.log("Ending trade with player");
        
        // Set trading flag
        this.isTrading = false;
        
        // Remove dialog elements if they exist
        const dialogBg = this.sprite.getData('dialogBg');
        const dialog = this.sprite.getData('dialog');
        
        if (dialogBg) dialogBg.destroy();
        if (dialog) dialog.destroy();
    }

    /**
     * Creates the health bar graphics that will float above the trader
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
        
        // Position health bar above the trader's head
        this.updateHealthBarPosition();
    }
    
    /**
     * Updates the position of the health bar to follow the trader
     */
    updateHealthBarPosition(): void {
        if (!this.sprite || !this.sprite.active) return;
        
        const offsetY = -30;
        const x = this.sprite.x - this.healthBarWidth / 2;
        const y = this.sprite.y + offsetY;
        
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
        if (!this.healthBar || !this.healthBar.active) return;
        
        this.healthBar.clear();
        
        const percentage = Math.max(0, this.health / this.maxHealth);
        
        let color;
        if (percentage > 0.6) color = 0x00ff00; // Green
        else if (percentage > 0.3) color = 0xffff00; // Yellow
        else color = 0xff0000; // Red
        
        this.healthBar.fillStyle(color, 1);
        this.healthBar.fillRect(0, 0, this.healthBarWidth * percentage, this.healthBarHeight);
    }

    /**
     * Creates the interaction indicator ("Press E to trade")
     */
    createInteractionIndicator(): void {
        this.interactionIndicator = this.scene.add.text(
            0, 0, 
            "Press E to trade", 
            {
                fontSize: '14px',
                color: '#ffffff',
                backgroundColor: '#00000080',
                padding: { x: 5, y: 3 }
            }
        ).setOrigin(0.5, 0);
        
        this.interactionIndicator.setDepth(102);
        this.interactionIndicator.setVisible(false);
        
        this.updateInteractionIndicatorPosition();
    }
    
    /**
     * Updates the position of the interaction indicator
     */
    updateInteractionIndicatorPosition(): void {
        if (!this.sprite || !this.sprite.active || !this.interactionIndicator) return;
        
        const offsetY = -45;
        const x = this.sprite.x;
        const y = this.sprite.y + offsetY;
        
        this.interactionIndicator.setPosition(x, y);
    }
    
    /**
     * Shows the interaction indicator
     */
    showInteractionIndicator(): void {
        if (this.interactionIndicator) {
            this.interactionIndicator.setVisible(true);
        }
    }
    
    /**
     * Hides the interaction indicator
     */
    hideInteractionIndicator(): void {
        if (this.interactionIndicator) {
            this.interactionIndicator.setVisible(false);
        }
    }

    takeDamage(amount: number, attackerPosition?: {x: number, y: number}): void {
        // Don't take damage if already hit, dead, or if sprite is inactive/being destroyed
        if (this.isHit || this.dead || !this.sprite || !this.sprite.active || !this.sprite.anims) return;

        // Set hit state to prevent multiple rapid damage events
        this.isHit = true;

        // Call the parent takeDamage method
        super.takeDamage(amount, attackerPosition);

        // Update the state machine with damage event
        this.traderService.send({ type: 'DAMAGE_TAKEN', damage: amount });

        // End trading if currently trading
        if (this.isTrading) {
            this.endTrading();
        }

        // Visual feedback
        if (this.sprite.anims && this.scene.anims.exists('trader-hurt')) {
            this.sprite.anims.play('trader-hurt', true);
        }

        // Update health bar to reflect new health
        this.updateHealthBar();

        // Reset the hit state after delay
        this.scene.time.delayedCall(500, () => {
            if (!this.sprite || !this.sprite.active || this.dead) return;
            
            this.isHit = false;
            
            // Calculate distance to player for recovery state decision
            const distanceToPlayer = this.player && this.player.sprite && this.player.sprite.active ?
                PhaserMath.Distance.Between(
                    this.sprite.x, this.sprite.y,
                    this.player.sprite.x, this.player.sprite.y
                ) : Infinity;
                
            // Update context with current values before recovery
            this.traderService.send({ 
                type: 'UPDATE_CONTEXT', 
                context: { 
                    distanceToPlayer,
                    health: this.health,
                    energy: this.energy,
                    isTrading: false
                } 
            });
        });
    }

    die(): void {
        if (this.dead || this.isDeathAnimationPlaying) return;
        
        console.log("Trader death started");
        
        // Set dying state tracking
        this.isDeathAnimationPlaying = true;
        
        // Call parent die method
        super.die();

        // End trading if currently trading
        if (this.isTrading) {
            this.endTrading();
        }

        // Hide interaction indicator
        this.hideInteractionIndicator();

        // Disable physics to prevent further interactions
        if (this.sprite.body) {
            (this.sprite.body as Physics.Arcade.Body).setEnable(false);
            (this.sprite.body as Physics.Arcade.Body).setVelocity(0, 0);
        }

        // Ensure the sprite stays visible
        this.sprite.setVisible(true);
        
        // Delay the animation start slightly to ensure proper setup
        this.scene.time.delayedCall(50, () => {
            if (!this.sprite?.active) return;
            
            // Make sure any current animation is stopped
            this.sprite.anims.stop();
            
            // Clear all animation listeners
            this.sprite.removeAllListeners(Phaser.Animations.Events.ANIMATION_COMPLETE);
            
            // Set up animation completion event listener
            this.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (animation: any) => {
                console.log(`Animation complete: ${animation.key}`);
                if (animation.key === 'trader-die') {
                    // Ensure a delay after animation completes
                    this.scene.time.delayedCall(200, () => {
                        if (this.sprite?.active) {
                            this.destroyTrader();
                        }
                    });
                }
            });
            
            // Start the death animation
            this.sprite.anims.play('trader-die', true);
            console.log("Death animation started playing");
            
            // Fallback timer
            const animDuration = 2500;
            this.scene.time.delayedCall(animDuration, () => {
                if (this.isDeathAnimationPlaying && this.sprite?.active) {
                    console.log("Trader death safety timer triggered");
                    this.destroyTrader();
                }
            });
        });
    }
    
    /**
     * Helper method to ensure consistent destruction of trader resources
     */
    destroyTrader(): void {
        if (!this.sprite?.active) return;
        
        console.log("Destroying trader");
        this.isDeathAnimationPlaying = false;
        
        // Destroy the sprite
        this.sprite.destroy();
        
        // Destroy health bar graphics if they exist
        if (this.healthBarBackground?.active) {
            this.healthBarBackground.destroy();
        }
        
        if (this.healthBar?.active) {
            this.healthBar.destroy();
        }
        
        // Destroy interaction indicator if it exists
        if (this.interactionIndicator?.active) {
            this.interactionIndicator.destroy();
        }
    }

    setupPlayerCollision(player: Player): void {
        if (!player.sprite) {
            return;
        }
        
        // Use an overlap instead of a collider to prevent pushing
        this.scene.physics.add.overlap(player.sprite, this.sprite, () => {
            // Empty callback - interaction is handled in update method
        });
    }

    /**
     * Process a transaction between the trader and player
     * @param itemId The ID of the item to buy
     * @returns boolean True if transaction was successful
     */
    sellItemToPlayer(itemId: string): boolean {
        // Find the item in trader's available items
        const item = this.availableItems.find(item => item.id === itemId);
        
        if (!item) {
            console.log(`Trader doesn't have item: ${itemId}`);
            return false;
        }
        
        if (item.quantity <= 0) {
            console.log(`Trader is out of stock: ${itemId}`);
            return false;
        }
        
        // Check if player has enough coins
        if (this.player.getCoins() < item.price) {
            console.log(`Player doesn't have enough coins for: ${itemId}`);
            return false;
        }
        
        // Process the transaction
        const success = this.player.removeCoins(item.price);
        
        if (success) {
            // Add the item to player's inventory
            this.player.addItem(itemId, 1);
            
            // Reduce trader's stock
            item.quantity--;
            
            console.log(`Player bought: ${itemId} for ${item.price} coins`);
            return true;
        }
        
        return false;
    }
}