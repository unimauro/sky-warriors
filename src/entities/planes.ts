export interface PlaneDef {
  id: string;
  name: string;
  role: string;
  description: string;
  color: number;
  accent: number;
  maxSpeed: number;
  accel: number;
  maxHp: number;
  maxShield: number;
  fireRate: number;
  bulletDamage: number;
  maxMissiles: number;
  /** Valores 1-5 para las barras de la pantalla de selección. */
  stats: { speed: number; armor: number; firepower: number; missiles: number };
}

export const PLANES: readonly PlaneDef[] = [
  {
    id: 'halcon',
    name: 'Halcón XF-1',
    role: 'Polivalente',
    description: 'Caza equilibrado. Buen blindaje, cadencia sólida y maniobrabilidad estable.',
    color: 0x3d8bfd,
    accent: 0xffb627,
    maxSpeed: 300,
    accel: 1500,
    maxHp: 100,
    maxShield: 50,
    fireRate: 10,
    bulletDamage: 1,
    maxMissiles: 12,
    stats: { speed: 3, armor: 3, firepower: 3, missiles: 3 },
  },
  {
    id: 'condor',
    name: 'Cóndor AV-8',
    role: 'Pesado',
    description: 'Blindaje reforzado y gran carga de misiles. Más lento, pero aguanta castigo.',
    color: 0x5d7a3a,
    accent: 0xe8e2c8,
    maxSpeed: 245,
    accel: 1100,
    maxHp: 145,
    maxShield: 70,
    fireRate: 8,
    bulletDamage: 1.3,
    maxMissiles: 20,
    stats: { speed: 2, armor: 5, firepower: 3, missiles: 5 },
  },
  {
    id: 'colibri',
    name: 'Colibrí S-3',
    role: 'Interceptor',
    description: 'Veloz y con cadencia altísima. Frágil: el arte está en no recibir disparos.',
    color: 0xd6336c,
    accent: 0xf8f9fa,
    maxSpeed: 370,
    accel: 2100,
    maxHp: 75,
    maxShield: 40,
    fireRate: 14,
    bulletDamage: 0.85,
    maxMissiles: 8,
    stats: { speed: 5, armor: 2, firepower: 4, missiles: 2 },
  },
];

export const getPlane = (id: string): PlaneDef => PLANES.find((p) => p.id === id) ?? PLANES[0];
