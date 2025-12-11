import { AUTO } from 'phaser';
import BootScene from '../scenes/BootScene.js';
import GameScene from '../scenes/GameScene.js';
import UIScene from '../scenes/UIScene.js';
import MenuScene from '../scenes/MenuScene.js';
import InventoryScene from '../scenes/InventoryScene.js';
import TradeScene from '../scenes/TradeScene.js';
import PhaserGameScene from '../scenes/PhaserGameScene.js';

// Centralized game configuration
export const config = {
    type: AUTO,
    width: 1000,
    height: 600,
    backgroundColor: '#000000',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 300 },
            debug: false  // changed to false to disable debug visualization
        }
    },
    // Define scenes in loading order
    // PhaserGameScene is the new fighting game scene
    // Old GameScene is for side-scrolling adventure (future)
    scene: [BootScene, MenuScene, PhaserGameScene, GameScene, UIScene, InventoryScene, TradeScene],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
};