/**
 * StateReader Utility
 * 
 * Extracts and interprets game state information for bot decision making.
 * Provides high-level queries about entities, positions, and combat states.
 */

import { GameState, FighterState, FighterStatus } from '../../../interfaces/types';

export class StateReader {
  /**
   * Get entity by ID
   */
  getEntity(state: GameState, entityId: string): FighterState | null {
    return state.entities.find(e => e.id === entityId) || null;
  }

  /**
   * Get distance between two entities (in pixels)
   */
  getDistance(entity1: FighterState, entity2: FighterState): number {
    return Math.abs(entity2.position.x - entity1.position.x);
  }

  /**
   * Get normalized distance (0.0 = touching, 1.0 = full screen)
   */
  getNormalizedDistance(state: GameState, entity1: FighterState, entity2: FighterState): number {
    const distance = this.getDistance(entity1, entity2);
    const maxDistance = state.arena.width;
    return Math.min(1.0, distance / maxDistance);
  }

  /**
   * Check if entity is jumping (airborne)
   */
  isJumping(entity: FighterState): boolean {
    return !entity.isGrounded;
  }

  /**
   * Check if entity is currently attacking
   */
  isAttacking(entity: FighterState): boolean {
    return entity.status === FighterStatus.ATTACK && entity.hitboxes.length > 0;
  }

  /**
   * Check if entity is in hitstun or blockstun
   */
  isStunned(entity: FighterState): boolean {
    return entity.stunFramesRemaining > 0;
  }

  /**
   * Check if entity is blocking
   */
  isBlocking(entity: FighterState): boolean {
    return entity.status === FighterStatus.BLOCK || entity.status === FighterStatus.BLOCKSTUN;
  }

  /**
   * Check if entity is in recovery (vulnerable after attack)
   */
  isInRecovery(entity: FighterState): boolean {
    if (!entity.currentMove) return false;
    
    // Entity is in recovery if it's still in attack animation but hitboxes are inactive
    return entity.status === FighterStatus.ATTACK && entity.hitboxes.length === 0;
  }

  /**
   * Get recovery frames remaining (approximate based on move frame)
   */
  getRecoveryFrames(entity: FighterState, characterDef?: any): number {
    if (!entity.currentMove || !this.isInRecovery(entity)) {
      return 0;
    }

    // If we have character definition, get exact frame data
    if (characterDef && characterDef.moves) {
      const move = characterDef.moves.get(entity.currentMove);
      if (move) {
        const totalFrames = move.frameData.totalFrames;
        return Math.max(0, totalFrames - entity.moveFrame);
      }
    }

    // Fallback: estimate based on current move frame
    // Most recovery is 10-20 frames, scale based on move progress
    return Math.max(0, 15 - entity.moveFrame);
  }

  /**
   * Check if entity can act (not stunned, not in recovery)
   */
  canAct(entity: FighterState): boolean {
    return !this.isStunned(entity) && !this.isInRecovery(entity);
  }

  /**
   * Get entity's current combo count
   */
  getComboCount(entity: FighterState): number {
    return entity.comboCount;
  }

  /**
   * Check if entity is in a combo (recently hit)
   */
  isInCombo(state: GameState, entity: FighterState): boolean {
    // Consider entity in combo if hit in last 60 frames and combo count > 0
    return entity.comboCount > 0 && (state.frame - entity.lastHitByFrame) < 60;
  }

  /**
   * Get health percentage (0.0 - 1.0)
   */
  getHealthPercentage(entity: FighterState): number {
    return entity.health / entity.maxHealth;
  }

  /**
   * Get super meter percentage (0.0 - 1.0)
   */
  getSuperMeterPercentage(entity: FighterState): number {
    return entity.superMeter / entity.maxSuperMeter;
  }

  /**
   * Check if opponent is approaching
   */
  isApproaching(actor: FighterState, opponent: FighterState): boolean {
    // Check if opponent's velocity is toward actor
    const dx = actor.position.x - opponent.position.x;
    const velocityToward = opponent.velocity.x * Math.sign(dx);
    return velocityToward < -0.5; // Moving toward actor
  }

  /**
   * Check if opponent is retreating
   */
  isRetreating(actor: FighterState, opponent: FighterState): boolean {
    // Check if opponent's velocity is away from actor
    const dx = actor.position.x - opponent.position.x;
    const velocityAway = opponent.velocity.x * Math.sign(dx);
    return velocityAway > 0.5; // Moving away from actor
  }

  /**
   * Get frame advantage (positive = actor's turn, negative = opponent's turn)
   * Simplified version - returns 0 if both can act, otherwise estimates based on stun
   */
  getFrameAdvantage(actor: FighterState, opponent: FighterState): number {
    const actorStun = actor.stunFramesRemaining;
    const opponentStun = opponent.stunFramesRemaining;
    
    return opponentStun - actorStun;
  }

  /**
   * Get tactical range category
   */
  getRange(distance: number): 'close' | 'mid' | 'far' {
    if (distance < 100) return 'close';
    if (distance < 250) return 'mid';
    return 'far';
  }

  /**
   * Check if entity is cornered (near screen edge)
   */
  isCornered(state: GameState, entity: FighterState): boolean {
    const distToLeftEdge = entity.position.x - state.arena.leftBound;
    const distToRightEdge = state.arena.rightBound - entity.position.x;
    const cornerThreshold = 100; // pixels
    
    return Math.min(distToLeftEdge, distToRightEdge) < cornerThreshold;
  }

  /**
   * Get direction toward opponent
   */
  getDirectionToward(actor: FighterState, opponent: FighterState): 'left' | 'right' {
    return opponent.position.x > actor.position.x ? 'right' : 'left';
  }

  /**
   * Get direction away from opponent
   */
  getDirectionAway(actor: FighterState, opponent: FighterState): 'left' | 'right' {
    return opponent.position.x < actor.position.x ? 'right' : 'left';
  }

  /**
   * Check if move is likely unsafe (simple heuristic)
   */
  isMoveUnsafe(moveName: string | null): boolean {
    if (!moveName) return false;
    
    // Heavy attacks and specials are typically unsafe
    return moveName.includes('hp') || 
           moveName.includes('hk') || 
           moveName.includes('heavy') ||
           moveName.includes('special');
  }

  /**
   * Get last action taken by entity
   */
  getLastAction(entity: FighterState): string {
    return entity.currentMove || 'idle';
  }
}
