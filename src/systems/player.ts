import { WORLD_H, WORLD_W } from '../core/constants';
import { approach, clamp, lerp } from '../core/math';
import type { InputState } from '../core/types';
import type { GameSim } from '../core/game';

const BULLET_SPEED = 760;
const ROLL_TIME = 0.5;
const ROLL_COOLDOWN = 1.5;
const MISSILE_COOLDOWN = 0.45;

/** Patrones de disparo por nivel de arma: [desplazamiento x, ángulo]. */
const WEAPON_PATTERNS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [[-6, 0], [6, 0]],
  [[-9, 0], [0, 0], [9, 0]],
  [[-7, 0], [7, 0], [-12, -0.12], [12, 0.12]],
  [[-7, 0], [7, 0], [-12, -0.12], [12, 0.12], [0, 0]],
  [[-7, 0], [7, 0], [-14, -0.1], [14, 0.1], [-16, -0.24], [16, 0.24]],
];

/** Movimiento con aceleración/desaceleración, turbo, tonel evasivo y armas. */
export function updatePlayer(sim: GameSim, input: InputState, prev: InputState, dt: number): void {
  const p = sim.player;
  p.fireCd -= dt;
  p.missileCd -= dt;
  p.rollCd -= dt;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.damageFlash > 0) p.damageFlash -= dt;

  if (!p.alive) {
    if (p.lives > 0) {
      p.respawn -= dt;
      if (p.respawn <= 0) sim.respawnPlayer();
    }
    return;
  }

  // Turbo: consume la barra mientras se mantiene, se recarga al soltar.
  const wantsTurbo = input.turbo && p.turbo > 4;
  p.turboActive = wantsTurbo;
  if (wantsTurbo) p.turbo = Math.max(0, p.turbo - sim.turboDrain * dt);
  else p.turbo = Math.min(100, p.turbo + 16 * dt);

  let ix = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let iy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (ix !== 0 && iy !== 0) {
    ix *= Math.SQRT1_2;
    iy *= Math.SQRT1_2;
  }
  const maxSpeed = sim.playerSpeed * (wantsTurbo ? 1.65 : 1);
  const accel = sim.plane.accel * (wantsTurbo ? 1.4 : 1);
  // Si no hay entrada, frena con menos fuerza: deriva suave.
  const ax = ix !== 0 ? accel : accel * 0.7;
  const ay = iy !== 0 ? accel : accel * 0.7;
  p.vx = approach(p.vx, ix * maxSpeed, ax * dt);
  p.vy = approach(p.vy, iy * maxSpeed, ay * dt);

  // Tonel (Q/E): esquiva breve con invulnerabilidad e impulso lateral.
  const rollPressed = (input.rollLeft && !prev.rollLeft) || (input.rollRight && !prev.rollRight);
  if (rollPressed && p.rollCd <= 0 && p.roll <= 0) {
    p.rollDir = input.rollLeft && !prev.rollLeft ? -1 : 1;
    p.roll = ROLL_TIME;
    p.rollCd = ROLL_COOLDOWN;
    p.vx += p.rollDir * 260;
    sim.emit({ type: 'roll', dir: p.rollDir });
  }
  if (p.roll > 0) p.roll -= dt;

  p.x += (p.vx + sim.wind) * dt;
  p.y += p.vy * dt;
  const minY = p.radius + 60;
  const maxY = WORLD_H - p.radius - 16;
  if (p.x < p.radius) { p.x = p.radius; p.vx = Math.max(0, p.vx); }
  if (p.x > WORLD_W - p.radius) { p.x = WORLD_W - p.radius; p.vx = Math.min(0, p.vx); }
  if (p.y < minY) { p.y = minY; p.vy = Math.max(0, p.vy); }
  if (p.y > maxY) { p.y = maxY; p.vy = Math.min(0, p.vy); }
  p.bank = lerp(p.bank, clamp(p.vx / sim.playerSpeed, -1, 1), Math.min(1, dt * 8));

  // Disparo principal (Espacio): cadencia fija, patrón según nivel de arma.
  if (input.fire && p.fireCd <= 0) {
    const pattern = WEAPON_PATTERNS[clamp(p.weaponLevel, 1, 5) - 1];
    for (const [ox, ang] of pattern) {
      sim.firePlayerBullet(p.x + ox, p.y - 18, Math.sin(ang) * BULLET_SPEED, -Math.cos(ang) * BULLET_SPEED);
    }
    p.fireCd = 1 / sim.plane.fireRate;
    sim.emit({ type: 'shot', x: p.x, y: p.y });
  }

  // Misiles (J): pareja de misiles guiados hacia los blancos más cercanos.
  if (input.missile && p.missileCd <= 0 && p.missiles > 0) {
    const targets = sim.nearestEnemies(p.x, p.y, 2);
    const n = Math.min(2, p.missiles);
    for (let i = 0; i < n; i++) {
      const side = n === 1 ? 0 : i === 0 ? -1 : 1;
      const target = targets[i] ?? targets[0];
      sim.firePlayerMissile(p.x + side * 16, p.y, side * 140, -260, target ? target.id : -1);
    }
    p.missiles -= n;
    p.missileCd = MISSILE_COOLDOWN;
    sim.emit({ type: 'missile', x: p.x, y: p.y });
  }

  // Arma especial (K): pulso EMP que daña a todos los enemigos y borra sus proyectiles.
  if (input.special && !prev.special && p.energy >= 100) {
    p.energy = 0;
    sim.triggerSpecial();
  }

  p.energy = Math.min(100, p.energy + 1.6 * dt);
}
