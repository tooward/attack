import { Scene } from 'phaser';

export default class UIScene extends Scene {
    constructor() {
        super({ key: 'UIScene' });
    }

    create() {
        // Get game dimensions
        const { width, height } = this.sys.game.config;
        
        // Create health bar
        this.createHealthBar(width);
        
        // Create stamina bar
        this.createStaminaBar(width);
        
        // Listen for health changes from the game scene
        this.listenForHealthChanges();
    }
    
    createHealthBar(width) {
        // Health bar text
        this.add.text(20, 20, 'HEALTH', {
            fontSize: '24px',
            fill: '#fff'
        });
        
        // Health bar background
        this.healthBarBackground = this.add.graphics()
            .fillStyle(0x222222, 0.8)
            .fillRect(150, 20, 300, 24);
        
        // Health bar foreground
        this.healthBar = this.add.graphics();
        
        // Initial render with full health
        this.updateHealthBar(100, 100);
    }
    
    createStaminaBar(width) {
        // Stamina bar text
        this.add.text(20, 60, 'STAMINA', {
            fontSize: '24px',
            fill: '#fff'
        });
        
        // Stamina bar background
        this.staminaBarBackground = this.add.graphics()
            .fillStyle(0x222222, 0.8)
            .fillRect(150, 60, 300, 24);
        
        // Stamina bar foreground
        this.staminaBar = this.add.graphics();
        
        // Initial render with full stamina
        this.updateStaminaBar(100, 100);
    }
    
    listenForHealthChanges() {
        // Get reference to the GameScene
        const gameScene = this.scene.get('GameScene');
        
        // Listen for health change events
        gameScene.events.on('player-health-changed', this.updateHealthBar, this);
        
        // Update stamina every frame
        this.events.on('update', this.updatePlayerUI, this);
    }
    
    updatePlayerUI() {
        // Get reference to the player from the GameScene
        const gameScene = this.scene.get('GameScene');
        
        if (gameScene.player) {
            this.updateStaminaBar(gameScene.player.stamina, gameScene.player.maxStamina);
        }
    }
    
    updateHealthBar(current, max) {
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
    
    updateStaminaBar(current, max) {
        // Clear previous graphics
        this.staminaBar.clear();
        
        // Calculate stamina percentage
        const percentage = Math.max(0, current / max);
        
        // Draw stamina bar
        this.staminaBar.fillStyle(0x0088ff, 1);
        this.staminaBar.fillRect(150, 60, 300 * percentage, 24);
    }
}