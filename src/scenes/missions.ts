import type { EnemyType, Theme } from '../core/types';

export type Formation = 'line' | 'v' | 'column' | 'sine' | 'sides' | 'random' | 'ground';

export interface WaveSpawn {
  /** Segundo de la misión en que aparece la oleada. */
  at: number;
  type: EnemyType;
  count: number;
  formation: Formation;
  /** Posición horizontal normalizada (0..1) para formaciones que la usan. */
  x?: number;
  /** Segundos entre unidades de una misma oleada. */
  interval?: number;
  amplitude?: number;
  /** Marca la unidad como objetivo de misión (p. ej. bases a destruir). */
  objective?: boolean;
}

export type Objective =
  | { kind: 'destroyBoss' }
  | { kind: 'destroyBases'; required: number }
  | { kind: 'killPercent'; percent: number };

export interface MissionDef {
  id: number;
  name: string;
  subtitle: string;
  briefing: string;
  theme: Theme;
  scrollSpeed: number;
  /** 1 = visibilidad total; valores menores oscurecen la escena (misión nocturna). */
  visibility: number;
  /** Viento lateral máximo (unidades/s) para tormentas. */
  wind: number;
  obstacles?: { every: number; kind: 'peak' | 'tower' };
  waves: WaveSpawn[];
  boss: { variant: string; at: number };
  objectives: Objective[];
  /** Multiplicador base de dificultad de la misión (progresión). */
  tier: number;
}

const w = (at: number, type: EnemyType, count: number, formation: Formation, extra: Partial<WaveSpawn> = {}): WaveSpawn => ({
  at, type, count, formation, ...extra,
});

export const MISSIONS: readonly MissionDef[] = [
  {
    id: 1,
    name: 'Defensa del Pacífico',
    subtitle: 'Mar abierto · Amanecer',
    briefing: 'Una flota aérea enemiga se acerca a la costa. Intercepta a los exploradores, derriba a los bombarderos y hunde la Fragata Kraken antes de que llegue a puerto.',
    theme: 'ocean',
    scrollSpeed: 70,
    visibility: 1,
    wind: 0,
    tier: 1,
    waves: [
      w(2, 'scout', 5, 'line'),
      w(7, 'scout', 6, 'sine', { x: 0.3, interval: 0.45 }),
      w(11, 'scout', 6, 'sine', { x: 0.7, interval: 0.45 }),
      w(16, 'interceptor', 3, 'sides', { interval: 0.8 }),
      w(22, 'scout', 7, 'v', { x: 0.5 }),
      w(28, 'bomber', 1, 'line', { x: 0.5 }),
      w(32, 'scout', 8, 'random', { interval: 0.5 }),
      w(40, 'interceptor', 4, 'sides', { interval: 0.6 }),
      w(46, 'scout', 6, 'sine', { x: 0.5, interval: 0.4, amplitude: 180 }),
      w(52, 'bomber', 2, 'line'),
      w(58, 'scout', 7, 'v', { x: 0.35 }),
      w(62, 'scout', 7, 'v', { x: 0.65 }),
      w(68, 'interceptor', 5, 'sides', { interval: 0.5 }),
      w(76, 'bomber', 2, 'line'),
      w(78, 'scout', 8, 'random', { interval: 0.35 }),
    ],
    boss: { variant: 'kraken', at: 88 },
    objectives: [{ kind: 'destroyBoss' }],
  },
  {
    id: 2,
    name: 'Tormenta Andina',
    subtitle: 'Cordillera · Tormenta eléctrica',
    briefing: 'Persigue al escuadrón enemigo entre los picos andinos. El viento te empuja y las cumbres no perdonan: esquívalas mientras derribas al Cóndor de Hierro.',
    theme: 'mountains',
    scrollSpeed: 85,
    visibility: 0.85,
    wind: 55,
    obstacles: { every: 3.2, kind: 'peak' },
    tier: 1.15,
    waves: [
      w(3, 'scout', 6, 'sine', { x: 0.5, interval: 0.4 }),
      w(8, 'interceptor', 4, 'sides', { interval: 0.6 }),
      w(14, 'scout', 7, 'v', { x: 0.5 }),
      w(20, 'bomber', 2, 'line'),
      w(25, 'interceptor', 5, 'sides', { interval: 0.5 }),
      w(32, 'scout', 8, 'random', { interval: 0.4 }),
      w(38, 'ace', 2, 'line'),
      w(44, 'scout', 6, 'sine', { x: 0.25, interval: 0.4, amplitude: 120 }),
      w(47, 'scout', 6, 'sine', { x: 0.75, interval: 0.4, amplitude: 120 }),
      w(54, 'bomber', 3, 'line'),
      w(60, 'interceptor', 6, 'sides', { interval: 0.45 }),
      w(68, 'ace', 3, 'line'),
      w(76, 'scout', 9, 'random', { interval: 0.3 }),
      w(82, 'interceptor', 4, 'sides', { interval: 0.5 }),
    ],
    boss: { variant: 'condor', at: 94 },
    objectives: [{ kind: 'destroyBoss' }],
  },
  {
    id: 3,
    name: 'Operación Desierto',
    subtitle: 'Dunas · Ataque a tierra',
    briefing: 'Inteligencia localizó 10 bases antiaéreas en el desierto. Destruye al menos 7 y luego arrasa la Fortaleza Duna, el centro de mando enemigo.',
    theme: 'desert',
    scrollSpeed: 75,
    visibility: 1,
    wind: 0,
    obstacles: { every: 7, kind: 'tower' },
    tier: 1.3,
    waves: [
      w(3, 'turret', 2, 'ground', { objective: true }),
      w(6, 'scout', 6, 'line'),
      w(12, 'turret', 2, 'ground', { objective: true }),
      w(16, 'interceptor', 4, 'sides', { interval: 0.6 }),
      w(22, 'bomber', 2, 'line'),
      w(26, 'turret', 2, 'ground', { objective: true }),
      w(31, 'scout', 8, 'v', { x: 0.5 }),
      w(38, 'ace', 2, 'line'),
      w(42, 'turret', 2, 'ground', { objective: true }),
      w(47, 'interceptor', 5, 'sides', { interval: 0.5 }),
      w(54, 'bomber', 3, 'line'),
      w(58, 'turret', 2, 'ground', { objective: true }),
      w(64, 'scout', 8, 'random', { interval: 0.35 }),
      w(70, 'ace', 3, 'line'),
      w(78, 'interceptor', 6, 'sides', { interval: 0.4 }),
    ],
    boss: { variant: 'dune', at: 92 },
    objectives: [{ kind: 'destroyBases', required: 7 }, { kind: 'destroyBoss' }],
  },
  {
    id: 4,
    name: 'Ataque Nocturno',
    subtitle: 'Noche cerrada · Visibilidad baja',
    briefing: 'Sin luna y sin radar: solo tu faro y los destellos enemigos. Cazas avanzados y drones kamikaze patrullan la zona. Abate al Espectro Nocturno.',
    theme: 'night',
    scrollSpeed: 80,
    visibility: 0.38,
    wind: 0,
    tier: 1.45,
    waves: [
      w(3, 'scout', 6, 'sine', { x: 0.5, interval: 0.45 }),
      w(8, 'drone', 6, 'random', { interval: 0.5 }),
      w(14, 'ace', 2, 'line'),
      w(20, 'interceptor', 5, 'sides', { interval: 0.5 }),
      w(27, 'drone', 8, 'random', { interval: 0.35 }),
      w(33, 'bomber', 2, 'line'),
      w(38, 'ace', 3, 'line'),
      w(45, 'scout', 8, 'v', { x: 0.5 }),
      w(50, 'drone', 10, 'random', { interval: 0.3 }),
      w(57, 'interceptor', 6, 'sides', { interval: 0.4 }),
      w(64, 'ace', 4, 'line'),
      w(72, 'bomber', 3, 'line'),
      w(76, 'drone', 10, 'random', { interval: 0.3 }),
      w(84, 'ace', 3, 'line'),
    ],
    boss: { variant: 'spectre', at: 98 },
    objectives: [{ kind: 'destroyBoss' }],
  },
  {
    id: 5,
    name: 'Batalla Final',
    subtitle: 'Cielo volcánico · Todo o nada',
    briefing: 'El Leviatán Omega, la nave insignia enemiga, despliega toda su flota. Sobrevive a la ofensiva total y derríbalo en sus tres fases.',
    theme: 'final',
    scrollSpeed: 95,
    visibility: 0.9,
    wind: 0,
    tier: 1.6,
    waves: [
      w(3, 'scout', 8, 'v', { x: 0.5 }),
      w(8, 'interceptor', 6, 'sides', { interval: 0.4 }),
      w(14, 'bomber', 3, 'line'),
      w(18, 'drone', 10, 'random', { interval: 0.3 }),
      w(24, 'ace', 3, 'line'),
      w(30, 'scout', 8, 'sine', { x: 0.3, interval: 0.3, amplitude: 140 }),
      w(32, 'scout', 8, 'sine', { x: 0.7, interval: 0.3, amplitude: 140 }),
      w(38, 'interceptor', 8, 'sides', { interval: 0.35 }),
      w(45, 'bomber', 4, 'line'),
      w(50, 'ace', 4, 'line'),
      w(56, 'drone', 14, 'random', { interval: 0.25 }),
      w(63, 'interceptor', 6, 'sides', { interval: 0.4 }),
      w(68, 'ace', 4, 'line'),
      w(74, 'bomber', 3, 'line'),
      w(78, 'scout', 10, 'random', { interval: 0.25 }),
    ],
    boss: { variant: 'leviathan', at: 92 },
    objectives: [{ kind: 'destroyBoss' }],
  },
];

export const getMission = (id: number): MissionDef => MISSIONS.find((m) => m.id === id) ?? MISSIONS[0];

export const DIFFICULTY = {
  easy: { label: 'Recluta', hp: 0.75, fire: 0.65, damage: 0.6, score: 0.75 },
  normal: { label: 'Piloto', hp: 1, fire: 1, damage: 1, score: 1 },
  hard: { label: 'As', hp: 1.3, fire: 1.35, damage: 1.35, score: 1.5 },
} as const;
