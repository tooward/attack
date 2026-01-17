/**
 * SpecialMoveExecutor
 * Handles execution of special moves from motion inputs
 */

import {
  GameState,
  FighterState,
  CharacterDefinition,
  SpecialMoveDefinition,
  MotionInputType,
  MotionButton,
  ProjectileState,
  InvincibilityState,
  ArmorState,
  Vector2,
  InputFrame,
  FighterStatus,
} from '../interfaces/types';

export interface SpecialMoveExecutionResult {
  executed: boolean;
  specialMoveId?: string;
  variant?: 'light' | 'heavy';
  spawnedProjectile?: ProjectileState;
}

export class SpecialMoveExecutor {
  /**
   * Attempt to execute a special move from detected motion input
   */
  static tryExecuteSpecialMove(
    fighter: FighterState,
    characterDef: CharacterDefinition,
    input: InputFrame,
    gameState: GameState
  ): SpecialMoveExecutionResult {
    // Check if motion was detected
    if (!input.detectedMotion) {
      return { executed: false };
    }

    const { motionType, button } = input.detectedMotion;

    // Find matching special move
    const specialMove = characterDef.specialMoves?.find(
      (move) => 
        move.input.motion === motionType &&
        (move.input.button === button || move.input.button === MotionButton.ANY)
    );

    if (!specialMove) {
      return { executed: false };
    }

    // Determine variant based on button strength
    const variant = this.determineVariant(button, input);

    // Check if fighter can execute special move
    if (!this.canExecuteSpecialMove(fighter, specialMove, variant)) {
      return { executed: false };
    }

    // Execute the special move
    this.executeSpecialMove(fighter, specialMove, variant, gameState);

    // Spawn projectile if applicable
    let spawnedProjectile: ProjectileState | undefined;
    const moveVariant = specialMove.variants[variant];
    if (moveVariant.projectile) {
      spawnedProjectile = this.spawnProjectile(
        fighter,
        specialMove,
        variant,
        gameState.frame
      );
    }

    return {
      executed: true,
      specialMoveId: specialMove.id,
      variant,
      spawnedProjectile,
    };
  }

  /**
   * Determine light vs heavy variant based on button input
   */
  private static determineVariant(
    button: string,
    input: InputFrame
  ): 'light' | 'heavy' {
    // Check which actual button was pressed
    const hasHeavyPunch = input.actions.has(6); // HEAVY_PUNCH
    const hasHeavyKick = input.actions.has(8);  // HEAVY_KICK

    if (button === 'punch' && hasHeavyPunch) {
      return 'heavy';
    }
    if (button === 'kick' && hasHeavyKick) {
      return 'heavy';
    }

    return 'light';
  }

  /**
   * Check if fighter can execute special move
   */
  private static canExecuteSpecialMove(
    fighter: FighterState,
    specialMove: SpecialMoveDefinition,
    variant: 'light' | 'heavy'
  ): boolean {
    // Can't execute during hitstun/blockstun/knockdown
    if (
      fighter.status === FighterStatus.HITSTUN ||
      fighter.status === FighterStatus.BLOCKSTUN ||
      fighter.status === FighterStatus.KNOCKDOWN
    ) {
      return false;
    }

    // Check if already executing a special move
    if (fighter.activeSpecialMove !== null) {
      return false;
    }

    // Check if grounded (for most special moves)
    // Air special moves can be added later
    if (!fighter.isGrounded) {
      return false;
    }

    return true;
  }

  /**
   * Execute the special move
   */
  private static executeSpecialMove(
    fighter: FighterState,
    specialMove: SpecialMoveDefinition,
    variant: 'light' | 'heavy',
    gameState: GameState
  ): void {
    const moveVariant = specialMove.variants[variant];

    // Set special move state
    fighter.activeSpecialMove = specialMove.id;
    fighter.specialMoveFrame = 0;
    fighter.status = FighterStatus.ATTACK;
    fighter.currentMove = `${specialMove.id}_${variant}`;
    fighter.moveFrame = 0;

    // Apply invincibility if present (use first invincibility window)
    if (moveVariant.invincibility && moveVariant.invincibility.length > 0) {
      const inv = moveVariant.invincibility[0];
      fighter.invincibilityState = {
        type: inv.type,
        startFrame: gameState.frame + inv.start,
        endFrame: gameState.frame + inv.end,
      };
    }

    // Apply armor if present
    if (moveVariant.armor) {
      const armor = moveVariant.armor;
      fighter.armorState = {
        hitsRemaining: armor.hits,
        damageReduction: armor.damageReduction,
        startFrame: gameState.frame + armor.start,
        endFrame: gameState.frame + armor.end,
      };
    }

    // Apply movement properties if present
    if (moveVariant.movement) {
      const movement = moveVariant.movement;
      fighter.velocity.x = movement.horizontal * fighter.facing;
      fighter.velocity.y = movement.vertical;
    }
  }

  /**
   * Spawn a projectile from a special move
   */
  private static spawnProjectile(
    fighter: FighterState,
    specialMove: SpecialMoveDefinition,
    variant: 'light' | 'heavy',
    currentFrame: number
  ): ProjectileState {
    const moveVariant = specialMove.variants[variant];
    const projectileData = moveVariant.projectile!;

    // Calculate spawn position (in front of fighter)
    const spawnOffset = 60 * fighter.facing; // 60 pixels in front
    const spawnPosition: Vector2 = {
      x: fighter.position.x + spawnOffset,
      y: fighter.position.y - 40, // Chest height
    };

    const projectile: ProjectileState = {
      id: `${fighter.id}_${specialMove.id}_${currentFrame}`,
      ownerId: fighter.id,
      teamId: fighter.teamId,
      position: spawnPosition,
      velocity: {
        x: projectileData.speed * fighter.facing,
        y: 0,
      },
      damage: projectileData.damage,
      chipDamage: projectileData.chipDamage,
      hitstun: projectileData.hitstun,
      blockstun: projectileData.blockstun,
      knockback: projectileData.knockback,
      hitbox: projectileData.hitbox,
      lifespan: projectileData.lifespan,
      frameCreated: currentFrame,
      hitCount: 0,
      hitLimit: projectileData.hitLimit,
      active: true,
      destroyOnHit: projectileData.destroyOnHit,
    };

    return projectile;
  }

  /**
   * Update special move state for a fighter
   */
  static updateSpecialMoveState(
    fighter: FighterState,
    characterDef: CharacterDefinition,
    currentFrame: number
  ): void {
    // Update special move frame counter
    if (fighter.activeSpecialMove !== null) {
      fighter.specialMoveFrame++;

      // Find the special move definition
      const specialMove = characterDef.specialMoves?.find(
        (move) => move.id === fighter.activeSpecialMove
      );

      if (specialMove) {
        // Determine which variant is active (from currentMove)
        const variant = fighter.currentMove?.includes('heavy') ? 'heavy' : 'light';
        const moveVariant = specialMove.variants[variant];

        // Check if special move is complete
        const totalFrames =
          moveVariant.startupFrames +
          moveVariant.activeFrames +
          moveVariant.recoveryFrames;

        if (fighter.specialMoveFrame >= totalFrames) {
          // Special move complete
          fighter.activeSpecialMove = null;
          fighter.specialMoveFrame = 0;
          fighter.status = FighterStatus.IDLE;
          fighter.currentMove = null;
        }
      }
    }

    // Update invincibility state
    if (fighter.invincibilityState) {
      if (currentFrame > fighter.invincibilityState.endFrame) {
        fighter.invincibilityState = null;
      }
    }

    // Update armor state
    if (fighter.armorState) {
      if (
        currentFrame > fighter.armorState.endFrame ||
        fighter.armorState.hitsRemaining <= 0
      ) {
        fighter.armorState = null;
      }
    }
  }

  /**
   * Check if fighter is invincible to a specific attack type
   */
  static isInvincible(
    fighter: FighterState,
    attackType: 'strike' | 'throw' | 'projectile'
  ): boolean {
    if (!fighter.invincibilityState) {
      return false;
    }

    const invType = fighter.invincibilityState.type;

    // Full invincibility beats everything
    if (invType === 'full') {
      return true;
    }

    // Type-specific invincibility
    return invType === attackType;
  }

  /**
   * Process hit against armor
   * Returns true if hit should be absorbed by armor
   */
  static processArmorHit(
    fighter: FighterState,
    damage: number
  ): { absorbed: boolean; damageReduction: number } {
    if (!fighter.armorState) {
      return { absorbed: false, damageReduction: 0 };
    }

    // Reduce hits remaining
    fighter.armorState.hitsRemaining--;

    return {
      absorbed: true,
      damageReduction: fighter.armorState.damageReduction,
    };
  }

  /**
   * Update all projectiles in game state
   */
  static updateProjectiles(gameState: GameState): void {
    for (const projectile of gameState.projectiles) {
      if (!projectile.active) continue;

      // Update position
      projectile.position.x += projectile.velocity.x;
      projectile.position.y += projectile.velocity.y;

      // Check lifespan
      const frameAge = gameState.frame - projectile.frameCreated;
      if (frameAge > projectile.lifespan) {
        projectile.active = false;
      }

      // Check arena bounds
      if (
        projectile.position.x < gameState.arena.leftBound ||
        projectile.position.x > gameState.arena.rightBound
      ) {
        projectile.active = false;
      }
    }

    // Remove inactive projectiles
    gameState.projectiles = gameState.projectiles.filter(p => p.active);
  }

  /**
   * Check projectile collision with fighters
   */
  static checkProjectileCollisions(gameState: GameState): void {
    for (const projectile of gameState.projectiles) {
      if (!projectile.active) continue;
      if (projectile.hitCount >= projectile.hitLimit) {
        projectile.active = false;
        continue;
      }

      // Check collision with fighters (except owner)
      for (const fighter of gameState.entities) {
        if (fighter.id === projectile.ownerId) continue;
        if (fighter.teamId === projectile.teamId) continue;

        // Check if fighter is invincible to projectiles
        if (this.isInvincible(fighter, 'projectile')) continue;

        // Simple AABB collision check
        const hit = this.checkProjectileFighterCollision(projectile, fighter);
        if (hit) {
          // Handle hit
          this.handleProjectileHit(projectile, fighter, gameState);
          break; // Move to next projectile
        }
      }
    }
  }

  /**
   * Check if projectile collides with fighter
   */
  private static checkProjectileFighterCollision(
    projectile: ProjectileState,
    fighter: FighterState
  ): boolean {
    const projRect = {
      x: projectile.position.x + projectile.hitbox.x,
      y: projectile.position.y + projectile.hitbox.y,
      width: projectile.hitbox.width,
      height: projectile.hitbox.height,
    };

    for (const hurtbox of fighter.hurtboxes) {
      const hurtRect = {
        x: fighter.position.x + hurtbox.x,
        y: fighter.position.y + hurtbox.y,
        width: hurtbox.width,
        height: hurtbox.height,
      };

      if (this.rectsOverlap(projRect, hurtRect)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Handle projectile hitting a fighter
   */
  private static handleProjectileHit(
    projectile: ProjectileState,
    fighter: FighterState,
    gameState: GameState
  ): void {
    const wasBlocked = fighter.status === FighterStatus.BLOCK;
    let damage = wasBlocked ? projectile.chipDamage : projectile.damage;

    // Check armor
    if (!wasBlocked) {
      const armorResult = this.processArmorHit(fighter, damage);
      if (armorResult.absorbed) {
        damage *= 1 - armorResult.damageReduction;
        // No hitstun with armor
        fighter.health = Math.max(0, fighter.health - damage);
        projectile.hitCount++;
        if (projectile.destroyOnHit || projectile.hitCount >= projectile.hitLimit) {
          projectile.active = false;
        }
        return;
      }
    }

    // Apply damage
    fighter.health = Math.max(0, fighter.health - damage);

    // Apply hitstun/blockstun
    if (wasBlocked) {
      fighter.status = FighterStatus.BLOCKSTUN;
      fighter.stunFramesRemaining = projectile.blockstun;
    } else {
      fighter.status = FighterStatus.HITSTUN;
      fighter.stunFramesRemaining = projectile.hitstun;
      fighter.velocity.x += projectile.knockback.x;
      fighter.velocity.y += projectile.knockback.y;
    }

    fighter.lastHitByFrame = gameState.frame;

    // Update projectile
    projectile.hitCount++;
    if (projectile.destroyOnHit || projectile.hitCount >= projectile.hitLimit) {
      projectile.active = false;
    }
  }

  /**
   * Check if two rectangles overlap (AABB collision)
   */
  private static rectsOverlap(
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number }
  ): boolean {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  /**
   * Check for command grab attempts during special move execution
   * Called each frame during special move active frames
   */
  static checkCommandGrab(
    attacker: FighterState,
    defender: FighterState,
    specialMove: SpecialMoveDefinition,
    variant: 'light' | 'heavy',
    gameState: GameState
  ): boolean {
    const moveVariant = specialMove.variants[variant];

    // Only process command grabs
    if (!moveVariant.isCommandGrab) {
      return false;
    }

    // Check if defender is in grab-immune state
    if (this.isGrabImmune(defender)) {
      return false;
    }

    // Check if within grab range
    const grabRange = this.calculateGrabRange(moveVariant.grabRange || 1.0);
    const distance = Math.abs(attacker.position.x - defender.position.x);
    
    if (distance > grabRange) {
      return false;
    }

    // Check if defenders are on same vertical level (within tolerance)
    const verticalDistance = Math.abs(attacker.position.y - defender.position.y);
    if (verticalDistance > 50) { // 50 pixels vertical tolerance
      return false;
    }

    // Execute the command grab
    this.executeCommandGrab(attacker, defender, moveVariant, gameState);
    return true;
  }

  /**
   * Check if a fighter is immune to grabs
   */
  private static isGrabImmune(fighter: FighterState): boolean {
    // Airborne fighters can't be grabbed
    if (!fighter.isGrounded) {
      return true;
    }

    // Invincible fighters can't be grabbed
    if (fighter.invincibilityState !== null) {
      return true;
    }

    // Already grabbed/thrown fighters can't be grabbed
    if (fighter.status === FighterStatus.HITSTUN && fighter.currentMove?.includes('throw')) {
      return true;
    }

    // Attacking/special moving fighters have grab immunity during active frames
    // This prevents grab trade scenarios
    if (fighter.activeSpecialMove !== null) {
      return true;
    }

    return false;
  }

  /**
   * Calculate grab range based on multiplier
   * Base grab range is 60 pixels
   */
  private static calculateGrabRange(multiplier: number): number {
    const BASE_GRAB_RANGE = 60;
    return BASE_GRAB_RANGE * multiplier;
  }

  /**
   * Execute a command grab on the defender
   */
  private static executeCommandGrab(
    attacker: FighterState,
    defender: FighterState,
    moveVariant: any,
    gameState: GameState
  ): void {
    // Apply damage
    defender.health = Math.max(0, defender.health - moveVariant.damage);

    // Apply hitstun (command grabs are unblockable)
    defender.status = FighterStatus.HITSTUN;
    defender.stunFramesRemaining = 40; // Long hitstun for cinematic grab

    // Pull defender toward attacker (grab animation effect)
    const pullDistance = 20;
    const direction = attacker.facing;
    defender.position.x = attacker.position.x + (pullDistance * direction);

    // Apply knockback after grab
    defender.velocity.x = 5 * attacker.facing;
    defender.velocity.y = -8; // Launch upward

    // Reset defender's combo
    defender.comboCount = 0;
    defender.comboScaling = 1.0;

    // Track hit
    defender.lastHitByFrame = gameState.frame;

    // Update attacker's combo
    attacker.comboCount++;
    attacker.lastHitFrame = gameState.frame;

    // Mark as grabbed for animation purposes
    defender.currentMove = 'grabbed';
  }

  /**
   * Check all command grab attempts in game state
   * Called from game loop during special move processing
   */
  static processCommandGrabs(
    gameState: GameState,
    characterDefs: Map<string, CharacterDefinition>
  ): void {
    // Check each fighter for active command grabs
    for (const attacker of gameState.entities) {
      if (attacker.activeSpecialMove === null) continue;

      const characterDef = characterDefs.get(attacker.characterId);
      if (!characterDef || !characterDef.specialMoves) continue;

      const specialMove = characterDef.specialMoves.find(
        (move) => move.id === attacker.activeSpecialMove
      );
      if (!specialMove) continue;

      const variant = attacker.currentMove?.includes('heavy') ? 'heavy' : 'light';
      const moveVariant = specialMove.variants[variant];

      // Only process during active frames
      const totalStartup = moveVariant.startupFrames;
      const totalActive = totalStartup + moveVariant.activeFrames;
      if (attacker.specialMoveFrame < totalStartup || attacker.specialMoveFrame >= totalActive) {
        continue;
      }

      // Check against all opponents
      for (const defender of gameState.entities) {
        if (defender.id === attacker.id) continue;
        if (defender.teamId === attacker.teamId) continue;

        const grabbed = this.checkCommandGrab(
          attacker,
          defender,
          specialMove,
          variant,
          gameState
        );

        if (grabbed) {
          // Only grab one opponent per execution
          break;
        }
      }
    }
  }
}
