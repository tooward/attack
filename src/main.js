import { Game } from 'phaser';
import { config } from './config/gameConfig.js';

// Initialize the Phaser game with the configuration
const game = new Game(config);

// Export the game instance so it can be accessed from other modules if needed
export default game;