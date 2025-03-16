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
var isRolling = false; // Add this flag to track if the player is rolling
var canRoll = true; // New: Tracks if rolling is allowed
var explosions;
var explosionTimer;

function preload() {
    // Load maps and tiles
    this.load.image('ground', 'assets/maps/Tileset.png');
    this.load.tilemapTiledJSON('map', 'assets/maps/map.tmj');

    // Load player sprites
    this.load.spritesheet('dude-run', 'assets/_Run.png', { frameWidth: 120, frameHeight: 80 });
    this.load.spritesheet('dude-idle', 'assets/_Idle.png', { frameWidth: 120, frameHeight: 80 });
    this.load.spritesheet('dude-jump', 'assets/_Jump.png', { frameWidth: 120, frameHeight: 80 });
    this.load.spritesheet('dude-die', 'assets/_Death.png', { frameWidth: 120, frameHeight: 80 });
    this.load.spritesheet('explosion', 'assets/explosion.png', { frameWidth: 64, frameHeight: 64 });

    this.load.audio('explosion-sound', 'assets/sounds/explosion.wav');
    this.load.spritesheet('dude-roll', 'assets/_Roll.png', { frameWidth: 120, frameHeight: 80 });
}

function create() {
    // Create the tilemap
    const map = this.make.tilemap({ key: 'map' });
    const tileset = map.addTilesetImage('ground', 'ground');
    // Create layer; the offset from Tiled is automatically applied if present.
    const platforms = map.createStaticLayer('ground', tileset, 0, 0);
    // Optionally override the layer's position:
    platforms.setPosition(0, 0);  // Adjust x and y as needed
    // Apply collision based on tile property; if not automatically set, force it:
    // platforms.forEachTile(tile => {
    //     if (tile.index > 0 && tile.properties && tile.properties.collides === true) {
    //         console.log("DEBUG: Tile GID " + tile.index + " HAS a 'collides' property.");
    //         tile.setCollision(true);
    //     }
    //     else {
    //         console.log("DEBUG: Tile GID " + tile.index + " does not have a 'collides' property.");
    //     }
    // });
    // Optionally still call setCollisionByProperty
    platforms.setCollisionByProperty({ collides: true });
     
    // Debugging: log colliding tiles count
    console.log("Number of tiles in the layer:", platforms.layer.data.length);
    let collidingTiles = platforms.filterTiles(tile => tile.collides);
    console.log("Number of colliding tiles:", collidingTiles.length);
    console.log(map.tilesets);
    platforms.renderDebug(this.add.graphics());

    // Debug: Log properties for all non-empty tiles in the layer
    // platforms.forEachTile(tile => {
    //     if (tile.index > 0) {
    //         console.log(`Tile GID: ${tile.index}`, tile.properties, 'Collides:', tile.collides);
    //     }
    // });

    // Create the player sprite
    player = this.physics.add.sprite(300, 350, 'dude-idle');
    player.setCollideWorldBounds(true);
    player.dead = false; // Initialize dead flag
   
     // Replace existing platforms group with the tilemap layer collision:
     this.physics.add.collider(player, platforms);

    // Create the explosions group
    explosions = this.physics.add.group({
        defaultKey: 'explosion',
        maxSize: 10,
        allowGravity: false // Prevent explosions from falling
    });

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

    this.physics.add.overlap(player, explosions, (player, explosion) => {
        if (!player.dead) {  
            player.dead = true; // Prevent further collisions
            player.setVelocity(0, 0); // Stop all movement immediately
            // Make the explosion play its animation and sound
            this.sound.play('explosion-sound');
            player.anims.play('die', true);
            // Stop spawning explosions when player dies
            if (this.explosionTimer) {
                this.explosionTimer.remove(false);
            }
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

    // Enable physics collisions
    this.physics.add.collider(player, platforms);

    // When the player collides with an explosion, change tint and play die animation
    this.physics.add.overlap(player, explosions, (player, explosion) => {
        if (!player.dead) {  
            player.dead = true; // Prevent further collisions
            // Make the explosion play its animation and sound
            this.sound.play('explosion-sound');
            player.anims.play('die', true);
            // Stop spawning explosions when player dies
            if (this.explosionTimer) {
                this.explosionTimer.remove(false);
            }
        }
    });

    // Spawn explosions periodically from the ground (y=568 matches ground level)
    this.explosionTimer = this.time.addEvent({
        delay: 3000, // every 3 seconds, adjust as needed
        callback: spawnExplosion,
        callbackScope: this,
        loop: true
    });
    
    function spawnExplosion() {
        // Get the top of the first ground platform from the group
        let groundBounds = platforms.getBounds();

        // Choose a random x position along the width
        let xPos = Phaser.Math.Between(groundBounds.x + 100, groundBounds.right - 100);

        // Spawn the explosion at ground level
        let explosion = explosions.get(xPos, 0);
        if (explosion) {
            let explosionBounds = explosion.getBounds();
            let adjustedY = groundBounds.top - (explosionBounds.height / 2);
            // console.log("DEBUG in spawnExplosion: groundBounds = " + groundBounds.top);
            // console.log("DEBUG in spawnExplosion: adjustedY = " + adjustedY);

            // Re-enable the explosion sprite (this resets its texture and active state).
            explosion.setPosition(xPos, adjustedY);
            explosion.enableBody(false, xPos, adjustedY, true, true);
    
            // Play the explosion animation.
            explosion.anims.play('explode');
            
            // Once the explosion animation is complete, disable and hide the sprite.
            explosion.once('animationcomplete', () => {
                explosion.disableBody(true, true);
            });
        }
    }

        // Spawn explosions periodically...
        this.explosionTimer = this.time.addEvent({
            delay: 3000,
            callback: spawnExplosion,
            callbackScope: this,
            loop: true
        });

    // Setup keyboard input
    //cursors = this.input.keyboard.createCursorKeys();
    cursors = this.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        right: Phaser.Input.Keyboard.KeyCodes.D
    });
}

function update() {
    if (player.dead) {
        // Skip movement updates if the player is dead
        return;
    }
    else if (cursors.left.isDown) {
        // Move left
        if (cursors.down.isDown) {
            // Roll
            player.setVelocityX(-160);
            player.flipX = true
            player.anims.play('roll', true);     
            isRolling = true; // Set the flag to true when rolling starts
                 
            // Reset the flag when the roll animation completes
            player.on('animationcomplete-roll', () => {
                isRolling = false;
            });
        }
        else if (cursors.up.isDown && player.body.touching.down) {
            // Jump
            player.setVelocityY(-100);
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
        if (cursors.down.isDown) {
            // Roll
            player.setVelocityX(160);
            player.flipX = false
            player.anims.play('roll', true);
            isRolling = true; // Set the flag to true when rolling starts

            // Reset the flag when the roll animation completes
            player.on('animationcomplete-roll', () => {
                isRolling = false;
            });
        }
        else if (cursors.up.isDown && player.body.touching.down) {
            // Jump
            player.setVelocityY(-100);
            player.anims.play('jump', true);
            canJump = false; // Prevent further jumps
        }
        else {
            player.setVelocityX(160);
            player.flipX = false
            player.anims.play('right', true);
        }
    }
    else if (cursors.up.isDown && player.body.touching.down && canJump) {
        // Jumping with delay        
        player.setVelocityY(-100);
        player.anims.play('jump', true);
        canJump = false; // Prevent further jumps

        // Add delay before allowing another jump
         this.time.delayedCall(1000, () => {
             canJump = true; // Enable jumping again after 1000ms
         });
    }
    else {
        // otherwise idle
        player.setVelocityX(0);
        player.anims.play('idle', true);
    }

}