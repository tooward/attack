import { Scene } from 'phaser';

export default class MenuScene extends Scene {
    private sun!: Phaser.GameObjects.Graphics;
    private sunTween!: Phaser.Tweens.Tween;
    private startButton!: Phaser.GameObjects.Text;

    constructor() {
        super({ key: 'MenuScene' });
    }

    create() {
        const width = this.sys.game.config.width as number;
        const height = this.sys.game.config.height as number;
        
        // Create rising sun (initially below screen)
        this.createRisingSun(width, height);
        
        // Title text
        this.add.text(width / 2, height / 3, 'Five Rings', {
            fontSize: '64px',
            color: '#fff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        // Single Player button (initially invisible)
        this.startButton = this.add.text(width / 2, height / 2 - 80, 'Single Player', {
            fontSize: '32px',
            color: '#fff',
            padding: { x: 20, y: 10 },
            backgroundColor: '#000'
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => this.startButton.setStyle({ color: '#ff0' }))
        .on('pointerout', () => this.startButton.setStyle({ color: '#fff' }))
        .on('pointerdown', () => this.startGame())
        .setAlpha(0); // Hide initially

        // Multiplayer button (initially invisible)
        const multiplayerButton = this.add.text(width / 2, height / 2, 'Online Multiplayer', {
            fontSize: '32px',
            color: '#fff',
            padding: { x: 20, y: 10 },
            backgroundColor: '#000'
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => multiplayerButton.setStyle({ color: '#ff0' }))
        .on('pointerout', () => multiplayerButton.setStyle({ color: '#fff' }))
        .on('pointerdown', () => this.startMultiplayer())
        .setAlpha(0); // Hide initially
        
        // Settings button (initially invisible)
        const settingsButton = this.add.text(width / 2, height / 2 + 80, 'Settings', {
            fontSize: '32px',
            color: '#fff',
            padding: { x: 20, y: 10 },
            backgroundColor: '#000'
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => settingsButton.setStyle({ color: '#ff0' }))
        .on('pointerout', () => settingsButton.setStyle({ color: '#fff' }))
        .on('pointerdown', () => this.openSettings())
        .setAlpha(0); // Hide initially

        // Show all buttons with staggered timing
        this.tweens.add({
            targets: [multiplayerButton, settingsButton],
            alpha: 1,
            duration: 500,
            ease: 'Power2',
            delay: 2000
        });
        this.animateRisingSun(height);

        // Optional: Add options button, credits, etc.
    }
    
    createRisingSun(width: number, height: number) {
        const sunRadius = width * 0.15;
        const startY = height + sunRadius; // Start below the screen
        
        this.sun = this.add.graphics();
        
        // Draw the sun with rays
        this.sun.fillStyle(0xff0000, 1); // Red color
        this.sun.fillCircle(width / 2, 0, sunRadius);
        
        // Add rays
        this.sun.fillStyle(0xff3333, 0.8);
        const rayCount = 12;
        const rayLength = sunRadius * 0.6;
        
        for (let i = 0; i < rayCount; i++) {
            const angle = (i * Math.PI * 2) / rayCount;
            const x = Math.cos(angle) * sunRadius;
            const y = Math.sin(angle) * sunRadius;
            
            this.sun.beginPath();
            this.sun.moveTo(width / 2, 0);
            this.sun.lineTo(width / 2 + x, y);
            this.sun.lineTo(width / 2 + x * 1.2, y * 1.2);
            this.sun.closePath();
            this.sun.fillPath();
        }
        
        // Position the sun below the screen initially
        this.sun.setY(startY);
    }
    
    animateRisingSun(height: number) {
        // Calculate the final Y position (above the title text)
        const finalY = height * 0.2 + 100;
        
        // Create the rising animation
        this.sunTween = this.tweens.add({
            targets: this.sun,
            y: finalY,
            duration: 2000,
            ease: 'Power2',
            onComplete: () => {
                // Show the start button once the animation is complete
                this.tweens.add({
                    targets: this.startButton,
                    alpha: 1,
                    duration: 500,
                    ease: 'Power2'
                });
            }
        });
    }
    
    startGame() {
        // Go to character select instead of directly to game
        this.scene.start('CharacterSelectScene');
    }

    startMultiplayer() {
        // Start multiplayer menu
        this.scene.start('MultiplayerMenuScene');
    }
    
    openSettings() {
        // Open settings menu
        this.scene.start('SettingsScene');
    }
}