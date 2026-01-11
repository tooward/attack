import { AUTO } from 'phaser';
import BootScene from '../scenes/BootScene.js';
import GameScene from '../scenes/GameScene.js';
import UIScene from '../scenes/UIScene.js';
import MenuScene from '../scenes/MenuScene.js';
import { MultiplayerMenuScene } from '../scenes/MultiplayerMenuScene.js';
import InventoryScene from '../scenes/InventoryScene.js';
import TradeScene from '../scenes/TradeScene.js';
import PhaserGameScene from '../scenes/PhaserGameScene.js';

// Mobile detection
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || !!(window as any).Capacitor;

// Resolution scaling for mobile
const baseWidth = 1000;
const baseHeight = 600;
const resolutionScale = isMobile ? 1.0 : 1.0; // Keep at 1.0 for now, can reduce to 0.85 if needed

// Centralized game configuration
export const config = {
    type: AUTO,
    width: baseWidth * resolutionScale,
    height: baseHeight * resolutionScale,
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
    scene: [BootScene, MenuScene, MultiplayerMenuScene, PhaserGameScene, GameScene, UIScene, InventoryScene, TradeScene],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    // Performance optimizations for mobile
    render: {
        powerPreference: 'high-performance',
        roundPixels: true,
        pixelArt: false,
        antialias: true
    },
    // Reduce audio channels on mobile
    audio: {
        disableWebAudio: false,
        noAudio: false
    },
    // FPS configuration
    fps: {
        target: 60,
        forceSetTimeOut: false
    }
};