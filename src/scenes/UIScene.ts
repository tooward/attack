import { Scene, GameObjects, Scenes } from 'phaser'; // Added GameObjects
import GameScene from './GameScene'; // Import GameScene to get player reference
import Player from '../entities/Player'; // Import Player type

export default class UIScene extends Scene {
    healthBarBackground!: GameObjects.Graphics; // Use definite assignment
    healthBar!: GameObjects.Graphics; // Use definite assignment
    staminaBarBackground!: GameObjects.Graphics; // Use definite assignment
    staminaBar!: GameObjects.Graphics; // Use definite assignment
    gameSceneRef!: GameScene; // Use definite assignment

    constructor() {
        super({ key: 'UIScene' });
    }

    create(): void { // Add return type
        // Get game dimensions
        const width = this.sys.game.config.width as number;
        const height = this.sys.game.config.height as number;

        // Create health bar
        this.createHealthBar(width);

        // Create stamina bar
        this.createStaminaBar(width);

        // Get reference to the GameScene
        this.gameSceneRef = this.scene.get('GameScene') as GameScene;

        // Listen for health changes from the game scene
        this.listenForHealthChanges();
    }

    createHealthBar(width: number): void { // Type width, add return type
        // Health bar text
        this.add.text(20, 20, 'HEALTH', {
            fontSize: '24px',
            color: '#fff'
        });

        // Health bar background
        this.healthBarBackground = this.add.graphics()
            .fillStyle(0x222222, 0.8)
            .fillRect(150, 20, 300, 24);

        // Health bar foreground
        this.healthBar = this.add.graphics();
    }

    createStaminaBar(width: number): void { // Type width, add return type
        // Stamina bar text
        this.add.text(20, 60, 'STAMINA', {
            fontSize: '24px',
            color: '#fff'
        });

        // Stamina bar background
        this.staminaBarBackground = this.add.graphics()
            .fillStyle(0x222222, 0.8)
            .fillRect(150, 60, 300, 24);

        // Stamina bar foreground
        this.staminaBar = this.add.graphics();
    }

    listenForHealthChanges(): void { // Add return type
        // Check if gameSceneRef is valid
        if (this.gameSceneRef) {
            // Listen for health change events
            this.gameSceneRef.events.on('player-health-changed', this.updateHealthBar, this);

            // Update stamina every frame using the scene's update event
            this.events.on(Scenes.Events.UPDATE, this.updatePlayerUI, this);
            
            // Initial UI update once player is ready
            if (this.gameSceneRef.player) {
                this.updateHealthBar(this.gameSceneRef.player.health, this.gameSceneRef.player.maxHealth);
                this.updateStaminaBar(this.gameSceneRef.player.stamina, this.gameSceneRef.player.maxStamina);
            }
        } else {
            console.warn("UIScene: Could not get GameScene reference to listen for events.");
            // Optionally retry getting the reference later or handle the error
        }
    }

    updatePlayerUI(): void { // Add return type
        // Get reference to the player from the GameScene reference
        const player: Player | undefined = this.gameSceneRef?.player; // Use optional chaining

        // No need for staminaBar check due to definite assignment
        if (player) { 
            this.updateStaminaBar(player.stamina, player.maxStamina);
        }
    }

    updateHealthBar(current: number, max: number): void { // Type parameters, add return type
        // Clear previous graphics
        this.healthBar.clear();

        // Calculate health percentage
        const percentage = Math.max(0, current / max);

        // Choose color based on health
        let color;
        if (percentage > 0.6) color = 0x00ff00; // Green
        else if (percentage > 0.3) color = 0xffff00; // Yellow
        else color = 0xff0000; // Red

        // Draw health bar
        this.healthBar.fillStyle(color, 1);
        this.healthBar.fillRect(150, 20, 300 * percentage, 24);
    }

    updateStaminaBar(current: number, max: number): void { // Type parameters, add return type
        // Clear previous graphics
        this.staminaBar.clear();

        // Calculate stamina percentage
        const percentage = Math.max(0, current / max);

        // Draw stamina bar
        this.staminaBar.fillStyle(0x0088ff, 1);
        this.staminaBar.fillRect(150, 60, 300 * percentage, 24);
    }
}