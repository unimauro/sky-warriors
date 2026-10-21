import { describe, expect, it } from 'vitest';
import { GameSim, type SimOptions } from '../../src/core/game';
import { emptyInput } from '../../src/core/types';
import { emptyUpgrades } from '../../src/entities/upgrades';
import { Pool } from '../../src/core/pool';
import { SpatialHash } from '../../src/systems/collision';
import { Rng } from '../../src/core/rng';
import { sanitizeDirective } from '../../src/ai/agentBridge';
import { MISSIONS } from '../../src/scenes/missions';
import { WORLD_H, WORLD_W } from '../../src/core/constants';

const makeSim = (over: Partial<SimOptions> = {}) =>
  new GameSim({
    missionId: 1,
    planeId: 'halcon',
    mode: '2d',
    difficulty: 'normal',
    upgrades: emptyUpgrades(),
    seed: 42,
    ...over,
  });

/** Avanza la simulación n segundos con una entrada fija. */
const run = (sim: GameSim, seconds: number, input = emptyInput()) => {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) sim.tick(1 / 60, input);
};

describe('GameSim — movimiento del jugador', () => {
  it('acelera hacia la izquierda y respeta los límites del mundo', () => {
    const sim = makeSim();
    const input = { ...emptyInput(), left: true };
    run(sim, 0.5, input);
    expect(sim.player.vx).toBeLessThan(0);
    run(sim, 10, input);
    expect(sim.player.x).toBeGreaterThanOrEqual(sim.player.radius);
  });

  it('desacelera al soltar la entrada (inercia)', () => {
    const sim = makeSim();
    run(sim, 1, { ...emptyInput(), right: true });
    const v1 = sim.player.vx;
    run(sim, 0.15);
    expect(Math.abs(sim.player.vx)).toBeLessThan(Math.abs(v1));
  });

  it('el turbo consume la barra y aumenta la velocidad máxima', () => {
    const sim = makeSim();
    // Medimos antes de que el avión llegue al borde del mundo (que frena en seco).
    run(sim, 0.4, { ...emptyInput(), up: true, turbo: true });
    expect(sim.player.turbo).toBeLessThan(100);
    expect(Math.abs(sim.player.vy)).toBeGreaterThan(sim.plane.maxSpeed);
  });
});

describe('GameSim — armas y colisiones', () => {
  it('dispara balas con cadencia limitada', () => {
    const sim = makeSim();
    run(sim, 1, { ...emptyInput(), fire: true });
    expect(sim.stats.shotsFired).toBeGreaterThan(10);
    expect(sim.stats.shotsFired).toBeLessThan(60);
  });

  it('las balas destruyen enemigos y suman puntos', () => {
    const sim = makeSim();
    const e = sim.spawnEnemy('scout', sim.player.x, sim.player.y - 150, { amplitude: 0, speed: 0 });
    // 1.5 s: antes de que lleguen las oleadas de la misión (t=2) y ensucien el conteo.
    run(sim, 1.5, { ...emptyInput(), fire: true });
    expect(e.alive).toBe(false);
    expect(sim.score).toBeGreaterThan(0);
    expect(sim.stats.kills).toBe(1);
  });

  it('los misiles persiguen y destruyen a su objetivo', () => {
    const sim = makeSim();
    const e = sim.spawnEnemy('bomber', 100, 200, { stopY: 200 });
    run(sim, 0.1);
    run(sim, 3, { ...emptyInput(), missile: true });
    expect(e.alive).toBe(false);
  });

  it('el jugador recibe daño: primero escudo, luego casco', () => {
    const sim = makeSim();
    const shield = sim.player.shield;
    sim.damagePlayer(20);
    expect(sim.player.shield).toBe(shield - 20);
    expect(sim.player.hp).toBe(sim.player.maxHp);
    sim.damagePlayer(sim.player.shield + 10);
    expect(sim.player.shield).toBe(0);
    expect(sim.player.hp).toBeLessThan(sim.player.maxHp);
  });

  it('perder todas las vidas termina en derrota', () => {
    const sim = makeSim();
    for (let i = 0; i < 10 && sim.status === 'playing'; i++) {
      sim.player.invuln = 0;
      sim.damagePlayer(10_000);
      run(sim, 2.5);
    }
    expect(sim.status).toBe('defeat');
    const result = sim.buildResult();
    expect(result.victory).toBe(false);
  });

  it('continuar tras la derrota restaura vidas y reduce la puntuación', () => {
    const sim = makeSim();
    sim.addScore(1000);
    for (let i = 0; i < 10 && sim.status === 'playing'; i++) {
      sim.player.invuln = 0;
      sim.damagePlayer(10_000);
      run(sim, 2.5);
    }
    const before = sim.score;
    sim.continueRun();
    expect(sim.status).toBe('playing');
    expect(sim.player.lives).toBe(3);
    expect(sim.score).toBeLessThan(before);
    expect(sim.stats.continues).toBe(1);
  });
});

describe('GameSim — progresión de misión', () => {
  it('genera oleadas y el jefe aparece a su hora', () => {
    const sim = makeSim();
    run(sim, 5);
    expect(sim.enemies.some((e) => e.alive)).toBe(true);
    // Hacemos invencible al jugador para llegar al jefe.
    const INPUT = emptyInput();
    for (let i = 0; i < 95 * 60; i++) {
      sim.player.invuln = 99;
      sim.tick(1 / 60, INPUT);
      if (sim.bossSpawned) break;
    }
    expect(sim.bossSpawned).toBe(true);
    expect(sim.boss?.type).toBe('boss');
  });

  it('derribar al jefe produce la victoria', () => {
    const sim = makeSim();
    const INPUT = emptyInput();
    for (let i = 0; i < 100 * 60 && !sim.bossSpawned; i++) {
      sim.player.invuln = 99;
      sim.tick(1 / 60, INPUT);
    }
    const boss = sim.boss!;
    boss.state = 'fight';
    sim.damageEnemy(boss, boss.maxHp + 1);
    run(sim, 3);
    expect(sim.status).toBe('victory');
    const result = sim.buildResult();
    expect(result.victory).toBe(true);
    expect(result.stars).toBeGreaterThanOrEqual(1);
    expect(result.credits).toBeGreaterThan(0);
  });

  it('el combo multiplica la puntuación y se corta al recibir daño', () => {
    const sim = makeSim();
    for (let i = 0; i < 8; i++) {
      const e = sim.spawnEnemy('scout', 50 + i * 60, 100, {});
      sim.damageEnemy(e, 1000);
    }
    expect(sim.combo).toBe(8);
    expect(sim.multiplier).toBeGreaterThan(1);
    sim.damagePlayer(5);
    expect(sim.combo).toBe(0);
    expect(sim.multiplier).toBe(1);
  });

  it('los power-ups aplican su efecto', () => {
    const sim = makeSim();
    sim.player.hp = 10;
    sim.collectPickup({ id: 1, kind: 'repair', x: 0, y: 0, vy: 0, t: 0, active: true });
    expect(sim.player.hp).toBeGreaterThan(10);
    const lvl = sim.player.weaponLevel;
    sim.collectPickup({ id: 2, kind: 'weapon', x: 0, y: 0, vy: 0, t: 0, active: true });
    expect(sim.player.weaponLevel).toBe(lvl + 1);
  });

  it('la dificultad escala la vida enemiga', () => {
    const easy = makeSim({ difficulty: 'easy' });
    const hard = makeSim({ difficulty: 'hard' });
    const e1 = easy.spawnEnemy('bomber', 100, 100, {});
    const e2 = hard.spawnEnemy('bomber', 100, 100, {});
    expect(e2.maxHp).toBeGreaterThan(e1.maxHp);
  });

  it('misma semilla ⇒ misma partida (determinismo)', () => {
    const a = makeSim({ seed: 7 });
    const b = makeSim({ seed: 7 });
    const input = { ...emptyInput(), fire: true, left: true };
    run(a, 8, input);
    run(b, 8, input);
    expect(a.score).toBe(b.score);
    expect(a.player.x).toBeCloseTo(b.player.x, 6);
    expect(a.enemies.filter((e) => e.alive).length).toBe(b.enemies.filter((e) => e.alive).length);
  });
});

describe('Definiciones de misiones', () => {
  it('hay 5 misiones con oleadas, jefe y objetivos', () => {
    expect(MISSIONS.length).toBe(5);
    for (const m of MISSIONS) {
      expect(m.waves.length).toBeGreaterThan(8);
      expect(m.boss.at).toBeGreaterThan(m.waves[m.waves.length - 1].at);
      expect(m.objectives.length).toBeGreaterThan(0);
    }
  });
});

describe('Infraestructura', () => {
  it('el pool recicla objetos sin crecer innecesariamente', () => {
    const pool = new Pool(() => ({ active: false, poolIndex: 0, v: 0 }), 4);
    const a = pool.acquire();
    const b = pool.acquire();
    expect(pool.activeCount).toBe(2);
    pool.release(a);
    pool.release(a); // doble release: inocuo
    expect(pool.activeCount).toBe(1);
    const c = pool.acquire();
    expect(c).toBe(a);
    pool.release(b);
    pool.release(c);
    expect(pool.items.length).toBe(4);
  });

  it('el hash espacial encuentra vecinos', () => {
    const hash = new SpatialHash<{ x: number; y: number; radius: number }>(64);
    const item = { x: 100, y: 100, radius: 10 };
    hash.insert(item);
    expect(hash.query(105, 105, 10)).toContain(item);
    expect(hash.query(500, 500, 10)).toHaveLength(0);
  });

  it('el RNG es determinista y acotado', () => {
    const a = new Rng(123);
    const b = new Rng(123);
    for (let i = 0; i < 100; i++) {
      const v = a.next();
      expect(v).toBe(b.next());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(new Rng(1).int(1, 3)).toBeGreaterThanOrEqual(1);
  });

  it('sanitizeDirective acota valores y tolera basura', () => {
    expect(sanitizeDirective(null)).toEqual({ aggression: 1, accuracy: 1, vitality: 1 });
    expect(sanitizeDirective({ aggression: 99, accuracy: -5, vitality: 'x' })).toEqual({
      aggression: 1.5, accuracy: 0.5, vitality: 1,
    });
  });

  it('el mundo lógico es constante entre motores', () => {
    expect(WORLD_W).toBe(640);
    expect(WORLD_H).toBe(900);
  });
});
