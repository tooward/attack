/**
 * Input Buffer System
 * Stores input history and provides motion detection for special moves.
 * Enables quarter-circle, half-circle, charge moves, etc.
 */

import { InputFrame, InputAction } from '../interfaces/types';

export const BUFFER_SIZE = 30; // Store last 30 frames of input

export interface InputBuffer {
  history: InputFrame[];
  currentFrame: number;
}

/**
 * Create a new empty input buffer
 */
export function createInputBuffer(): InputBuffer {
  return {
    history: [],
    currentFrame: 0,
  };
}

/**
 * Add a new input frame to the buffer
 */
export function addInput(buffer: InputBuffer, input: InputFrame): InputBuffer {
  const newHistory = [...buffer.history, { ...input, frame: buffer.currentFrame }];

  // Keep only the last BUFFER_SIZE frames
  const trimmedHistory = newHistory.slice(-BUFFER_SIZE);

  return {
    history: trimmedHistory,
    currentFrame: buffer.currentFrame + 1,
  };
}

/**
 * Get the most recent input frame
 */
export function getLatestInput(buffer: InputBuffer): InputFrame | null {
  return buffer.history.length > 0 ? buffer.history[buffer.history.length - 1] : null;
}

/**
 * Check if a simple button press occurred in the last N frames
 */
export function checkButtonPress(
  buffer: InputBuffer,
  action: InputAction,
  withinFrames: number = 3
): boolean {
  const recentFrames = buffer.history.slice(-withinFrames);
  return recentFrames.some((frame) => frame.actions.has(action));
}

/**
 * Check if a motion input was performed (e.g., quarter-circle forward + punch)
 * Motion is specified as array of InputActions in sequence
 */
export function checkMotionInput(
  buffer: InputBuffer,
  motion: InputAction[],
  maxFrames: number = 15
): boolean {
  if (motion.length === 0) return false;

  const recentHistory = buffer.history.slice(-maxFrames);
  let motionIndex = 0;

  // Scan through history looking for motion sequence
  for (const frame of recentHistory) {
    if (frame.actions.has(motion[motionIndex])) {
      motionIndex++;
      if (motionIndex === motion.length) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check for quarter-circle forward (down, down-forward, forward + button)
 * Returns true if the motion was detected
 */
export function checkQuarterCircleForward(
  buffer: InputBuffer,
  button: InputAction,
  facing: number,
  maxFrames: number = 15
): boolean {
  const recentHistory = buffer.history.slice(-maxFrames);

  let foundDown = false;
  let foundDownForward = false;
  let foundForwardAndButton = false;

  for (const frame of recentHistory) {
    // Check for down
    if (frame.actions.has(InputAction.DOWN)) {
      foundDown = true;
    }

    // Check for down-forward (down + forward pressed together)
    if (
      foundDown &&
      frame.actions.has(InputAction.DOWN) &&
      ((facing === 1 && frame.actions.has(InputAction.RIGHT)) ||
        (facing === -1 && frame.actions.has(InputAction.LEFT)))
    ) {
      foundDownForward = true;
    }

    // Check for forward + button
    if (
      foundDownForward &&
      ((facing === 1 && frame.actions.has(InputAction.RIGHT)) ||
        (facing === -1 && frame.actions.has(InputAction.LEFT))) &&
      frame.actions.has(button)
    ) {
      foundForwardAndButton = true;
      break;
    }
  }

  return foundForwardAndButton;
}

/**
 * Check for dragon punch motion (forward, down, down-forward + button)
 * This is the classic "Z" or "shoryuken" motion
 */
export function checkDragonPunch(
  buffer: InputBuffer,
  button: InputAction,
  facing: number,
  maxFrames: number = 15
): boolean {
  const recentHistory = buffer.history.slice(-maxFrames);

  let foundForward = false;
  let foundDown = false;
  let foundDownForwardAndButton = false;

  for (const frame of recentHistory) {
    // Check for forward
    if (
      (facing === 1 && frame.actions.has(InputAction.RIGHT)) ||
      (facing === -1 && frame.actions.has(InputAction.LEFT))
    ) {
      foundForward = true;
    }

    // Check for down after forward
    if (foundForward && frame.actions.has(InputAction.DOWN)) {
      foundDown = true;
    }

    // Check for down-forward + button
    if (
      foundDown &&
      frame.actions.has(InputAction.DOWN) &&
      ((facing === 1 && frame.actions.has(InputAction.RIGHT)) ||
        (facing === -1 && frame.actions.has(InputAction.LEFT))) &&
      frame.actions.has(button)
    ) {
      foundDownForwardAndButton = true;
      break;
    }
  }

  return foundDownForwardAndButton;
}

/**
 * Check for charge move (hold back/down for X frames, then forward/up + button)
 * Returns true if charge was held and then released with button
 */
export function checkChargeMove(
  buffer: InputBuffer,
  chargeDirection: InputAction.LEFT | InputAction.RIGHT | InputAction.DOWN,
  releaseDirection: InputAction.RIGHT | InputAction.LEFT | InputAction.UP,
  button: InputAction,
  requiredChargeFrames: number = 45
): boolean {
  const history = buffer.history;

  // Look backwards from current frame to find the release
  for (let i = history.length - 1; i >= 0; i--) {
    const frame = history[i];

    // Check if this frame has the release direction + button
    if (frame.actions.has(releaseDirection) && frame.actions.has(button)) {
      // Count backwards from here to see if charge was held
      let chargeFrames = 0;
      for (let j = i - 1; j >= 0 && j >= i - requiredChargeFrames - 5; j--) {
        if (history[j].actions.has(chargeDirection)) {
          chargeFrames++;
        } else {
          // Break if we stop holding charge
          break;
        }
      }

      if (chargeFrames >= requiredChargeFrames) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Clear the buffer (useful for round resets)
 */
export function clearBuffer(buffer: InputBuffer): InputBuffer {
  return {
    history: [],
    currentFrame: buffer.currentFrame,
  };
}

/**
 * Get input at a specific frame offset from current
 * @param offset - Number of frames back (0 = most recent, 1 = one frame ago, etc.)
 */
export function getInputAtOffset(buffer: InputBuffer, offset: number): InputFrame | null {
  const index = buffer.history.length - 1 - offset;
  return index >= 0 ? buffer.history[index] : null;
}
