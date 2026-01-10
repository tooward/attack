import Phaser from 'phaser';
import { DPadControl } from './DPadControl';
import { ActionButton } from './ActionButton';
import { InputAction, InputFrame } from '../../core/interfaces/types';

export class TouchControlsOverlay extends Phaser.GameObjects.Container {
  private dpad: DPadControl;
  private actionButtons: Map<InputAction, ActionButton>;
  private activeInputs: Set<InputAction> = new Set();

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);

    const width = scene.cameras.main.width;
    const height = scene.cameras.main.height;

    // Make controls semi-transparent so game is visible
    this.setAlpha(0.7);

    // D-Pad (bottom left)
    this.dpad = new DPadControl(scene, 120, height - 120);
    this.add(this.dpad);

    // Action buttons (bottom right) - spread out more to avoid overlap
    this.actionButtons = new Map();
    const buttonLayout = [
      { action: InputAction.HEAVY_PUNCH, label: 'HP', x: -100, y: -100 },
      { action: InputAction.LIGHT_PUNCH, label: 'LP', x: -100, y: 10 },
      { action: InputAction.HEAVY_KICK, label: 'HK', x: 10, y: -50 },
      { action: InputAction.LIGHT_KICK, label: 'LK', x: 10, y: 60 }
    ];

    const baseX = width - 120;
    const baseY = height - 120;

    for (const btn of buttonLayout) {
      const button = new ActionButton(
        scene,
        baseX + btn.x,
        baseY + btn.y,
        btn.action,
        btn.label
      );
      this.actionButtons.set(btn.action, button);
      this.add(button);
    }

    // Block button (left side, middle height)
    const blockButton = new ActionButton(
      scene,
      120,
      height - 280,
      InputAction.BLOCK,
      '🛡',
      0x666666
    );
    this.actionButtons.set(InputAction.BLOCK, blockButton);
    this.add(blockButton);

    this.setupInputHandlers();
    this.setDepth(1000); // Always on top
  }

  private setupInputHandlers() {
    // D-Pad direction changes
    this.dpad.on('directionChange', (direction: string | null) => {
      // Clear all directional inputs
      this.activeInputs.delete(InputAction.LEFT);
      this.activeInputs.delete(InputAction.RIGHT);
      this.activeInputs.delete(InputAction.UP);
      this.activeInputs.delete(InputAction.DOWN);

      // Add new direction
      if (direction === 'left') this.activeInputs.add(InputAction.LEFT);
      if (direction === 'right') this.activeInputs.add(InputAction.RIGHT);
      if (direction === 'up') this.activeInputs.add(InputAction.UP);
      if (direction === 'down') this.activeInputs.add(InputAction.DOWN);
    });

    // Action button presses
    for (const [action, button] of this.actionButtons) {
      button.on('pressed', () => {
        this.activeInputs.add(action);
      });

      button.on('released', () => {
        this.activeInputs.delete(action);
      });
    }
  }

  getCurrentInput(): InputFrame {
    return {
      actions: new Set(this.activeInputs),
      timestamp: this.scene.game.loop.frame
    };
  }

  destroy() {
    this.activeInputs.clear();
    super.destroy();
  }
}
