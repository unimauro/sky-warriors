import { create } from 'zustand';
import type { Difficulty, GameMode, MissionResult, QualitySetting } from '../core/types';
import { UPGRADES, type UpgradeKey } from '../entities/upgrades';
import {
  addHighScore,
  DEFAULT_BINDINGS,
  loadSave,
  persistSave,
  type KeyBindings,
  type SaveData,
} from '../persistence/storage';
import { audio } from '../audio/engine';

export type Screen =
  | 'menu' | 'planeSelect' | 'missionSelect' | 'hangar'
  | 'settings' | 'scores' | 'briefing' | 'game' | 'results';

interface UiState {
  screen: Screen;
  save: SaveData;
  selectedPlane: string;
  selectedMode: GameMode;
  selectedMission: number;
  lastResult: MissionResult | null;
  paused: boolean;

  goTo: (screen: Screen) => void;
  selectPlane: (id: string) => void;
  selectMode: (mode: GameMode) => void;
  selectMission: (id: number) => void;
  startMission: () => void;
  setPaused: (paused: boolean) => void;
  finishMission: (result: MissionResult) => void;
  buyUpgrade: (key: UpgradeKey) => void;
  setVolumes: (music: number, sfx: number) => void;
  toggleMuted: () => void;
  setQuality: (q: QualitySetting) => void;
  setDifficulty: (d: Difficulty) => void;
  setBinding: (action: string, index: number, code: string) => void;
  resetBindings: () => void;
}

const initialSave = loadSave();
audio.setVolumes(initialSave.settings.musicVolume, initialSave.settings.sfxVolume);
audio.setMuted(initialSave.settings.muted);

const saveAnd = (save: SaveData): SaveData => {
  persistSave(save);
  return save;
};

export const useStore = create<UiState>((set, get) => ({
  screen: 'menu',
  save: initialSave,
  selectedPlane: initialSave.settings.lastPlane,
  selectedMode: initialSave.settings.lastMode,
  selectedMission: 1,
  lastResult: null,
  paused: false,

  goTo: (screen) => set({ screen, paused: false }),

  selectPlane: (id) =>
    set((st) => ({
      selectedPlane: id,
      save: saveAnd({ ...st.save, settings: { ...st.save.settings, lastPlane: id } }),
    })),

  selectMode: (mode) =>
    set((st) => ({
      selectedMode: mode,
      save: saveAnd({ ...st.save, settings: { ...st.save.settings, lastMode: mode } }),
    })),

  selectMission: (id) => set({ selectedMission: id }),

  startMission: () => set({ screen: 'game', paused: false }),

  setPaused: (paused) => set({ paused }),

  finishMission: (result) => {
    const st = get();
    let save = { ...st.save };
    save.credits += result.credits;
    if (result.victory) {
      save.unlockedMission = Math.max(save.unlockedMission, Math.min(5, result.missionId + 1));
      save.stars = { ...save.stars, [result.missionId]: Math.max(save.stars[result.missionId] ?? 0, result.stars) };
    }
    save = addHighScore(save, {
      score: result.score,
      missionId: result.missionId,
      mode: result.mode,
      planeId: result.planeId,
      difficulty: result.difficulty,
      date: new Date().toISOString().slice(0, 10),
    });
    set({ save: saveAnd(save), lastResult: result, screen: 'results', paused: false });
  },

  buyUpgrade: (key) => {
    const st = get();
    const def = UPGRADES.find((u) => u.key === key)!;
    const level = st.save.upgrades[key];
    if (level >= def.costs.length) return;
    const cost = def.costs[level];
    if (st.save.credits < cost) return;
    set({
      save: saveAnd({
        ...st.save,
        credits: st.save.credits - cost,
        upgrades: { ...st.save.upgrades, [key]: level + 1 },
      }),
    });
  },

  setVolumes: (music, sfx) => {
    audio.setVolumes(music, sfx);
    set((st) => ({
      save: saveAnd({ ...st.save, settings: { ...st.save.settings, musicVolume: music, sfxVolume: sfx } }),
    }));
  },

  toggleMuted: () => {
    const muted = !get().save.settings.muted;
    audio.setMuted(muted);
    set((st) => ({ save: saveAnd({ ...st.save, settings: { ...st.save.settings, muted } }) }));
  },

  setQuality: (quality) =>
    set((st) => ({ save: saveAnd({ ...st.save, settings: { ...st.save.settings, quality } }) })),

  setDifficulty: (difficulty) =>
    set((st) => ({ save: saveAnd({ ...st.save, settings: { ...st.save.settings, difficulty } }) })),

  setBinding: (action, index, code) =>
    set((st) => {
      const bindings: KeyBindings = { ...st.save.settings.bindings };
      const codes = [...(bindings[action] ?? [])];
      // Quita el código de cualquier otra acción para evitar duplicados.
      for (const [a, list] of Object.entries(bindings)) {
        if (a !== action) bindings[a] = list.filter((c) => c !== code);
      }
      codes[index] = code;
      bindings[action] = codes;
      return { save: saveAnd({ ...st.save, settings: { ...st.save.settings, bindings } }) };
    }),

  resetBindings: () =>
    set((st) => ({
      save: saveAnd({
        ...st.save,
        settings: { ...st.save.settings, bindings: structuredClone(DEFAULT_BINDINGS) as KeyBindings },
      }),
    })),
}));
