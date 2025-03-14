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

function preload() {
    this.load.image('ground', 'assets/platform.png');
    this.load.spritesheet('dude-run', 'assets/_Run.png', { frameWidth: 120, frameHeight: 80 });
    this.load.spritesheet('dude-idle', 'assets/_Idle.png', { frameWidth: 120, frameHeight: 80 });
    this.load.spritesheet('dude-jump', 'assets/_Jump.png', { frameWidth: 120, frameHeight: 80 });
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
        frames: this.anims.generateFrameNumbers('dude-jump', { start: 0, end: 3 }), // Adjust frame range if needed
        frameRate: 10
    });

    // Enable physics collisions
    this.physics.add.collider(player, platforms);

    // Setup keyboard input
    cursors = this.input.keyboard.createCursorKeys();
}

function update() {
    if (cursors.left.isDown ) {
        player.setVelocityX(-160);
        player.flipX = true
        player.anims.play('left', true);
    } else if (cursors.right.isDown) {
        player.setVelocityX(160);
        player.flipX = false
        player.anims.play('right', true);
    } else {
        player.setVelocityX(0);
        player.anims.play('idle', true);
    }

    // Jumping with delay
    if (cursors.up.isDown && player.body.touching.down && canJump) {
        player.setVelocityY(-100);
        player.anims.play('jump', true);
        canJump = false; // Prevent further jumps

        // Add delay before allowing another jump
        this.time.delayedCall(1000, () => {
            canJump = true; // Enable jumping again after 500ms
        });
    }
}