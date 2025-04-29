import { Game } from 'phaser';
import { config } from './config/gameConfig.js';

// Update the game configuration to fix the Vector2Like error
const updatedConfig = {
    ...config,
    physics: {
        ...config.physics,
        arcade: {
            ...config.physics.arcade,
            gravity: { ...config.physics.arcade.gravity, x: 0 } // Add x: 0 for Vector2Like
        }
    }
};

// Initialize the Phaser game with the updated configuration
const game = new Game(updatedConfig);

// Export the game instance so it can be accessed from other modules if needed
export default game;