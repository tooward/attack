/**
 * Input Handler for Phaser
 * Captures keyboard/gamepad input and converts to InputFrame for core engine
 */

import { InputFrame, InputAction } from '../core/interfaces/types';

export class InputHandler {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys: Map<string, Phaser.Input.Keyboard.Key>;

  constructor(scene: Phaser.Scene) {
    this.cursors = scene.input.keyboard!.createCursorKeys();
    
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
   * Capture current input state and convert to InputFrame
   */
  captureInput(timestamp: number): InputFrame {
    const actions = new Set<InputAction>();

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

    return {
      actions,
      timestamp,
    };
  }

  /**
   * Check if a key was just pressed this frame
   */
  isKeyJustPressed(key: string): boolean {
    return Phaser.Input.Keyboard.JustDown(this.keys.get(key)!);
  }

  /**
   * Destroy and clean up
   */
  destroy(): void {
    this.keys.clear();
  }
}
