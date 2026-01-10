import Phaser from 'phaser';

type Direction = 'up' | 'down' | 'left' | 'right' | null;

export class DPadControl extends Phaser.GameObjects.Container {
  private background: Phaser.GameObjects.Graphics;
  private directionGraphics: Map<string, Phaser.GameObjects.Graphics>;
  private activeDirection: Direction = null;
  private isPressed: boolean = false;
  private activePointerId: number = -1;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    console.log('[DPadControl] Creating D-pad at', x, y);

    // Background circle (more visible for debugging)
    this.background = scene.add.graphics();
    this.background.fillStyle(0x333333, 0.8); // More opaque
    this.background.fillCircle(0, 0, 60);
    this.background.lineStyle(3, 0x00ff00, 1); // Green border for visibility
    this.background.strokeCircle(0, 0, 60);
    this.add(this.background);

    // Directional segments
    this.directionGraphics = new Map();
    const directions = [
      { key: 'up', angle: -90 },
      { key: 'right', angle: 0 },
      { key: 'down', angle: 90 },
      { key: 'left', angle: 180 }
    ];

    for (const dir of directions) {
      const graphic = scene.add.graphics();
      graphic.fillStyle(0x4a90e2, 0.7);
      graphic.slice(
        0, 0, 50,
        Phaser.Math.DegToRad(dir.angle - 30),
        Phaser.Math.DegToRad(dir.angle + 30)
      );
      graphic.fillPath();
      graphic.setAlpha(0.3);
      this.directionGraphics.set(dir.key, graphic);
      this.add(graphic);
    }

    // Make interactive (larger hit area for testing)
    this.setSize(150, 150);
    this.setInteractive(
      new Phaser.Geom.Circle(0, 0, 75),
      Phaser.Geom.Circle.Contains
    );

    this.setupTouchHandlers();
  }

  private setupTouchHandlers() {
    // Use scene-level input and manually check if touch is within D-pad bounds
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const dx = pointer.x - this.x;
      const dy = pointer.y - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance <= 75) {
        this.isPressed = true;
        this.activePointerId = pointer.id;
        this.updateDirection(pointer);
      }
    });

    // Listen to scene-level pointermove to track any pointer
    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isPressed && pointer.id === this.activePointerId && pointer.isDown) {
        this.updateDirection(pointer);
      }
    });

    // Listen to scene-level pointerup for ANY pointer
    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.id === this.activePointerId) {
        this.isPressed = false;
        this.activePointerId = -1;
        this.setActiveDirection(null);
      }
    });
  }

  private updateDirection(pointer: Phaser.Input.Pointer) {
    const localX = pointer.x - this.x;
    const localY = pointer.y - this.y;
    const distance = Math.sqrt(localX * localX + localY * localY);

    if (distance > 60) {
      // Outside d-pad, clear direction
      this.setActiveDirection(null);
      return;
    }

    const angle = Phaser.Math.Angle.Between(0, 0, localX, localY);
    const degrees = Phaser.Math.RadToDeg(angle);

    let newDirection: Direction = null;
    if (degrees > -45 && degrees < 45) newDirection = 'right';
    else if (degrees >= 45 && degrees < 135) newDirection = 'down';
    else if (degrees >= 135 || degrees < -135) newDirection = 'left';
    else if (degrees >= -135 && degrees <= -45) newDirection = 'up';

    if (newDirection !== this.activeDirection) {
      this.setActiveDirection(newDirection);
    }
  }

  private setActiveDirection(direction: Direction) {
    // Reset all
    for (const graphic of this.directionGraphics.values()) {
      graphic.setAlpha(0.3);
    }

    // Highlight active
    if (direction && this.directionGraphics.has(direction)) {
      this.directionGraphics.get(direction)!.setAlpha(1.0);
    }

    this.activeDirection = direction;
    this.emit('directionChange', direction);
  }

  getActiveDirection(): Direction {
    return this.activeDirection;
  }
}
