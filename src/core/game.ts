import { FIXED_DT, MAX_FRAME_DT, WORLD_H, WORLD_W } from './constants';
import { clamp } from './math';
import { Pool } from './pool';
import { Rng } from './rng';
import {
  emptyInput,
  type Difficulty,
  type Enemy,
  type EnemyType,
  type GameEvent,
  type GameMode,
  type GameStatus,
  type InputState,
  type MissionResult,
  type MissionStats,
  type Obstacle,
  type Pickup,
  type PickupKind,
  type Player,
  type Projectile,
} from './types';
import { ENEMY_DEFS, BOSSES } from '../entities/enemies';
import { getPlane, type PlaneDef } from '../entities/planes';
import type { UpgradeLevels } from '../entities/upgrades';
import { DIFFICULTY, getMission, type MissionDef, type WaveSpawn } from '../scenes/missions';
import { updateEnemy } from '../systems/ai';
import { SpatialHash } from '../systems/collision';
import { resolveCollisions, updateProjectiles } from '../systems/combat';
import { updatePlayer } from '../systems/player';
import { defaultDirective, type AiDirective } from '../ai/agentBridge';

export interface SimOptions {
  missionId: number;
  planeId: string;
  mode: GameMode;
  difficulty: Difficulty;
  upgrades: UpgradeLevels;
  seed?: number;
}

interface PendingSpawn {
  at: number;
  wave: WaveSpawn;
  index: number;
}

/**
 * Simulación completa de una misión, independiente del renderizador.
 * Los motores Phaser (2D/2.5D) y Three.js (3D) solo leen su estado y dibujan:
 * las reglas de combate viven únicamente aquí.
 */
export class GameSim {
  readonly mission: MissionDef;
  readonly plane: PlaneDef;
  readonly mode: GameMode;
  readonly difficulty: Difficulty;
  readonly diff: (typeof DIFFICULTY)[Difficulty];
  readonly rng: Rng;

  readonly player: Player;
  readonly enemies: Enemy[] = [];
  readonly projectiles: Pool<Projectile>;
  readonly pickups: Pickup[] = [];
  readonly obstacles: Obstacle[] = [];
  readonly enemyHash = new SpatialHash<Enemy>(80);
  readonly stats: MissionStats = {
    kills: 0, shotsFired: 0, shotsHit: 0, maxCombo: 0, basesDestroyed: 0, damageTaken: 0, continues: 0,
  };

  status: GameStatus = 'playing';
  time = 0;
  score = 0;
  combo = 0;
  comboTimer = 0;
  multiplier = 1;
  scrollY = 0;
  wind = 0;
  bossSpawned = false;
  boss: Enemy | null = null;
  endReason = '';
  /** Parámetros que un agente IA externo (opcional) puede modular. */
  directive: AiDirective = defaultDirective();

  playerSpeed: number;
  turboDrain: number;
  fireMult: number;
  private damageMult: number;

  private events: GameEvent[] = [];
  private pending: PendingSpawn[] = [];
  private nextEnemyId = 1;
  private nextPickupId = 1;
  private nextObstacleId = 1;
  private nextProjectileId = 1;
  private accumulator = 0;
  private prevInput: InputState = emptyInput();
  private enemiesSpawned = 0;
  private obstacleTimer = 4;
  private endTimer = -1;
  private proximityCd = 0;
  private totalBases = 0;

  constructor(opts: SimOptions) {
    this.mission = getMission(opts.missionId);
    this.plane = getPlane(opts.planeId);
    this.mode = opts.mode;
    this.difficulty = opts.difficulty;
    this.diff = DIFFICULTY[opts.difficulty];
    this.rng = new Rng(opts.seed ?? (Date.now() ^ (opts.missionId * 7919)));

    const up = opts.upgrades;
    const hpMult = 1 + up.armor * 0.12;
    this.damageMult = (1 + up.firepower * 0.12) * this.plane.bulletDamage;
    this.playerSpeed = this.plane.maxSpeed * (1 + up.engine * 0.06);
    this.turboDrain = 30 / (1 + up.engine * 0.15);
    this.fireMult = this.mission.tier * this.diff.fire;

    const maxHp = Math.round(this.plane.maxHp * hpMult);
    const maxShield = Math.round(this.plane.maxShield * hpMult);
    const maxMissiles = this.plane.maxMissiles + up.missiles * 3;
    this.player = {
      planeId: this.plane.id,
      x: WORLD_W / 2, y: WORLD_H - 140, vx: 0, vy: 0,
      radius: 16,
      hp: maxHp, maxHp,
      shield: maxShield, maxShield,
      missiles: maxMissiles, maxMissiles,
      energy: 40, turbo: 100, turboActive: false,
      weaponLevel: 1, lives: 3, invuln: 2.2,
      roll: 0, rollDir: 0, rollCd: 0, fireCd: 0, missileCd: 0,
      bank: 0, alive: true, respawn: 0, damageFlash: 0,
    };

    this.projectiles = new Pool<Projectile>(
      () => ({
        active: false, poolIndex: 0, id: 0, kind: 'bullet',
        x: 0, y: 0, vx: 0, vy: 0, damage: 1, radius: 4, life: 0, targetId: -1,
      }),
      320,
    );

    for (const wave of this.mission.waves) this.queueWave(wave);
    if (this.mission.theme === 'desert') {
      this.totalBases = this.mission.waves.filter((w) => w.objective).reduce((acc, w) => acc + w.count, 0);
    }
  }

  // ── Bucle principal ──────────────────────────────────────────────────────────

  /** Avanza la simulación con paso fijo; devuelve los eventos producidos. */
  tick(rawDt: number, input: InputState): GameEvent[] {
    this.events.length = 0;
    if (this.status !== 'playing') return this.events;
    let dt = Math.min(rawDt, MAX_FRAME_DT);
    this.accumulator += dt;
    while (this.accumulator >= FIXED_DT) {
      this.accumulator -= FIXED_DT;
      this.step(FIXED_DT, input);
      if (this.status !== 'playing') break;
    }
    return this.events;
  }

  private step(dt: number, input: InputState): void {
    this.time += dt;
    this.scrollY += this.mission.scrollSpeed * dt;
    if (this.mission.wind > 0) {
      this.wind = Math.sin(this.time * 0.35) * this.mission.wind + Math.sin(this.time * 1.7) * this.mission.wind * 0.3;
    }

    // Oleadas programadas.
    while (this.pending.length > 0 && this.pending[0].at <= this.time) {
      const sp = this.pending.shift()!;
      this.spawnFromWave(sp.wave, sp.index);
    }

    // Jefe.
    if (!this.bossSpawned && this.time >= this.mission.boss.at && this.basesObjectiveMet()) {
      this.spawnBoss();
    }

    // Obstáculos del escenario.
    if (this.mission.obstacles) {
      this.obstacleTimer -= dt;
      if (this.obstacleTimer <= 0 && !this.bossSpawned) {
        this.obstacleTimer = this.mission.obstacles.every * this.rng.range(0.75, 1.3);
        this.spawnObstacle(this.mission.obstacles.kind);
      }
    }
    for (const o of this.obstacles) {
      if (!o.active) continue;
      o.y += this.mission.scrollSpeed * dt;
      if (o.y > WORLD_H + o.radius + 60) o.active = false;
    }

    updatePlayer(this, input, this.prevInput, dt);
    for (const e of this.enemies) if (e.alive) updateEnemy(this, e, dt);
    updateProjectiles(this, dt);
    resolveCollisions(this);

    for (const pk of this.pickups) {
      if (!pk.active) continue;
      pk.t += dt;
      pk.y += pk.vy * dt;
      pk.x += Math.sin(pk.t * 2.2) * 24 * dt;
      if (pk.y > WORLD_H + 30) pk.active = false;
    }

    // Combo: se corta si pasa demasiado tiempo sin derribos.
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.multiplier = 1;
      }
    }

    // Alerta de proximidad: un misil enemigo activo cerca.
    this.proximityCd -= dt;
    if (this.proximityCd <= 0 && this.player.alive) {
      this.projectiles.forEachActive((pr) => {
        if (pr.kind === 'enemyMissile' && Math.hypot(pr.x - this.player.x, pr.y - this.player.y) < 150) {
          this.emit({ type: 'proximity' });
          this.proximityCd = 1.2;
        }
      });
    }

    this.prevInput = { ...input };

    // Retardo breve antes de cerrar la misión para que se vea la última explosión.
    if (this.endTimer > 0) {
      this.endTimer -= dt;
      if (this.endTimer <= 0) this.finish();
    }
  }

  // ── Spawning ────────────────────────────────────────────────────────────────

  private queueWave(wave: WaveSpawn): void {
    for (let i = 0; i < wave.count; i++) {
      this.pending.push({ at: wave.at + i * (wave.interval ?? 0.001), wave, index: i });
    }
    this.pending.sort((a, b) => a.at - b.at);
  }

  private spawnFromWave(wave: WaveSpawn, index: number): void {
    const n = wave.count;
    const fx = wave.x ?? 0.5;
    let x = WORLD_W * fx;
    let y = -40;
    const pattern: Partial<Enemy['pattern']> = {};
    switch (wave.formation) {
      case 'line':
        x = WORLD_W * ((index + 1) / (n + 1));
        break;
      case 'v':
        x = WORLD_W * fx + (index - (n - 1) / 2) * 52;
        y = -40 - Math.abs(index - (n - 1) / 2) * 42;
        break;
      case 'column':
        x = WORLD_W * fx;
        y = -40 - index * 50;
        break;
      case 'sine':
        x = WORLD_W * fx;
        pattern.baseX = x;
        pattern.amplitude = wave.amplitude ?? 110;
        break;
      case 'sides':
        x = index % 2 === 0 ? -30 : WORLD_W + 30;
        y = this.rng.range(40, 200);
        break;
      case 'random':
        x = this.rng.range(50, WORLD_W - 50);
        break;
      case 'ground':
        x = this.rng.range(70, WORLD_W - 70);
        y = -60;
        break;
    }
    this.spawnEnemy(wave.type, clamp(x, 30, WORLD_W - 30), y, pattern, wave.objective ?? false);
  }

  spawnEnemy(
    type: EnemyType,
    x: number,
    y: number,
    patternOverride: Partial<Enemy['pattern']>,
    objective = false,
  ): Enemy {
    const def = ENEMY_DEFS[type];
    const hp = Math.round(def.hp * this.mission.tier * this.diff.hp * this.directive.vitality);
    const e: Enemy = {
      id: this.nextEnemyId++,
      type,
      variant: '',
      x, y, vx: 0, vy: def.speed * 0.6,
      heading: Math.PI / 2,
      hp, maxHp: hp,
      radius: def.radius,
      alive: true,
      state: 'spawn',
      stateTime: 0,
      age: 0,
      fireCd: this.rng.range(0.4, 1.4),
      score: def.score,
      pattern: {
        baseX: x,
        amplitude: 110,
        frequency: this.rng.range(1.2, 2.2),
        phase: this.rng.range(0, Math.PI * 2),
        speed: def.speed * this.rng.range(0.85, 1.1),
        stopY: this.rng.range(90, 220),
        dir: this.rng.chance(0.5) ? 1 : -1,
        ...patternOverride,
      },
      phase: 0,
      ground: def.ground,
      objective,
      flash: 0,
      evadeCd: 0,
      spin: 0,
      attack: '',
      attackTimer: 0,
      attackIndex: 0,
      shotTimer: 0,
      offsetX: 0,
    };
    this.enemies.push(e);
    this.enemiesSpawned++;
    this.compactEnemies();
    return e;
  }

  private spawnBoss(): void {
    this.bossSpawned = true;
    const def = BOSSES[this.mission.boss.variant];
    const hp = Math.round(def.hp * this.diff.hp);
    const e = this.spawnEnemy('boss', WORLD_W / 2, -def.radius - 30, { stopY: def.ground ? 170 : 150 });
    e.variant = def.variant;
    e.hp = hp;
    e.maxHp = hp;
    e.radius = def.radius;
    e.ground = def.ground;
    e.score = ENEMY_DEFS.boss.score;
    this.boss = e;
    this.emit({ type: 'bossWarning', name: def.name });
  }

  private spawnObstacle(kind: 'peak' | 'tower'): void {
    const radius = kind === 'peak' ? this.rng.range(42, 72) : this.rng.range(26, 36);
    this.obstacles.push({
      id: this.nextObstacleId++,
      kind,
      x: this.rng.chance(0.5) ? this.rng.range(radius, WORLD_W * 0.3) : this.rng.range(WORLD_W * 0.7, WORLD_W - radius),
      y: -radius - 40,
      radius,
      height: kind === 'peak' ? this.rng.range(60, 110) : this.rng.range(70, 90),
      active: true,
    });
    let idx = 0;
    for (const o of this.obstacles) if (o.active || o.id > this.nextObstacleId - 40) this.obstacles[idx++] = o;
    this.obstacles.length = idx;
  }

  dropPickup(x: number, y: number, guaranteed = false): void {
    const kinds: PickupKind[] = ['weapon', 'shield', 'repair', 'missiles', 'turbo'];
    const kind = this.rng.pick(kinds);
    if (!guaranteed && this.player.weaponLevel >= 5 && kind === 'weapon') return;
    this.pickups.push({
      id: this.nextPickupId++,
      kind,
      x: clamp(x, 24, WORLD_W - 24),
      y,
      vy: 65,
      t: 0,
      active: true,
    });
    let idx = 0;
    for (const pk of this.pickups) if (pk.active) this.pickups[idx++] = pk;
    this.pickups.length = idx;
  }

  // ── Armas ───────────────────────────────────────────────────────────────────

  firePlayerBullet(x: number, y: number, vx: number, vy: number): void {
    const pr = this.projectiles.acquire();
    pr.id = this.nextProjectileId++;
    pr.kind = 'bullet';
    pr.x = x; pr.y = y; pr.vx = vx; pr.vy = vy;
    pr.damage = this.damageMult;
    pr.radius = 5;
    pr.life = 1.6;
    pr.targetId = -1;
    this.stats.shotsFired++;
  }

  firePlayerMissile(x: number, y: number, vx: number, vy: number, targetId: number): void {
    const pr = this.projectiles.acquire();
    pr.id = this.nextProjectileId++;
    pr.kind = 'missile';
    pr.x = x; pr.y = y; pr.vx = vx; pr.vy = vy;
    pr.damage = 10 * this.damageMult;
    pr.radius = 7;
    pr.life = 4;
    pr.targetId = targetId;
  }

  fireEnemyBullet(x: number, y: number, angle: number, speed: number): void {
    const pr = this.projectiles.acquire();
    pr.id = this.nextProjectileId++;
    pr.kind = 'enemyBullet';
    pr.x = x; pr.y = y;
    pr.vx = Math.cos(angle) * speed;
    pr.vy = Math.sin(angle) * speed;
    pr.damage = 10 * this.diff.damage;
    pr.radius = 5;
    pr.life = 7;
    pr.targetId = -1;
    this.emit({ type: 'enemyShot', x, y });
  }

  fireEnemyMissile(x: number, y: number, angle: number): void {
    const pr = this.projectiles.acquire();
    pr.id = this.nextProjectileId++;
    pr.kind = 'enemyMissile';
    pr.x = x; pr.y = y;
    pr.vx = Math.cos(angle) * 160;
    pr.vy = Math.sin(angle) * 160;
    pr.damage = 22 * this.diff.damage;
    pr.radius = 7;
    pr.life = 6;
    pr.targetId = -1;
    this.emit({ type: 'missile', x, y });
  }

  /** Pulso EMP del arma especial: daña a todo y limpia los proyectiles enemigos. */
  triggerSpecial(): void {
    this.emit({ type: 'special', x: this.player.x, y: this.player.y });
    this.projectiles.forEachActive((pr) => {
      if (pr.kind === 'enemyBullet' || pr.kind === 'enemyMissile') this.projectiles.release(pr);
    });
    for (const e of this.enemies) {
      if (!e.alive) continue;
      this.damageEnemy(e, e.type === 'boss' ? 45 : 18);
    }
  }

  // ── Daño y muerte ───────────────────────────────────────────────────────────

  isPlayerVulnerable(): boolean {
    return this.player.alive && this.player.invuln <= 0 && this.player.roll <= 0;
  }

  damagePlayer(amount: number): void {
    const p = this.player;
    this.stats.damageTaken += amount;
    p.damageFlash = 0.25;
    const absorbed = Math.min(p.shield, amount);
    p.shield -= absorbed;
    const rest = amount - absorbed;
    p.hp -= rest;
    this.emit({ type: 'playerHit', x: p.x, y: p.y, shield: rest <= 0 });
    this.combo = 0;
    this.multiplier = 1;
    if (p.hp <= 0) this.killPlayer();
    else p.invuln = Math.max(p.invuln, 0.5);
  }

  private killPlayer(): void {
    const p = this.player;
    p.alive = false;
    p.hp = 0;
    p.turboActive = false;
    this.emit({ type: 'explosion', x: p.x, y: p.y, size: 1.4, ground: false });
    p.lives--;
    this.emit({ type: 'lifeLost' });
    if (p.lives <= 0) {
      this.endReason = 'Tu avión fue derribado';
      this.endTimer = 1.6;
    } else {
      p.respawn = 1.6;
    }
  }

  respawnPlayer(): void {
    const p = this.player;
    p.alive = true;
    p.x = WORLD_W / 2;
    p.y = WORLD_H - 140;
    p.vx = 0; p.vy = 0;
    p.hp = p.maxHp;
    p.shield = p.maxShield;
    p.invuln = 2.5;
    p.weaponLevel = Math.max(1, p.weaponLevel - 1);
    p.missiles = Math.max(p.missiles, Math.floor(p.maxMissiles / 2));
    p.turbo = 100;
  }

  damageEnemy(e: Enemy, amount: number): void {
    if (!e.alive) return;
    e.hp -= amount;
    e.flash = 0.1;
    if (e.hp <= 0) this.killEnemy(e, true);
  }

  killEnemy(e: Enemy, score: boolean): void {
    if (!e.alive) return;
    e.alive = false;
    this.emit({
      type: 'explosion',
      x: e.x,
      y: e.y,
      size: e.type === 'boss' ? 3 : e.type === 'bomber' ? 1.5 : e.type === 'turret' ? 1.3 : 1,
      ground: e.ground,
    });
    if (score) {
      this.stats.kills++;
      this.combo++;
      this.comboTimer = 2.5;
      this.multiplier = 1 + Math.min(16, Math.floor(this.combo / 4)) * 0.25;
      if (this.combo > this.stats.maxCombo) this.stats.maxCombo = this.combo;
      if (this.combo >= 4 && this.combo % 4 === 0) {
        this.emit({ type: 'combo', count: this.combo, multiplier: this.multiplier });
      }
      this.addScore(e.score);
      if (e.objective) {
        this.stats.basesDestroyed++;
        this.emit({ type: 'objective', text: `Base destruida (${this.stats.basesDestroyed}/${this.totalBases})` });
      }
      const def = ENEMY_DEFS[e.type];
      if (e.type !== 'boss' && this.rng.chance(def.dropChance)) this.dropPickup(e.x, e.y);
    }
    if (e.type === 'boss') {
      this.boss = null;
      // Victoria: el jefe cae y la misión termina tras la gran explosión.
      for (let i = 0; i < 6; i++) {
        this.emit({
          type: 'explosion',
          x: e.x + this.rng.range(-e.radius, e.radius),
          y: e.y + this.rng.range(-e.radius * 0.6, e.radius * 0.6),
          size: this.rng.range(1, 2.2),
          ground: e.ground,
        });
      }
      this.endReason = '¡Objetivo cumplido!';
      this.status = 'playing';
      this.endTimer = 2.2;
    }
  }

  despawnEnemy(e: Enemy): void {
    e.alive = false;
    if (e.objective) {
      // Una base que escapa ya no puede contarse: no bloquea la misión (el requisito es 7 de 10).
      this.emit({ type: 'objective', text: 'Una base escapó del alcance' });
    }
  }

  private compactEnemies(): void {
    if (this.enemies.length < 160) return;
    let idx = 0;
    for (const e of this.enemies) if (e.alive) this.enemies[idx++] = e;
    this.enemies.length = idx;
  }

  // ── Power-ups ───────────────────────────────────────────────────────────────

  collectPickup(pk: Pickup): void {
    const p = this.player;
    pk.active = false;
    switch (pk.kind) {
      case 'shield':
        p.shield = Math.min(p.maxShield, p.shield + p.maxShield * 0.5);
        break;
      case 'repair':
        p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.35);
        break;
      case 'weapon':
        if (p.weaponLevel < 5) p.weaponLevel++;
        else this.addScore(500);
        break;
      case 'turbo':
        p.turbo = 100;
        p.energy = Math.min(100, p.energy + 35);
        break;
      case 'missiles':
        p.missiles = Math.min(p.maxMissiles, p.missiles + 6);
        break;
    }
    this.addScore(50);
    this.emit({ type: 'pickup', kind: pk.kind, x: pk.x, y: pk.y });
  }

  addScore(base: number): void {
    this.score += Math.round(base * this.multiplier * this.diff.score);
  }

  // ── Consultas usadas por IA y combate ───────────────────────────────────────

  rebuildEnemyHash(): void {
    this.enemyHash.clear();
    for (const e of this.enemies) if (e.alive) this.enemyHash.insert(e);
  }

  getEnemy(id: number): Enemy | undefined {
    for (const e of this.enemies) if (e.id === id && e.alive) return e;
    return undefined;
  }

  nearestEnemies(x: number, y: number, count: number): Enemy[] {
    const sorted = this.enemies
      .filter((e) => e.alive && e.y > -40 && e.y < y + 60)
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
    return sorted.slice(0, count);
  }

  neighbors(e: Enemy, radius: number): Enemy[] {
    return this.enemies.filter(
      (o) => o.alive && o !== e && o.type === e.type && Math.hypot(o.x - e.x, o.y - e.y) < radius,
    );
  }

  /** Proyectil del jugador que se acerca a un enemigo (para maniobras evasivas). */
  findThreat(e: Enemy, radius: number): Projectile | null {
    let found: Projectile | null = null;
    this.projectiles.forEachActive((pr) => {
      if (found || (pr.kind !== 'bullet' && pr.kind !== 'missile')) return;
      if (pr.vy < 0 && pr.y > e.y && pr.y - e.y < radius && Math.abs(pr.x - e.x) < 46) found = pr;
    });
    return found;
  }

  private basesObjectiveMet(): boolean {
    for (const o of this.mission.objectives) {
      if (o.kind === 'destroyBases' && this.stats.basesDestroyed < o.required) {
        // No aparece el jefe hasta cumplir el objetivo de bases; mientras tanto siguen llegando refuerzos.
        if (this.pending.length === 0 && !this.enemies.some((e) => e.alive && e.objective)) {
          this.queueWave({ at: this.time + 3, type: 'turret', count: 2, formation: 'ground', objective: true });
          this.queueWave({ at: this.time + 5, type: 'scout', count: 5, formation: 'random', interval: 0.5 });
        }
        return false;
      }
    }
    return true;
  }

  // ── Final de misión ─────────────────────────────────────────────────────────

  private finish(): void {
    const victory = this.player.lives > 0;
    this.status = victory ? 'victory' : 'defeat';
    this.emit({ type: victory ? 'victory' : 'defeat' });
  }

  /** Continuar tras la derrota: reinicia vidas sin perder la puntuación (clásico arcade). */
  continueRun(): void {
    if (this.status !== 'defeat') return;
    this.stats.continues++;
    this.score = Math.floor(this.score * 0.7);
    this.status = 'playing';
    this.endTimer = -1;
    this.player.lives = 3;
    this.respawnPlayer();
  }

  buildResult(): MissionResult {
    const victory = this.status === 'victory';
    const accuracy = this.stats.shotsFired > 0 ? this.stats.shotsHit / this.stats.shotsFired : 0;
    let stars = 0;
    if (victory) {
      stars = 1;
      if (this.player.lives === 3 && this.stats.continues === 0) stars++;
      if (accuracy > 0.25 || this.stats.maxCombo >= 12) stars++;
    }
    return {
      missionId: this.mission.id,
      victory,
      reason: this.endReason,
      score: this.score,
      time: this.time,
      stars,
      credits: Math.round(this.score * 0.08) + (victory ? 250 : 50),
      stats: { ...this.stats },
      mode: this.mode,
      planeId: this.plane.id,
      difficulty: this.difficulty,
    };
  }

  emit(ev: GameEvent): void {
    this.events.push(ev);
  }
}
