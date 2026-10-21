import type { EnemyType } from '../core/types';

export interface EnemyDef {
  name: string;
  hp: number;
  radius: number;
  speed: number;
  score: number;
  fireInterval: number;
  ground: boolean;
  /** Probabilidad de soltar un power-up al ser destruido. */
  dropChance: number;
}

export const ENEMY_DEFS: Record<EnemyType, EnemyDef> = {
  scout: { name: 'Explorador', hp: 3, radius: 15, speed: 150, score: 100, fireInterval: 2.4, ground: false, dropChance: 0.06 },
  interceptor: { name: 'Interceptor', hp: 6, radius: 16, speed: 200, score: 150, fireInterval: 1.5, ground: false, dropChance: 0.1 },
  bomber: { name: 'Bombardero', hp: 26, radius: 28, speed: 55, score: 400, fireInterval: 1.7, ground: false, dropChance: 0.6 },
  ace: { name: 'Caza avanzado', hp: 14, radius: 17, speed: 230, score: 350, fireInterval: 1.1, ground: false, dropChance: 0.35 },
  turret: { name: 'Base antiaérea', hp: 16, radius: 22, speed: 0, score: 300, fireInterval: 1.6, ground: true, dropChance: 0.3 },
  drone: { name: 'Dron kamikaze', hp: 2, radius: 11, speed: 175, score: 50, fireInterval: 99, ground: false, dropChance: 0.03 },
  boss: { name: 'Jefe', hp: 400, radius: 62, speed: 80, score: 5000, fireInterval: 1, ground: false, dropChance: 1 },
};

/** Ataques que un jefe puede encadenar en cada fase. */
export type BossAttack = 'fan' | 'aimed' | 'spiral' | 'drones' | 'missiles' | 'charge' | 'rain';

export interface BossDef {
  variant: string;
  name: string;
  hp: number;
  radius: number;
  ground: boolean;
  /** Una lista de ataques por fase; la fase cambia al perder 1/n de la vida. */
  phases: BossAttack[][];
  color: number;
}

export const BOSSES: Record<string, BossDef> = {
  kraken: {
    variant: 'kraken', name: 'Fragata Kraken', hp: 320, radius: 60, ground: false, color: 0x4a5568,
    phases: [['fan', 'aimed'], ['fan', 'drones', 'aimed']],
  },
  condor: {
    variant: 'condor', name: 'Cóndor de Hierro', hp: 400, radius: 64, ground: false, color: 0x6b4f2a,
    phases: [['aimed', 'fan'], ['missiles', 'charge', 'fan']],
  },
  dune: {
    variant: 'dune', name: 'Fortaleza Duna', hp: 470, radius: 70, ground: true, color: 0x8c6a3f,
    phases: [['fan', 'rain'], ['spiral', 'missiles', 'aimed']],
  },
  spectre: {
    variant: 'spectre', name: 'Espectro Nocturno', hp: 460, radius: 58, ground: false, color: 0x2d2a4a,
    phases: [['aimed', 'spiral'], ['drones', 'fan'], ['spiral', 'charge', 'missiles']],
  },
  leviathan: {
    variant: 'leviathan', name: 'Leviatán Omega', hp: 1150, radius: 84, ground: false, color: 0x7a1f2b,
    phases: [['fan', 'aimed', 'drones'], ['spiral', 'missiles', 'rain'], ['spiral', 'charge', 'drones', 'fan']],
  },
};
