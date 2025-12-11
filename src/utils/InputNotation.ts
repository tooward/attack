/**
 * Input Notation Converter
 * Converts input sequences into fighting game notation (236P, 623K, etc.)
 */

import { InputFrame, InputAction } from '../core/interfaces/types';

export interface NotationSegment {
  direction: string;  // '2', '3', '6', etc. or empty for neutral
  buttons: string[];  // ['LP', 'HP', 'LK', 'HK', 'BL']
}

/**
 * Convert direction inputs to numpad notation
 * Assumes Player 1 facing (right = forward)
 * 
 * Numpad notation:
 * 7 8 9
 * 4 5 6
 * 1 2 3
 * 
 * 5 = neutral
 * 6 = forward
 * 4 = back
 * 2 = down
 * 8 = up
 */
export function getDirectionNotation(input: InputFrame, facing: number): string {
  const up = input.actions.has(InputAction.UP);
  const down = input.actions.has(InputAction.DOWN);
  const left = input.actions.has(InputAction.LEFT);
  const right = input.actions.has(InputAction.RIGHT);
  
  // Adjust for facing direction
  const forward = facing === 1 ? right : left;
  const backward = facing === 1 ? left : right;
  
  // Convert to numpad notation
  if (down && backward) return '1';
  if (down && !forward && !backward) return '2';
  if (down && forward) return '3';
  if (backward && !up && !down) return '4';
  if (!up && !down && !forward && !backward) return '5';
  if (forward && !up && !down) return '6';
  if (up && backward) return '7';
  if (up && !forward && !backward) return '8';
  if (up && forward) return '9';
  
  return '5'; // Neutral
}

/**
 * Get button notation from input
 */
export function getButtonNotation(input: InputFrame): string[] {
  const buttons: string[] = [];
  
  if (input.actions.has(InputAction.LIGHT_PUNCH)) buttons.push('LP');
  if (input.actions.has(InputAction.HEAVY_PUNCH)) buttons.push('HP');
  if (input.actions.has(InputAction.LIGHT_KICK)) buttons.push('LK');
  if (input.actions.has(InputAction.HEAVY_KICK)) buttons.push('HK');
  if (input.actions.has(InputAction.BLOCK)) buttons.push('BL');
  
  return buttons;
}

/**
 * Detect special move motions from input history
 * Returns the motion notation if detected, otherwise null
 */
export function detectMotion(history: InputFrame[], facing: number): string | null {
  if (history.length < 2) return null;
  
  // Get last 10 frames of direction history
  const recent = history.slice(-10).map(input => getDirectionNotation(input, facing));
  const motionString = recent.join('');
  
  // Quarter circle forward (236)
  if (motionString.includes('236') || motionString.includes('2356') || motionString.includes('23456')) {
    return '236';
  }
  
  // Quarter circle back (214)
  if (motionString.includes('214') || motionString.includes('2154') || motionString.includes('21454')) {
    return '214';
  }
  
  // Dragon punch / Shoryuken (623)
  if (motionString.includes('623') || motionString.includes('6523') || motionString.includes('62323')) {
    return '623';
  }
  
  // Half circle forward (41236)
  if (motionString.includes('41236') || motionString.includes('412356')) {
    return '41236';
  }
  
  // Half circle back (63214)
  if (motionString.includes('63214') || motionString.includes('632154')) {
    return '63214';
  }
  
  // 360 / SPD motion (full circle)
  if (motionString.includes('641236') || motionString.includes('236987')) {
    return '360';
  }
  
  // Charge back-forward (4~6)
  const chargeBack = recent.filter(d => d === '4').length >= 4;
  if (chargeBack && recent[recent.length - 1] === '6') {
    return '4~6';
  }
  
  // Charge down-up (2~8)
  const chargeDown = recent.filter(d => d === '2').length >= 4;
  if (chargeDown && recent[recent.length - 1] === '8') {
    return '2~8';
  }
  
  return null;
}

/**
 * Convert recent input history into readable notation
 * Shows the last significant input or detected motion
 */
export function getInputNotation(history: InputFrame[], facing: number): string {
  if (history.length === 0) return '';
  
  const lastInput = history[history.length - 1];
  const buttons = getButtonNotation(lastInput);
  
  // If no buttons pressed, just show direction
  if (buttons.length === 0) {
    const dir = getDirectionNotation(lastInput, facing);
    return dir === '5' ? '' : dir;
  }
  
  // Check for special motion
  const motion = detectMotion(history, facing);
  if (motion) {
    return `${motion}${buttons.join('+')}`;
  }
  
  // Show current direction + buttons
  const dir = getDirectionNotation(lastInput, facing);
  if (dir === '5') {
    return buttons.join('+');
  }
  
  return `${dir}${buttons.join('+')}`;
}

/**
 * Get a simplified display notation (converts to common abbreviations)
 */
export function getDisplayNotation(notation: string): string {
  // Convert button names to shorter versions
  return notation
    .replace('LP', 'P')
    .replace('HP', 'P')
    .replace('LK', 'K')
    .replace('HK', 'K')
    .replace('BL', 'B')
    .replace('+', '');
}
