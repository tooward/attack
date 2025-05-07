import { Scene, GameObjects } from 'phaser';
import { InventoryItem, Item } from '../data/InventoryManager';
import InventoryManager from '../data/InventoryManager';
import Player from '../entities/Player';

export default class InventoryScene extends Scene {
    private player: Player | null = null;
    private background!: GameObjects.Rectangle;
    private itemList: GameObjects.Text[] = [];
    private descriptionText!: GameObjects.Text;
    private actionButtons: GameObjects.Text[] = [];
    private selectedItemIndex: number = -1;
    private selectedItem: InventoryItem | null = null;
    private equippedLabel!: GameObjects.Text;
    private closeButton!: GameObjects.Text;
    
    constructor() {
        super({ key: 'InventoryScene' });
    }
    
    init(data: { player: Player }): void {
        this.player = data.player;
    }
    
    create(): void {
        // Get game dimensions
        const width = this.sys.game.config.width as number;
        const height = this.sys.game.config.height as number;
        
        // Create semi-transparent background
        this.background = this.add.rectangle(width / 2, height / 2, width * 0.8, height * 0.8, 0x000000, 0.8);
        
        // Create header
        const headerText = this.add.text(width / 2, height * 0.15, 'INVENTORY', {
            fontSize: '32px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        // Create close button
        this.closeButton = this.add.text(width * 0.85, height * 0.15, 'X', {
            fontSize: '28px',
            color: '#ff0000',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.closeButton.setInteractive({ useHandCursor: true });
        this.closeButton.on('pointerdown', this.closeInventory, this);
        
        // Create "Equipped:" label
        this.equippedLabel = this.add.text(width * 0.2, height * 0.2, 'Equipped: None', {
            fontSize: '18px',
            color: '#ffff00'
        }).setOrigin(0, 0.5);
        
        // Update equipped label if player has a weapon equipped
        this.updateEquippedLabel();
        
        // Create item list container
        const listX = width * 0.2;
        const listY = height * 0.25;
        const listHeight = height * 0.4;
        const itemSpacing = 30;
        
        // Check if player exists and has inventory
        if (this.player) {
            const inventory = this.player.getInventory();
            
            // Create item list
            inventory.forEach((item, index) => {
                const itemText = this.add.text(listX, listY + (index * itemSpacing), 
                    `${item.name} (${item.quantity})`, {
                    fontSize: '18px',
                    color: '#ffffff'
                });
                
                // Make item selectable
                itemText.setInteractive({ useHandCursor: true });
                itemText.on('pointerdown', () => this.selectItem(index), this);
                
                this.itemList.push(itemText);
            });
            
            if (inventory.length === 0) {
                this.add.text(width / 2, height * 0.4, 'Inventory is empty', {
                    fontSize: '18px',
                    color: '#999999'
                }).setOrigin(0.5);
            }
        }
        
        // Description area
        this.descriptionText = this.add.text(width * 0.2, height * 0.7, '', {
            fontSize: '16px',
            color: '#cccccc',
            wordWrap: { width: width * 0.6 }
        });
        
        // Action buttons - these will be created when an item is selected
        
        // Set up keyboard input for closing inventory
        this.input.keyboard?.on('keydown-ESC', this.closeInventory, this);
        
        // Pause the main game scene
        const gameScene = this.scene.get('GameScene');
        if (gameScene.scene.isActive()) {
            gameScene.scene.pause();
        }
    }
    
    selectItem(index: number): void {
        // Clear previous selection highlight
        this.itemList.forEach(text => {
            text.setColor('#ffffff');
        });
        
        // Clear previous action buttons
        this.actionButtons.forEach(button => {
            button.destroy();
        });
        this.actionButtons = [];
        
        // Set new selection
        this.selectedItemIndex = index;
        if (index >= 0 && index < this.itemList.length && this.player) {
            const inventory = this.player.getInventory();
            this.selectedItem = inventory[index];
            
            // Highlight selected item
            this.itemList[index].setColor('#ffff00');
            
            // Update description
            this.descriptionText.setText(this.selectedItem.description || 'No description available.');
            
            // Create action buttons based on item type
            this.createActionButtons();
        } else {
            this.selectedItem = null;
            this.descriptionText.setText('');
        }
    }
    
    createActionButtons(): void {
        if (!this.selectedItem || !this.player) return;
        
        const width = this.sys.game.config.width as number;
        const height = this.sys.game.config.height as number;
        const buttonY = height * 0.8;
        const buttonSpacing = 120;
        let buttonX = width * 0.2;
        const inventoryManager = InventoryManager.getInstance();
        
        // Determine available actions based on item type
        const actions: { text: string, callback: () => void }[] = [];
        
        // All items can be dropped
        actions.push({
            text: 'Drop',
            callback: () => this.dropItem()
        });
        
        // Weapons can be equipped
        if (inventoryManager.isWeapon(this.selectedItem) && 
            (!this.player.getEquippedWeapon() || 
            this.player.getEquippedWeapon()?.id !== this.selectedItem.id)) {
            actions.push({
                text: 'Equip',
                callback: () => this.equipItem()
            });
        } else if (inventoryManager.isWeapon(this.selectedItem) && 
            this.player.getEquippedWeapon()?.id === this.selectedItem.id) {
            actions.push({
                text: 'Unequip',
                callback: () => this.unequipItem()
            });
        }
        
        // Usable items can be used
        if (this.selectedItem.usable) {
            actions.push({
                text: 'Use',
                callback: () => this.useItem()
            });
        }
        
        // Create buttons for actions
        actions.forEach((action, index) => {
            const button = this.add.text(buttonX + (index * buttonSpacing), buttonY, action.text, {
                fontSize: '18px',
                color: '#ffffff',
                backgroundColor: '#444444',
                padding: { left: 10, right: 10, top: 5, bottom: 5 }
            });
            
            button.setInteractive({ useHandCursor: true });
            button.on('pointerdown', action.callback, this);
            button.on('pointerover', () => button.setBackgroundColor('#666666'));
            button.on('pointerout', () => button.setBackgroundColor('#444444'));
            
            this.actionButtons.push(button);
        });
    }
    
    dropItem(): void {
        if (!this.selectedItem || !this.player) return;
        
        // Ask for quantity if more than 1
        let quantityToDrop = 1;
        if (this.selectedItem.quantity > 1) {
            // In a real implementation, we'd show a dialog here
            // For now, just drop 1
            quantityToDrop = 1;
        }
        
        // Remove the item from inventory
        const success = this.player.removeItem(this.selectedItem.id, quantityToDrop);
        
        if (success) {
            // Refresh inventory display
            this.refreshInventoryDisplay();
        }
    }
    
    equipItem(): void {
        if (!this.selectedItem || !this.player) return;
        
        const success = this.player.equipWeapon(this.selectedItem.id);
        
        if (success) {
            this.updateEquippedLabel();
            // Refresh the action buttons to show Unequip instead of Equip
            this.selectItem(this.selectedItemIndex);
        }
    }
    
    unequipItem(): void {
        if (!this.player || !this.player.getEquippedWeapon()) return;
        
        // Set equipped weapon to null
        this.player.equippedWeapon = null;
        
        // Update UI
        this.updateEquippedLabel();
        this.selectItem(this.selectedItemIndex);
    }
    
    useItem(): void {
        if (!this.selectedItem || !this.player) return;
        
        const success = this.player.useItem(this.selectedItem.id);
        
        if (success) {
            // Refresh inventory display since item may have been consumed
            this.refreshInventoryDisplay();
        }
    }
    
    updateEquippedLabel(): void {
        if (!this.player) return;
        
        const equippedWeapon = this.player.getEquippedWeapon();
        this.equippedLabel.setText(equippedWeapon ? 
            `Equipped: ${equippedWeapon.name}` : 
            'Equipped: None');
    }
    
    refreshInventoryDisplay(): void {
        // Clear current item list
        this.itemList.forEach(text => {
            text.destroy();
        });
        this.itemList = [];
        
        // Clear selection
        this.selectedItemIndex = -1;
        this.selectedItem = null;
        this.descriptionText.setText('');
        
        // Clear action buttons
        this.actionButtons.forEach(button => {
            button.destroy();
        });
        this.actionButtons = [];
        
        // Recreate the scene
        this.scene.restart({ player: this.player });
    }
    
    closeInventory(): void {
        // Resume game scene
        const gameScene = this.scene.get('GameScene');
        if (gameScene.scene.isPaused()) {
            gameScene.scene.resume();
        }
        
        // Close inventory scene
        this.scene.stop();
    }
}
