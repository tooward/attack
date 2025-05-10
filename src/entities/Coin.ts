import { Scene, Physics, GameObjects } from 'phaser';
import Player from './Player';

export default class Coin extends GameObjects.Sprite {
    // Store reference to scene and physics body
    scene: Scene;
    body: Physics.Arcade.Body;
    value: number;
    
    /**
     * Create a new coin at the specified position
     * @param scene The scene to add the coin to
     * @param x X position
     * @param y Y position
     * @param value Coin value (defaults to 1)
     */
    constructor(scene: Scene, x: number, y: number, value: number = 1) {
        // Use our programmatically generated texture with the new key
        super(scene, x, y, 'coin-pickup');
        
        console.log(`Coin: Created at position ${x},${y} with texture key 'coin-pickup'`);
        
        this.scene = scene;
        this.value = value;
        
        // Add to scene
        scene.add.existing(this);
        
        // Enable physics
        scene.physics.add.existing(this);
        
        // Get body with proper type assertion
        this.body = this.body as Physics.Arcade.Body;
        
        // Configure physics body
        this.body.setCollideWorldBounds(true);
        this.body.setBounce(0.4);
        this.body.setDrag(100, 0);
        
        // Apply a small random velocity when spawned to make coin drop feel more natural
        const randomVelocityX = Phaser.Math.Between(-50, 50);
        this.body.setVelocity(randomVelocityX, -100);
        
        // Set a custom flag to identify as coin
        this.setData('isCoin', true);
        this.setData('value', value);
        
        // Add bounce animation to make coin more noticeable
        this.scene.tweens.add({
            targets: this,
            y: y - 10,
            duration: 1000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
        
        // Set a timer to despawn the coin if not collected after a while (30 seconds)
        this.scene.time.delayedCall(30000, () => {
            if (this.active) {
                console.log(`Coin: Auto-destroying after 30 seconds at ${this.x},${this.y}`);
                this.destroy();
            }
        });
    }
    
    /**
     * Static method to preload coin assets
     * @param scene The scene to load assets into
     */
    static preload(scene: Scene): void {
        // Create a simple coin texture programmatically using a different key
        const coinGraphics = scene.make.graphics({ x: 0, y: 0, add: false });
        
        // Draw a gold coin with gradient fill
        coinGraphics.fillStyle(0xffcc00);
        coinGraphics.fillCircle(16, 16, 14);
        coinGraphics.fillStyle(0xffaa00);
        coinGraphics.fillCircle(16, 16, 10);
        coinGraphics.fillStyle(0xffd700);
        coinGraphics.fillCircle(16, 16, 8);
        
        // Add a shiny highlight
        coinGraphics.fillStyle(0xffffff, 0.6);
        coinGraphics.fillCircle(11, 11, 3);
        
        // Add outline
        coinGraphics.lineStyle(2, 0xd4af37);
        coinGraphics.strokeCircle(16, 16, 14);
        
        // Generate texture from the graphics object with a DIFFERENT key
        coinGraphics.generateTexture('coin-pickup', 32, 32);
        
        // Optional - add a coin sound
        scene.load.audio('coin-pickup', 'assets/sounds/coin-pickup.wav');
    }
    
    /**
     * Set up coin collection by player
     * @param player The player that can collect this coin
     */
    setupPlayerCollection(player: Player): void {
        if (!player.sprite) return;
        
        // Add overlap for collection
        this.scene.physics.add.overlap(this, player.sprite, () => {
            this.collectCoin(player);
        });
    }
    
    /**
     * Handle coin collection by player
     * @param player The player collecting the coin
     */
    collectCoin(player: Player): void {
        if (!this.active || this.getData('collected')) return;
        
        // Mark as collected to prevent multiple collection events
        this.setData('collected', true);
        
        // Disable the physics body to prevent further collisions
        this.body.enable = false;
        
        console.log(`Coin: Collection by player at ${this.x},${this.y}, value=${this.value}`);
        
        // Add coin value to player
        player.addCoins(this.value);
        
        // Visual feedback for collection
        this.scene.tweens.add({
            targets: this,
            alpha: 0,
            y: this.y - 20,
            duration: 300,
            onComplete: () => {
                console.log(`Coin: Destroy after collection animation complete`);
                this.destroy();
            }
        });
        
        // Play sound effect if available
        if (this.scene.sound.get('coin-pickup')) {
            this.scene.sound.play('coin-pickup', { volume: 0.5 });
        }
    }
}