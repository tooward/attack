/**
 * Core Type Definitions for Fighting Game Engine
 * 
 * These types define the pure TypeScript game state.
 * NO PHASER DEPENDENCIES ALLOWED IN THIS FILE.
 */

// ============================================================================
// PRIMITIVES
// ============================================================================

export interface Vector2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;      // Relative to entity position
  y: number;
  width: number;
  height: number;
}

// ============================================================================
// INPUT
// ============================================================================

export enum InputAction {
  NONE = 0,
  LEFT = 1,
  RIGHT = 2,
  UP = 3,
  DOWN = 4,
  LIGHT_PUNCH = 5,
  HEAVY_PUNCH = 6,
  LIGHT_KICK = 7,
  HEAVY_KICK = 8,
  BLOCK = 9,
  SPECIAL_1 = 10,
  SPECIAL_2 = 11,
  SUPER = 12,
}

export interface InputFrame {
  actions: Set<InputAction>;  // All buttons currently pressed
  timestamp: number;           // Frame number when this input was recorded
}

// ============================================================================
// FIGHTER STATE
// ============================================================================

export enum FighterStatus {
  IDLE = 'idle',
  WALK_FORWARD = 'walk_forward',
  WALK_BACKWARD = 'walk_backward',
  CROUCH = 'crouch',
  JUMP = 'jump',
  ATTACK = 'attack',
  BLOCK = 'block',
  HITSTUN = 'hitstun',
  BLOCKSTUN = 'blockstun',
  KNOCKDOWN = 'knockdown',
  WAKEUP = 'wakeup',
}

export interface FighterState {
  // Identity
  id: string;                  // Unique instance ID (e.g., "player", "enemy_1")
  characterId: string;         // Character definition ID (e.g., "musashi")
  teamId: number;              // 0 = player team, 1 = enemy team
  
  // Transform
  position: Vector2;
  velocity: Vector2;
  facing: 1 | -1;              // 1 = right, -1 = left
  
  // Resources
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  superMeter: number;
  maxSuperMeter: number;
  
  // State
  status: FighterStatus;
  isGrounded: boolean;
  
  // Current Action
  currentMove: string | null;  // Move ID from character definition
  moveFrame: number;           // Current frame of the move animation
  
  // Combat Tracking
  comboCount: number;
  lastHitFrame: number;        // When this fighter last landed a hit
  lastHitByFrame: number;      // When this fighter was last hit
  
  // Frame Data
  stunFramesRemaining: number; // Hitstun or blockstun countdown
  invincibleFrames: number;    // Invulnerability window
  
  // Hitboxes (computed per frame based on current move)
  hurtboxes: Rect[];           // Where this fighter can be hit
  hitboxes: Rect[];            // Active attack hitboxes
}

// ============================================================================
// MOVE DEFINITIONS
// ============================================================================

export interface FrameData {
  startup: number;             // Frames before hitbox becomes active
  active: number;              // Frames the hitbox is active
  recovery: number;            // Frames after hitbox deactivates
  totalFrames: number;         // startup + active + recovery
}

export interface MoveDefinition {
  id: string;
  name: string;
  
  // Input requirements
  input: InputAction[];
  motionInput?: string;        // e.g., "236P" for quarter-circle forward + punch
  
  // Frame data
  frameData: FrameData;
  
  // Properties
  damage: number;
  chipDamage: number;          // Damage dealt when blocked
  hitstun: number;             // Frames opponent is stunned
  blockstun: number;           // Frames opponent is in blockstun
  knockback: Vector2;          // Velocity applied to opponent
  
  // Hitbox data (map of frame number to hitboxes active on that frame)
  hitboxFrames: Map<number, Rect[]>;
  
  // Resource costs
  energyCost: number;
  superMeterGain: number;      // Meter gained on hit
  superMeterCost: number;      // For EX/Super moves
  
  // Cancel windows
  cancellableInto: string[];   // Move IDs this can cancel into
  cancellableOnHit: boolean;
  cancellableOnBlock: boolean;
  
  // Requirements
  requiresGrounded: boolean;
  requiresAirborne: boolean;
  invincibleFrames?: number[]; // Frame numbers with invincibility
}

// ============================================================================
// CHARACTER DEFINITIONS
// ============================================================================

export interface CharacterStats {
  maxHealth: number;
  maxEnergy: number;
  walkSpeed: number;
  jumpForce: number;
  gravity: number;
  weight: number;              // Affects knockback received
}

export interface CharacterDefinition {
  id: string;
  name: string;
  stats: CharacterStats;
  
  // Collision boxes
  standingHurtbox: Rect;
  crouchingHurtbox: Rect;
  airborneHurtbox: Rect;
  
  // Moves
  moves: Map<string, MoveDefinition>;
  
  // Progression (for future side-scroller)
  moveUnlockLevels?: Map<string, number>;
}

// ============================================================================
// GAME STATE
// ============================================================================

export interface RoundState {
  roundNumber: number;
  timeRemaining: number;       // In frames (60fps standard)
  winner: string | null;       // Entity ID of winner
}

export interface MatchState {
  wins: Record<string, number>; // Map of entity ID to win count
  roundsToWin: number;
  matchWinner: string | null;
}

export interface ArenaConfig {
  width: number;
  height: number;
  groundLevel: number;
  leftBound: number;
  rightBound: number;
}

export interface GameState {
  frame: number;               // Current frame count
  entities: FighterState[];    // All active fighters
  round: RoundState;
  match: MatchState;
  arena: ArenaConfig;
  
  // Camera (for future side-scroller support)
  cameraPosition: Vector2;
  
  // Game flow
  isPaused: boolean;
  isRoundOver: boolean;
  isMatchOver: boolean;
}

// ============================================================================
// AI / TRAINING
// ============================================================================

export interface Observation {
  features: number[];          // Normalized [-1, 1] or [0, 1]
}

export interface AIPersonality {
  // Core traits
  aggression: number;          // 0-1: How often to advance/attack
  riskTolerance: number;       // 0-1: Chance to pick unsafe moves
  defenseBias: number;         // 0-1: Preference for blocking/backdashing
  spacingTarget: number;       // Preferred distance from opponent
  comboAmbition: number;       // 0-1: Simple confirms vs optimal combos
  
  // Behavior rates
  jumpRate: number;
  throwRate: number;
  fireballRate: number;
  antiAirCommitment: number;
  
  // Adaptation
  adaptivity: number;          // How much to adjust based on player behavior
  discipline: number;          // Respect for frame disadvantage
  
  // Weaknesses (deliberate blind spots)
  patternAddiction: number;    // 0-1: Tendency to repeat successful sequences
  tiltThreshold: number;       // Damage taken before becoming reckless
  rangeBlindness?: {
    minRange: number;
    maxRange: number;
    reactionPenalty: number;
  };
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface HitResult {
  attackerId: string;
  defenderId: string;
  damage: number;
  hitstun: number;
  blockstun: number;
  knockback: Vector2;
  wasBlocked: boolean;
}

export type GameConfig = {
  entities: Array<{
    characterId: string;
    id: string;
    teamId: number;
    startPosition: Vector2;
  }>;
  arena: ArenaConfig;
  roundsToWin: number;
  roundTimeSeconds: number;
};
