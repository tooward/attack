import Phaser from 'phaser';
import { InputAction } from '../../core/interfaces/types';

export class ActionButton extends Phaser.GameObjects.Container {
  private button: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private isPressed: boolean = false;
  private action: InputAction;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    action: InputAction,
    label: string,
    color: number = 0xe74c3c
  ) {
    super(scene, x, y);
    this.action = action;

    // Draw circular button (larger for easier touch)
    this.button = scene.add.graphics();
    this.button.fillStyle(color, 0.7);
    this.button.fillCircle(0, 0, 45); // Increased from 35
    this.add(this.button);

    // Add label text
    this.label = scene.add.text(0, 0, label, {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    });
    this.label.setOrigin(0.5);
    this.add(this.label);

    // Make interactive (larger hit area)
    this.setSize(90, 90); // Increased from 70
    this.setInteractive(
      new Phaser.Geom.Circle(0, 0, 45), // Increased from 35
      Phaser.Geom.Circle.Contains
    );

    this.setupInputHandlers();
  }

  private setupInputHandlers() {
    // Use scene-level input like D-pad to avoid container input issues
    const checkHit = (pointer: Phaser.Input.Pointer): boolean => {
      const dx = pointer.x - this.x;
      const dy = pointer.y - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance <= 45;
    };
    
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (checkHit(pointer)) {
        this.setPressed(true);
      }
    });

    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.isPressed) {
        this.setPressed(false);
      }
    });

    // Handle pointer leaving while pressed
    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isPressed && !pointer.isDown) {
        this.setPressed(false);
      }
    });
  }

  private setPressed(pressed: boolean) {
    this.isPressed = pressed;

    // Visual feedback
    this.button.clear();
    if (pressed) {
      this.button.fillStyle(0xff6b6b, 1.0);
      this.button.fillCircle(0, 0, 48); // Slightly larger when pressed
      this.triggerHaptic();
    } else {
      this.button.fillStyle(0xe74c3c, 0.7);
      this.button.fillCircle(0, 0, 45); // Normal size
    }

    // Emit event
    this.emit(pressed ? 'pressed' : 'released', this.action);
  }

  private async triggerHaptic() {
    try {
      // Check if Capacitor is available
      if ((window as any).Capacitor) {
        const { Haptics } = await import('@capacitor/haptics');
        await Haptics.impact({ style: 'light' });
      }
    } catch (e) {
      // Haptics not available (browser or not loaded)
    }
  }

  getAction(): InputAction {
    return this.action;
  }

  isPressedDown(): boolean {
    return this.isPressed;
  }
}
