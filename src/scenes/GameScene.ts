import { Scene } from 'phaser';
import Player from '../entities/Player.js';
import Explosion from '../entities/Explosion.js';
import Bot from '../entities/Bot.js';
import BotTrader from '../entities/BotTrader.js';
import SpriteUtils from '../utils/SpriteUtils.js';
import InventoryManager from '../data/InventoryManager.js';
import TradeScene from './TradeScene.js';
import Coin from '../entities/Coin.js';

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

    // Tree properties
    treeGroup!: Phaser.GameObjects.Group;
    treeLocations: Phaser.Math.Vector2[] = [];
    treeLoadMargin: number = 500; // Load trees 500px beyond camera view
    
    // Flag properties
    flagGroup!: Phaser.GameObjects.Group;
    flagLocations: Phaser.Math.Vector2[] = [];
    flagLoadMargin: number = 500; // Load flags 500px beyond camera view
    
    // Trade stand properties
    tradeGroup!: Phaser.GameObjects.Group;
    tradeLocations: Phaser.Math.Vector2[] = [];
    tradeLoadMargin: number = 500; // Load trade stands 500px beyond camera view

    // Add activeTrader property at the top of the class
    activeTrader: BotTrader | null = null;

    // Debug graphics for trade zones
    tradeDebugGraphics!: Phaser.GameObjects.Graphics;
    tradeDebugTexts: Phaser.GameObjects.Text[] = [];

    constructor() {
        super({ key: 'GameScene' });
    }

    create() {
        // Scale backgrounds to fit viewport
        const gameWidth = this.sys.game.config.width as number;
        const gameHeight = this.sys.game.config.height as number;

        // Create backgrounds as TileSprites to enable horizontal tiling
        const bg3 = this.add.tileSprite(0, 0, gameWidth, gameHeight, 'bg3')
            .setOrigin(0, 0)
            .setScrollFactor(0)
            .setDepth(-30);

        const bg2 = this.add.tileSprite(0, 0, gameWidth, gameHeight, 'bg2')
            .setOrigin(0, 0)
            .setScrollFactor(0)
            .setDepth(-20);

        const bg1 = this.add.tileSprite(0, 0, gameWidth, gameHeight, 'bg1')
            .setOrigin(0, 0)
            .setScrollFactor(0)
            .setDepth(-10);

        // Store references to background TileSprites for parallax scrolling
        this.backgrounds = [bg3, bg2, bg1];
        
        // Create the tilemap
        this.createMap();

        // Initialize tree group for object pooling
        this.treeGroup = this.add.group({
            classType: Phaser.GameObjects.Image,
            runChildUpdate: false // Trees don't need individual updates
        });

        // Initial tree visibility check
        this.updateTreeVisibility();
        
        // Create flag animation
        this.anims.create({
            key: 'flag-wave',
            frames: this.anims.generateFrameNumbers('flag', { start: 0, end: 5 }),
            frameRate: 8,
            repeat: -1
        });
        
        // Initialize flag group for object pooling
        this.flagGroup = this.add.group({
            classType: Phaser.GameObjects.Sprite,
            runChildUpdate: false
        });
        
        // Initial flag visibility check
        this.updateFlagVisibility();

        // Initialize trade group for object pooling
        this.tradeGroup = this.add.group({
            classType: Phaser.GameObjects.Image,
            runChildUpdate: false,
            maxSize: 5 // Limit to 5 instances as requested
        });
        
        // Initial trade stand visibility check
        this.updateTradeVisibility();

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
        
        // Inventory toggle key (I)
        this.input.keyboard?.on('keydown-I', () => {
            // Only open inventory if player is alive
            if (this.player && !this.player.dead) {
                // Show a temporary message
                const statusText = this.add.text(
                    (this.sys.game.config.width as number) / 2,
                    100,
                    'Opening Inventory',
                    { fontSize: '24px', color: '#ffff00', backgroundColor: '#0008' }
                ).setOrigin(0.5).setScrollFactor(0).setDepth(100);
                
                // Remove the text after 1 second
                this.time.delayedCall(1000, () => {
                    statusText.destroy();
                });
                
                // Launch inventory scene
                this.scene.launch('InventoryScene', { player: this.player });
            }
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
    
    createTrader(bottomY: number) {
        // Create a trader at a specific position
        const traderPosition = { x: 350, y: bottomY - 50 };
        
        // Create the trader
        const trader = new BotTrader(this, traderPosition.x, traderPosition.y, this.player);
        
        // Set up platform collision using Character's shared method
        trader.setupPlatformCollision(this.platforms);
        
        // Set up interaction with player
        trader.setupPlayerCollision(this.player);
        
        return trader;
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

        // Check if player is on a trade tile
        this.checkTradeInteraction();

        // Draw trade debug visualization
//        this.drawTradeDebugVisualization();

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

        // Update tree visibility based on camera scroll
        this.updateTreeVisibility();
        
        // Update flag visibility based on camera scroll
        this.updateFlagVisibility();
        
        // Update trade stand visibility based on camera scroll
        this.updateTradeVisibility();
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
        
        // Add the ground-markers tileset
        const markersTileset = map.addTilesetImage('ground-markers', 'ground-markers');
        if (!markersTileset) console.warn('Ground markers tileset not found');

        // Calculate the Y position to place the layer at the bottom
        const gameHeight = this.sys.game.config.height as number;
        const mapHeight = map.heightInPixels;
        const bottomY = gameHeight - mapHeight;

        // Create the layer at the bottom position
        // Only include markersTileset in the array if it's not null
        const platformLayer = map.createLayer('ground', 
            markersTileset ? [tileset, markersTileset] : [tileset], 
            0, bottomY);
            
        if (!platformLayer) throw new Error('Layer not found');
        this.platforms = platformLayer;
        this.platforms.setCollisionByExclusion([-1]);
        
        // Store locations for trees based on custom tile property
        this.treeLocations = [];
        this.flagLocations = []; // Initialize flag locations array
        this.tradeLocations = []; // Initialize trade locations array
        
        this.platforms.forEachTile(tile => {
            if (tile.properties.health) { // Check for your custom property
                const worldX = this.platforms.x + tile.pixelX + tile.width / 2;
                const worldY = this.platforms.y + tile.pixelY + tile.height;
                this.treeLocations.push(new Phaser.Math.Vector2(worldX, worldY));
            }
            
            if (tile.properties.flag) { // Check for flag property
                const worldX = this.platforms.x + tile.pixelX + tile.width / 2;
                const worldY = this.platforms.y + tile.pixelY + tile.height;
                this.flagLocations.push(new Phaser.Math.Vector2(worldX, worldY));
            }
            
            if (tile.properties.Trade) { // Check for Trade property (capitalized)
                const worldX = this.platforms.x + tile.pixelX + tile.width / 2;
                const worldY = this.platforms.y + tile.pixelY + tile.height;
                this.tradeLocations.push(new Phaser.Math.Vector2(worldX, worldY));
                // Add debug log to verify trade tiles are being found
                console.log(`Found trade tile at position: ${worldX}, ${worldY}`);
            }
        });
        
        // Add debug log to show total trade locations found
        console.log(`Total trade locations found: ${this.tradeLocations.length}`);
                
        // Debug tilemap
        console.log("Number of tiles in the layer:", this.platforms.layer.data.length);
        const collidingTiles = this.platforms.filterTiles((tile: Phaser.Tilemaps.Tile) => tile.collides);
        console.log("Number of colliding tiles:", collidingTiles.length);
        
        // Set world bounds to match the size and position of our tilemap
        this.physics.world.setBounds(0, bottomY, map.widthInPixels, map.heightInPixels);
    }
    
    updateTreeVisibility() {
        if (!this.treeGroup || !this.map || !this.cameras.main) return;

        const camera = this.cameras.main;
        const cameraView = camera.worldView;

        // Define an extended view rectangle for loading/unloading trees
        const extendedView = new Phaser.Geom.Rectangle(
            cameraView.x - this.treeLoadMargin,
            cameraView.y - this.treeLoadMargin,
            cameraView.width + (2 * this.treeLoadMargin),
            cameraView.height + (2 * this.treeLoadMargin)
        );

        // Deactivate trees outside the extended view
        this.treeGroup.getChildren().forEach(child => {
            const tree = child as Phaser.GameObjects.Image;
            // Use getBottomCenter() for checking if the tree's base is in view
            const treeBottomCenter = tree.getBottomCenter();
            if (tree.active && !extendedView.contains(treeBottomCenter.x, treeBottomCenter.y)) {
                this.treeGroup.killAndHide(tree);
            }
        });
        
        // Activate or create trees within the extended view
        this.treeLocations.forEach(location => {
            // Check if the location (bottom-center of where tree should be) is within extended view
            if (Phaser.Geom.Rectangle.Contains(extendedView, location.x, location.y)) {
                let treeExistsAndActiveAtLocation = false;
                this.treeGroup.getChildren().forEach(child => {
                    const existingTree = child as Phaser.GameObjects.Image;
                    if (existingTree.active && existingTree.x === location.x && existingTree.y === location.y) {
                        treeExistsAndActiveAtLocation = true;
                    }
                });

                if (!treeExistsAndActiveAtLocation) {
                    const tree = this.treeGroup.get(location.x, location.y, 'tree') as Phaser.GameObjects.Image;
                    if (tree) {
                        tree.setActive(true)
                            .setVisible(true)
                            .setOrigin(0.5, 1) // Set origin to bottom-center
                            .setDepth(this.platforms.depth > 0 ? this.platforms.depth -1 : -1); // Place behind platforms or at a default depth like -1
                    }
                }
            }
        });
    }
    
    updateFlagVisibility() {
        if (!this.flagGroup || !this.map || !this.cameras.main) return;

        const camera = this.cameras.main;
        const cameraView = camera.worldView;

        // Define an extended view rectangle for loading/unloading flags
        const extendedView = new Phaser.Geom.Rectangle(
            cameraView.x - this.flagLoadMargin,
            cameraView.y - this.flagLoadMargin,
            cameraView.width + (2 * this.flagLoadMargin),
            cameraView.height + (2 * this.flagLoadMargin)
        );

        // Deactivate flags outside the extended view
        this.flagGroup.getChildren().forEach(child => {
            const flag = child as Phaser.GameObjects.Sprite;
            // Use getBottomCenter() for checking if the flag's base is in view
            const flagBottomCenter = flag.getBottomCenter();
            if (flag.active && !extendedView.contains(flagBottomCenter.x, flagBottomCenter.y)) {
                this.flagGroup.killAndHide(flag);
                flag.anims.stop();
            }
        });
        
        // Activate or create flags within the extended view
        this.flagLocations.forEach(location => {
            // Check if the location is within extended view
            if (Phaser.Geom.Rectangle.Contains(extendedView, location.x, location.y)) {
                let flagExistsAndActiveAtLocation = false;
                this.flagGroup.getChildren().forEach(child => {
                    const existingFlag = child as Phaser.GameObjects.Sprite;
                    if (existingFlag.active && existingFlag.x === location.x && existingFlag.y === location.y - 16) { // Adjusted Y check
                        flagExistsAndActiveAtLocation = true;
                    }
                });

                if (!flagExistsAndActiveAtLocation) {
                    // Position flag with bottom at the top of the cell (subtract tile height)
                    const flag = this.flagGroup.get(location.x, location.y - 16, 'flag') as Phaser.GameObjects.Sprite;
                    if (flag) {
                        flag.setActive(true)
                            .setVisible(true)
                            .setOrigin(0.5, 1) // Set origin to bottom-center
                            .setDepth(this.platforms.depth > 0 ? this.platforms.depth - 1 : -1); // Place behind platforms
                        
                        // Start the flag animation
                        flag.play('flag-wave');
                    }
                }
            }
        });
    }
    
    updateTradeVisibility() {
        if (!this.tradeGroup || !this.map || !this.cameras.main) return;

        const camera = this.cameras.main;
        const cameraView = camera.worldView;

        // Define an extended view rectangle for loading/unloading trade stands
        const extendedView = new Phaser.Geom.Rectangle(
            cameraView.x - this.tradeLoadMargin,
            cameraView.y - this.tradeLoadMargin,
            cameraView.width + (2 * this.tradeLoadMargin),
            cameraView.height + (2 * this.tradeLoadMargin)
        );

        // Deactivate trade stands outside the extended view
        this.tradeGroup.getChildren().forEach(child => {
            const tradeStand = child as Phaser.GameObjects.Image;
            const tradeStandBottomCenter = tradeStand.getBottomCenter();
            if (tradeStand.active && !extendedView.contains(tradeStandBottomCenter.x, tradeStandBottomCenter.y)) {
                this.tradeGroup.killAndHide(tradeStand);
            }
        });
        
        // Activate or create trade stands within the extended view
        this.tradeLocations.forEach(location => {
            if (Phaser.Geom.Rectangle.Contains(extendedView, location.x, location.y)) {
                let tradeStandExistsAndActiveAtLocation = false;
                this.tradeGroup.getChildren().forEach(child => {
                    const existingTradeStand = child as Phaser.GameObjects.Image;
                    if (existingTradeStand.active && existingTradeStand.x === location.x && existingTradeStand.y === location.y) {
                        tradeStandExistsAndActiveAtLocation = true;
                    }
                });

                if (!tradeStandExistsAndActiveAtLocation) {
                    // Create a trade stand from the objects atlas using the 'trade' frame
                    const tradeStand = this.tradeGroup.get(location.x, location.y) as Phaser.GameObjects.Image;
                    if (tradeStand) {
                        // Configure the trade stand with the atlas frame
                        tradeStand.setTexture('objects', 'trade')
                            .setActive(true)
                            .setVisible(true)
                            .setOrigin(0.5, 1) // Set origin to bottom-center
                            .setDepth(this.platforms.depth > 0 ? this.platforms.depth - 1 : -1);
                    }
                }
            }
        });
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
            // Update position for parallax scrolling effect - use negative values to scroll correctly
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
            // Stop the UIScene before returning to MenuScene
            this.scene.stop('UIScene');
            
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

    /**
     * Check if player is on a trade tile and handle trade scene activation
     */
    checkTradeInteraction(): void {
        // Return if player isn't initialized or is dead
        if (!this.player || this.player.dead) return;
        
        // Get player position
        const playerX = this.player.sprite.x;
        const playerY = this.player.sprite.y;
        
        // Check distance to all trade locations
        const horizontalInteractionDistance = 50; // Distance in pixels horizontally to trigger trade
        const verticalInteractionDistance = 100; // Allow more vertical distance to account for jumping/falling
        
        let nearestTradeLocation: Phaser.Math.Vector2 | null = null;
        let nearestHorizontalDistance = Infinity;
        let validVerticalDistance = false;
        
        // Find nearest trade location
        this.tradeLocations.forEach(location => {
            // Calculate horizontal and vertical distances separately
            const horizontalDistance = Math.abs(playerX - location.x);
            const verticalDistance = Math.abs(playerY - location.y);
            
            // Check if player is within the vertical distance limit
            if (verticalDistance <= verticalInteractionDistance) {
                // Only consider this location if within vertical range
                if (horizontalDistance < nearestHorizontalDistance) {
                    nearestHorizontalDistance = horizontalDistance;
                    nearestTradeLocation = location;
                    validVerticalDistance = true;
                }
            }
        });
        
        // Debug log distance information
        // if (nearestTradeLocation) {
        //     console.log(`Distance to trade location: Horizontal=${nearestHorizontalDistance}, Vertical=${Math.abs(playerY - nearestTradeLocation.y)}`);
        // }
        
        // Check if player is close enough to the nearest trade location
        if (nearestTradeLocation && nearestHorizontalDistance <= horizontalInteractionDistance && validVerticalDistance) {
            // Only check for key press if trade scene isn't already active
            if (!this.scene.isActive('TradeScene')) {
                // Check if E key is pressed to open trade (one-shot detection)
                const eKey = this.input.keyboard?.addKey('E');
                // Use JustDown for more reliable single-press detection
                if (eKey && Phaser.Input.Keyboard.JustDown(eKey)) {
                    console.log('E key pressed near trade location! Starting trade...');
                    this.handleTradeStart(nearestTradeLocation);
                    
                    // Show interaction hint
                    this.showTradeInteractionHint(false);
                } else {
                    // Show interaction hint if not already trading
                    this.showTradeInteractionHint(true);
                }
            }
        } else {
            // Hide interaction hint when moving away
            this.showTradeInteractionHint(false);
        }
    }
    
    /**
     * Start the trading process
     * @param tradeLocation The location where trading is happening
     */
    handleTradeStart(tradeLocation: Phaser.Math.Vector2): void {
        // Create the trader if it doesn't exist
        if (!this.activeTrader) {
            console.log('Creating trader at location:', tradeLocation.x, tradeLocation.y);
            
            // The tradeLocation Y is already at the proper world position since it's derived 
            // from the tilemap which has already been positioned correctly
            
            // Create the trader at the trade tile position (with proper Y offset for standing)
            this.activeTrader = new BotTrader(
                this, 
                tradeLocation.x,  // X position at trade tile
                tradeLocation.y - 48, // Y position above the ground (sprite is taller than tile)
                this.player
            );
            
            console.log('Trader sprite position:', this.activeTrader.sprite.x, this.activeTrader.sprite.y);
            
            // Set up platform collision using Character's shared method
            this.activeTrader.setupPlatformCollision(this.platforms);
            
            // Set up interaction with player
            this.activeTrader.setupPlayerCollision(this.player);
        }
        
        // Show a temporary message
        const statusText = this.add.text(
            (this.sys.game.config.width as number) / 2,
            100,
            'Starting Trade',
            { fontSize: '24px', color: '#ffff00', backgroundColor: '#0008' }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(100);
        
        // Remove the text after 1 second
        this.time.delayedCall(1000, () => {
            statusText.destroy();
        });
        
        // Launch the trade scene
        this.scene.launch('TradeScene', { 
            player: this.player,
            trader: this.activeTrader 
        });
    }
    
    /**
     * Show or hide the "Press E to trade" hint
     * @param show Whether to show or hide the hint
     */
    showTradeInteractionHint(show: boolean): void {
        // Find existing hint if there is one
        const existingHint = this.children.getChildren().find(
            child => child.name === 'tradeHint'
        ) as Phaser.GameObjects.Text;
        
        // If we need to hide and there's a hint, destroy it
        if (!show && existingHint) {
            existingHint.destroy();
            return;
        }
        
        // If we need to show and there's no hint yet, create it
        if (show && !existingHint && this.player) {
            console.log("Showing trade hint at position:", this.player.sprite.x, this.player.sprite.y);
            
            const hint = this.add.text(
                this.player.sprite.x,
                this.player.sprite.y - 50,
                'Press E to trade',
                {
                    fontSize: '16px',
                    color: '#ffffff',
                    backgroundColor: '#00000080',
                    padding: { x: 5, y: 3 }
                }
            ).setOrigin(0.5, 0);
            
            hint.name = 'tradeHint';
            hint.setDepth(100);
        } else if (show && existingHint && this.player) {
            // Update position if player moved
            existingHint.setPosition(this.player.sprite.x, this.player.sprite.y - 50);
        }
    }

    /**
     * Draws debug visualization for trade zones to help with debugging
     */
    drawTradeDebugVisualization(): void {
        // Clear previous debug graphics for trade zones
        if (!this.tradeDebugGraphics) {
            this.tradeDebugGraphics = this.add.graphics();
        } else {
            this.tradeDebugGraphics.clear();
        }
        
        // Set style for trade zones visualization
        this.tradeDebugGraphics.lineStyle(2, 0xff00ff, 1);
        this.tradeDebugGraphics.fillStyle(0xff00ff, 0.3);
        
        // Draw circles at all trade locations
        this.tradeLocations.forEach(location => {
            // Draw circle with radius equal to the interaction distance
            const tradeInteractionDistance = 50;
            this.tradeDebugGraphics.strokeCircle(location.x, location.y, tradeInteractionDistance);
            this.tradeDebugGraphics.fillCircle(location.x, location.y, 10);
            
            // Draw text showing the coordinates
            if (!this.tradeDebugTexts) {
                this.tradeDebugTexts = [];
            }
            
            // Find or create debug text for this location
            let debugText = this.tradeDebugTexts.find(text => 
                text.getData('locationX') === location.x && 
                text.getData('locationY') === location.y
            );
            
            if (!debugText) {
                debugText = this.add.text(
                    location.x,
                    location.y - 25,
                    `Trade Zone\n(${Math.floor(location.x)},${Math.floor(location.y)})`,
                    {
                        fontSize: '12px',
                        color: '#ff00ff',
                        backgroundColor: '#00000080',
                        padding: { x: 3, y: 2 }
                    }
                ).setOrigin(0.5, 1).setDepth(1000);
                
                debugText.setData('locationX', location.x);
                debugText.setData('locationY', location.y);
                this.tradeDebugTexts.push(debugText);
            } else {
                // Update existing text position if needed
                debugText.setPosition(location.x, location.y - 25);
            }
        });
        
        // Also visualize player's position for reference
        if (this.player && this.player.sprite) {
            this.tradeDebugGraphics.lineStyle(2, 0x00ffff, 1);
            this.tradeDebugGraphics.strokeCircle(this.player.sprite.x, this.player.sprite.y, 10);
        }
    }
}