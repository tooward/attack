/**
 * Combat System
 * 
 * Handles hit detection, damage calculation, and combat resolution.
 */

import {
  FighterState,
  FighterStatus,
  Rect,
  HitResult,
  MoveDefinition,
} from '../interfaces/types';
import { applyHitstun, applyBlockstun } from '../entities/Fighter';

/**
 * Check if two rectangles overlap
 */
export function rectsOverlap(
  rect1: Rect,
  pos1: { x: number; y: number },
  facing1: number,
  rect2: Rect,
  pos2: { x: number; y: number },
  facing2: number
): boolean {
  // Convert relative rects to world space
  const r1 = {
    x: pos1.x + (facing1 === 1 ? rect1.x : -rect1.x - rect1.width),
    y: pos1.y + rect1.y,
    width: rect1.width,
    height: rect1.height,
  };

  const r2 = {
    x: pos2.x + (facing2 === 1 ? rect2.x : -rect2.x - rect2.width),
    y: pos2.y + rect2.y,
    width: rect2.width,
    height: rect2.height,
  };

  // AABB collision check
  return (
    r1.x < r2.x + r2.width &&
    r1.x + r1.width > r2.x &&
    r1.y < r2.y + r2.height &&
    r1.y + r1.height > r2.y
  );
}

/**
 * Check if attacker's hitbox hits defender's hurtbox
 */
export function checkHit(
  attacker: FighterState,
  defender: FighterState
): HitResult | null {
  // Can't hit teammates
  if (attacker.teamId === defender.teamId) {
    return null;
  }

  // Can't hit invincible fighters
  if (defender.invincibleFrames > 0) {
    return null;
  }

  // Attacker must have active hitboxes
  if (attacker.hitboxes.length === 0) {
    return null;
  }

  // Defender must have hurtboxes
  if (defender.hurtboxes.length === 0) {
    return null;
  }

  // Check for any hitbox-hurtbox overlap
  for (const hitbox of attacker.hitboxes) {
    for (const hurtbox of defender.hurtboxes) {
      if (
        rectsOverlap(
          hitbox,
          attacker.position,
          attacker.facing,
          hurtbox,
          defender.position,
          defender.facing
        )
      ) {
        // Hit detected - need move definition to get properties
        return {
          attackerId: attacker.id,
          defenderId: defender.id,
          damage: 0, // Will be filled in by caller with move data
          hitstun: 0,
          blockstun: 0,
          knockback: { x: 0, y: 0 },
          wasBlocked: defender.status === FighterStatus.BLOCK,
        };
      }
    }
  }

  return null;
}

/**
 * Calculate damage with combo scaling
 */
export function calculateDamage(
  baseDamage: number,
  comboCount: number
): number {
  // Damage scaling: each hit after the first does less damage
  const scaling = Math.max(0.3, 1 - (comboCount * 0.1));
  return Math.floor(baseDamage * scaling);
}

/**
 * Apply hit result to both fighters
 */
export function resolveHit(
  attacker: FighterState,
  defender: FighterState,
  move: MoveDefinition
): [FighterState, FighterState] {
  const wasBlocked = defender.status === FighterStatus.BLOCK;

  if (wasBlocked) {
    // Blocked hit
    const damage = move.chipDamage;
    const newDefender = applyBlockstun(
      { ...defender, health: Math.max(0, defender.health - damage) },
      move.blockstun
    );

    // Attacker gains less meter on block
    const newAttacker = {
      ...attacker,
      superMeter: Math.min(
        attacker.maxSuperMeter,
        attacker.superMeter + move.superMeterGain * 0.5
      ),
    };

    return [newAttacker, newDefender];
  } else {
    // Clean hit
    const damage = calculateDamage(move.damage, attacker.comboCount);
    const knockback = {
      x: move.knockback.x * attacker.facing,
      y: move.knockback.y,
    };

    const newDefender = applyHitstun(
      {
        ...defender,
        health: Math.max(0, defender.health - damage),
        comboCount: 0, // Reset defender's combo
        lastHitByFrame: 0, // Will be set by game loop
      },
      move.hitstun,
      knockback
    );

    const newAttacker = {
      ...attacker,
      comboCount: attacker.comboCount + 1,
      lastHitFrame: 0, // Will be set by game loop
      superMeter: Math.min(
        attacker.maxSuperMeter,
        attacker.superMeter + move.superMeterGain
      ),
    };

    return [newAttacker, newDefender];
  }
}

/**
 * Scan all entities for hits and apply results
 */
export function scanForHits(
  entities: FighterState[],
  characterMoves: Map<string, Map<string, MoveDefinition>>
): FighterState[] {
  let updatedEntities = [...entities];
  const processedHits = new Set<string>(); // Track processed hit pairs

  for (let i = 0; i < updatedEntities.length; i++) {
    const attacker = updatedEntities[i];

    // Skip if not attacking or no move active
    if (!attacker.currentMove || attacker.hitboxes.length === 0) {
      continue;
    }

    // Get move definition
    const characterMoveset = characterMoves.get(attacker.characterId);
    if (!characterMoveset) continue;

    const move = characterMoveset.get(attacker.currentMove);
    if (!move) continue;

    for (let j = 0; j < updatedEntities.length; j++) {
      if (i === j) continue;

      const defender = updatedEntities[j];
      const hitKey = `${attacker.id}-${defender.id}-${attacker.moveFrame}`;

      // Check if we already processed this hit
      if (processedHits.has(hitKey)) {
        continue;
      }

      // Check for hit
      const hitResult = checkHit(attacker, defender);
      if (hitResult) {
        // Apply hit
        const [newAttacker, newDefender] = resolveHit(attacker, defender, move);
        updatedEntities[i] = newAttacker;
        updatedEntities[j] = newDefender;

        // Mark as processed
        processedHits.add(hitKey);
      }
    }
  }

  return updatedEntities;
}

/**
 * Update hurtboxes based on fighter state
 */
export function updateHurtboxes(
  fighter: FighterState,
  standingBox: Rect,
  crouchingBox: Rect,
  airborneBox: Rect
): FighterState {
  let hurtboxes: Rect[];

  if (!fighter.isGrounded) {
    hurtboxes = [airborneBox];
  } else if (fighter.status === FighterStatus.CROUCH) {
    hurtboxes = [crouchingBox];
  } else {
    hurtboxes = [standingBox];
  }

  return { ...fighter, hurtboxes };
}
