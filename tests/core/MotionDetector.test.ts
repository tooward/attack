/**
 * MotionDetector Tests
 * Tests all motion input detection with edge cases and leniency
 */

import { MotionDetector, DirectionalInput, ButtonInput } from '../../src/core/input/MotionDetector';
import { MotionInputType, MotionButton } from '../../src/core/interfaces/types';

describe('MotionDetector', () => {
  let detector: MotionDetector;
  
  const createDirectionalInput = (up = false, down = false, left = false, right = false): DirectionalInput => ({
    up, down, left, right, timestamp: Date.now(),
  });

  const createButtonInput = (punch = false, kick = false): ButtonInput => ({
    punch, kick, timestamp: Date.now(),
  });

  beforeEach(() => {
    detector = new MotionDetector(true); // Facing right
  });

  describe('Quarter Circle Forward (QCF)', () => {
    it('should detect exact QCF pattern (Down → Down-Forward → Forward + Punch)', () => {
      // Down
      detector.addInput(createDirectionalInput(false, true, false, false), createButtonInput());
      // Down-Forward
      detector.addInput(createDirectionalInput(false, true, false, true), createButtonInput());
      // Forward + Punch
      detector.addInput(createDirectionalInput(false, false, false, true), createButtonInput(true));

      const motion = detector.detectMotion();
      expect(motion).not.toBeNull();
      expect(motion?.motionType).toBe(MotionInputType.QUARTER_CIRCLE_FORWARD);
      expect(motion?.button).toBe(MotionButton.PUNCH);
      expect(motion?.confidence).toBe(1.0);
    });

    it('should detect lenient QCF pattern (Down → Forward)', () => {
      // Down
      detector.addInput(createDirectionalInput(false, true, false, false), createButtonInput());
      // Forward + Punch
      detector.addInput(createDirectionalInput(false, false, false, true), createButtonInput(true));

      const motion = detector.detectMotion();
      expect(motion).not.toBeNull();
      expect(motion?.motionType).toBe(MotionInputType.QUARTER_CIRCLE_FORWARD);
      expect(motion?.confidence).toBe(0.7); // Lenient match
    });

    it('should detect QCF with neutral frames in between', () => {
      detector.addInput(createDirectionalInput(false, true, false, false), createButtonInput());
      detector.addInput(createDirectionalInput(false, false, false, false), createButtonInput()); // Neutral
      detector.addInput(createDirectionalInput(false, true, false, true), createButtonInput());
      detector.addInput(createDirectionalInput(false, false, false, false), createButtonInput()); // Neutral
      detector.addInput(createDirectionalInput(false, false, false, true), createButtonInput(true));

      const motion = detector.detectMotion();
      expect(motion).not.toBeNull();
      expect(motion?.motionType).toBe(MotionInputType.QUARTER_CIRCLE_FORWARD);
    });

    it('should NOT detect QCF when facing left (should be QCB)', () => {
      detector.setFacingRight(false);
      
      // Down → Right (which is forward when facing left is Down → Left)
      detector.addInput(createDirectionalInput(false, true, false, false), createButtonInput());
      detector.addInput(createDirectionalInput(false, false, false, true), createButtonInput(true));

      const motion = detector.detectMotion();
      // This should be detected as QCB since we're facing left
      expect(motion?.motionType).toBe(MotionInputType.QUARTER_CIRCLE_BACK);
    });

    it('should NOT detect QCF outside buffer window', () => {
      detector.addInput(createDirectionalInput(false, true, false, false), createButtonInput());
      
      // Wait 20 frames (outside 15-frame buffer)
      for (let i = 0; i < 20; i++) {
        detector.addInput(createDirectionalInput(false, false, false, false), createButtonInput());
      }
      
      detector.addInput(createDirectionalInput(false, false, false, true), createButtonInput(true));

      const motion = detector.detectMotion();
      expect(motion).toBeNull();
    });
  });

  describe('Quarter Circle Back (QCB)', () => {
    it('should detect exact QCB pattern', () => {
      detector.addInput(createDirectionalInput(false, true, false, false), createButtonInput());
      detector.addInput(createDirectionalInput(false, true, true, false), createButtonInput());
      detector.addInput(createDirectionalInput(false, false, true, false), createButtonInput(false, true));

      const motion = detector.detectMotion();
      expect(motion).not.toBeNull();
      expect(motion?.motionType).toBe(MotionInputType.QUARTER_CIRCLE_BACK);
      expect(motion?.button).toBe(MotionButton.KICK);
    });

    it('should detect lenient QCB pattern', () => {
      detector.addInput(createDirectionalInput(false, true, false, false), createButtonInput());
      detector.addInput(createDirectionalInput(false, false, true, false), createButtonInput(false, true));

      const motion = detector.detectMotion();
      expect(motion).not.toBeNull();
      expect(motion?.motionType).toBe(MotionInputType.QUARTER_CIRCLE_BACK);
    });
  });

  describe('Dragon Punch (DP)', () => {
    it('should detect exact DP pattern (Forward → Down → Down-Forward + Punch)', () => {
      detector.addInput(createDirectionalInput(false, false, false, true), createButtonInput());
      detector.addInput(createDirectionalInput(false, true, false, false), createButtonInput());
      detector.addInput(createDirectionalInput(false, true, false, true), createButtonInput(true));

      const motion = detector.detectMotion();
      expect(motion).not.toBeNull();
      expect(motion?.motionType).toBe(MotionInputType.DRAGON_PUNCH);
      expect(motion?.confidence).toBe(1.0);
    });

    it('should prioritize DP over QCF when both match', () => {
      // DP motion also contains QCF motion
      detector.addInput(createDirectionalInput(false, false, false, true), createButtonInput());
      detector.addInput(createDirectionalInput(false, true, false, false), createButtonInput());
      detector.addInput(createDirectionalInput(false, true, false, true), createButtonInput(true));

      const motion = detector.detectMotion();
      // DP has higher priority (checked first)
      expect(motion?.motionType).toBe(MotionInputType.DRAGON_PUNCH);
    });
  });

  describe('Charge Motions', () => {
    it('should detect charge back-forward', () => {
      // Hold back for 30+ frames
      for (let i = 0; i < 35; i++) {
        detector.addInput(createDirectionalInput(false, false, true, false), createButtonInput());
      }
      
      // Release forward + Punch (button must be on THIS frame)
      detector.addInput(createDirectionalInput(false, false, false, true), createButtonInput(true));

      const motion = detector.detectMotion();
      expect(motion).not.toBeNull();
      expect(motion?.motionType).toBe(MotionInputType.CHARGE_BACK_FORWARD);
      expect(motion?.confidence).toBe(1.0);
    });

    it('should NOT detect charge if held less than 30 frames', () => {
      // Hold back for only 20 frames
      for (let i = 0; i < 20; i++) {
        detector.addInput(createDirectionalInput(false, false, true, false), createButtonInput());
      }
      
      detector.addInput(createDirectionalInput(false, false, false, true), createButtonInput(true));

      const motion = detector.detectMotion();
      // Might detect QCB or nothing, but not charge move
      expect(motion?.motionType).not.toBe(MotionInputType.CHARGE_BACK_FORWARD);
    });

    it('should detect charge down-up', () => {
      // Hold down for 30+ frames
      for (let i = 0; i < 35; i++) {
        detector.addInput(createDirectionalInput(false, true, false, false), createButtonInput());
      }
      
      // Release up + Kick (button must be on THIS frame)
      detector.addInput(createDirectionalInput(true, false, false, false), createButtonInput(false, true));

      const motion = detector.detectMotion();
      expect(motion).not.toBeNull();
      expect(motion?.motionType).toBe(MotionInputType.CHARGE_DOWN_UP);
    });

    it('should maintain charge while in down-back', () => {
      // Hold down-back (charges both back and down)
      for (let i = 0; i < 35; i++) {
        detector.addInput(createDirectionalInput(false, true, true, false), createButtonInput());
      }
      
      // Release forward should trigger back-forward charge (button on THIS frame)
      detector.addInput(createDirectionalInput(false, false, false, true), createButtonInput(true));

      const motion = detector.detectMotion();
      expect(motion?.motionType).toBe(MotionInputType.CHARGE_BACK_FORWARD);
    });
  });

  describe('360° Motion', () => {
    it('should detect clockwise 360° motion', () => {
      // Clockwise: → ↘ ↓ ↙ ← ↖
      detector.addInput(createDirectionalInput(false, false, false, true), createButtonInput()); // →
      detector.addInput(createDirectionalInput(false, true, false, true), createButtonInput()); // ↘
      detector.addInput(createDirectionalInput(false, true, false, false), createButtonInput()); // ↓
      detector.addInput(createDirectionalInput(false, true, true, false), createButtonInput()); // ↙
      detector.addInput(createDirectionalInput(false, false, true, false), createButtonInput()); // ←
      detector.addInput(createDirectionalInput(true, false, true, false), createButtonInput(true)); // ↖ + Punch

      const motion = detector.detectMotion();
      expect(motion).not.toBeNull();
      expect(motion?.motionType).toBe(MotionInputType.FULL_CIRCLE);
    });

    it('should detect counter-clockwise 360° motion', () => {
      // Counter-clockwise: → ↗ ↑ ↖ ← ↙
      detector.addInput(createDirectionalInput(false, false, false, true), createButtonInput()); // →
      detector.addInput(createDirectionalInput(true, false, false, true), createButtonInput()); // ↗
      detector.addInput(createDirectionalInput(true, false, false, false), createButtonInput()); // ↑
      detector.addInput(createDirectionalInput(true, false, true, false), createButtonInput()); // ↖
      detector.addInput(createDirectionalInput(false, false, true, false), createButtonInput()); // ←
      detector.addInput(createDirectionalInput(false, true, true, false), createButtonInput(true)); // ↙ + Punch

      const motion = detector.detectMotion();
      expect(motion).not.toBeNull();
      expect(motion?.motionType).toBe(MotionInputType.FULL_CIRCLE);
    });

    it('should accept lenient 270° motion (6 of 8 directions)', () => {
      // Just 6 cardinal directions should work
      detector.addInput(createDirectionalInput(false, false, false, true), createButtonInput()); // →
      detector.addInput(createDirectionalInput(false, true, false, true), createButtonInput()); // ↘
      detector.addInput(createDirectionalInput(false, true, false, false), createButtonInput()); // ↓
      detector.addInput(createDirectionalInput(false, true, true, false), createButtonInput()); // ↙
      detector.addInput(createDirectionalInput(false, false, true, false), createButtonInput()); // ←
      detector.addInput(createDirectionalInput(true, false, true, false), createButtonInput(true)); // ↖ + Punch

      const motion = detector.detectMotion();
      expect(motion).not.toBeNull();
      expect(motion?.motionType).toBe(MotionInputType.FULL_CIRCLE);
      expect(motion?.confidence).toBe(0.8); // Lenient match
    });
  });

  describe('Double Tap (Dash)', () => {
    it('should detect double tap forward', () => {
      // Forward
      detector.addInput(createDirectionalInput(false, false, false, true), createButtonInput());
      // Neutral
      detector.addInput(createDirectionalInput(false, false, false, false), createButtonInput());
      // Forward + Punch
      detector.addInput(createDirectionalInput(false, false, false, true), createButtonInput(true));

      const motion = detector.detectMotion();
      expect(motion).not.toBeNull();
      expect(motion?.motionType).toBe(MotionInputType.DOUBLE_TAP_FORWARD);
    });

    it('should detect double tap back', () => {
      detector.addInput(createDirectionalInput(false, false, true, false), createButtonInput());
      detector.addInput(createDirectionalInput(false, false, false, false), createButtonInput());
      detector.addInput(createDirectionalInput(false, false, true, false), createButtonInput(false, true));

      const motion = detector.detectMotion();
      expect(motion).not.toBeNull();
      expect(motion?.motionType).toBe(MotionInputType.DOUBLE_TAP_BACK);
    });

    it('should NOT detect double tap outside buffer window', () => {
      detector.addInput(createDirectionalInput(false, false, false, true), createButtonInput());
      
      // Wait too long (15+ frames)
      for (let i = 0; i < 15; i++) {
        detector.addInput(createDirectionalInput(false, false, false, false), createButtonInput());
      }
      
      detector.addInput(createDirectionalInput(false, false, false, true), createButtonInput(true));

      const motion = detector.detectMotion();
      expect(motion?.motionType).not.toBe(MotionInputType.DOUBLE_TAP_FORWARD);
    });
  });

  describe('Motion Cooldown', () => {
    it('should prevent duplicate detection within cooldown period', () => {
      // First QCF
      detector.addInput(createDirectionalInput(false, true, false, false), createButtonInput());
      detector.addInput(createDirectionalInput(false, false, false, true), createButtonInput(true));
      
      const firstMotion = detector.detectMotion();
      expect(firstMotion?.motionType).toBe(MotionInputType.QUARTER_CIRCLE_FORWARD);

      // Immediately try another QCF (should be blocked by cooldown)
      // Need to release button first
      detector.addInput(createDirectionalInput(false, false, false, false), createButtonInput());
      detector.addInput(createDirectionalInput(false, true, false, false), createButtonInput());
      detector.addInput(createDirectionalInput(false, false, false, true), createButtonInput(true));
      
      const secondMotion = detector.detectMotion();
      expect(secondMotion).toBeNull();
    });

    it('should allow detection after cooldown expires', () => {
      // First QCF
      detector.addInput(createDirectionalInput(false, true, false, false), createButtonInput());
      detector.addInput(createDirectionalInput(false, false, false, true), createButtonInput(true));
      detector.detectMotion();

      // Wait for cooldown (15+ frames)
      for (let i = 0; i < 16; i++) {
        detector.addInput(createDirectionalInput(false, false, false, false), createButtonInput());
      }

      // Second QCF
      detector.addInput(createDirectionalInput(false, true, false, false), createButtonInput());
      detector.addInput(createDirectionalInput(false, false, false, true), createButtonInput(true));
      
      const secondMotion = detector.detectMotion();
      expect(secondMotion?.motionType).toBe(MotionInputType.QUARTER_CIRCLE_FORWARD);
    });

    it('should clear cooldowns when explicitly cleared', () => {
      detector.addInput(createDirectionalInput(false, true, false, false), createButtonInput());
      detector.addInput(createDirectionalInput(false, false, false, true), createButtonInput(true));
      detector.detectMotion();

      // Clear cooldowns (e.g., when move successfully executes)
      detector.clearCooldowns();

      // Should immediately allow another detection
      detector.addInput(createDirectionalInput(false, true, false, false), createButtonInput());
      detector.addInput(createDirectionalInput(false, false, false, true), createButtonInput(true));
      
      const motion = detector.detectMotion();
      expect(motion?.motionType).toBe(MotionInputType.QUARTER_CIRCLE_FORWARD);
    });
  });

  describe('Reset', () => {
    it('should clear all state when reset', () => {
      // Build up state
      for (let i = 0; i < 35; i++) {
        detector.addInput(createDirectionalInput(false, false, true, false), createButtonInput());
      }
      detector.addInput(createDirectionalInput(false, true, false, false), createButtonInput());
      detector.addInput(createDirectionalInput(false, false, false, true), createButtonInput(true));
      detector.detectMotion();

      // Reset
      detector.reset();

      // Try to detect with empty history
      detector.addInput(createDirectionalInput(false, false, false, true), createButtonInput(true));
      const motion = detector.detectMotion();
      
      // Should not detect anything with single input
      expect(motion).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid direction changes (piano inputs)', () => {
      // Simulate piano motion (rapid alternating inputs)
      detector.addInput(createDirectionalInput(false, true, false, false), createButtonInput());
      detector.addInput(createDirectionalInput(false, false, false, true), createButtonInput());
      detector.addInput(createDirectionalInput(false, true, false, false), createButtonInput());
      detector.addInput(createDirectionalInput(false, false, false, true), createButtonInput(true));

      // Should still detect QCF from the valid pattern
      const motion = detector.detectMotion();
      expect(motion?.motionType).toBe(MotionInputType.QUARTER_CIRCLE_FORWARD);
    });

    it('should NOT require button press for motion tracking', () => {
      // Build motion without button
      detector.addInput(createDirectionalInput(false, true, false, false), createButtonInput());
      detector.addInput(createDirectionalInput(false, true, false, true), createButtonInput());
      detector.addInput(createDirectionalInput(false, false, false, true), createButtonInput());
      
      // No button pressed yet - should not detect
      let motion = detector.detectMotion();
      expect(motion).toBeNull();

      // Now press button
      detector.addInput(createDirectionalInput(false, false, false, true), createButtonInput(true));
      
      // Should detect the motion
      motion = detector.detectMotion();
      expect(motion).not.toBeNull();
    });

    it('should handle simultaneous punch and kick press', () => {
      detector.addInput(createDirectionalInput(false, true, false, false), createButtonInput());
      detector.addInput(createDirectionalInput(false, false, false, true), createButtonInput(true, true));

      const motion = detector.detectMotion();
      expect(motion).not.toBeNull();
      // Should prioritize punch
      expect(motion?.button).toBe(MotionButton.PUNCH);
    });
  });
});
