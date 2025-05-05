import { Scene } from 'phaser';
import Player from '../entities/Player.js';
import Explosion from '../entities/Explosion.js';
import Bot from '../entities/Bot.js';
import SpriteUtils from '../utils/SpriteUtils.js';

export default class GameScene extends Scene {
    player!: Player;
    platforms!: Phaser.Tilemaps.TilemapLayer;
    bots: Bot[] = []; // Store multiple bots in an array
    explosions!: Explosion;
    explosionDebugText!: Phaser.GameObjects.Text;
    backgrounds!: Phaser.GameObjects.TileSprite[];
    map!: Phaser.Tilemaps.Tilemap;
    debugGraphics!: Phaser.GameObjects.Graphics; // Debug graphics for hitboxes

    // Custom debug properties
    showDebug: boolean = false;
    customDebugGraphics: Phaser.GameObjects.Graphics | null = null;

    constructor() {
        super({ key: 'GameScene' });
    }

    create() {
        // Scale backgrounds to fit viewport
        const gameWidth = this.sys.game.config.width as number;
        const gameHeight = this.sys.game.config.height as number;

        // Parallax backgrounds - create with proper size and depth
        this.backgrounds = [
            this.add.tileSprite(0, 0, gameWidth, gameHeight, 'bg3')
                .setOrigin(0, 0)
                .setScrollFactor(0)
                .setDepth(-30),
            this.add.tileSprite(0, 0, gameWidth, gameHeight, 'bg2')
                .setOrigin(0, 0)
                .setScrollFactor(0)
                .setDepth(-20),
            this.add.tileSprite(0, 0, gameWidth, gameHeight, 'bg1')
                .setOrigin(0, 0)
                .setScrollFactor(0)
                .setDepth(-10)
        ];
                        
        // Create the tilemap
        this.createMap();

        // Calculate the position for player and bots
        const mapHeight = this.map.heightInPixels;
        const bottomY = gameHeight - mapHeight;

        // Create player at adjusted Y position to account for tilemap position
        this.player = new Player(this, 300, bottomY - 50);
        
        // Set up platform collision using Character's shared method
        this.player.setupPlatformCollision(this.platforms);
        
        // Create enemy bots at different positions
        this.createBots(bottomY);
        
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
        
        // Initialize debug graphics for hitboxes
        this.debugGraphics = this.add.graphics();
        this.customDebugGraphics = this.add.graphics();
        this.customDebugGraphics.setDepth(1000); // Ensure it renders on top
        
        // Listen for player death
        this.events.on('player-died', this.handlePlayerDeath, this);
        
        // Debug info
        this.debugCollisions();
        
        // Debug toggle key (D)
        this.input.keyboard?.on('keydown-D', () => {
            this.explosionDebugText.setVisible(!this.explosionDebugText.visible);
        });
        
        // Hitbox debug toggle key (H)
        this.input.keyboard?.on('keydown-P', () => {
            // Toggle custom debug rendering
            this.showDebug = !this.showDebug;
            
            // This prevents the error from occurring
            if (this.physics.world.drawDebug) {
                this.physics.world.drawDebug = false;
            }
            
            // Show a temporary message about debug mode
            const statusText = this.add.text(
                (this.sys.game.config.width as number) / 2,
                100,
                `Hitbox Debug: ${this.showDebug ? 'ON' : 'OFF'}`,
                { fontSize: '24px', color: '#ffff00', backgroundColor: '#0008' }
            ).setOrigin(0.5).setScrollFactor(0).setDepth(100);
            
            // Remove the text after 2 seconds
            this.time.delayedCall(2000, () => {
                statusText.destroy();
            });
        });
        
        // Set up camera to follow player
        this.setupCamera();
    }
    
    createBots(bottomY: number) {
        // Create multiple bots at different positions
        const botPositions = [
            { x: 500, y: bottomY - 50 },
            { x: 800, y: bottomY - 100 },
            { x: 1200, y: bottomY - 50 }
        ];
        
        botPositions.forEach(pos => {
            const bot = new Bot(this, pos.x, pos.y, this.player);
            
            // Store the bot in our array
            this.bots.push(bot);
            
            // Set up platform collision using Character's shared method
            bot.setupPlatformCollision(this.platforms);
            
            // Set up combat interaction between player and bot
            bot.setupPlayerCollision(this.player);
        });
    }
    
    update(time: number, delta: number) {
        // Update player
        this.player.update(time, delta);
        
        // Update all bots
        this.bots.forEach(bot => {
            if (bot.sprite.active) {
                bot.update(time, delta); // Pass time and delta here
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
                `Player energy: ${Math.floor(this.player.energy)}/${this.player.maxEnergy}\n` + // Changed stamina to energy
                `Active bots: ${activeBots}/${this.bots.length}\n` +
                `Press D to toggle debug info`
            );
        }
        
        // Handle custom debug rendering
        if (this.showDebug && this.customDebugGraphics) {
            this.renderCustomDebug();
        }
    }
    
    /**
     * Custom debug rendering method that doesn't rely on Phaser's built-in debug
     * to avoid the "Cannot read properties of undefined (reading 'clear')" error
     */
    renderCustomDebug(): void {
        // Clear previous debug graphics
        this.customDebugGraphics?.clear();
        
        // Get all physics bodies in the scene
        const bodies = this.physics.world.bodies.getArray();
        
        // Draw debugging for all bodies
        bodies.forEach(body => {
            if (!body.gameObject || !body.gameObject.active) return;
            
            const bodyX = body.x;
            const bodyY = body.y;
            const bodyWidth = body.width;
            const bodyHeight = body.height;
            
            // Draw body outline
            this.customDebugGraphics?.lineStyle(1, 0x00ff00, 0.8);
            this.customDebugGraphics?.strokeRect(
                bodyX - bodyWidth/2,
                bodyY - bodyHeight/2,
                bodyWidth,
                bodyHeight
            );
            
            // Draw velocity vector if moving
            if (body.velocity.lengthSq() > 0) {
                const velX = bodyX;
                const velY = bodyY;
                const velEndX = bodyX + body.velocity.x / 10;
                const velEndY = bodyY + body.velocity.y / 10;
                
                this.customDebugGraphics?.lineStyle(2, 0xff0000);
                this.customDebugGraphics?.lineBetween(velX, velY, velEndX, velEndY);
            }
        });
        
        // Draw platform collisions
        if (this.platforms) {
            const bounds = this.platforms.getBounds();
            this.customDebugGraphics?.lineStyle(1, 0x0000ff, 0.5);
            this.customDebugGraphics?.strokeRect(
                bounds.x, bounds.y, bounds.width, bounds.height
            );
        }
    }
    
    createMap() {
        // Create the tilemap
        const map = this.make.tilemap({ key: 'map' });
        this.map = map; // Store reference to the map
        
        const tileset = map.addTilesetImage('ground', 'ground');
        if (!tileset) throw new Error('Tileset not found');

        // Calculate the Y position to place the layer at the bottom
        const gameHeight = this.sys.game.config.height as number;
        const mapHeight = map.heightInPixels;
        const bottomY = gameHeight - mapHeight;

        // Create the layer at the bottom position
        const platformLayer = map.createLayer('ground', tileset, 0, bottomY);
        if (!platformLayer) throw new Error('Layer not found');
        this.platforms = platformLayer;
        this.platforms.setCollisionByExclusion([-1]);
                
        // Debug tilemap
        console.log("Number of tiles in the layer:", this.platforms.layer.data.length);
        const collidingTiles = this.platforms.filterTiles((tile: Phaser.Tilemaps.Tile) => tile.collides);
        console.log("Number of colliding tiles:", collidingTiles.length);
        
        // Set world bounds to match the size and position of our tilemap
        this.physics.world.setBounds(0, bottomY, map.widthInPixels, map.heightInPixels);
    }
    
    setupCamera() {
        // Configure camera to follow the player
        const camera = this.cameras.main;
        
        // Set camera bounds to match the full width of the tilemap but allow vertical visibility of the entire game
        camera.setBounds(0, 0, this.map.widthInPixels, this.sys.game.config.height as number);
        
        // Set camera to follow the player sprite
        camera.startFollow(this.player.sprite);
        
        // Optional: Add camera settings for smooth following
        camera.setDeadzone(200, 200); // Add a "deadzone" where small movements won't scroll
        camera.setZoom(2); // Increase zoom from 1 to 2 for a closer view
        
        // Optional: smooth camera movement
        camera.setLerp(0.1, 0.1); // Lower values = smoother camera movement
    }
    
    updateParallaxBackgrounds() {
        const cam = this.cameras.main;
        
        if (this.backgrounds) {
            // Update tilePosition for parallax scrolling effect
            // Different rates create the parallax depth effect
            this.backgrounds[0].tilePositionX = cam.scrollX * 0.2;
            this.backgrounds[1].tilePositionX = cam.scrollX * 0.5;
            this.backgrounds[2].tilePositionX = cam.scrollX * 0.8;
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