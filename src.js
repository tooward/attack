// This is a basic platformer template with a player that can move left, right, and jump.
var config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 300 },
            debug: false
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

function preload() {
    this.load.image('ground', 'assets/platform.png');
    this.load.spritesheet('dude-run', 'assets/_Run.png', { frameWidth: 120, frameHeight: 80 });
    this.load.spritesheet('dude-idle', 'assets/_Idle.png', { frameWidth: 120, frameHeight: 80 });
    this.load.spritesheet('dude-jump', 'assets/_Jump.png', { frameWidth: 120, frameHeight: 80 });
    this.load.spritesheet('dude-roll', 'assets/_Roll.png', { frameWidth: 120, frameHeight: 80 });
}

function create() {
    // Create the ground
    platforms = this.physics.add.staticGroup();
    platforms.create(400, 568, 'ground').setScale(2).refreshBody();

    // Create the player sprite
    player = this.physics.add.sprite(300, 350, 'dude-idle');
    player.setCollideWorldBounds(true);

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

    // Enable physics collisions
    this.physics.add.collider(player, platforms);

    // Setup keyboard input
    cursors = this.input.keyboard.createCursorKeys();
}

function update() {
    if (cursors.left.isDown) {
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
    else if (cursors.up.isDown && player.body.touching.down) {
        // Jumping with delay        
        player.setVelocityY(-100);
        player.anims.play('jump', true);
        canJump = false; // Prevent further jumps

        // Add delay before allowing another jump
        // this.time.delayedCall(1000, () => {
        //     canJump = true; // Enable jumping again after 500ms
        // });
    }
    else {
        // otherwise idle
        player.setVelocityX(0);
        player.anims.play('idle', true);
    }

}