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
  SPECIAL_MOVE = 13,  // Special move detected via motion input
}

export interface InputFrame {
  actions: Set<InputAction>;  // All buttons currently pressed
  timestamp: number;           // Frame number when this input was recorded
  detectedMotion?: {           // Special move motion detected this frame
    motionType: string;        // MotionInputType value
    button: string;            // MotionButton value
    confidence: number;        // 0-1, match quality
  };
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
  comboScaling: number;        // Damage multiplier for current combo (starts at 1.0)
  comboStartFrame: number;     // When current combo began
  lastHitFrame: number;        // When this fighter last landed a hit
  lastHitByFrame: number;      // When this fighter was last hit
  
  // Frame Data
  stunFramesRemaining: number; // Hitstun or blockstun countdown
  invincibleFrames: number;    // Invulnerability window
  
  // Cancel tracking
  cancelAvailable: boolean;    // Can cancel current move?
  lastCancelFrame: number;     // Frame of last cancel (prevent loops)
  
  // Special move state
  activeSpecialMove: string | null; // ID of currently executing special move
  specialMoveFrame: number;    // Frame within special move animation
  invincibilityState: InvincibilityState | null; // Active invincibility
  armorState: ArmorState | null; // Active armor/super armor
  
  // Hitboxes (computed per frame based on current move)
  hurtboxes: Rect[];           // Where this fighter can be hit
  hitboxes: Rect[];            // Active attack hitboxes
}

// ============================================================================
// SPECIAL MOVE STATES
// ============================================================================

export interface InvincibilityState {
  type: 'full' | 'strike' | 'throw' | 'projectile'; // What attacks it's immune to
  startFrame: number;          // When invincibility began
  endFrame: number;            // When it expires
}

export interface ArmorState {
  hitsRemaining: number;       // Number of hits before armor breaks
  damageReduction: number;     // 0-1, how much damage is reduced
  startFrame: number;
  endFrame: number;
}

export interface InvincibilityState {
  type: 'full' | 'strike' | 'throw' | 'projectile';
  startFrame: number;
  endFrame: number;
}

export interface ArmorState {
  hitsRemaining: number;
  damageReduction: number;     // 0-1 (0.5 = half damage)
  startFrame: number;
  endFrame: number;
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
  
  // Special move properties
  isSpecial?: boolean;         // Is this a special/super move?
  projectile?: ProjectileDefinition; // Spawns projectile on activation
  invincibleFrames?: number[]; // Frame numbers with invincibility
  
  // Cancel windows
  cancellableInto: string[];   // Move IDs this can cancel into
  cancellableFrames?: {        // When canceling is allowed
    start: number;
    end: number;
  };
  cancellableOnHit: boolean;
  cancellableOnBlock: boolean;
  cancellableOnWhiff?: boolean; // Can cancel even on miss
  
  // Requirements
  requiresGrounded: boolean;
  requiresAirborne: boolean;
}

// ============================================================================
// CHARACTER DEFINITIONS
// ============================================================================

export enum CharacterArchetype {
  BALANCED = 'balanced',
  RUSHDOWN = 'rushdown',
  GRAPPLER = 'grappler',
  ZONER = 'zoner',
}

export interface CharacterStats {
  maxHealth: number;
  maxEnergy: number;
  walkSpeed: number;
  jumpForce: number;
  gravity: number;
  weight: number;              // Affects knockback received
  
  // New: Character-specific modifiers
  speedModifier: number;       // 0.7-1.3x (1.0 = standard)
  damageModifier: number;      // 0.9-1.3x (1.0 = standard)
  jumpHeightModifier: number;  // 0.8-1.2x (1.0 = standard)
}

export interface CharacterDefinition {
  id: string;
  name: string;
  archetype: CharacterArchetype;
  stats: CharacterStats;
  
  // Collision boxes
  standingHurtbox: Rect;
  crouchingHurtbox: Rect;
  airborneHurtbox: Rect;
  
  // Moves
  moves: Map<string, MoveDefinition>;
  specialMoves?: SpecialMoveDefinition[];
  
  // Progression (for future side-scroller)
  moveUnlockLevels?: Map<string, number>;
}

// ============================================================================
// SPECIAL MOVES & MOTION INPUTS
// ============================================================================

export enum MotionInputType {
  QUARTER_CIRCLE_FORWARD = 'qcf',     // ↓↘→
  QUARTER_CIRCLE_BACK = 'qcb',        // ↓↙←
  DRAGON_PUNCH = 'dp',                // →↓↘
  HALF_CIRCLE_FORWARD = 'hcf',        // ←↙↓↘→
  HALF_CIRCLE_BACK = 'hcb',           // →↘↓↙←
  CHARGE_BACK_FORWARD = 'charge_bf',  // ←(hold)→
  CHARGE_DOWN_UP = 'charge_du',       // ↓(hold)↑
  DOUBLE_TAP_FORWARD = 'dash_f',      // →→
  DOUBLE_TAP_BACK = 'dash_b',         // ←←
  FULL_CIRCLE = '360',                // Full circle any direction
}

export enum MotionButton {
  PUNCH = 'punch',
  KICK = 'kick',
  ANY = 'any',
}

export interface MotionInput {
  motion: MotionInputType;
  button: MotionButton;
  chargeTime?: number;         // Frames required for charge moves (default: 30)
  bufferWindow?: number;       // Frames to complete input (default: 10)
}

export interface InvincibilityFrames {
  start: number;               // First invincible frame
  end: number;                 // Last invincible frame
  type: 'full' | 'strike' | 'throw' | 'projectile'; // What it's invincible to
}

export interface ArmorProperties {
  hits: number;                // How many hits it absorbs (1-2)
  start: number;               // First armor frame
  end: number;                 // Last armor frame
  damageReduction: number;     // 0-1 (0 = full damage absorbed, 0.5 = half damage)
}

export interface MovementProperties {
  horizontal: number;          // Units per frame
  vertical: number;            // Units per frame  
  duration: number;            // Frames of movement
}

export interface SpecialMoveVariant {
  damage: number;
  startupFrames: number;
  activeFrames: number;
  recoveryFrames: number;
  blockAdvantage: number;
  hitAdvantage: number;
  
  // Special properties
  projectile?: ProjectileDefinition;
  invincibility?: InvincibilityFrames[];
  armor?: ArmorProperties;
  movement?: MovementProperties;
  
  // Command grab specific
  isCommandGrab?: boolean;
  grabRange?: number;          // Multiplier on normal throw range (1.5x, 2x)
}

export interface SpecialMoveDefinition {
  id: string;
  name: string;
  input: MotionInput;
  
  variants: {
    light: SpecialMoveVariant;
    heavy: SpecialMoveVariant;
  };
  
  // Animation (will be used by renderer)
  animationKey?: string;
}

// ============================================================================
// PROJECTILES
// ============================================================================

export interface ProjectileDefinition {
  id: string;
  name: string;
  
  // Movement
  speed: number;               // Pixels per frame
  gravity: number;             // 0 for straight projectiles
  acceleration: number;        // Speeding up/slowing down
  
  // Hit properties
  damage: number;
  chipDamage: number;
  hitstun: number;
  blockstun: number;
  knockback: Vector2;
  
  // Lifetime
  lifespan: number;            // Frames before auto-dissipate
  hitLimit: number;            // Max hits (1 for single-hit, N for multi-hit)
  
  // Collision
  hitbox: Rect;
  destroyOnHit: boolean;       // False for multi-hit projectiles
}

export interface ProjectileState {
  id: string;
  ownerId: string;             // Fighter who created it
  teamId: number;
  position: Vector2;
  velocity: Vector2;
  
  // Properties from definition
  damage: number;
  chipDamage: number;
  hitstun: number;
  blockstun: number;
  knockback: Vector2;
  
  // Hitbox
  hitbox: Rect;
  
  // Lifetime
  lifespan: number;
  frameCreated: number;
  hitCount: number;            // How many times it's hit
  hitLimit: number;
  active: boolean;             // Still able to hit
  destroyOnHit: boolean;
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
  projectiles: ProjectileState[]; // Active projectiles
  round: RoundState;
  match: MatchState;
  arena: ArenaConfig;
  
  // Camera (for future side-scroller support)
  cameraPosition: Vector2;
  
  // Game flow
  isPaused: boolean;
  isRoundOver: boolean;
  isMatchOver: boolean;
  
  // Visual effects
  freezeFrames: number;        // Hit freeze countdown
  screenShake: {
    intensity: number;
    duration: number;
    elapsed: number;
  } | null;
  
  // Training mode
  trainingMode?: {
    enabled: boolean;
    dummyMode: 'idle' | 'crouch' | 'jump' | 'block' | 'cpu' | 'record' | 'playback';
    recording: InputFrame[];
    recordingStartFrame: number;
    playbackIndex: number;
    infiniteMeter: boolean;
  };
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
