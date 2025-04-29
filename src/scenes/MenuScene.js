import { Scene } from 'phaser';

export default class MenuScene extends Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    create() {
        const { width, height } = this.sys.game.config;
        
        // Title text
        this.add.text(width / 2, height / 3, 'ATTACK GAME', {
            fontSize: '64px',
            fill: '#fff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        // Start game button
        const startButton = this.add.text(width / 2, height / 2, 'Start Game', {
            fontSize: '32px',
            fill: '#fff',
            padding: { x: 20, y: 10 },
            backgroundColor: '#000'
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => startButton.setStyle({ fill: '#ff0' }))
        .on('pointerout', () => startButton.setStyle({ fill: '#fff' }))
        .on('pointerdown', () => this.startGame());

        // Optional: Add options button, credits, etc.
    }
    
    startGame() {
        // Start both game and UI scenes when starting the game
        this.scene.start('GameScene');
        this.scene.launch('UIScene');
    }
}