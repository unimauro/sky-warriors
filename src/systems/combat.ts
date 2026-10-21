import { WORLD_H, WORLD_W } from '../core/constants';
import { angleDiff } from '../core/math';
import type { Enemy, Projectile } from '../core/types';
import type { GameSim } from '../core/game';
import { circlesOverlap } from './collision';

const PLAYER_MISSILE_TURN = 5.5;
const PLAYER_MISSILE_MAX = 600;
const ENEMY_MISSILE_TURN = 1.7;
const ENEMY_MISSILE_SPEED = 215;

const candidates: Enemy[] = [];
const enemyMissiles: Projectile[] = [];

function steerTowards(pr: Projectile, tx: number, ty: number, turnRate: number, speed: number, dt: number) {
  const current = Math.atan2(pr.vy, pr.vx);
  const desired = Math.atan2(ty - pr.y, tx - pr.x);
  const diff = angleDiff(current, desired);
  const maxTurn = turnRate * dt;
  const next = current + Math.max(-maxTurn, Math.min(maxTurn, diff));
  pr.vx = Math.cos(next) * speed;
  pr.vy = Math.sin(next) * speed;
}

/** Mueve proyectiles, aplica guiado de misiles y recicla los que salen del campo. */
export function updateProjectiles(sim: GameSim, dt: number): void {
  sim.projectiles.forEachActive((pr) => {
    pr.life -= dt;
    if (pr.kind === 'missile') {
      let target = pr.targetId >= 0 ? sim.getEnemy(pr.targetId) : undefined;
      if (!target || !target.alive) {
        target = sim.nearestEnemies(pr.x, pr.y, 1)[0];
        pr.targetId = target ? target.id : -1;
      }
      const speed = Math.min(PLAYER_MISSILE_MAX, Math.hypot(pr.vx, pr.vy) + 900 * dt);
      if (target) steerTowards(pr, target.x, target.y, PLAYER_MISSILE_TURN, speed, dt);
      else {
        const s = speed / Math.max(1, Math.hypot(pr.vx, pr.vy));
        pr.vx *= s;
        pr.vy *= s;
      }
    } else if (pr.kind === 'enemyMissile' && sim.player.alive && pr.life > 1) {
      steerTowards(pr, sim.player.x, sim.player.y, ENEMY_MISSILE_TURN, ENEMY_MISSILE_SPEED, dt);
    }
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    if (pr.life <= 0 || pr.x < -40 || pr.x > WORLD_W + 40 || pr.y < -60 || pr.y > WORLD_H + 40) {
      sim.projectiles.release(pr);
    }
  });
}

/** Resuelve todas las colisiones del paso: proyectiles, cuerpos, escenario y power-ups. */
export function resolveCollisions(sim: GameSim): void {
  const p = sim.player;
  sim.rebuildEnemyHash();

  enemyMissiles.length = 0;
  sim.projectiles.forEachActive((pr) => {
    if (pr.kind === 'enemyMissile') enemyMissiles.push(pr);
  });

  sim.projectiles.forEachActive((pr) => {
    if (pr.kind === 'bullet' || pr.kind === 'missile') {
      // El escenario (picos, torres) bloquea los disparos.
      for (const o of sim.obstacles) {
        if (o.active && circlesOverlap(pr.x, pr.y, pr.radius, o.x, o.y, o.radius * 0.8)) {
          sim.emit({ type: 'hit', x: pr.x, y: pr.y });
          sim.projectiles.release(pr);
          return;
        }
      }
      // Las balas pueden derribar misiles enemigos.
      for (const m of enemyMissiles) {
        if (m.active && circlesOverlap(pr.x, pr.y, pr.radius, m.x, m.y, m.radius)) {
          sim.emit({ type: 'explosion', x: m.x, y: m.y, size: 0.5, ground: false });
          sim.projectiles.release(m);
          sim.projectiles.release(pr);
          sim.addScore(25);
          return;
        }
      }
      sim.enemyHash.query(pr.x, pr.y, pr.radius, candidates);
      for (const e of candidates) {
        if (!e.alive || !circlesOverlap(pr.x, pr.y, pr.radius, e.x, e.y, e.radius)) continue;
        if (e.type === 'boss' && e.state === 'enter') continue;
        if (pr.kind === 'bullet') sim.stats.shotsHit++;
        sim.emit(pr.kind === 'missile'
          ? { type: 'explosion', x: pr.x, y: pr.y, size: 0.6, ground: e.ground }
          : { type: 'hit', x: pr.x, y: pr.y });
        sim.damageEnemy(e, pr.damage);
        sim.projectiles.release(pr);
        return;
      }
      return;
    }

    // Proyectiles enemigos contra el jugador (hitbox algo menor que el sprite: más justo).
    if (p.alive && circlesOverlap(pr.x, pr.y, pr.radius, p.x, p.y, p.radius * 0.55)) {
      if (sim.isPlayerVulnerable()) {
        sim.damagePlayer(pr.damage);
        sim.projectiles.release(pr);
      }
    }
  });

  if (!p.alive) return;

  // Choques de cuerpos contra aviones enemigos.
  sim.enemyHash.query(p.x, p.y, p.radius, candidates);
  for (const e of candidates) {
    if (!e.alive || e.ground) continue;
    if (!circlesOverlap(p.x, p.y, p.radius * 0.7, e.x, e.y, e.radius * 0.8)) continue;
    if (!sim.isPlayerVulnerable()) continue;
    if (e.type === 'drone') {
      sim.damagePlayer(20 * sim.diff.damage);
      sim.killEnemy(e, false);
    } else if (e.type === 'boss') {
      sim.damagePlayer(30 * sim.diff.damage);
      p.vy = 400;
    } else {
      sim.damagePlayer(25 * sim.diff.damage);
      sim.damageEnemy(e, 12);
    }
  }

  // Choques contra el escenario.
  for (const o of sim.obstacles) {
    if (!o.active || !circlesOverlap(p.x, p.y, p.radius * 0.6, o.x, o.y, o.radius * 0.85)) continue;
    const dx = p.x - o.x;
    const dy = p.y - o.y;
    const d = Math.hypot(dx, dy) || 1;
    const push = p.radius * 0.6 + o.radius * 0.85 - d;
    p.x += (dx / d) * push;
    p.y += (dy / d) * push;
    p.vx = (dx / d) * 220;
    p.vy = (dy / d) * 220;
    if (sim.isPlayerVulnerable()) {
      sim.damagePlayer(18 * sim.diff.damage);
      p.invuln = Math.max(p.invuln, 0.7);
    }
  }

  // Power-ups.
  for (const pk of sim.pickups) {
    if (pk.active && circlesOverlap(p.x, p.y, p.radius + 6, pk.x, pk.y, 14)) sim.collectPickup(pk);
  }
}
