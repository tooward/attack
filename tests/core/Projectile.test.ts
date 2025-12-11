/**
 * Unit tests for Projectile system
 */

import {
  createProjectile,
  updateProjectile,
  updateProjectiles,
  checkProjectileHit,
  checkProjectileHits,
  applyProjectileHit,
  checkProjectileClash,
  resolveProjectileClashes,
} from '../../src/core/entities/Projectile';
import {
  ProjectileState,
  ProjectileDefinition,
  FighterState,
  FighterStatus,
} from '../../src/core/interfaces/types';

describe('Projectile System', () => {
  const mockProjectileDef: ProjectileDefinition = {
    id: 'test_projectile',
    name: 'Test Projectile',
    speed: 10,
    gravity: 0,
    acceleration: 0,
    damage: 20,
    chipDamage: 5,
    hitstun: 15,
    blockstun: 10,
    knockback: { x: 8, y: 0 },
    lifespan: 180, // 3 seconds at 60fps
    hitLimit: 1,
    hitbox: { x: 0, y: 0, width: 40, height: 40 },
    destroyOnHit: true,
  };

  const mockFighter: FighterState = {
    id: 'fighter1',
    characterId: 'musashi',
    teamId: 0,
    position: { x: 500, y: 400 },
    velocity: { x: 0, y: 0 },
    facing: 1,
    health: 100,
    maxHealth: 100,
    energy: 100,
    maxEnergy: 100,
    superMeter: 0,
    maxSuperMeter: 300,
    status: FighterStatus.IDLE,
    isGrounded: true,
    currentMove: null,
    moveFrame: 0,
    comboCount: 0,
    comboScaling: 1.0,
    comboStartFrame: 0,
    lastHitFrame: 0,
    lastHitByFrame: 0,
    stunFramesRemaining: 0,
    invincibleFrames: 0,
    cancelAvailable: false,
    lastCancelFrame: 0,
    hurtboxes: [{ x: 0, y: 0, width: 60, height: 80 }],
    hitboxes: [],
  };

  describe('Projectile Creation', () => {
    test('should create projectile from fighter', () => {
      const projectile = createProjectile(mockProjectileDef, mockFighter, 100);

      expect(projectile.id).toContain('fighter1');
      expect(projectile.id).toContain('100');
      expect(projectile.ownerId).toBe('fighter1');
      expect(projectile.teamId).toBe(0);
      expect(projectile.damage).toBe(20);
      expect(projectile.lifespan).toBe(180);
      expect(projectile.hitCount).toBe(0);
      expect(projectile.hitLimit).toBe(1);
      expect(projectile.active).toBe(true);
    });

    test('should spawn projectile in front of fighter', () => {
      const rightFacing = { ...mockFighter, facing: 1 as 1, position: { x: 500, y: 400 } };
      const projectile = createProjectile(mockProjectileDef, rightFacing, 100);

      expect(projectile.position.x).toBeGreaterThan(rightFacing.position.x);
      expect(projectile.position.y).toBeLessThan(rightFacing.position.y); // Chest height
    });

    test('should spawn projectile correctly for left-facing fighter', () => {
      const leftFacing = { ...mockFighter, facing: -1 as -1, position: { x: 500, y: 400 } };
      const projectile = createProjectile(mockProjectileDef, leftFacing, 100);

      expect(projectile.position.x).toBeLessThan(leftFacing.position.x);
      expect(projectile.velocity.x).toBeLessThan(0); // Moving left
    });

    test('should set velocity based on facing direction', () => {
      const rightFacing = { ...mockFighter, facing: 1 as 1 };
      const projectile = createProjectile(mockProjectileDef, rightFacing, 100);

      expect(projectile.velocity.x).toBe(10); // speed * facing
    });
  });

  describe('Projectile Movement', () => {
    test('should update projectile position', () => {
      const projectile = createProjectile(mockProjectileDef, mockFighter, 100);
      const updated = updateProjectile(projectile, 101, 1000);

      expect(updated).not.toBeNull();
      expect(updated!.position.x).toBe(projectile.position.x + projectile.velocity.x);
    });

    test('should maintain velocity through updates', () => {
      let projectile = createProjectile(mockProjectileDef, mockFighter, 100);
      
      for (let i = 0; i < 5; i++) {
        const prev = projectile;
        projectile = updateProjectile(projectile, 101 + i, 1000)!;
        expect(projectile.position.x).toBe(prev.position.x + prev.velocity.x);
      }
    });

    test('should destroy projectile when off-screen left', () => {
      const leftMoving = createProjectile(
        mockProjectileDef,
        { ...mockFighter, facing: -1, position: { x: 50, y: 400 } },
        100
      );

      // Move projectile far left
      let projectile = leftMoving;
      for (let i = 0; i < 20; i++) {
        const result = updateProjectile(projectile, 101 + i, 1000);
        if (result === null) {
          expect(projectile.position.x).toBeLessThanOrEqual(-100);
          return;
        }
        projectile = result;
      }

      fail('Projectile should have been destroyed when off-screen');
    });

    test('should destroy projectile when off-screen right', () => {
      const rightMoving = createProjectile(
        mockProjectileDef,
        { ...mockFighter, facing: 1, position: { x: 950, y: 400 } },
        100
      );

      // Move projectile far right
      let projectile = rightMoving;
      for (let i = 0; i < 20; i++) {
        const result = updateProjectile(projectile, 101 + i, 1000);
        if (result === null) {
          expect(projectile.position.x).toBeGreaterThanOrEqual(1100);
          return;
        }
        projectile = result;
      }

      fail('Projectile should have been destroyed when off-screen');
    });
  });

  describe('Projectile Lifetime', () => {
    test('should track projectile age', () => {
      const projectile = createProjectile(mockProjectileDef, mockFighter, 100);

      expect(projectile.frameCreated).toBe(100);
      expect(projectile.lifespan).toBe(180);
    });

    test('should destroy projectile after lifespan', () => {
      const projectile = createProjectile(mockProjectileDef, mockFighter, 100);

      // Just before lifespan ends
      const stillAlive = updateProjectile(projectile, 279, 1000);
      expect(stillAlive).not.toBeNull();

      // After lifespan ends
      const expired = updateProjectile(projectile, 280, 1000);
      expect(expired).toBeNull();
    });

    test('should handle short lifespan projectiles', () => {
      const shortDef = { ...mockProjectileDef, lifespan: 10 };
      const projectile = createProjectile(shortDef, mockFighter, 100);

      const result = updateProjectile(projectile, 110, 1000);
      expect(result).toBeNull();
    });
  });

  describe('Hit Detection', () => {
    test('should detect projectile hitting fighter', () => {
      const projectile = createProjectile(mockProjectileDef, mockFighter, 100);
      const target = {
        ...mockFighter,
        id: 'fighter2',
        teamId: 1, // Different team
        position: { x: projectile.position.x + 10, y: projectile.position.y },
      };

      expect(checkProjectileHit(projectile, target)).toBe(true);
    });

    test('should not hit fighter on same team', () => {
      const projectile = createProjectile(mockProjectileDef, mockFighter, 100);
      const teammate = {
        ...mockFighter,
        id: 'fighter2',
        teamId: 0, // Same team
        position: { x: projectile.position.x + 10, y: projectile.position.y },
      };

      expect(checkProjectileHit(projectile, teammate)).toBe(false);
    });

    test('should not hit invincible fighter', () => {
      const projectile = createProjectile(mockProjectileDef, mockFighter, 100);
      const target = {
        ...mockFighter,
        id: 'fighter2',
        teamId: 1,
        position: { x: projectile.position.x + 10, y: projectile.position.y },
        invincibleFrames: 5, // Invincible
      };

      expect(checkProjectileHit(projectile, target)).toBe(false);
    });

    test('should not hit when projectile is inactive', () => {
      const projectile = {
        ...createProjectile(mockProjectileDef, mockFighter, 100),
        active: false,
      };
      const target = {
        ...mockFighter,
        id: 'fighter2',
        teamId: 1,
        position: { x: projectile.position.x + 10, y: projectile.position.y },
      };

      expect(checkProjectileHit(projectile, target)).toBe(false);
    });

    test('should not hit when too far away', () => {
      const projectile = createProjectile(mockProjectileDef, mockFighter, 100);
      const target = {
        ...mockFighter,
        id: 'fighter2',
        teamId: 1,
        position: { x: projectile.position.x + 200, y: projectile.position.y }, // Far away
      };

      expect(checkProjectileHit(projectile, target)).toBe(false);
    });

    test('should detect multiple hits across fighters', () => {
      const projectile = createProjectile(mockProjectileDef, mockFighter, 100);
      const fighter1 = {
        ...mockFighter,
        id: 'fighter2',
        teamId: 1,
        position: { x: projectile.position.x + 10, y: projectile.position.y },
      };
      const fighter2 = {
        ...mockFighter,
        id: 'fighter3',
        teamId: 1,
        position: { x: projectile.position.x + 15, y: projectile.position.y },
      };

      const hits = checkProjectileHits([projectile], [fighter1, fighter2]);

      expect(hits.length).toBe(2);
      expect(hits).toContainEqual({ projectileId: projectile.id, fighterId: 'fighter2' });
      expect(hits).toContainEqual({ projectileId: projectile.id, fighterId: 'fighter3' });
    });
  });

  describe('Hit Application', () => {
    test('should apply damage to fighter on hit', () => {
      const projectile = createProjectile(mockProjectileDef, mockFighter, 100);
      const target = {
        ...mockFighter,
        id: 'fighter2',
        teamId: 1,
        health: 100,
      };

      const { fighter } = applyProjectileHit(projectile, target, false);

      expect(fighter.health).toBe(80); // 100 - 20 damage
    });

    test('should apply chip damage when blocked', () => {
      const projectile = createProjectile(mockProjectileDef, mockFighter, 100);
      const target = {
        ...mockFighter,
        id: 'fighter2',
        teamId: 1,
        health: 100,
      };

      const { fighter } = applyProjectileHit(projectile, target, true);

      expect(fighter.health).toBe(95); // 100 - 5 chip damage
    });

    test('should apply hitstun to fighter', () => {
      const projectile = createProjectile(mockProjectileDef, mockFighter, 100);
      const target = {
        ...mockFighter,
        id: 'fighter2',
        teamId: 1,
      };

      const { fighter } = applyProjectileHit(projectile, target, false);

      expect(fighter.stunFramesRemaining).toBe(15);
      expect(fighter.status).toBe(FighterStatus.HITSTUN);
    });

    test('should apply blockstun when blocked', () => {
      const projectile = createProjectile(mockProjectileDef, mockFighter, 100);
      const target = {
        ...mockFighter,
        id: 'fighter2',
        teamId: 1,
      };

      const { fighter } = applyProjectileHit(projectile, target, true);

      expect(fighter.stunFramesRemaining).toBe(10);
      expect(fighter.status).toBe(FighterStatus.BLOCKSTUN);
    });

    test('should apply knockback on hit', () => {
      const projectile = createProjectile(mockProjectileDef, mockFighter, 100);
      const target = {
        ...mockFighter,
        id: 'fighter2',
        teamId: 1,
      };

      const { fighter } = applyProjectileHit(projectile, target, false);

      expect(fighter.velocity.x).toBe(8);
    });

    test('should reduce knockback when blocked', () => {
      const projectile = createProjectile(mockProjectileDef, mockFighter, 100);
      const target = {
        ...mockFighter,
        id: 'fighter2',
        teamId: 1,
      };

      const { fighter } = applyProjectileHit(projectile, target, true);

      expect(fighter.velocity.x).toBe(4); // 50% of 8
    });

    test('should destroy single-hit projectile on hit', () => {
      const projectile = createProjectile(mockProjectileDef, mockFighter, 100);
      const target = {
        ...mockFighter,
        id: 'fighter2',
        teamId: 1,
      };

      const { projectile: newProjectile } = applyProjectileHit(projectile, target, false);

      expect(newProjectile).toBeNull();
    });

    test('should increment combo count on hit', () => {
      const projectile = createProjectile(mockProjectileDef, mockFighter, 100);
      const target = {
        ...mockFighter,
        id: 'fighter2',
        teamId: 1,
        comboCount: 2,
      };

      const { fighter } = applyProjectileHit(projectile, target, false);

      expect(fighter.comboCount).toBe(3);
    });

    test('should reset combo count when blocked', () => {
      const projectile = createProjectile(mockProjectileDef, mockFighter, 100);
      const target = {
        ...mockFighter,
        id: 'fighter2',
        teamId: 1,
        comboCount: 3,
      };

      const { fighter } = applyProjectileHit(projectile, target, true);

      expect(fighter.comboCount).toBe(0);
    });
  });

  describe('Multi-Hit Projectiles', () => {
    const multiHitDef: ProjectileDefinition = {
      ...mockProjectileDef,
      hitLimit: 3,
      destroyOnHit: false,
    };

    test('should not destroy multi-hit projectile on first hit', () => {
      const projectile = createProjectile(multiHitDef, mockFighter, 100);
      const target = {
        ...mockFighter,
        id: 'fighter2',
        teamId: 1,
      };

      const { projectile: newProjectile } = applyProjectileHit(projectile, target, false);

      expect(newProjectile).not.toBeNull();
      expect(newProjectile!.hitCount).toBe(1);
    });

    test('should destroy multi-hit projectile after hit limit', () => {
      let projectile: ProjectileState | null = createProjectile(multiHitDef, mockFighter, 100);
      const target = {
        ...mockFighter,
        id: 'fighter2',
        teamId: 1,
      };

      // Hit 1
      let result = applyProjectileHit(projectile, target, false);
      projectile = result.projectile;
      expect(projectile).not.toBeNull();
      expect(projectile!.hitCount).toBe(1);

      // Hit 2
      result = applyProjectileHit(projectile!, target, false);
      projectile = result.projectile;
      expect(projectile).not.toBeNull();
      expect(projectile!.hitCount).toBe(2);

      // Hit 3 - should destroy
      result = applyProjectileHit(projectile!, target, false);
      projectile = result.projectile;
      expect(projectile).toBeNull();
    });

    test('should destroy projectile when hit count reaches limit during update', () => {
      const projectile = {
        ...createProjectile(multiHitDef, mockFighter, 100),
        hitCount: 3, // At limit
      };

      const result = updateProjectile(projectile, 101, 1000);
      expect(result).toBeNull();
    });
  });

  describe('Projectile Clashing', () => {
    test('should detect projectile clash', () => {
      const proj1 = createProjectile(mockProjectileDef, mockFighter, 100);
      const proj2 = createProjectile(
        mockProjectileDef,
        { ...mockFighter, id: 'fighter2', teamId: 1, facing: -1 },
        100
      );

      // Position them to overlap
      proj2.position = { x: proj1.position.x + 10, y: proj1.position.y };

      expect(checkProjectileClash(proj1, proj2)).toBe(true);
    });

    test('should not clash projectiles from same team', () => {
      const proj1 = createProjectile(mockProjectileDef, mockFighter, 100);
      const proj2 = createProjectile(
        mockProjectileDef,
        { ...mockFighter, id: 'fighter2', teamId: 0 }, // Same team
        100
      );

      proj2.position = { x: proj1.position.x + 10, y: proj1.position.y };

      expect(checkProjectileClash(proj1, proj2)).toBe(false);
    });

    test('should not clash when projectiles do not overlap', () => {
      const proj1 = createProjectile(mockProjectileDef, mockFighter, 100);
      const proj2 = createProjectile(
        mockProjectileDef,
        { ...mockFighter, id: 'fighter2', teamId: 1 },
        100
      );

      proj2.position = { x: proj1.position.x + 200, y: proj1.position.y };

      expect(checkProjectileClash(proj1, proj2)).toBe(false);
    });

    test('should resolve clashes and remove both projectiles', () => {
      const proj1 = createProjectile(mockProjectileDef, mockFighter, 100);
      const proj2 = createProjectile(
        mockProjectileDef,
        { ...mockFighter, id: 'fighter2', teamId: 1, facing: -1 },
        100
      );
      const proj3 = createProjectile(mockProjectileDef, mockFighter, 101);

      // Position proj1 and proj2 to clash
      proj2.position = { x: proj1.position.x + 10, y: proj1.position.y };
      proj3.position = { x: proj1.position.x + 300, y: proj1.position.y }; // Far away

      const result = resolveProjectileClashes([proj1, proj2, proj3]);

      expect(result.length).toBe(1);
      expect(result[0].id).toBe(proj3.id);
    });

    test('should handle multiple simultaneous clashes', () => {
      const proj1 = createProjectile(mockProjectileDef, mockFighter, 100);
      const proj2 = createProjectile(
        mockProjectileDef,
        { ...mockFighter, id: 'fighter2', teamId: 1 },
        100
      );
      const proj3 = createProjectile(mockProjectileDef, mockFighter, 101);
      const proj4 = createProjectile(
        mockProjectileDef,
        { ...mockFighter, id: 'fighter2', teamId: 1 },
        101
      );

      // Set up two separate clashes
      proj2.position = { x: proj1.position.x + 10, y: proj1.position.y };
      proj4.position = { x: proj3.position.x + 10, y: proj3.position.y };

      const result = resolveProjectileClashes([proj1, proj2, proj3, proj4]);

      expect(result.length).toBe(0); // All should be removed
    });
  });

  describe('Batch Updates', () => {
    test('should update multiple projectiles', () => {
      const proj1 = createProjectile(mockProjectileDef, mockFighter, 100);
      const proj2 = createProjectile(mockProjectileDef, mockFighter, 101);
      const proj3 = createProjectile(mockProjectileDef, mockFighter, 102);

      const updated = updateProjectiles([proj1, proj2, proj3], 105, 1000);

      expect(updated.length).toBe(3);
      updated.forEach((proj, i) => {
        expect(proj.position.x).toBeGreaterThan([proj1, proj2, proj3][i].position.x);
      });
    });

    test('should remove expired projectiles from batch', () => {
      const proj1 = createProjectile(mockProjectileDef, mockFighter, 100);
      const shortDef = { ...mockProjectileDef, lifespan: 5 };
      const proj2 = createProjectile(shortDef, mockFighter, 100);

      const updated = updateProjectiles([proj1, proj2], 106, 1000);

      expect(updated.length).toBe(1);
      expect(updated[0].id).toBe(proj1.id);
    });

    test('should handle empty projectile array', () => {
      const updated = updateProjectiles([], 100, 1000);
      expect(updated).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    test('should handle zero damage projectile', () => {
      const zeroDef = { ...mockProjectileDef, damage: 0, chipDamage: 0 };
      const projectile = createProjectile(zeroDef, mockFighter, 100);
      const target = {
        ...mockFighter,
        id: 'fighter2',
        teamId: 1,
        health: 100,
      };

      const { fighter } = applyProjectileHit(projectile, target, false);

      expect(fighter.health).toBe(100);
    });

    test('should not reduce health below zero', () => {
      const projectile = createProjectile(mockProjectileDef, mockFighter, 100);
      const target = {
        ...mockFighter,
        id: 'fighter2',
        teamId: 1,
        health: 10,
      };

      const { fighter } = applyProjectileHit(projectile, target, false);

      expect(fighter.health).toBe(0);
      expect(fighter.health).toBeGreaterThanOrEqual(0);
    });

    test('should handle projectile with zero velocity', () => {
      const staticDef = { ...mockProjectileDef, speed: 0 };
      const projectile = createProjectile(staticDef, mockFighter, 100);

      const updated = updateProjectile(projectile, 101, 1000);

      expect(updated!.position.x).toBe(projectile.position.x);
    });

    test('should handle fighter with no hurtboxes', () => {
      const projectile = createProjectile(mockProjectileDef, mockFighter, 100);
      const target = {
        ...mockFighter,
        id: 'fighter2',
        teamId: 1,
        hurtboxes: [], // No hurtboxes
      };

      expect(checkProjectileHit(projectile, target)).toBe(false);
    });
  });
});
