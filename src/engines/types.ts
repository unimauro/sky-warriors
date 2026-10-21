import type { GameSim } from '../core/game';
import type { MissionResult } from '../core/types';

/** Contrato común de los motores gráficos: Phaser (2D/2.5D) y Three.js (3D). */
export interface EngineCallbacks {
  /** Instantánea del estado para el HUD (~12 Hz). */
  onHud: (sim: GameSim) => void;
  /** La misión terminó (victoria o derrota). */
  onEnd: (result: MissionResult) => void;
  /** Mensaje efímero en pantalla (jefes, objetivos, avisos). */
  onNotice: (text: string) => void;
}

export interface EngineHandle {
  setPaused(paused: boolean): void;
  destroy(): void;
}
