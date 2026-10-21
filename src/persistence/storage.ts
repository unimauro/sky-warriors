import type { Action, Difficulty, GameMode, QualitySetting } from '../core/types';
import { emptyUpgrades, type UpgradeLevels } from '../entities/upgrades';

/**
 * Persistencia en localStorage con validación: si el navegador lo bloquea
 * (modo privado, datos borrados) el juego funciona con valores por defecto.
 */
const KEY = 'sky-warriors-save-v1';

export interface KeyBindings {
  [action: string]: string[];
}

export const DEFAULT_BINDINGS: Record<Action, string[]> = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  fire: ['Space'],
  missile: ['KeyJ'],
  special: ['KeyK'],
  turbo: ['ShiftLeft', 'ShiftRight'],
  rollLeft: ['KeyQ'],
  rollRight: ['KeyE'],
  camera: ['KeyC'],
  pause: ['KeyP', 'Escape'],
  mute: ['KeyM'],
};

export interface ScoreEntry {
  score: number;
  missionId: number;
  mode: GameMode;
  planeId: string;
  difficulty: Difficulty;
  date: string;
}

export interface SaveData {
  version: 1;
  credits: number;
  unlockedMission: number;
  stars: Record<number, number>;
  upgrades: UpgradeLevels;
  highScores: ScoreEntry[];
  settings: {
    musicVolume: number;
    sfxVolume: number;
    muted: boolean;
    quality: QualitySetting;
    difficulty: Difficulty;
    bindings: KeyBindings;
    lastPlane: string;
    lastMode: GameMode;
  };
}

export const defaultSave = (): SaveData => ({
  version: 1,
  credits: 0,
  unlockedMission: 1,
  stars: {},
  upgrades: emptyUpgrades(),
  highScores: [],
  settings: {
    musicVolume: 0.55,
    sfxVolume: 0.8,
    muted: false,
    quality: 'auto',
    difficulty: 'normal',
    bindings: { ...DEFAULT_BINDINGS },
    lastPlane: 'halcon',
    lastMode: '2d',
  },
});

export function loadSave(): SaveData {
  const base = defaultSave();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const data = JSON.parse(raw) as Partial<SaveData>;
    if (data.version !== 1) return base;
    return {
      ...base,
      ...data,
      upgrades: { ...base.upgrades, ...(data.upgrades ?? {}) },
      stars: { ...(data.stars ?? {}) },
      highScores: Array.isArray(data.highScores) ? data.highScores.slice(0, 10) : [],
      settings: {
        ...base.settings,
        ...(data.settings ?? {}),
        bindings: { ...DEFAULT_BINDINGS, ...(data.settings?.bindings ?? {}) },
      },
    };
  } catch {
    return base;
  }
}

export function persistSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Almacenamiento no disponible: la partida sigue en memoria.
  }
}

export function addHighScore(data: SaveData, entry: ScoreEntry): SaveData {
  const highScores = [...data.highScores, entry].sort((a, b) => b.score - a.score).slice(0, 10);
  return { ...data, highScores };
}
