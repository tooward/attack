/**
 * Action Space for AI
 * Defines discrete actions AI can take and converts them to InputFrames
 */

import { InputFrame, InputAction } from '../interfaces/types';

/**
 * Discrete actions available to AI agents
 */
export enum AIAction {
  IDLE = 0,
  WALK_FORWARD = 1,
  WALK_BACKWARD = 2,
  JUMP = 3,
  CROUCH = 4,
  LIGHT_PUNCH = 5,
  HEAVY_PUNCH = 6,
  LIGHT_KICK = 7,
  HEAVY_KICK = 8,
  BLOCK = 9,
  JUMP_FORWARD = 10,
  JUMP_BACKWARD = 11,
  CROUCH_LIGHT_PUNCH = 12,
  CROUCH_HEAVY_PUNCH = 13,
}

/**
 * Total number of actions in the action space
 */
export const ACTION_SPACE_SIZE = 14;

/**
 * Convert AI action to InputFrame
 */
export function actionToInputFrame(
  action: AIAction,
  facing: number,
  timestamp: number
): InputFrame {
  const actions = new Set<InputAction>();

  switch (action) {
    case AIAction.IDLE:
      // No actions - empty set
      break;

    case AIAction.WALK_FORWARD:
      actions.add(facing === 1 ? InputAction.RIGHT : InputAction.LEFT);
      break;

    case AIAction.WALK_BACKWARD:
      actions.add(facing === 1 ? InputAction.LEFT : InputAction.RIGHT);
      break;

    case AIAction.JUMP:
      actions.add(InputAction.UP);
      break;

    case AIAction.CROUCH:
      actions.add(InputAction.DOWN);
      break;

    case AIAction.LIGHT_PUNCH:
      actions.add(InputAction.LIGHT_PUNCH);
      break;

    case AIAction.HEAVY_PUNCH:
      actions.add(InputAction.HEAVY_PUNCH);
      break;

    case AIAction.LIGHT_KICK:
      actions.add(InputAction.LIGHT_KICK);
      break;

    case AIAction.HEAVY_KICK:
      actions.add(InputAction.HEAVY_KICK);
      break;

    case AIAction.BLOCK:
      actions.add(InputAction.BLOCK);
      break;

    case AIAction.JUMP_FORWARD:
      actions.add(InputAction.UP);
      actions.add(facing === 1 ? InputAction.RIGHT : InputAction.LEFT);
      break;

    case AIAction.JUMP_BACKWARD:
      actions.add(InputAction.UP);
      actions.add(facing === 1 ? InputAction.LEFT : InputAction.RIGHT);
      break;

    case AIAction.CROUCH_LIGHT_PUNCH:
      actions.add(InputAction.DOWN);
      actions.add(InputAction.LIGHT_PUNCH);
      break;

    case AIAction.CROUCH_HEAVY_PUNCH:
      actions.add(InputAction.DOWN);
      actions.add(InputAction.HEAVY_PUNCH);
      break;

    default:
      // Invalid action - do nothing
      break;
  }

  return {
    actions,
    timestamp,
  };
}

/**
 * Get all valid actions as array
 */
export function getAllActions(): AIAction[] {
  return [
    AIAction.IDLE,
    AIAction.WALK_FORWARD,
    AIAction.WALK_BACKWARD,
    AIAction.JUMP,
    AIAction.CROUCH,
    AIAction.LIGHT_PUNCH,
    AIAction.HEAVY_PUNCH,
    AIAction.LIGHT_KICK,
    AIAction.HEAVY_KICK,
    AIAction.BLOCK,
    AIAction.JUMP_FORWARD,
    AIAction.JUMP_BACKWARD,
    AIAction.CROUCH_LIGHT_PUNCH,
    AIAction.CROUCH_HEAVY_PUNCH,
  ];
}

/**
 * Get action name for debugging
 */
export function getActionName(action: AIAction): string {
  return AIAction[action];
}
