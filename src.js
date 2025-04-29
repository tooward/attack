// This is a basic platformer template with a player that can move left, right, and jump.
var config = {
    type: Phaser.AUTO,
    width: 1600,
    height: 1200,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 300 },
            debug: true  // enable debug mode for collision visualization
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};
var canJump = true; // Flag to track if the player can jump
var player;
var platforms;
var cursors;
var game = new Phaser.Game(config);
var isRolling = false; // Prevents rolling spam
var lastDirection = 1; // 1 for right, -1 for left (tracks last movement direction)
var canRoll = true; // New: Tracks if rolling is allowed
var explosions;
var explosionTimer;

function preload() {
    // Load maps and tiles
    this.load.image('ground', 'assets/maps/Tileset.png');
    this.load.tilemapTiledJSON('map', 'assets/maps/map.tmj');

    // Load player sprites
    this.load.spritesheet('dude-run', 'assets/player/_Run.png', { frameWidth: 120, frameHeight: 80 });
    this.load.spritesheet('dude-idle', 'assets/player/_Idle.png', { frameWidth: 120, frameHeight: 80 });
    this.load.spritesheet('dude-jump', 'assets/player/_Jump.png', { frameWidth: 120, frameHeight: 80 });
    this.load.spritesheet('dude-die', 'assets/player/_Death.png', { frameWidth: 120, frameHeight: 80 });
    this.load.spritesheet('dude-roll', 'assets/player/_Roll.png', { frameWidth: 120, frameHeight: 80 });

    // Load explosion spritesheet
    this.load.spritesheet('explosion', 'assets/explosion.png', { frameWidth: 64, frameHeight: 64 });
    this.load.audio('explosion-sound', 'assets/sounds/explosion.wav');

    // Add bot sprite
    this.load.spritesheet('bot', 'assets/enemy/bot.png', { frameWidth: 120, frameHeight: 80 });
}

function create() {
    // Create the tilemap
    const map = this.make.tilemap({ key: 'map' });
    const tileset = map.addTilesetImage('ground', 'ground');
    // Create layer; the offset from Tiled is automatically applied if present.
    const platforms = map.createStaticLayer('ground', tileset, 0, 0);
    // Optionally override the layer's position:
    platforms.setPosition(0, 0);  // Adjust x and y as needed
    platforms.setCollisionByExclusion([-1]); // Collide with all tiles except those with GID -1
     
    // Debugging: log colliding tiles count
    console.log("Number of tiles in the layer:", platforms.layer.data.length);
    let collidingTiles = platforms.filterTiles(tile => tile.collides);
    console.log("Number of colliding tiles:", collidingTiles.length);
    console.log(map.tilesets);
    platforms.renderDebug(this.add.graphics());

    // Create the player sprite
    player = this.physics.add.sprite(300, 350, 'dude-idle');
    player.body.setSize(60, 70);  // Adjusted size to better match character dimensions
    player.body.setOffset(30, 10); // Adjust offset to center the hitbox on the visible sprite
    player.setCollideWorldBounds(true);
    player.dead = false; // Initialize dead flag

    // Add custom stats
    player.maxHealth = 100;
    player.health = 100;

    player.maxStamina = 100;
    player.stamina = 100;

    player.staminaRegenRate = 10; // per second
    player.staminaDrainRate = 20; // per second during fighting
    player.isFighting = false;

    // Create the health bar using graphics object
    this.healthBarGraphics = this.add.graphics();
    this.updateHealthBar = function() {
        this.healthBarGraphics.clear();
        // Background of health bar
        this.healthBarGraphics.fillStyle(0x555555);
        this.healthBarGraphics.fillRect(250, 10, 300, 20);
        // Foreground of health bar (actual health)
        this.healthBarGraphics.fillStyle(0xff0000);
        const healthWidth = 300 * (player.health / player.maxHealth);
        this.healthBarGraphics.fillRect(250, 10, healthWidth, 20);
    };
    this.updateHealthBar();
   
    // Replace existing platforms group with the tilemap layer collision:
    this.physics.add.collider(player, platforms);

    // Create the explosions group with physics enabled
    explosions = this.physics.add.group({
        defaultKey: 'explosion',
        maxSize: 10,
        allowGravity: true,  // Enable gravity for physics placement
        bounceY: 0,
        collideWorldBounds: true
    });

    // Add physics collider between explosions and platforms
    this.physics.add.collider(explosions, platforms);

    // Create animations
    this.anims.create({
        key: 'left',
        frames: this.anims.generateFrameNumbers('dude-run', { start: 0, end: 9 }),
        frameRate: 10,
        repeat: -1
    });

    this.anims.create({
        key: 'right',
        frames: this.anims.generateFrameNumbers('dude-run', { start: 0, end: 9 }),
        frameRate: 10,
        repeat: -1
    });

    this.anims.create({
        key: 'idle',
        frames: this.anims.generateFrameNumbers('dude-idle', { start: 0, end: 9 }),
        frameRate: 10
    });

    this.anims.create({
        key: 'jump',
        frames: this.anims.generateFrameNumbers('dude-jump', { start: 0, end: 2 }), // Adjust frame range if needed
        frameRate: 10
    });

    this.anims.create({
        key: 'roll',
        frames: this.anims.generateFrameNumbers('dude-roll', { start: 0, end: 11 }), // Adjust frame range
        frameRate: 20,
        repeat: 0 // Play once
    });

    this.anims.create({
        key: 'die',
        frames: this.anims.generateFrameNumbers('dude-die', { start: 0, end: 9 }),
        frameRate: 20
    });

    // Update the player-explosion overlap handler to trigger explosions on contact
    this.physics.add.overlap(player, explosions, (player, explosion) => {
        // Only process if the player isn't already dead and the explosion hasn't played yet
        if (!player.dead && explosion.active && !explosion.anims.isPlaying) {
            console.log("Player collided with explosion, triggering it");
            
            // Play the explosion animation when player touches it
            explosion.anims.play('explode');
            
            // Play explosion sound
            this.sound.play('explosion-sound');
            
            // Kill the player
            player.dead = true;
            player.anims.play('die', true);
            player.setVelocity(0, -200); // Optional: Add a little upward force
            
            // Stop spawning explosions when player dies
            if (this.explosionTimer) {
                this.explosionTimer.remove(false);
            }
            
            // Once the explosion animation completes, hide it
            explosion.once('animationcomplete', function() {
                this.setActive(false);
                this.setVisible(false);
                this.body.enable = false;
                explosion.disableBody(true, true);
            });
        }
    });

    // create the explosion animation
    this.anims.create({
        key: 'explode',
        frames: this.anims.generateFrameNumbers('explosion', { start: 0, end: 7 }),
        frameRate: 20,
        repeat: 0,
        hideOnComplete: true
    });

    const explosionAnim = this.anims.get('explode');
    if (explosionAnim) {
        console.log("DEBUG: 'explode' animation details:", explosionAnim);
        explosionAnim.frames.forEach((frame, index) => {
            console.log(`Frame ${index}: key = ${frame.textureKey}, frame = ${frame.frame}`);
        });
    } else {
        console.error("DEBUG: 'explode' animation was not created properly!");
    }

    // Enable player physics collisions (single instance)
    this.physics.add.collider(player, platforms);

    // Create bot enemy
    this.bot = this.physics.add.sprite(500, 350, 'bot');
    this.bot.setCollideWorldBounds(true);
    this.bot.body.setSize(60, 70);

    // Add bot collision with platforms
    this.physics.add.collider(this.bot, platforms);

    // Fix player-bot overlap collision with proper context
    this.physics.add.overlap(player, this.bot, () => {
        if (player.isFighting && !this.bot.isHit) {
            this.bot.isHit = true;
            this.bot.tint = 0xff0000; // Flash red when hit
            
            // Reset after a short delay
            this.time.delayedCall(500, () => {
                this.bot.isHit = false;
                this.bot.clearTint();
            });
        }
    });

    // Spawn explosions periodically from the ground
    this.explosionTimer = this.time.addEvent({
        delay: 3000, // every 3 seconds, adjust as needed
        callback: spawnExplosion,
        callbackScope: this,
        loop: true
    });
    
    function spawnExplosion() {
        // Store a reference to the scene for proper access
        const scene = this;
        
        // Access game dimensions from the scene
        const gameWidth = scene.sys.game.config.width;
        
        // Choose a random x position along the width
        let xPos = Phaser.Math.Between(100, gameWidth - 100);
        
        console.log("Spawning explosion at x:", xPos);
        
        // Create the explosion using create instead of get to ensure we always get a new explosion
        let explosion = explosions.create(xPos, 50, 'explosion');
        
        // In case the group is full, the explosion may still be null
        if (explosion) {
            explosion.setActive(true);
            explosion.setVisible(true);
            explosion.setScale(1.5);
            
            // Set a small collision box at the bottom of the explosion sprite
            explosion.body.setSize(48, 10);
            explosion.body.setOffset(8, 54); // Adjust based on your sprite dimensions
            
            // Wait until the explosion has landed before playing animation
            scene.time.addEvent({
                delay: 50,
                callback: function checkForLandingCallback() {
                    checkForLanding(scene, explosion);
                },
                callbackScope: scene,
                loop: true,
                repeat: 20 // Check for 1 second max (50ms * 20)
            });
        } else {
            console.error("Failed to get explosion from group - group is likely full");
            
            // Try to recycle an old explosion if we couldn't create a new one
            explosions.getChildren().some(oldExplosion => {
                if (!oldExplosion.anims.isPlaying) {
                    oldExplosion.setPosition(xPos, 50);
                    oldExplosion.setActive(true);
                    oldExplosion.setVisible(true);
                    oldExplosion.body.enable = true;
                    
                    // Wait until the explosion has landed before playing animation
                    scene.time.addEvent({
                        delay: 50,
                        callback: function checkForLandingCallback() {
                            checkForLanding(scene, oldExplosion);
                        },
                        callbackScope: scene,
                        loop: true,
                        repeat: 20 // Check for 1 second max (50ms * 20)
                    });
                    
                    explosion = oldExplosion;
                    return true; // Break the loop
                }
                return false;
            });
        }
    }

    // Helper function to check if an explosion has landed
    function checkForLanding(scene, explosion) {
        if (explosion && explosion.active && explosion.body.touching.down) {
            console.log("Explosion landed, playing animation");
            
            // Get the timer event for this explosion and clear only that specific timer
            const timerEvents = scene.time.getAll();
            for (let i = 0; i < timerEvents.length; i++) {
                // Only remove the timer related to this specific explosion's landing check
                if (timerEvents[i].callback && timerEvents[i].callback.name === 'checkForLandingCallback') {
                    timerEvents[i].remove();
                }
            }
            
            // Play the explosion animation once it lands
            explosion.anims.play('explode');
            
            // Play explosion sound
            scene.sound.play('explosion-sound');
            
            // Once the animation completes, hide the explosion
            explosion.once('animationcomplete', function() {
                this.setActive(false);
                this.setVisible(false);
                // Disable physics body to prevent further collisions
                this.body.enable = false;
                
                // Remove from display list and physics world
                explosion.disableBody(true, true);
            });
        }
    }

    function playerTakeDamage(player, amount) {
        player.health -= amount;
        if (player.health <= 0) {
            player.health = 0;
            console.log('Player has died!');
            // You can trigger game over here
        }
    }

    // Setup keyboard input
    cursors = this.input.keyboard.createCursorKeys();
}

function update(time, delta) {
    // delta is milliseconds since last frame
    const seconds = delta / 1000;

    // bail out if player is dead
    if (player.dead) {
        // Skip movement updates if the player is dead
        return;
    }

    // handle regular movement
    if (cursors.left.isDown) {
        // Move left
        if (cursors.down.isDown && canRoll) {
            // Roll
            player.setVelocityX(-160);
            player.flipX = true;
            player.anims.play('roll', true);     
            isRolling = true; // Set the flag to true when rolling starts
            canRoll = false;
            
            // Reset the flag when the roll animation completes - use once instead of on
            player.once('animationcomplete-roll', () => {
                isRolling = false;
                
                // Add cooldown before allowing another roll
                this.time.delayedCall(500, () => {
                    canRoll = true;
                });
            });
        }
        else if (cursors.up.isDown && player.body.onFloor()) {
            // Jump with higher velocity
            player.setVelocityY(-400);
            player.anims.play('jump', true);
            canJump = false; // Prevent further jumps
        }
        else {
            player.setVelocityX(-160);
            player.flipX = true
            player.anims.play('left', true);
        }
    } else if (cursors.right.isDown) {
        // Move right
        if (cursors.down.isDown && canRoll) {
            // Roll
            player.setVelocityX(160);
            player.flipX = false;
            player.anims.play('roll', true);
            isRolling = true; // Set the flag to true when rolling starts
            canRoll = false;
            
            // Reset the flag when the roll animation completes - use once instead of on
            player.once('animationcomplete-roll', () => {
                isRolling = false;
                
                // Add cooldown before allowing another roll
                this.time.delayedCall(500, () => {
                    canRoll = true;
                });
            });
        }
        else if (cursors.up.isDown && player.body.onFloor()) {
            // Jump with higher velocity
            player.setVelocityY(-400);
            player.anims.play('jump', true);
            canJump = false; // Prevent further jumps
        }
        else {
            player.setVelocityX(160);
            player.flipX = false
            player.anims.play('right', true);
        }
    }
    else if (cursors.up.isDown && player.body.onFloor() && canJump) {
        // Jumping with delay using higher velocity        
        player.setVelocityY(-400);
        player.anims.play('jump', true);
        canJump = false; // Prevent further jumps

        // Add delay before allowing another jump
         this.time.delayedCall(1000, () => {
             canJump = true; // Enable jumping again after 1000ms
         });
    }
    else if (this.input.keyboard.checkDown(cursors.space, 500)) {
        // Attack needs to be revisited. Use attack specific keys
        player.isFighting = true;
        // Attack code here
        // Then, after a delay, set back to resting:
        this.time.delayedCall(1000, () => {
            player.isFighting = false;
        });
    }
    else {
        // otherwise idle
        player.setVelocityX(0);
        player.anims.play('idle', true);
    }

    // Handle stamina drain if fighting
    if (player.isFighting) {
        player.stamina -= player.staminaDrainRate * seconds;
        if (player.stamina < 0) {
            player.stamina = 0;
            // Maybe make the player weaker if stamina hits 0
        }
    } else {
        // Regen stamina when resting
        if (player.stamina < player.maxStamina) {
            player.stamina += player.staminaRegenRate * seconds;
            if (player.stamina > player.maxStamina) {
                player.stamina = player.maxStamina;
            }
        }
    }

    // (Optional) Reduce attack power if stamina is low
    if (player.stamina < 20) {
        player.attackPower = 0.5; // Half damage
    } else {
        player.attackPower = 1.0;
    }

    // Example: Decrease health slowly for demo
    // player.health -= 0.05; // (uncomment for testing)

    if (player.health < 0) {
        player.health = 0;
    }

    // Update health bar width based on health if health bar exists
    if (this.healthBarGraphics) {
        this.updateHealthBar();
    }
}