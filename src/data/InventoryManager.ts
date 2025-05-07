import { Scene } from 'phaser';

export interface Item {
    id: string;
    name: string;
    type: 'weapon' | 'health' | 'valuable' | 'quest';
    tradeable: boolean;
    usable: boolean;
    damage?: number;
    health?: number;
    value?: number;
    description: string;
}

export interface InventoryItem extends Item {
    quantity: number;
}

export default class InventoryManager {
    private static instance: InventoryManager;
    private items: Map<string, Item>;
    
    private constructor() {
        this.items = new Map<string, Item>();
    }
    
    public static getInstance(): InventoryManager {
        if (!InventoryManager.instance) {
            InventoryManager.instance = new InventoryManager();
        }
        return InventoryManager.instance;
    }
    
    public async loadItems(scene: Scene): Promise<void> {
        try {
            const data = await scene.cache.json.get('items');
            if (data && data.items) {
                data.items.forEach((item: Item) => {
                    this.items.set(item.id, item);
                });
                console.log(`Loaded ${this.items.size} items`);
            } else {
                console.error('Invalid items.json structure');
            }
        } catch (error) {
            console.error('Failed to load items:', error);
        }
    }
    
    public getItem(id: string): Item | undefined {
        return this.items.get(id);
    }
    
    public getAllItems(): Item[] {
        return Array.from(this.items.values());
    }
    
    public isWeapon(item: Item): boolean {
        return item.type === 'weapon';
    }
    
    public isHealthItem(item: Item): boolean {
        return item.type === 'health';
    }
    
    public isValuable(item: Item): boolean {
        return item.type === 'valuable';
    }
    
    public isQuestItem(item: Item): boolean {
        return item.type === 'quest';
    }
}
