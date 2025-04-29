import { Scene } from 'phaser';
import Player from '../entities/Player.js';
import Explosion from '../entities/Explosion.js';
import Bot from '../entities/Bot.js';

export default class GameScene extends Scene {
    player!: Player;
    platforms!: Phaser.Tilemaps.TilemapLayer;
    bot!: Bot;
    explosions!: Explosion;
    explosionDebugText!: Phaser.GameObjects.Text;

    constructor() {
        super({ key: 'GameScene' });
    }

    create() {
        // Create the tilemap
        this.createMap();
        
        // Create player
        this.player = new Player(this, 300, 350);
        
        // Add collision between player and platforms
        this.physics.add.collider(this.player.sprite, this.platforms);
        
        // Create enemy bot using the modular Bot class, passing the player reference
        this.bot = new Bot(this, 500, 350, this.player); // Pass this.player here

        // Add bot collision with platforms
        this.physics.add.collider(this.bot.sprite, this.platforms);
        
        // Set up collision between player and bot
        this.bot.setupPlayerCollision(this.player);
        
        // Create explosions
        this.explosions = new Explosion(this);
        
        // Debug text for explosion info
        this.explosionDebugText = this.add.text(16, 16, 'Explosion Debug:', { 
            fontSize: '18px', 
            color: '#fff',
            backgroundColor: '#000a',
            padding: { x: 5, y: 5 }
        }).setVisible(false); // Hidden by default
        
        // Listen for player death
        this.events.on('player-died', this.handlePlayerDeath, this);
        
        // Debug info
        this.debugCollisions();
        
        // Debug toggle key (D)
        this.input.keyboard?.on('keydown-D', () => {
            this.explosionDebugText.setVisible(!this.explosionDebugText.visible);
        });
    }
    
    update(time: number, delta: number) {
        // Update player
        this.player.update(time, delta);
        
        // Update bot movement
        this.bot.update();
        
        // Update explosion debug text if visible
        if (this.explosionDebugText.visible) {
            const activeCount = this.explosions.group.getChildren().filter(exp => exp.active).length;
            const explodedCount = this.explosions.group.getChildren().filter(
                exp => (exp as Phaser.GameObjects.Sprite).getData('hasExploded')
            ).length;
            
            this.explosionDebugText.setText(
                `Explosions: ${activeCount} active, ${explodedCount} exploded\n` + 
                `Player health: ${this.player.health}/${this.player.maxHealth}\n` +
                `Press D to toggle debug info`
            );
        }
    }
    
    createMap() {
        // Create the tilemap
        const map = this.make.tilemap({ key: 'map' });
        const tileset = map.addTilesetImage('ground', 'ground');
        if (!tileset) throw new Error('Tileset not found');
        const platformLayer = map.createLayer('ground', tileset, 0, 0);
        if (!platformLayer) throw new Error('Layer not found');
        this.platforms = platformLayer;
        this.platforms.setCollisionByExclusion([-1]); // Collide with all tiles
        
        // Debug tilemap
        console.log("Number of tiles in the layer:", this.platforms.layer.data.length);
        const collidingTiles = this.platforms.filterTiles((tile: Phaser.Tilemaps.Tile) => tile.collides);
        console.log("Number of colliding tiles:", collidingTiles.length);
    }
    
    handlePlayerDeath() {
        console.log("Player died!");
        
        // Stop explosions
        this.explosions.stopSpawning();
        
        // Show game over text
        this.add.text(
            (this.sys.game.config.width as number) / 2, 
            (this.sys.game.config.height as number) / 2, 
            'GAME OVER', 
            { fontSize: '64px', color: '#ff0000', fontStyle: 'bold' }
        ).setOrigin(0.5);
        
        // Wait and then show game over
        this.time.delayedCall(2000, () => {
            // Reset the game after a short delay
            this.scene.start('MenuScene');
        });
    }
    
    debugCollisions() {
        // Debug physics
        if (this.physics.world.drawDebug) {
            this.platforms.renderDebug(this.add.graphics());
        }
    }
}