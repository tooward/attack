/**
 * InputHandler Integration Tests
 * Tests that InputHandler properly integrates with MotionDetector
 */

import Phaser from 'phaser';
import { InputHandler } from '../../src/phaser/InputHandler';
import { InputAction, MotionInputType } from '../../src/core/interfaces/types';

// Mock Phaser Scene
class MockScene {
  input = {
    keyboard: {
      createCursorKeys: () => ({
        up: { isDown: false },
        down: { isDown: false },
        left: { isDown: false },
        right: { isDown: false },
      }),
      addKey: () => ({ isDown: false }),
    },
  };
}

describe('InputHandler Integration', () => {
  let handler: InputHandler;
  let mockScene: any;
  let mockCursors: any;
  let mockKeys: Map<string, any>;

  beforeEach(() => {
    mockScene = new MockScene();
    mockCursors = mockScene.input.keyboard.createCursorKeys();
    mockKeys = new Map([
      ['Z', { isDown: false }],
      ['X', { isDown: false }],
      ['C', { isDown: false }],
      ['V', { isDown: false }],
      ['SPACE', { isDown: false }],
    ]);

    // Mock the keyboard setup
    mockScene.input.keyboard.createCursorKeys = () => mockCursors;
    mockScene.input.keyboard.addKey = (key: string) => {
      const mockKey = { isDown: false };
      mockKeys.set(key, mockKey);
      return mockKey;
    };

    handler = new InputHandler(mockScene as any, true);
  });

  afterEach(() => {
    handler.destroy();
  });

  it('should create InputHandler with motion detector', () => {
    expect(handler).toBeDefined();
  });

  it('should capture basic directional input', () => {
    mockCursors.right.isDown = true;
    
    const input = handler.captureInput(0);
    
    expect(input.actions.has(InputAction.RIGHT)).toBe(true);
    expect(input.detectedMotion).toBeUndefined(); // No motion without button press
  });

  it('should capture button input', () => {
    mockKeys.get('Z')!.isDown = true;
    
    const input = handler.captureInput(0);
    
    expect(input.actions.has(InputAction.LIGHT_PUNCH)).toBe(true);
  });

  it('should detect QCF motion (Down → Forward + Punch)', () => {
    // Simulate QCF motion over multiple frames
    // Frame 0: Down
    mockCursors.down.isDown = true;
    handler.captureInput(0);
    mockCursors.down.isDown = false;

    // Frame 1: Forward + Punch
    mockCursors.right.isDown = true;
    mockKeys.get('Z')!.isDown = true;
    const input = handler.captureInput(1);

    expect(input.actions.has(InputAction.SPECIAL_MOVE)).toBe(true);
    expect(input.detectedMotion).toBeDefined();
    expect(input.detectedMotion?.motionType).toBe(MotionInputType.QUARTER_CIRCLE_FORWARD);
    expect(input.detectedMotion?.button).toBe('punch');
  });

  it('should update facing direction correctly', () => {
    // Start facing right
    mockCursors.down.isDown = true;
    handler.captureInput(0);
    mockCursors.down.isDown = false;
    
    mockCursors.right.isDown = true;
    mockKeys.get('Z')!.isDown = true;
    const rightInput = handler.captureInput(1);
    
    // Should detect QCF (Down → Right)
    expect(rightInput.detectedMotion?.motionType).toBe(MotionInputType.QUARTER_CIRCLE_FORWARD);
    
    // Reset
    handler.resetMotionDetector();
    mockCursors.right.isDown = false;
    mockKeys.get('Z')!.isDown = false;
    
    // Change to facing left
    handler.setFacingRight(false);
    
    // Now QCF should be Down → Left
    mockCursors.down.isDown = true;
    handler.captureInput(2);
    mockCursors.down.isDown = false;
    
    mockCursors.left.isDown = true;
    mockKeys.get('Z')!.isDown = true;
    const leftInput = handler.captureInput(3);
    
    expect(leftInput.detectedMotion?.motionType).toBe(MotionInputType.QUARTER_CIRCLE_FORWARD);
  });

  it('should detect charge motions (Back hold → Forward)', () => {
    // Hold back for 35 frames
    mockCursors.left.isDown = true;
    for (let i = 0; i < 35; i++) {
      handler.captureInput(i);
    }
    mockCursors.left.isDown = false;

    // Release forward + punch
    mockCursors.right.isDown = true;
    mockKeys.get('Z')!.isDown = true;
    const input = handler.captureInput(35);

    expect(input.actions.has(InputAction.SPECIAL_MOVE)).toBe(true);
    expect(input.detectedMotion?.motionType).toBe(MotionInputType.CHARGE_BACK_FORWARD);
  });

  it('should reset motion detector on round reset', () => {
    // Build up some motion history
    mockCursors.down.isDown = true;
    handler.captureInput(0);
    mockCursors.right.isDown = true;
    handler.captureInput(1);

    // Reset
    handler.resetMotionDetector();

    // Should have clean slate
    mockCursors.right.isDown = true;
    mockKeys.get('Z')!.isDown = true;
    const input = handler.captureInput(2);

    // Should not detect motion with empty history
    expect(input.detectedMotion).toBeUndefined();
  });

  it('should handle both punch and kick buttons', () => {
    // QCF with kick
    mockCursors.down.isDown = true;
    handler.captureInput(0);
    mockCursors.down.isDown = false;

    mockCursors.right.isDown = true;
    mockKeys.get('C')!.isDown = true; // Light kick
    const input = handler.captureInput(1);

    expect(input.detectedMotion?.button).toBe('kick');
  });

  it('should prioritize punch over kick when both pressed', () => {
    mockCursors.down.isDown = true;
    handler.captureInput(0);
    mockCursors.down.isDown = false;

    mockCursors.right.isDown = true;
    mockKeys.get('Z')!.isDown = true; // Light punch
    mockKeys.get('C')!.isDown = true; // Light kick
    const input = handler.captureInput(1);

    // Should prioritize punch
    expect(input.detectedMotion?.button).toBe('punch');
  });

  it('should clear cooldowns after successful detection', () => {
    // First QCF
    mockCursors.down.isDown = true;
    handler.captureInput(0);
    mockCursors.down.isDown = false;

    mockCursors.right.isDown = true;
    mockKeys.get('Z')!.isDown = true;
    const firstInput = handler.captureInput(1);
    expect(firstInput.detectedMotion).toBeDefined();

    // Cooldowns should be cleared after detection
    // So another QCF should work immediately
    mockCursors.right.isDown = false;
    mockKeys.get('Z')!.isDown = false;

    mockCursors.down.isDown = true;
    handler.captureInput(2);
    mockCursors.down.isDown = false;

    mockCursors.right.isDown = true;
    mockKeys.get('Z')!.isDown = true;
    const secondInput = handler.captureInput(3);

    // Should detect again (cooldowns were cleared)
    expect(secondInput.detectedMotion).toBeDefined();
  });
});
