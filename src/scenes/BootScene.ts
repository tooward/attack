import { Scene } from 'phaser';
import Player from '../entities/Player.js';
import Explosion from '../entities/Explosion.js';
import Bot from '../entities/Bot.js';

export default class BootScene extends Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        // Create loading bar
        this.createLoadingBar();
        
        // Load maps and tiles
        this.load.image('ground', 'assets/maps/Tileset.png');
        this.load.tilemapTiledJSON('map', 'assets/maps/map.tmj');

        // Load player assets using the static method from Player class
        Player.preload(this);
        
        // Load explosion assets using the static method from Explosion class
        Explosion.preload(this);
        
        // Load bot assets using the static method from Bot class
        Bot.preload(this);
    }

    create() {
        // Create all the animations using the static methods from entity classes
        Player.createAnims(this);
        Explosion.createAnims(this);
        Bot.createAnims(this);
        
        // Start the menu scene when loading is complete
        this.scene.start('MenuScene');
    }

    createLoadingBar() {
        // Display loading progress
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);
        
        const loadingText = this.make.text({
            x: width / 2,
            y: height / 2 - 50,
            text: 'Loading...',
            style: {
                font: '20px monospace',
                color: '#ffffff'
            }
        });
        loadingText.setOrigin(0.5, 0.5);
        
        // Update the loading bar as assets are loaded
        this.load.on('progress', (value: number) => {
            progressBar.clear();
            progressBar.fillStyle(0xffffff, 1);
            progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
        });
        
        this.load.on('complete', () => {
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();
        });
    }
}