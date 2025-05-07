import { AUTO, CANVAS, WEBGL } from 'phaser';
import BootScene from '../scenes/BootScene.js';
import GameScene from '../scenes/GameScene.js';
import UIScene from '../scenes/UIScene.js';
import MenuScene from '../scenes/MenuScene.js';
import InventoryScene from '../scenes/InventoryScene.js';

// Centralized game configuration
export const config = {
    type: AUTO,
    width: 1600,
    height: 1200,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 300 },
            debug: false  // changed to false to disable debug visualization
        }
    },
    // Define scenes in loading order
    scene: [BootScene, MenuScene, GameScene, UIScene, InventoryScene]
};