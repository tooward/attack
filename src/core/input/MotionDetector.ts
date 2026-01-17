/**
 * MotionDetector - Detects fighting game motion inputs
 * 
 * Tracks input history and matches against motion patterns like:
 * - Quarter circles (QCF, QCB)
 * - Dragon Punch (DP)
 * - Charge moves
 * - 360° motions
 * - Double taps
 * 
 * Implements mobile-friendly leniency:
 * - Accepts simplified patterns (e.g., Down→Forward for QCF)
 * - Generous buffer windows (10-20 frames)
 * - Lenient directional matching
 */

import { MotionInputType, MotionButton } from '../interfaces/types';

export interface DirectionalInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  timestamp: number;
}

export interface ButtonInput {
  punch: boolean;
  kick: boolean;
  timestamp: number;
}

export interface DetectedMotion {
  motionType: MotionInputType;
  button: MotionButton;
  timestamp: number;
  confidence: number; // 0-1, higher for more exact matches
}

interface ChargeState {
  direction: 'back' | 'down';
  startFrame: number;
  duration: number;
}

/**
 * Direction constants for internal tracking
 */
enum Direction {
  NEUTRAL = 0,
  UP = 1,
  UP_RIGHT = 2,
  RIGHT = 3,
  DOWN_RIGHT = 4,
  DOWN = 5,
  DOWN_LEFT = 6,
  LEFT = 7,
  UP_LEFT = 8,
}

interface InputHistoryEntry {
  direction: Direction;
  buttons: ButtonInput;
  frame: number;
}

export class MotionDetector {
  private inputHistory: InputHistoryEntry[] = [];
  private readonly historySize = 60; // Track last 60 frames (1 second at 60fps)
  private currentFrame = 0;
  private facingRight = true;
  
  // Charge tracking
  private chargeState: ChargeState | null = null;
  
  // Buffer for detected motions (prevents duplicate detections)
  private lastDetectedMotions: Map<string, number> = new Map();
  private readonly motionCooldown = 15; // Frames before same motion can be detected again

  constructor(facingRight: boolean = true) {
    this.facingRight = facingRight;
  }

  /**
   * Update facing direction (important for left/right relative motions)
   */
  setFacingRight(facingRight: boolean): void {
    this.facingRight = facingRight;
  }

  /**
   * Add new input to history and update charge tracking
   */
  addInput(directional: DirectionalInput, buttons: ButtonInput): void {
    const direction = this.directionalInputToDirection(directional);
    
    this.inputHistory.push({
      direction,
      buttons,
      frame: this.currentFrame,
    });

    // Trim history
    if (this.inputHistory.length > this.historySize) {
      this.inputHistory.shift();
    }

    // Update charge state
    this.updateChargeTracking(direction);

    this.currentFrame++;
  }

  /**
   * Check for any detected motion inputs
   * Returns most recent valid motion, or null
   */
  detectMotion(): DetectedMotion | null {
    const latestInput = this.inputHistory[this.inputHistory.length - 1];
    if (!latestInput) return null;

    // Only check when button is pressed
    if (!latestInput.buttons.punch && !latestInput.buttons.kick) {
      return null;
    }

    const button = latestInput.buttons.punch ? MotionButton.PUNCH : MotionButton.KICK;

    // Check motions in priority order (most specific first)
    // 1. 360° motion (highest priority, hardest input)
    const fullCircle = this.detectFullCircle();
    if (fullCircle) {
      if (!this.isMotionOnCooldown('360')) {
        this.setMotionCooldown('360');
        return { motionType: MotionInputType.FULL_CIRCLE, button, timestamp: this.currentFrame, confidence: fullCircle.confidence };
      }
    }

    // 2. Charge motions (check before simpler motions to prevent false dash detection)
    const chargeForward = this.detectChargeMotion('back');
    if (chargeForward) {
      if (!this.isMotionOnCooldown('charge_bf')) {
        this.setMotionCooldown('charge_bf');
        return { motionType: MotionInputType.CHARGE_BACK_FORWARD, button, timestamp: this.currentFrame, confidence: chargeForward.confidence };
      }
    }

    const chargeUp = this.detectChargeMotion('down');
    if (chargeUp) {
      if (!this.isMotionOnCooldown('charge_du')) {
        this.setMotionCooldown('charge_du');
        return { motionType: MotionInputType.CHARGE_DOWN_UP, button, timestamp: this.currentFrame, confidence: chargeUp.confidence };
      }
    }

    // 3. Dragon Punch (high priority anti-air)
    const dp = this.detectDragonPunch();
    if (dp) {
      if (!this.isMotionOnCooldown('dp')) {
        this.setMotionCooldown('dp');
        return { motionType: MotionInputType.DRAGON_PUNCH, button, timestamp: this.currentFrame, confidence: dp.confidence };
      }
    }

    // 4. Half circles
    const hcf = this.detectHalfCircleForward();
    if (hcf) {
      if (!this.isMotionOnCooldown('hcf')) {
        this.setMotionCooldown('hcf');
        return { motionType: MotionInputType.HALF_CIRCLE_FORWARD, button, timestamp: this.currentFrame, confidence: hcf.confidence };
      }
    }

    const hcb = this.detectHalfCircleBack();
    if (hcb) {
      if (!this.isMotionOnCooldown('hcb')) {
        this.setMotionCooldown('hcb');
        return { motionType: MotionInputType.HALF_CIRCLE_BACK, button, timestamp: this.currentFrame, confidence: hcb.confidence };
      }
    }

    // 5. Quarter circles
    const qcf = this.detectQuarterCircleForward();
    if (qcf) {
      if (!this.isMotionOnCooldown('qcf')) {
        this.setMotionCooldown('qcf');
        return { motionType: MotionInputType.QUARTER_CIRCLE_FORWARD, button, timestamp: this.currentFrame, confidence: qcf.confidence };
      }
      // Motion detected but on cooldown - don't check further to avoid detecting simpler motions
      return null;
    }

    const qcb = this.detectQuarterCircleBack();
    if (qcb) {
      if (!this.isMotionOnCooldown('qcb')) {
        this.setMotionCooldown('qcb');
        return { motionType: MotionInputType.QUARTER_CIRCLE_BACK, button, timestamp: this.currentFrame, confidence: qcb.confidence };
      }
      return null;
    }

    // 6. Double taps (dashes)
    const dashForward = this.detectDoubleTapForward();
    if (dashForward) {
      if (!this.isMotionOnCooldown('dash_f')) {
        this.setMotionCooldown('dash_f');
        return { motionType: MotionInputType.DOUBLE_TAP_FORWARD, button, timestamp: this.currentFrame, confidence: dashForward.confidence };
      }
    }

    const dashBack = this.detectDoubleTapBack();
    if (dashBack) {
      if (!this.isMotionOnCooldown('dash_b')) {
        this.setMotionCooldown('dash_b');
        return { motionType: MotionInputType.DOUBLE_TAP_BACK, button, timestamp: this.currentFrame, confidence: dashBack.confidence };
      }
    }

    return null;
  }

  /**
   * Clear detection cooldowns (call when motion is successfully executed)
   */
  clearCooldowns(): void {
    this.lastDetectedMotions.clear();
  }

  /**
   * Reset detector state (call on round reset, etc.)
   */
  reset(): void {
    this.inputHistory = [];
    this.currentFrame = 0;
    this.chargeState = null;
    this.lastDetectedMotions.clear();
  }

  // ===== MOTION DETECTION METHODS =====

  private detectQuarterCircleForward(): { confidence: number } | null {
    // QCF: Down → Down-Forward → Forward (↓↘→)
    // Lenient: Just Down → Forward is acceptable
    const bufferWindow = 15; // frames
    
    const pattern = this.facingRight 
      ? [Direction.DOWN, Direction.DOWN_RIGHT, Direction.RIGHT]
      : [Direction.DOWN, Direction.DOWN_LEFT, Direction.LEFT];
    
    const lenientPattern = this.facingRight
      ? [Direction.DOWN, Direction.RIGHT]
      : [Direction.DOWN, Direction.LEFT];

    // Try exact pattern first
    if (this.matchPattern(pattern, bufferWindow)) {
      return { confidence: 1.0 };
    }

    // Try lenient pattern
    if (this.matchPattern(lenientPattern, bufferWindow)) {
      return { confidence: 0.7 };
    }

    return null;
  }

  private detectQuarterCircleBack(): { confidence: number } | null {
    // QCB: Down → Down-Back → Back (↓↙←)
    const bufferWindow = 15;
    
    const pattern = this.facingRight
      ? [Direction.DOWN, Direction.DOWN_LEFT, Direction.LEFT]
      : [Direction.DOWN, Direction.DOWN_RIGHT, Direction.RIGHT];
    
    const lenientPattern = this.facingRight
      ? [Direction.DOWN, Direction.LEFT]
      : [Direction.DOWN, Direction.RIGHT];

    if (this.matchPattern(pattern, bufferWindow)) {
      return { confidence: 1.0 };
    }

    if (this.matchPattern(lenientPattern, bufferWindow)) {
      return { confidence: 0.7 };
    }

    return null;
  }

  private detectDragonPunch(): { confidence: number } | null {
    // DP: Forward → Down → Down-Forward (→↓↘)
    // This is checked BEFORE QCF, so it takes priority
    const bufferWindow = 12;
    
    const pattern = this.facingRight
      ? [Direction.RIGHT, Direction.DOWN, Direction.DOWN_RIGHT]
      : [Direction.LEFT, Direction.DOWN, Direction.DOWN_LEFT];
    
    // Only detect exact DP pattern to avoid confusion with QCF
    // QCF is Down→Down-Forward→Forward
    // DP is Forward→Down→Down-Forward
    // The key difference is Forward BEFORE Down
    if (this.matchPattern(pattern, bufferWindow)) {
      return { confidence: 1.0 };
    }

    return null;
  }

  private detectHalfCircleForward(): { confidence: number } | null {
    // HCF: Back → Down-Back → Down → Down-Forward → Forward (←↙↓↘→)
    const bufferWindow = 20;
    
    const pattern = this.facingRight
      ? [Direction.LEFT, Direction.DOWN_LEFT, Direction.DOWN, Direction.DOWN_RIGHT, Direction.RIGHT]
      : [Direction.RIGHT, Direction.DOWN_RIGHT, Direction.DOWN, Direction.DOWN_LEFT, Direction.LEFT];

    // Lenient: Just Back → Down → Forward
    const lenientPattern = this.facingRight
      ? [Direction.LEFT, Direction.DOWN, Direction.RIGHT]
      : [Direction.RIGHT, Direction.DOWN, Direction.LEFT];

    if (this.matchPattern(pattern, bufferWindow)) {
      return { confidence: 1.0 };
    }

    if (this.matchPattern(lenientPattern, bufferWindow)) {
      return { confidence: 0.6 };
    }

    return null;
  }

  private detectHalfCircleBack(): { confidence: number } | null {
    // HCB: Forward → Down-Forward → Down → Down-Back → Back (→↘↓↙←)
    const bufferWindow = 20;
    
    const pattern = this.facingRight
      ? [Direction.RIGHT, Direction.DOWN_RIGHT, Direction.DOWN, Direction.DOWN_LEFT, Direction.LEFT]
      : [Direction.LEFT, Direction.DOWN_LEFT, Direction.DOWN, Direction.DOWN_RIGHT, Direction.RIGHT];

    const lenientPattern = this.facingRight
      ? [Direction.RIGHT, Direction.DOWN, Direction.LEFT]
      : [Direction.LEFT, Direction.DOWN, Direction.RIGHT];

    if (this.matchPattern(pattern, bufferWindow)) {
      return { confidence: 1.0 };
    }

    if (this.matchPattern(lenientPattern, bufferWindow)) {
      return { confidence: 0.6 };
    }

    return null;
  }

  private detectChargeMotion(chargeDirection: 'back' | 'down'): { confidence: number } | null {
    // Check charge duration by counting backwards in history
    const requiredCharge = 30; // frames (0.5 seconds at 60fps)
    
    // Count consecutive charge frames going backwards from history[-2] (since [-1] is the release)
    if (this.inputHistory.length < requiredCharge + 1) return null;
    
    let chargeDuration = 0;
    for (let i = this.inputHistory.length - 2; i >= 0; i--) {
      const input = this.inputHistory[i];
      
      // Check if this input was a charging input
      const isCharging = chargeDirection === 'back'
        ? (input.direction === (this.facingRight ? Direction.LEFT : Direction.RIGHT) || 
           input.direction === (this.facingRight ? Direction.DOWN_LEFT : Direction.DOWN_RIGHT))
        : (input.direction === Direction.DOWN ||
           input.direction === Direction.DOWN_LEFT ||
           input.direction === Direction.DOWN_RIGHT);
      
      if (isCharging) {
        chargeDuration++;
      } else {
        break; // Stop counting if we find a non-charge frame
      }
    }
    
    if (chargeDuration < requiredCharge) {
      return null;
    }

    // Check if we JUST released (look at previous input vs current)
    const currentInput = this.inputHistory[this.inputHistory.length - 1];
    const previousInput = this.inputHistory[this.inputHistory.length - 2];

    if (chargeDirection === 'back') {
      const back = this.facingRight ? Direction.LEFT : Direction.RIGHT;
      const forward = this.facingRight ? Direction.RIGHT : Direction.LEFT;
      
      // Previous was back/down-back, current is forward/down-forward/up-forward
      const wasCharging = previousInput.direction === back || 
                         previousInput.direction === (this.facingRight ? Direction.DOWN_LEFT : Direction.DOWN_RIGHT);
      const isForward = currentInput.direction === forward || 
                       currentInput.direction === (this.facingRight ? Direction.DOWN_RIGHT : Direction.DOWN_LEFT) ||
                       currentInput.direction === (this.facingRight ? Direction.UP_RIGHT : Direction.UP_LEFT);
      
      if (wasCharging && isForward) {
        return { confidence: 1.0 };
      }
    } else if (chargeDirection === 'down') {
      // Previous was down/down-left/down-right, current is up/up-left/up-right
      const wasCharging = previousInput.direction === Direction.DOWN ||
                         previousInput.direction === Direction.DOWN_LEFT ||
                         previousInput.direction === Direction.DOWN_RIGHT;
      const isUp = currentInput.direction === Direction.UP ||
                  currentInput.direction === Direction.UP_LEFT ||
                  currentInput.direction === Direction.UP_RIGHT;
      
      if (wasCharging && isUp) {
        return { confidence: 1.0 };
      }
    }

    return null;
  }

  private detectFullCircle(): { confidence: number } | null {
    // 360°: Complete circle in any direction
    // For mobile leniency, accept 270° (6 of 8 cardinal directions)
    const bufferWindow = 30; // Extra lenient
    
    // Clockwise from forward: → ↘ ↓ ↙ ← ↖ ↑ ↗
    const clockwisePattern = this.facingRight
      ? [Direction.RIGHT, Direction.DOWN_RIGHT, Direction.DOWN, Direction.DOWN_LEFT, Direction.LEFT, Direction.UP_LEFT]
      : [Direction.LEFT, Direction.DOWN_LEFT, Direction.DOWN, Direction.DOWN_RIGHT, Direction.RIGHT, Direction.UP_RIGHT];

    // Counter-clockwise
    const counterPattern = this.facingRight
      ? [Direction.RIGHT, Direction.UP_RIGHT, Direction.UP, Direction.UP_LEFT, Direction.LEFT, Direction.DOWN_LEFT]
      : [Direction.LEFT, Direction.UP_LEFT, Direction.UP, Direction.UP_RIGHT, Direction.RIGHT, Direction.DOWN_RIGHT];

    if (this.matchPattern(clockwisePattern, bufferWindow, true)) {
      return { confidence: 0.8 };
    }

    if (this.matchPattern(counterPattern, bufferWindow, true)) {
      return { confidence: 0.8 };
    }

    return null;
  }

  private detectDoubleTapForward(): { confidence: number } | null {
    const bufferWindow = 12;
    const forward = this.facingRight ? Direction.RIGHT : Direction.LEFT;
    
    // Look for: Forward, Neutral/Any, Forward within buffer
    if (this.inputHistory.length < 3) return null;

    const recentInputs = this.inputHistory.slice(-10);
    let forwardCount = 0;
    let lastForwardFrame = -1;

    for (let i = recentInputs.length - 1; i >= 0; i--) {
      if (recentInputs[i].direction === forward) {
        if (forwardCount === 0) {
          lastForwardFrame = recentInputs[i].frame;
          forwardCount++;
        } else if (this.currentFrame - recentInputs[i].frame <= bufferWindow) {
          forwardCount++;
          if (forwardCount >= 2) {
            return { confidence: 1.0 };
          }
        }
      }
    }

    return null;
  }

  private detectDoubleTapBack(): { confidence: number } | null {
    const bufferWindow = 12;
    const back = this.facingRight ? Direction.LEFT : Direction.RIGHT;
    
    if (this.inputHistory.length < 3) return null;

    const recentInputs = this.inputHistory.slice(-10);
    let backCount = 0;

    for (let i = recentInputs.length - 1; i >= 0; i--) {
      if (recentInputs[i].direction === back) {
        if (backCount === 0) {
          backCount++;
        } else if (this.currentFrame - recentInputs[i].frame <= bufferWindow) {
          backCount++;
          if (backCount >= 2) {
            return { confidence: 1.0 };
          }
        }
      }
    }

    return null;
  }

  // ===== HELPER METHODS =====

  /**
   * Match a direction pattern within buffer window
   */
  private matchPattern(pattern: Direction[], bufferWindow: number, allowGaps = false): boolean {
    if (pattern.length === 0) return false;
    if (this.inputHistory.length < pattern.length) return false;

    let patternIndex = 0;
    const currentFrame = this.currentFrame;
    let lastMatchFrame = -1;

    // Search backwards through recent history
    for (let i = this.inputHistory.length - 1; i >= 0 && patternIndex < pattern.length; i--) {
      const input = this.inputHistory[i];
      
      // Check if outside buffer window
      if (currentFrame - input.frame > bufferWindow) {
        break;
      }

      // Check if direction matches current pattern element (searching backwards)
      if (input.direction === pattern[pattern.length - 1 - patternIndex]) {
        // Ensure temporal order: later pattern elements should have later frames
        if (lastMatchFrame === -1 || input.frame < lastMatchFrame) {
          patternIndex++;
          lastMatchFrame = input.frame;
        }
      }
    }

    return patternIndex === pattern.length;
  }

  /**
   * Check if a specific direction was inputted recently
   */
  private hadDirectionRecently(direction: Direction, framesBack: number, minFramesAgo: number = 0): boolean {
    const currentFrame = this.currentFrame;
    
    for (let i = this.inputHistory.length - 1 - minFramesAgo; i >= 0; i--) {
      const input = this.inputHistory[i];
      
      if (currentFrame - input.frame > framesBack) {
        break;
      }
      
      if (input.direction === direction) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check if direction is part of pattern
   */
  private isPartOfPattern(direction: Direction, pattern: Direction[]): boolean {
    return pattern.includes(direction);
  }

  /**
   * Convert directional input to Direction enum
   */
  private directionalInputToDirection(input: DirectionalInput): Direction {
    const { up, down, left, right } = input;

    if (up && right) return Direction.UP_RIGHT;
    if (up && left) return Direction.UP_LEFT;
    if (down && right) return Direction.DOWN_RIGHT;
    if (down && left) return Direction.DOWN_LEFT;
    if (up) return Direction.UP;
    if (down) return Direction.DOWN;
    if (left) return Direction.LEFT;
    if (right) return Direction.RIGHT;
    
    return Direction.NEUTRAL;
  }

  /**
   * Update charge tracking based on current direction
   */
  private updateChargeTracking(direction: Direction): void {
    const back = this.facingRight ? Direction.LEFT : Direction.RIGHT;
    const down = Direction.DOWN;

    // Check if holding back
    if (direction === back || direction === (this.facingRight ? Direction.DOWN_LEFT : Direction.DOWN_RIGHT)) {
      if (this.chargeState?.direction === 'back') {
        this.chargeState.duration++;
      } else {
        this.chargeState = { direction: 'back', startFrame: this.currentFrame, duration: 1 };
      }
    }
    // Check if holding down
    else if (direction === down || direction === Direction.DOWN_LEFT || direction === Direction.DOWN_RIGHT) {
      if (this.chargeState?.direction === 'down') {
        this.chargeState.duration++;
      } else {
        this.chargeState = { direction: 'down', startFrame: this.currentFrame, duration: 1 };
      }
    }
    // Not charging
    else {
      this.chargeState = null;
    }
  }

  /**
   * Check if motion is on cooldown
   */
  private isMotionOnCooldown(motionKey: string): boolean {
    const lastFrame = this.lastDetectedMotions.get(motionKey);
    if (lastFrame === undefined) return false;
    
    return (this.currentFrame - lastFrame) < this.motionCooldown;
  }

  /**
   * Set cooldown for motion
   */
  private setMotionCooldown(motionKey: string): void {
    this.lastDetectedMotions.set(motionKey, this.currentFrame);
  }
}
