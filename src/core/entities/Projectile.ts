/**
 * Projectile System
 * 
 * Handles creation, movement, and collision for projectiles (fireballs, etc.)
 */

import {
  ProjectileState,
  ProjectileDefinition,
  FighterState,
  FighterStatus,
  Vector2,
  Rect,
} from '../interfaces/types';

// ============================================================================
// PROJECTILE CREATION
// ============================================================================

/**
 * Create a projectile from a fighter
 */
export function createProjectile(
  def: ProjectileDefinition,
  owner: FighterState,
  currentFrame: number
): ProjectileState {
  // Spawn position (offset based on facing direction)
  const spawnOffset = 60; // pixels in front of fighter
  const spawnX = owner.position.x + (spawnOffset * owner.facing);
  
  return {
    id: `projectile_${owner.id}_${currentFrame}`,
    ownerId: owner.id,
    teamId: owner.teamId,
    position: {
      x: spawnX,
      y: owner.position.y - 50, // Chest height
    },
    velocity: {
      x: def.speed * owner.facing,
      y: 0,
    },
    damage: def.damage,
    chipDamage: def.chipDamage,
    hitstun: def.hitstun,
    blockstun: def.blockstun,
    knockback: {
      x: def.knockback.x * owner.facing,
      y: def.knockback.y,
    },
    hitbox: def.hitbox,
    lifespan: def.lifespan,
    frameCreated: currentFrame,
    hitCount: 0,
    hitLimit: def.hitLimit,
    active: true,
    destroyOnHit: def.destroyOnHit,
  };
}

// ============================================================================
// PROJECTILE UPDATES
// ============================================================================

/**
 * Update a single projectile (movement, lifetime)
 */
export function updateProjectile(
  projectile: ProjectileState,
  currentFrame: number,
  arenaWidth: number
): ProjectileState | null {
  // Check lifetime
  const age = currentFrame - projectile.frameCreated;
  if (age >= projectile.lifespan) {
    return null; // Projectile expired
  }
  
  // Check if hit limit reached
  if (projectile.hitCount >= projectile.hitLimit) {
    return null; // Projectile exhausted
  }
  
  // Update position
  const newPosition: Vector2 = {
    x: projectile.position.x + projectile.velocity.x,
    y: projectile.position.y + projectile.velocity.y,
  };
  
  // Check bounds (destroy if off-screen)
  if (newPosition.x < -100 || newPosition.x > arenaWidth + 100) {
    return null;
  }
  
  return {
    ...projectile,
    position: newPosition,
  };
}

/**
 * Update all projectiles
 */
export function updateProjectiles(
  projectiles: ProjectileState[],
  currentFrame: number,
  arenaWidth: number
): ProjectileState[] {
  return projectiles
    .map(p => updateProjectile(p, currentFrame, arenaWidth))
    .filter((p): p is ProjectileState => p !== null);
}

// ============================================================================
// COLLISION DETECTION
// ============================================================================

/**
 * Get world-space hitbox for projectile
 */
function getProjectileWorldHitbox(projectile: ProjectileState): Rect {
  return {
    x: projectile.position.x + projectile.hitbox.x,
    y: projectile.position.y + projectile.hitbox.y,
    width: projectile.hitbox.width,
    height: projectile.hitbox.height,
  };
}

/**
 * Get world-space hurtbox for fighter (centered positioning)
 */
function getFighterWorldHurtbox(fighter: FighterState): Rect | null {
  if (fighter.hurtboxes.length === 0) return null;
  
  // Use first hurtbox (assuming single hurtbox per fighter)
  const hurtbox = fighter.hurtboxes[0];
  // Hurtboxes are centered (x=0 means centered, offset by -width/2)
  return {
    x: fighter.position.x + hurtbox.x - hurtbox.width / 2,
    y: fighter.position.y + hurtbox.y,
    width: hurtbox.width,
    height: hurtbox.height,
  };
}

/**
 * Check if two rectangles overlap
 */
function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/**
 * Check if projectile hits a fighter
 */
export function checkProjectileHit(
  projectile: ProjectileState,
  fighter: FighterState
): boolean {
  // Can't hit own team
  if (projectile.teamId === fighter.teamId) return false;
  
  // Projectile must be active
  if (!projectile.active) return false;
  
  // Fighter must be vulnerable
  if (fighter.invincibleFrames > 0) return false;
  
  // Check hitbox overlap
  const projectileHitbox = getProjectileWorldHitbox(projectile);
  const fighterHurtbox = getFighterWorldHurtbox(fighter);
  
  if (!fighterHurtbox) return false;
  
  return rectsOverlap(projectileHitbox, fighterHurtbox);
}

/**
 * Check all projectile hits against all fighters
 */
export function checkProjectileHits(
  projectiles: ProjectileState[],
  fighters: FighterState[]
): Array<{ projectileId: string; fighterId: string }> {
  const hits: Array<{ projectileId: string; fighterId: string }> = [];
  
  for (const projectile of projectiles) {
    for (const fighter of fighters) {
      if (checkProjectileHit(projectile, fighter)) {
        hits.push({
          projectileId: projectile.id,
          fighterId: fighter.id,
        });
      }
    }
  }
  
  return hits;
}

// ============================================================================
// PROJECTILE HIT APPLICATION
// ============================================================================

/**
 * Apply projectile hit to fighter and update projectile
 */
export function applyProjectileHit(
  projectile: ProjectileState,
  fighter: FighterState,
  wasBlocked: boolean
): { projectile: ProjectileState | null; fighter: FighterState } {
  const actualDamage = wasBlocked ? projectile.chipDamage : projectile.damage;
  const stun = wasBlocked ? projectile.blockstun : projectile.hitstun;
  
  // Update fighter
  const newFighter: FighterState = {
    ...fighter,
    health: Math.max(0, fighter.health - actualDamage),
    stunFramesRemaining: stun,
    status: wasBlocked ? FighterStatus.BLOCKSTUN : FighterStatus.HITSTUN,
    velocity: wasBlocked
      ? { x: projectile.knockback.x * 0.5, y: 0 } // Less knockback on block
      : projectile.knockback,
    comboCount: wasBlocked ? 0 : fighter.comboCount + 1,
    lastHitByFrame: fighter.lastHitByFrame, // Will be updated by caller
  };
  
  // Update projectile
  const newHitCount = projectile.hitCount + 1;
  const shouldDestroy = projectile.destroyOnHit || newHitCount >= projectile.hitLimit;
  
  const newProjectile: ProjectileState | null = shouldDestroy
    ? null
    : {
        ...projectile,
        hitCount: newHitCount,
      };
  
  return {
    projectile: newProjectile,
    fighter: newFighter,
  };
}

// ============================================================================
// PROJECTILE CLASHING (Future Feature)
// ============================================================================

/**
 * Check if two projectiles collide and destroy each other
 */
export function checkProjectileClash(
  proj1: ProjectileState,
  proj2: ProjectileState
): boolean {
  // Must be from different teams
  if (proj1.teamId === proj2.teamId) return false;
  
  // Check hitbox overlap
  const hitbox1 = getProjectileWorldHitbox(proj1);
  const hitbox2 = getProjectileWorldHitbox(proj2);
  
  return rectsOverlap(hitbox1, hitbox2);
}

/**
 * Remove clashing projectiles
 */
export function resolveProjectileClashes(
  projectiles: ProjectileState[]
): ProjectileState[] {
  const toRemove = new Set<string>();
  
  for (let i = 0; i < projectiles.length; i++) {
    for (let j = i + 1; j < projectiles.length; j++) {
      if (checkProjectileClash(projectiles[i], projectiles[j])) {
        toRemove.add(projectiles[i].id);
        toRemove.add(projectiles[j].id);
      }
    }
  }
  
  return projectiles.filter(p => !toRemove.has(p.id));
}
