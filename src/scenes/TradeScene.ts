import { Scene, GameObjects } from 'phaser';
import Player from '../entities/Player';
import BotTrader from '../entities/BotTrader';
import InventoryManager, { Item, InventoryItem } from '../data/InventoryManager';

export default class TradeScene extends Scene {
    private player: Player | null = null;
    private trader: BotTrader | null = null;
    private background!: GameObjects.Rectangle;
    private itemsForSale: GameObjects.Container | null = null;
    private dialogueText!: GameObjects.Text;
    private closeButton!: GameObjects.Text;
    private coinDisplay!: GameObjects.Text;
    private selectedItem: Item | null = null;
    private itemButtons: GameObjects.Text[] = [];
    private descriptionText!: GameObjects.Text;
    private buyButton!: GameObjects.Text;
    
    constructor() {
        super({ key: 'TradeScene' });
    }
    
    init(data: { player: Player, trader: BotTrader }): void {
        this.player = data.player;
        this.trader = data.trader;
    }
    
    create(): void {
        // Get game dimensions for layout
        const width = this.sys.game.config.width as number;
        const height = this.sys.game.config.height as number;
        
        // Get the gameScene to access platform position information
        const gameScene = this.scene.get('GameScene') as any;
        
        // Get the platform layer position to align trade UI with the game world
        let groundY = height;
        let platformsExist = false;
        if (gameScene && gameScene.platforms) {
            // Get the bounds of the platform layer to determine where the ground is
            const platformBounds = gameScene.platforms.getBounds();
            groundY = platformBounds.y; // Top of the platform layer
            platformsExist = true;
            
            // Debug logging
            console.log('Trade Scene Debug - Platform bounds:', platformBounds);
            console.log('Trade Scene Debug - Initial groundY:', groundY);
            
            // Check for active trade locations
            if (gameScene.tradeLocations && gameScene.tradeLocations.length > 0) {
                // Use the Y position of the first trade location instead
                const tradeY = gameScene.tradeLocations[0].y;
                console.log('Trade Scene Debug - Trade location Y:', tradeY);
                
                // Adjust groundY to be at the trade location rather than platform top
                groundY = tradeY - 100; // Position UI above the trade location
            }
        } else {
            console.log('Trade Scene Debug - No platforms found in GameScene');
        }
        
        console.log('Trade Scene Debug - Final groundY:', groundY);
        console.log('Trade Scene Debug - Screen height:', height);
        
        // Position UI relative to the ground level rather than screen center
        // Calculate a good position that doesn't go off screen
        const uiHeight = height * 0.7; // Reduce height to 70% of screen
        const uiY = Math.max(100, Math.min(groundY - (uiHeight / 2), height * 0.6)); // Keep UI in top 60% of screen
        
        console.log('Trade Scene Debug - UI position Y:', uiY);
        console.log('Trade Scene Debug - UI height:', uiHeight);
        
        // Create semi-transparent background aligned with ground
        this.background = this.add.rectangle(
            width / 2,
            uiY + (uiHeight / 2), // Center vertically at calculated position
            width * 0.8, 
            uiHeight, 
            0x000000, 
            0.8
        );
        
        // Add a visual indicator to show where the ground level is (for debugging)
        const groundIndicator = this.add.rectangle(
            width / 2,
            groundY,
            width * 0.9,
            4,
            0xff0000,
            1
        );
        groundIndicator.setDepth(1000); // Ensure it's visible on top
        
        // Add text label
        this.add.text(
            width / 2, 
            groundY - 10, 
            platformsExist ? 'Ground Level' : 'Estimated Ground',
            { fontSize: '12px', color: '#ff0000' }
        ).setOrigin(0.5, 1).setDepth(1000);
        
        // Position UI elements relative to the background
        const bgBounds = this.background.getBounds();
        
        // Create trader dialogue
        this.dialogueText = this.add.text(
            bgBounds.centerX, 
            bgBounds.top + 50, 
            'Hello, what would you like to buy today?', 
            {
                fontSize: '20px',
                color: '#ffffff',
                align: 'center'
            }
        ).setOrigin(0.5);
        
        // Create close button
        this.closeButton = this.add.text(
            bgBounds.right - 20, 
            bgBounds.top + 20, 
            'X', 
            {
                fontSize: '28px',
                color: '#ff0000',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);
        this.closeButton.setInteractive({ useHandCursor: true });
        this.closeButton.on('pointerdown', this.closeTradeScene, this);
        
        // Create coin display - show player's current balance
        const coinText = this.player ? `Coins: ${this.player.getCoins()}` : 'Coins: 0';
        this.coinDisplay = this.add.text(
            bgBounds.left + 40, 
            bgBounds.top + 50, 
            coinText, 
            {
                fontSize: '18px',
                color: '#ffff00'
            }
        ).setOrigin(0, 0.5);
        
        // Create item description area
        this.descriptionText = this.add.text(
            bgBounds.left + 40, 
            bgBounds.bottom - 100, 
            '', 
            {
                fontSize: '16px',
                color: '#cccccc',
                wordWrap: { width: bgBounds.width - 80 }
            }
        );
        
        // Create buy button (initially hidden)
        this.buyButton = this.add.text(
            bgBounds.centerX, 
            bgBounds.bottom - 40, 
            'Buy Item', 
            {
                fontSize: '20px',
                color: '#ffffff',
                backgroundColor: '#446644',
                padding: { left: 15, right: 15, top: 8, bottom: 8 }
            }
        ).setOrigin(0.5);
        this.buyButton.setInteractive({ useHandCursor: true });
        this.buyButton.on('pointerdown', this.buySelectedItem, this);
        this.buyButton.setVisible(false);
        
        // Load and display items for sale
        this.loadItemsForSale(bgBounds);
        
        // Setup keyboard input for closing the trade scene
        this.input.keyboard?.on('keydown-ESC', this.closeTradeScene, this);
        
        // Pause the game scene
        if (gameScene.scene.isActive()) {
            gameScene.scene.pause();
        }
    }
    
    loadItemsForSale(bgBounds?: Phaser.Geom.Rectangle): void {
        // Get all items from inventory manager
        const inventoryManager = InventoryManager.getInstance();
        const allItems = inventoryManager.getAllItems();
        
        // Filter to only tradeable items
        const tradeableItems = allItems.filter(item => item.tradeable);
        
        // Use background bounds if provided, otherwise calculate from screen dimensions
        let listX, listY, width, height;
        if (bgBounds) {
            listX = bgBounds.left + 40;
            listY = bgBounds.top + 100;
            width = bgBounds.width;
            height = bgBounds.height;
        } else {
            width = this.sys.game.config.width as number;
            height = this.sys.game.config.height as number;
            listX = width * 0.2;
            listY = height * 0.3;
        }
        
        const itemSpacing = 35;
        
        // Create item buttons
        tradeableItems.forEach((item, index) => {
            const itemButton = this.add.text(
                listX, 
                listY + (index * itemSpacing), 
                `${item.name} - ${item.price} coins`, 
                {
                    fontSize: '18px',
                    color: '#ffffff',
                    backgroundColor: '#333333',
                    padding: { left: 10, right: 10, top: 5, bottom: 5 }
                }
            );
            
            // Make item selectable
            itemButton.setInteractive({ useHandCursor: true });
            itemButton.on('pointerdown', () => this.selectItem(item), this);
            itemButton.on('pointerover', () => itemButton.setBackgroundColor('#555555'));
            itemButton.on('pointerout', () => itemButton.setBackgroundColor('#333333'));
            
            this.itemButtons.push(itemButton);
        });
        
        if (tradeableItems.length === 0) {
            const messageX = bgBounds ? bgBounds.centerX : width / 2;
            const messageY = bgBounds ? bgBounds.centerY - 50 : height * 0.4;
            
            this.add.text(messageX, messageY, 'No items available for sale', {
                fontSize: '18px',
                color: '#999999'
            }).setOrigin(0.5);
        }
    }
    
    selectItem(item: Item): void {
        // Clear previous selection highlight
        this.itemButtons.forEach(button => {
            button.setBackgroundColor('#333333');
        });
        
        // Set new selection
        this.selectedItem = item;
        
        // Find and highlight the selected item button
        const selectedButton = this.itemButtons.find(
            button => button.text.includes(item.name)
        );
        if (selectedButton) {
            selectedButton.setBackgroundColor('#665500');
        }
        
        // Update description text
        let description = `${item.name}\n\n${item.description}\n\nPrice: ${item.price} coins`;
        
        // Add additional information based on item type
        if (item.type === 'weapon') {
            description += `\nDamage: ${item.damage}`;
        } else if (item.type === 'health') {
            description += `\nHealth restored: ${item.health}`;
        }
        
        this.descriptionText.setText(description);
        
        // Show buy button
        this.buyButton.setVisible(true);
        
        // Check if player can afford this item
        if (this.player && this.player.getCoins() < item.price) {
            this.buyButton.setBackgroundColor('#664444');
            this.buyButton.setText('Not enough coins');
            this.buyButton.disableInteractive();
        } else {
            this.buyButton.setBackgroundColor('#446644');
            this.buyButton.setText('Buy Item');
            this.buyButton.setInteractive({ useHandCursor: true });
        }
    }
    
    buySelectedItem(): void {
        if (!this.player || !this.selectedItem) return;
        
        // Check if player has enough coins
        if (this.player.getCoins() < this.selectedItem.price) {
            // Visual feedback for not enough coins
            this.showStatusMessage('Not enough coins!', '#ff0000');
            return;
        }
        
        // Process purchase
        const success = this.player.removeCoins(this.selectedItem.price);
        
        if (success) {
            // Add item to player's inventory
            this.player.addItem(this.selectedItem.id, 1);
            
            // Update coin display
            this.coinDisplay.setText(`Coins: ${this.player.getCoins()}`);
            
            // Show success message
            this.showStatusMessage(`Purchased ${this.selectedItem.name}!`, '#00ff00');
            
            // Update buy button state for newly selected item (may no longer be affordable)
            this.selectItem(this.selectedItem);
        }
    }
    
    showStatusMessage(message: string, color: string): void {
        // Get background bounds if it exists
        const bgBounds = this.background ? this.background.getBounds() : null;
        
        // Position status message based on background bounds or screen center
        const x = bgBounds ? bgBounds.centerX : (this.sys.game.config.width as number) / 2;
        const y = bgBounds ? bgBounds.centerY : (this.sys.game.config.height as number) * 0.6;
        
        const statusText = this.add.text(
            x,
            y,
            message,
            {
                fontSize: '20px',
                color: color,
                backgroundColor: '#000000',
                padding: { left: 10, right: 10, top: 5, bottom: 5 }
            }
        ).setOrigin(0.5);
        
        // Remove after 1.5 seconds
        this.time.delayedCall(1500, () => {
            statusText.destroy();
        });
    }
    
    closeTradeScene(): void {
        // Resume game scene
        const gameScene = this.scene.get('GameScene');
        if (gameScene.scene.isPaused()) {
            gameScene.scene.resume();
        }
        
        // If trader exists, mark trading as completed
        if (this.trader) {
            this.trader.endTrading();
        }
        
        // Close trade scene
        this.scene.stop();
    }
}