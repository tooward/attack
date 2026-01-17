/**
 * Input Handler for Phaser
 * Captures keyboard/gamepad input and converts to InputFrame for core engine
 * Includes motion input detection for special moves
 */

import { InputFrame, InputAction } from '../core/interfaces/types';
import { MotionDetector, DirectionalInput, ButtonInput } from '../core/input/MotionDetector';

export class InputHandler {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys: Map<string, Phaser.Input.Keyboard.Key>;
  private motionDetector: MotionDetector;
  private facingRight: boolean = true;

  constructor(scene: Phaser.Scene, facingRight: boolean = true) {
    this.cursors = scene.input.keyboard!.createCursorKeys();
    this.facingRight = facingRight;
    this.motionDetector = new MotionDetector(facingRight);
    
    // Combat buttons
    this.keys = new Map([
      ['Z', scene.input.keyboard!.addKey('Z')],  // Light punch
      ['X', scene.input.keyboard!.addKey('X')],  // Heavy punch
      ['C', scene.input.keyboard!.addKey('C')],  // Light kick
      ['V', scene.input.keyboard!.addKey('V')],  // Heavy kick
      ['SPACE', scene.input.keyboard!.addKey('SPACE')], // Block
    ]);
  }

  /**
   * Update facing direction for motion detection
   */
  setFacingRight(facingRight: boolean): void {
    this.facingRight = facingRight;
    this.motionDetector.setFacingRight(facingRight);
  }

  /**
   * Capture current input state and convert to InputFrame
   * Also detects special move motions
   */
  captureInput(timestamp: number): InputFrame {
    const actions = new Set<InputAction>();

    // Capture directional inputs for motion detection
    const directionalInput: DirectionalInput = {
      up: this.cursors.up?.isDown || false,
      down: this.cursors.down?.isDown || false,
      left: this.cursors.left?.isDown || false,
      right: this.cursors.right?.isDown || false,
      timestamp,
    };

    // Capture button inputs for motion detection
    const buttonInput: ButtonInput = {
      punch: this.keys.get('Z')?.isDown || this.keys.get('X')?.isDown || false,
      kick: this.keys.get('C')?.isDown || this.keys.get('V')?.isDown || false,
      timestamp,
    };

    // Feed inputs to motion detector
    this.motionDetector.addInput(directionalInput, buttonInput);

    // Check for special move detection
    const detectedMotion = this.motionDetector.detectMotion();

    // Directional inputs
    if (this.cursors.left?.isDown) {
      actions.add(InputAction.LEFT);
    }
    if (this.cursors.right?.isDown) {
      actions.add(InputAction.RIGHT);
    }
    if (this.cursors.up?.isDown) {
      actions.add(InputAction.UP);
    }
    if (this.cursors.down?.isDown) {
      actions.add(InputAction.DOWN);
    }

    // Attack buttons
    if (this.keys.get('Z')?.isDown) {
      actions.add(InputAction.LIGHT_PUNCH);
    }
    if (this.keys.get('X')?.isDown) {
      actions.add(InputAction.HEAVY_PUNCH);
    }
    if (this.keys.get('C')?.isDown) {
      actions.add(InputAction.LIGHT_KICK);
    }
    if (this.keys.get('V')?.isDown) {
      actions.add(InputAction.HEAVY_KICK);
    }
    if (this.keys.get('SPACE')?.isDown) {
      actions.add(InputAction.BLOCK);
    }

    // Add special move action if motion detected
    if (detectedMotion) {
      actions.add(InputAction.SPECIAL_MOVE);
    }

    const inputFrame: InputFrame = {
      actions,
      timestamp,
    };

    // Attach detected motion details if present
    if (detectedMotion) {
      inputFrame.detectedMotion = {
        motionType: detectedMotion.motionType,
        button: detectedMotion.button,
        confidence: detectedMotion.confidence,
      };

      // Clear cooldowns after successful detection to allow next move
      this.motionDetector.clearCooldowns();
    }

    return inputFrame;
  }

  /**
   * Check if a key was just pressed this frame
   */
  isKeyJustPressed(key: string): boolean {
    return Phaser.Input.Keyboard.JustDown(this.keys.get(key)!);
  }

  /**
   * Reset motion detector state (call on round reset)
   */
  resetMotionDetector(): void {
    this.motionDetector.reset();
  }

  /**
   * Destroy and clean up
   */
  destroy(): void {
    this.keys.clear();
    this.motionDetector.reset();
  }
}
