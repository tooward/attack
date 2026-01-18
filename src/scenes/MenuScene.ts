import { Scene } from 'phaser';

export default class MenuScene extends Scene {
    // private sun!: Phaser.GameObjects.Graphics;
    // private sunTween!: Phaser.Tweens.Tween;
    private startButton!: Phaser.GameObjects.Text;

    constructor() {
        super({ key: 'MenuScene' });
    }

    create() {
        const width = this.sys.game.config.width as number;
        const height = this.sys.game.config.height as number;
        
        // Create rising sun (initially below screen)
        // this.createRisingSun(width, height);
        
        // Title text
        this.add.text(width / 2, height * 0.15, 'Five Rings', {
            fontSize: `${height * 0.075}px`,
            color: '#fff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        // Single Player button (initially invisible)
        this.startButton = this.add.text(width / 2, height * 0.35, 'Single Player', {
            fontSize: `${height * 0.04}px`,
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

        // Practice Mode button (initially invisible)
        const practiceButton = this.add.text(width / 2, height * 0.47, 'Practice Mode', {
            fontSize: `${height * 0.04}px`,
            color: '#fff',
            padding: { x: 20, y: 10 },
            backgroundColor: '#000'
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => practiceButton.setStyle({ color: '#ff0' }))
        .on('pointerout', () => practiceButton.setStyle({ color: '#fff' }))
        .on('pointerdown', () => this.startPracticeMode())
        .setAlpha(0); // Hide initially

        // Multiplayer button (initially invisible)
        const multiplayerButton = this.add.text(width / 2, height * 0.59, 'Online Multiplayer', {
            fontSize: `${height * 0.04}px`,
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
        
        // Character Test button - DEPRECATED: Functionality moved to Practice Mode
        // const characterTestButton = this.add.text(width / 2, height * 0.71, 'Character Test Lab', {
        //     fontSize: `${height * 0.035}px`,
        //     color: '#0ff',
        //     padding: { x: 20, y: 10 },
        //     backgroundColor: '#001'
        // })
        // .setOrigin(0.5)
        // .setInteractive({ useHandCursor: true })
        // .on('pointerover', () => characterTestButton.setStyle({ color: '#ff0' }))
        // .on('pointerout', () => characterTestButton.setStyle({ color: '#0ff' }))
        // .on('pointerdown', () => this.startCharacterTest())
        // .setAlpha(0); // Hide initially
        
        // Settings button (initially invisible)
        const settingsButton = this.add.text(width / 2, height * 0.71, 'Settings', {
            fontSize: `${height * 0.04}px`,
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

        // Show all buttons immediately (sun animation disabled)
        this.tweens.add({
            targets: [this.startButton, practiceButton, multiplayerButton, settingsButton],
            alpha: 1,
            duration: 500,
            ease: 'Power2'
        });
        // this.animateRisingSun(height);

        // Optional: Add options button, credits, etc.
    }
    
    /* createRisingSun(width: number, height: number) {
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
    } */
    
    /* animateRisingSun(height: number) {
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
    } */
    
    startGame() {
        // Go to character select instead of directly to game
        this.scene.start('CharacterSelectScene');
    }

    startPracticeMode() {
        // Go to bot selection for practice mode
        this.scene.start('BotSelectionScene');
    }

    startMultiplayer() {
        // Start multiplayer menu
        this.scene.start('MultiplayerMenuScene');
    }

    // DEPRECATED: Character Test Lab functionality moved to Practice Mode (ESC menu)
    // startCharacterTest() {
    //     // Launch Character Test Lab for balance testing
    //     this.scene.start('CharacterTestScene');
    // }
    
    openSettings() {
        // Open settings menu
        this.scene.start('SettingsScene');
    }
}