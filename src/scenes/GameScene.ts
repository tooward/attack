import { Scene } from 'phaser';
import Player from '../entities/Player.js';
import Explosion from '../entities/Explosion.js';
import Bot from '../entities/Bot.js';

export default class GameScene extends Scene {
    player!: Player;
    platforms!: Phaser.Tilemaps.TilemapLayer;
    bots: Bot[] = []; // Store multiple bots in an array
    explosions!: Explosion;
    explosionDebugText!: Phaser.GameObjects.Text;
    backgrounds!: Phaser.GameObjects.Image[];
    map!: Phaser.Tilemaps.Tilemap;

    constructor() {
        super({ key: 'GameScene' });
    }

    create() {
        // Create the tilemap
        this.createMap();
        
        // Parallax backgrounds
        this.backgrounds = [
            this.add.image(0, 0, 'bg3').setOrigin(0, 0).setScrollFactor(0),
            this.add.image(0, 0, 'bg2').setOrigin(0, 0).setScrollFactor(0),
            this.add.image(0, 0, 'bg1').setOrigin(0, 0).setScrollFactor(0)
        ];

        // Create player
        this.player = new Player(this, 300, 350);
        
        // Add collision between player and platforms
        this.physics.add.collider(this.player.sprite, this.platforms);
        
        // Create enemy bots at different positions
        this.createBots();
        
        // Create explosions
        this.explosions = new Explosion(this);
        
        // Debug text for explosion info
        this.explosionDebugText = this.add.text(16, 16, 'Explosion Debug:', { 
            fontSize: '18px', 
            color: '#fff',
            backgroundColor: '#000a',
            padding: { x: 5, y: 5 }
        }).setVisible(false) // Hidden by default
        .setScrollFactor(0); // Keep UI element fixed on screen
        
        // Listen for player death
        this.events.on('player-died', this.handlePlayerDeath, this);
        
        // Debug info
        this.debugCollisions();
        
        // Debug toggle key (D)
        this.input.keyboard?.on('keydown-D', () => {
            this.explosionDebugText.setVisible(!this.explosionDebugText.visible);
        });
        
        // Set up camera to follow player
        this.setupCamera();
    }
    
    createBots() {
        // Create multiple bots at different positions
        const botPositions = [
            { x: 500, y: 350 },
            { x: 800, y: 300 },
            { x: 1200, y: 350 }
        ];
        
        botPositions.forEach(pos => {
            const bot = new Bot(this, pos.x, pos.y, this.player);
            
            // Store the bot in our array
            this.bots.push(bot);
            
            // Add bot collision with platforms
            this.physics.add.collider(bot.sprite, this.platforms);
            
            // Set up combat interaction between player and bot
            bot.setupPlayerCollision(this.player);
            
            // Store bot reference on the sprite for targeting during attacks
            bot.sprite.setData('isBot', true);
            bot.sprite.setData('botRef', bot);
        });
    }
    
    update(time: number, delta: number) {
        // Update player
        this.player.update(time, delta);
        
        // Update all bots
        this.bots.forEach(bot => {
            if (bot.sprite.active) {
                bot.update();
            }
        });

        // Parallax background scroll
        this.updateParallaxBackgrounds();
        
        // Update explosion debug text if visible
        if (this.explosionDebugText.visible) {
            const activeCount = this.explosions.group.getChildren().filter(exp => exp.active).length;
            const explodedCount = this.explosions.group.getChildren().filter(
                exp => (exp as Phaser.GameObjects.Sprite).getData('hasExploded')
            ).length;
            const activeBots = this.bots.filter(bot => bot.sprite.active).length;
            
            this.explosionDebugText.setText(
                `Explosions: ${activeCount} active, ${explodedCount} exploded\n` + 
                `Player health: ${this.player.health}/${this.player.maxHealth}\n` +
                `Player stamina: ${Math.floor(this.player.stamina)}/${this.player.maxStamina}\n` +
                `Active bots: ${activeBots}/${this.bots.length}\n` +
                `Press D to toggle debug info`
            );
        }
    }
    
    createMap() {
        // Create the tilemap
        const map = this.make.tilemap({ key: 'map' });
        this.map = map; // Store reference to the map
        
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
        
        // Set world bounds to match the size of our tilemap
        this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    }
    
    setupCamera() {
        // Configure camera to follow the player
        const camera = this.cameras.main;
        
        // Set camera bounds to the size of the tilemap
        camera.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
        
        // Set camera to follow the player sprite
        camera.startFollow(this.player.sprite);
        
        // Optional: Add camera settings for smooth following
        camera.setDeadzone(200, 200); // Add a "deadzone" where small movements won't scroll
        camera.setZoom(1); // You can adjust zoom if needed
        
        // Optional: smooth camera movement
        camera.setLerp(0.1, 0.1); // Lower values = smoother camera movement
    }
    
    updateParallaxBackgrounds() {
        const cam = this.cameras.main;
        if (this.backgrounds) {
            // Position backgrounds relative to camera for parallax effect
            // Different scroll factors create the parallax depth effect
            this.backgrounds[0].x = cam.scrollX * 0.2;
            this.backgrounds[1].x = cam.scrollX * 0.5;
            this.backgrounds[2].x = cam.scrollX * 0.8;
        }
    }
    
    handlePlayerDeath() {
        console.log("Player died!");
        
        // Stop explosions
        this.explosions.stopSpawning();
        
        // Show game over text (fixed to camera)
        this.add.text(
            (this.sys.game.config.width as number) / 2, 
            (this.sys.game.config.height as number) / 2, 
            'GAME OVER', 
            { fontSize: '64px', color: '#ff0000', fontStyle: 'bold' }
        ).setOrigin(0.5)
        .setScrollFactor(0); // Keep text fixed to the camera
        
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