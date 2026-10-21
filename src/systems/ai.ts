import { WORLD_H, WORLD_W } from '../core/constants';
import type { Enemy } from '../core/types';
import { clamp } from '../core/math';
import { BOSSES, ENEMY_DEFS, type BossAttack } from '../entities/enemies';
import type { GameSim } from '../core/game';
import { applySteering, arrive, combine, flee, pursue, seek, separation } from './steering';

/**
 * IA de enemigos en tiempo real: máquinas de estados finitos (campo `state`) que combinan
 * steering behaviors y patrones parametrizados. Corre en cada paso fijo, sin servicios externos;
 * un agente remoto opcional solo ajusta parámetros globales (ver ai/agentBridge.ts).
 */
export function updateEnemy(sim: GameSim, e: Enemy, dt: number): void {
  e.age += dt;
  e.stateTime += dt;
  e.fireCd -= dt;
  e.evadeCd -= dt;
  if (e.flash > 0) e.flash -= dt;

  switch (e.type) {
    case 'scout':
      updateScout(sim, e, dt);
      break;
    case 'interceptor':
      updateInterceptor(sim, e, dt);
      break;
    case 'bomber':
      updateBomber(sim, e, dt);
      break;
    case 'ace':
      updateAce(sim, e, dt);
      break;
    case 'drone':
      updateDrone(sim, e, dt);
      break;
    case 'turret':
      updateTurret(sim, e, dt);
      break;
    case 'boss':
      updateBoss(sim, e, dt);
      break;
  }

  if (e.type !== 'boss' && e.age > 2) {
    const out = e.y > WORLD_H + 90 || e.y < -170 || e.x < -140 || e.x > WORLD_W + 140;
    if (out) sim.despawnEnemy(e);
  }
}

const onScreen = (e: Enemy, margin = 0) =>
  e.x > -margin && e.x < WORLD_W + margin && e.y > 10 - margin && e.y < WORLD_H - 60 + margin;

const setState = (e: Enemy, state: string) => {
  e.state = state;
  e.stateTime = 0;
};

const headingFromVelocity = (e: Enemy) => {
  if (Math.abs(e.vx) + Math.abs(e.vy) > 1) e.heading = Math.atan2(e.vy, e.vx);
};

function aimAngle(sim: GameSim, e: Enemy, error: number): number {
  const p = sim.player;
  const base = Math.atan2(p.y - e.y, p.x - e.x);
  const spread = error / Math.max(sim.directive.accuracy, 0.2);
  return base + sim.rng.range(-spread, spread);
}

function cooldown(sim: GameSim, e: Enemy, factor = 1): number {
  return (ENEMY_DEFS[e.type].fireInterval * factor * sim.rng.range(0.8, 1.25)) / sim.fireMult;
}

// ── Exploradores: trayectoria sinusoidal parametrizada ─────────────────────────
function updateScout(sim: GameSim, e: Enemy, dt: number) {
  const p = e.pattern;
  const nx = p.baseX + p.amplitude * Math.sin(p.frequency * e.age + p.phase);
  e.vx = (nx - e.x) / dt;
  e.vy = p.speed;
  e.x = nx;
  e.y += p.speed * dt;
  headingFromVelocity(e);
  if (e.fireCd <= 0 && onScreen(e) && e.y < sim.player.y - 80) {
    sim.fireEnemyBullet(e.x, e.y + 10, aimAngle(sim, e, 0.3), 200);
    e.fireCd = cooldown(sim, e);
  }
}

// ── Interceptores: aproximación → ataque → ruptura → salida ───────────────────
function updateInterceptor(sim: GameSim, e: Enemy, dt: number) {
  const p = sim.player;
  const def = ENEMY_DEFS.interceptor;
  const speed = def.speed * (0.9 + 0.1 * sim.directive.aggression);
  const neighbors = sim.neighbors(e, 60);
  const sep = separation(e, neighbors, 60, 400);
  const dist = Math.hypot(p.x - e.x, p.y - e.y);

  if (e.state === 'spawn') setState(e, 'approach');
  if (e.age > 16 && e.state !== 'exit') setState(e, 'exit');

  switch (e.state) {
    case 'approach':
      applySteering(e, combine(seek(e, p.x, p.y - 140, speed), sep), 420, speed, dt);
      if (dist < 260 && e.stateTime > 0.6) setState(e, 'attack');
      break;
    case 'attack':
      applySteering(e, combine(pursue(e, p, speed * 0.65), sep), 300, speed * 0.65, dt);
      if (e.fireCd <= 0 && e.y < p.y - 30) {
        sim.fireEnemyBullet(e.x, e.y, aimAngle(sim, e, 0.12), 250);
        e.fireCd = cooldown(sim, e, 0.4);
      }
      if (e.stateTime > 1.3 || dist < 70) setState(e, 'breakoff');
      break;
    case 'breakoff':
      applySteering(e, combine(flee(e, p.x, p.y + 200, speed), sep), 520, speed, dt);
      if (e.stateTime > 1.4) setState(e, 'approach');
      break;
    case 'exit':
      applySteering(e, seek(e, e.x, -260, speed * 1.2), 500, speed * 1.2, dt);
      break;
  }
  headingFromVelocity(e);
}

// ── Bombarderos: descenso → bombardeo de abanico → salida ─────────────────────
function updateBomber(sim: GameSim, e: Enemy, dt: number) {
  const def = ENEMY_DEFS.bomber;
  const p = e.pattern;
  if (e.state === 'spawn') setState(e, 'descend');
  switch (e.state) {
    case 'descend':
      applySteering(e, arrive(e, p.baseX, p.stopY, def.speed * 1.6, 90), 120, def.speed * 1.6, dt);
      if (Math.abs(e.y - p.stopY) < 12) setState(e, 'barrage');
      break;
    case 'barrage': {
      const tx = clamp(p.baseX + Math.sin(e.stateTime * 0.5) * 120, 60, WORLD_W - 60);
      applySteering(e, arrive(e, tx, p.stopY, def.speed, 60), 80, def.speed, dt);
      if (e.fireCd <= 0) {
        e.attackIndex++;
        if (e.attackIndex % 3 === 0) {
          for (let i = -1; i <= 1; i++) sim.fireEnemyBullet(e.x, e.y + 20, aimAngle(sim, e, 0.05) + i * 0.12, 230);
        } else {
          const n = 5;
          for (let i = 0; i < n; i++) sim.fireEnemyBullet(e.x, e.y + 20, Math.PI / 2 + (i - (n - 1) / 2) * 0.22, 170);
        }
        e.fireCd = cooldown(sim, e);
      }
      if (e.stateTime > 12) setState(e, 'exit');
      break;
    }
    case 'exit':
      applySteering(e, seek(e, e.x, WORLD_H + 200, def.speed * 1.5), 90, def.speed * 1.5, dt);
      break;
  }
  e.heading = Math.PI / 2;
}

// ── Cazas avanzados: posicionamiento táctico, ráfagas y evasión de proyectiles ─
function updateAce(sim: GameSim, e: Enemy, dt: number) {
  const pl = sim.player;
  const def = ENEMY_DEFS.ace;
  const speed = def.speed;
  if (e.state === 'spawn') {
    e.offsetX = sim.rng.range(-150, 150);
    setState(e, 'position');
  }
  if (e.age > 26 && e.state !== 'exit') setState(e, 'exit');

  // Detección de amenaza: un proyectil del jugador que sube hacia el caza.
  if (e.state !== 'evade' && e.state !== 'exit' && e.evadeCd <= 0) {
    const threat = sim.findThreat(e, 170);
    if (threat && sim.rng.chance(0.75 * sim.directive.aggression)) {
      e.attackIndex = threat.x < e.x ? 1 : -1;
      if (e.x < 70) e.attackIndex = 1;
      if (e.x > WORLD_W - 70) e.attackIndex = -1;
      setState(e, 'evade');
      e.evadeCd = 1.1;
    }
  }

  const tx = clamp(pl.x + e.offsetX, 50, WORLD_W - 50);
  const ty = clamp(pl.y - 290, 70, 380);
  const sep = separation(e, sim.neighbors(e, 70), 70, 500);

  switch (e.state) {
    case 'position':
      applySteering(e, combine(arrive(e, tx, ty, speed, 120), sep), 650, speed, dt);
      if (e.stateTime > 1.8 || Math.hypot(tx - e.x, ty - e.y) < 30) {
        setState(e, 'attack');
        e.shotTimer = 0;
        e.attackTimer = 3;
      }
      break;
    case 'attack':
      applySteering(e, combine(arrive(e, tx, ty, speed * 0.6, 120), sep), 500, speed * 0.6, dt);
      e.shotTimer -= dt;
      if (e.shotTimer <= 0 && e.attackTimer > 0 && e.fireCd <= 0) {
        sim.fireEnemyBullet(e.x, e.y + 12, aimAngle(sim, e, 0.06), 300);
        e.attackTimer--;
        e.shotTimer = 0.13;
        if (e.attackTimer === 0) e.fireCd = cooldown(sim, e);
      }
      if (e.attackTimer === 0 && e.stateTime > 0.8) {
        e.offsetX = sim.rng.range(-170, 170);
        setState(e, 'position');
      }
      break;
    case 'evade':
      e.vx = e.attackIndex * speed * 1.5;
      e.vy *= 0.9;
      e.x = clamp(e.x + e.vx * dt, 20, WORLD_W - 20);
      e.y += e.vy * dt;
      if (e.stateTime > 0.32) setState(e, 'position');
      break;
    case 'exit':
      applySteering(e, seek(e, e.x, -260, speed), 500, speed, dt);
      break;
  }
  e.heading = e.state === 'exit' ? -Math.PI / 2 : Math.PI / 2;
  e.spin = clamp(e.vx / speed, -1, 1);
}

// ── Drones kamikaze: persecución con predicción ───────────────────────────────
function updateDrone(sim: GameSim, e: Enemy, dt: number) {
  const def = ENEMY_DEFS.drone;
  if (e.state === 'spawn') setState(e, 'hunt');
  if (sim.player.alive && e.age < 8) {
    applySteering(e, pursue(e, sim.player, def.speed), 260, def.speed, dt);
  } else {
    applySteering(e, seek(e, e.x, WORLD_H + 300, def.speed), 300, def.speed, dt);
  }
  headingFromVelocity(e);
}

// ── Bases terrestres: se desplazan con el terreno y apuntan al jugador ────────
function updateTurret(sim: GameSim, e: Enemy, dt: number) {
  e.y += sim.mission.scrollSpeed * dt;
  e.vy = sim.mission.scrollSpeed;
  e.heading = Math.atan2(sim.player.y - e.y, sim.player.x - e.x);
  if (e.fireCd <= 0 && e.y > 20 && e.y < sim.player.y - 60) {
    const a = aimAngle(sim, e, 0.1);
    sim.fireEnemyBullet(e.x, e.y, a, 210);
    sim.fireEnemyBullet(e.x, e.y, a + 0.15, 210);
    e.fireCd = cooldown(sim, e);
  }
}

// ── Jefes: entrada → combate por fases con ataques encadenados ────────────────
const ATTACK_COOLDOWN: Record<BossAttack, number> = {
  fan: 1.5, aimed: 1.1, spiral: 3.0, drones: 2.4, missiles: 2.0, charge: 2.6, rain: 2.2,
};

function updateBoss(sim: GameSim, e: Enemy, dt: number) {
  const def = BOSSES[e.variant];
  const stopY = e.pattern.stopY;

  if (e.state === 'spawn') setState(e, 'enter');
  if (e.state === 'enter') {
    if (def.ground) e.y += sim.mission.scrollSpeed * 1.4 * dt;
    else e.y += (stopY - e.y) * Math.min(1, dt * 1.2) + 20 * dt;
    e.vy = 60;
    if (e.y >= stopY) {
      e.y = stopY;
      setState(e, 'fight');
      e.fireCd = 1.2;
      sim.emit({ type: 'bossPhase', phase: 1 });
    }
    return;
  }

  // Cambio de fase según la vida restante.
  const nPhases = def.phases.length;
  const phase = Math.min(nPhases - 1, Math.floor((1 - e.hp / e.maxHp) * nPhases));
  if (phase !== e.phase) {
    e.phase = phase;
    e.attackIndex = 0;
    e.attack = '';
    e.fireCd = 1.4;
    sim.emit({ type: 'bossPhase', phase: phase + 1 });
    sim.emit({ type: 'explosion', x: e.x + sim.rng.range(-40, 40), y: e.y, size: 1.6, ground: def.ground });
    sim.dropPickup(e.x, e.y, true);
  }

  const rage = 1 + phase * 0.35;
  const prevX = e.x;
  if (e.attack === 'charge') {
    // Embestida: se lanza sobre la columna del jugador mientras dispara hacia abajo.
    e.x += clamp(sim.player.x - e.x, -1, 1) * 260 * dt;
    e.y = stopY + Math.sin(e.attackTimer * Math.PI) * 140;
  } else if (!def.ground) {
    e.x = WORLD_W / 2 + Math.sin(e.stateTime * 0.55 * rage) * (WORLD_W / 2 - e.radius - 24);
    e.y = stopY + Math.sin(e.stateTime * 1.3) * 22;
  } else {
    e.x = WORLD_W / 2 + Math.sin(e.stateTime * 0.3) * 60;
  }
  e.x = clamp(e.x, e.radius, WORLD_W - e.radius);
  e.vx = (e.x - prevX) / dt;
  e.vy = 0;
  e.heading = Math.PI / 2;

  if (e.attack) runBossAttack(sim, e, dt, rage);
  else if (e.fireCd <= 0) {
    const list = def.phases[phase];
    const next = list[e.attackIndex % list.length];
    e.attackIndex++;
    if (next === 'charge' && def.ground) return;
    startBossAttack(e, next);
  }
}

function startBossAttack(e: Enemy, attack: BossAttack) {
  e.attack = attack;
  e.shotTimer = 0;
  switch (attack) {
    case 'fan': e.attackTimer = 3; break;
    case 'aimed': e.attackTimer = 6; break;
    case 'spiral': e.attackTimer = 2.4; break;
    case 'drones': e.attackTimer = 1; break;
    case 'missiles': e.attackTimer = 1; break;
    case 'charge': e.attackTimer = 1.6; break;
    case 'rain': e.attackTimer = 16; break;
  }
}

function finishAttack(sim: GameSim, e: Enemy, attack: BossAttack, rage: number) {
  e.attack = '';
  e.fireCd = (ATTACK_COOLDOWN[attack] / rage) / sim.fireMult;
}

function runBossAttack(sim: GameSim, e: Enemy, dt: number, rage: number) {
  const attack = e.attack as BossAttack;
  e.shotTimer -= dt;
  const muzzleY = e.y + e.radius * 0.5;
  switch (attack) {
    case 'fan': {
      if (e.shotTimer > 0) return;
      const n = 9 + e.phase * 2;
      const offset = (e.attackTimer % 2) * 0.06;
      for (let i = 0; i < n; i++) {
        const a = Math.PI / 2 + (i - (n - 1) / 2) * (1.3 / n) + offset;
        sim.fireEnemyBullet(e.x, muzzleY, a, 185 + e.phase * 15);
      }
      e.attackTimer--;
      e.shotTimer = 0.45;
      if (e.attackTimer <= 0) finishAttack(sim, e, attack, rage);
      return;
    }
    case 'aimed': {
      if (e.shotTimer > 0) return;
      for (const dx of [-e.radius * 0.6, e.radius * 0.6]) {
        const a = Math.atan2(sim.player.y - muzzleY, sim.player.x - (e.x + dx));
        sim.fireEnemyBullet(e.x + dx, muzzleY, a + sim.rng.range(-0.04, 0.04), 290);
      }
      e.attackTimer--;
      e.shotTimer = 0.14;
      if (e.attackTimer <= 0) finishAttack(sim, e, attack, rage);
      return;
    }
    case 'spiral': {
      e.attackTimer -= dt;
      if (e.shotTimer <= 0) {
        const arms = 2 + e.phase;
        for (let i = 0; i < arms; i++) sim.fireEnemyBullet(e.x, e.y, e.spin + (i * Math.PI * 2) / arms, 165);
        e.spin += 0.27;
        e.shotTimer = 0.085;
      }
      if (e.attackTimer <= 0) finishAttack(sim, e, attack, rage);
      return;
    }
    case 'drones': {
      const n = 3 + e.phase;
      for (let i = 0; i < n; i++) {
        sim.spawnEnemy('drone', e.x + (i - (n - 1) / 2) * 36, e.y + 20, {});
      }
      finishAttack(sim, e, attack, rage);
      return;
    }
    case 'missiles': {
      const n = 2 + e.phase;
      for (let i = 0; i < n; i++) {
        sim.fireEnemyMissile(e.x + (i - (n - 1) / 2) * 30, muzzleY, Math.PI / 2 + (i - (n - 1) / 2) * 0.4);
      }
      finishAttack(sim, e, attack, rage);
      return;
    }
    case 'charge': {
      e.attackTimer -= dt;
      if (e.shotTimer <= 0) {
        sim.fireEnemyBullet(e.x - 20, muzzleY, Math.PI / 2, 260);
        sim.fireEnemyBullet(e.x + 20, muzzleY, Math.PI / 2, 260);
        e.shotTimer = 0.18;
      }
      if (e.attackTimer <= 0) finishAttack(sim, e, attack, rage);
      return;
    }
    case 'rain': {
      if (e.shotTimer > 0) return;
      sim.fireEnemyBullet(e.x + sim.rng.range(-e.radius, e.radius), muzzleY, Math.PI / 2 + sim.rng.range(-0.8, 0.8), sim.rng.range(150, 230));
      e.attackTimer--;
      e.shotTimer = 0.09;
      if (e.attackTimer <= 0) finishAttack(sim, e, attack, rage);
      return;
    }
  }
}
