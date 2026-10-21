export type GameMode = '2d' | '2.5d' | '3d';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type QualityLevel = 'low' | 'medium' | 'high';
export type QualitySetting = QualityLevel | 'auto';

export type Action =
  | 'up' | 'down' | 'left' | 'right'
  | 'fire' | 'missile' | 'special' | 'turbo'
  | 'rollLeft' | 'rollRight' | 'camera' | 'pause' | 'mute';

/** Acciones que la simulación lee en cada paso (las meta-acciones las maneja la UI). */
export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  fire: boolean;
  missile: boolean;
  special: boolean;
  turbo: boolean;
  rollLeft: boolean;
  rollRight: boolean;
}

export const emptyInput = (): InputState => ({
  up: false, down: false, left: false, right: false,
  fire: false, missile: false, special: false, turbo: false,
  rollLeft: false, rollRight: false,
});

export type EnemyType = 'scout' | 'interceptor' | 'bomber' | 'ace' | 'turret' | 'drone' | 'boss';
export type PickupKind = 'shield' | 'repair' | 'weapon' | 'turbo' | 'missiles';
export type ProjectileKind = 'bullet' | 'missile' | 'enemyBullet' | 'enemyMissile';
export type Theme = 'ocean' | 'mountains' | 'desert' | 'night' | 'final';
export type GameStatus = 'intro' | 'playing' | 'victory' | 'defeat';

export interface Player {
  planeId: string;
  x: number; y: number; vx: number; vy: number;
  radius: number;
  hp: number; maxHp: number;
  shield: number; maxShield: number;
  missiles: number; maxMissiles: number;
  energy: number;
  turbo: number;
  turboActive: boolean;
  weaponLevel: number;
  lives: number;
  invuln: number;
  roll: number;
  rollDir: number;
  rollCd: number;
  fireCd: number;
  missileCd: number;
  bank: number;
  alive: boolean;
  respawn: number;
  damageFlash: number;
}

export interface PatternParams {
  baseX: number;
  amplitude: number;
  frequency: number;
  phase: number;
  speed: number;
  stopY: number;
  dir: number;
}

export interface Enemy {
  id: number;
  type: EnemyType;
  variant: string;
  x: number; y: number; vx: number; vy: number;
  heading: number;
  hp: number; maxHp: number;
  radius: number;
  alive: boolean;
  state: string;
  stateTime: number;
  age: number;
  fireCd: number;
  score: number;
  pattern: PatternParams;
  phase: number;
  ground: boolean;
  objective: boolean;
  flash: number;
  evadeCd: number;
  spin: number;
  /** Ataque en curso (jefes y ráfagas de cazas avanzados). */
  attack: string;
  attackTimer: number;
  attackIndex: number;
  shotTimer: number;
  offsetX: number;
}

export interface Projectile {
  active: boolean;
  poolIndex: number;
  id: number;
  kind: ProjectileKind;
  x: number; y: number; vx: number; vy: number;
  damage: number;
  radius: number;
  life: number;
  targetId: number;
}

export interface Pickup {
  id: number;
  kind: PickupKind;
  x: number; y: number;
  vy: number;
  t: number;
  active: boolean;
}

export interface Obstacle {
  id: number;
  kind: 'peak' | 'tower';
  x: number; y: number;
  radius: number;
  height: number;
  active: boolean;
}

export type GameEvent =
  | { type: 'shot'; x: number; y: number }
  | { type: 'missile'; x: number; y: number }
  | { type: 'enemyShot'; x: number; y: number }
  | { type: 'explosion'; x: number; y: number; size: number; ground: boolean }
  | { type: 'hit'; x: number; y: number }
  | { type: 'playerHit'; x: number; y: number; shield: boolean }
  | { type: 'pickup'; kind: PickupKind; x: number; y: number }
  | { type: 'special'; x: number; y: number }
  | { type: 'roll'; dir: number }
  | { type: 'bossWarning'; name: string }
  | { type: 'bossPhase'; phase: number }
  | { type: 'proximity' }
  | { type: 'combo'; count: number; multiplier: number }
  | { type: 'lifeLost' }
  | { type: 'objective'; text: string }
  | { type: 'lightning' }
  | { type: 'victory' }
  | { type: 'defeat' };

export interface MissionStats {
  kills: number;
  shotsFired: number;
  shotsHit: number;
  maxCombo: number;
  basesDestroyed: number;
  damageTaken: number;
  continues: number;
}

export interface MissionResult {
  missionId: number;
  victory: boolean;
  reason: string;
  score: number;
  time: number;
  stars: number;
  credits: number;
  stats: MissionStats;
  mode: GameMode;
  planeId: string;
  difficulty: Difficulty;
}
