/** Dimensiones lógicas del campo de batalla (unidades de mundo, independientes del renderizador). */
export const WORLD_W = 640;
export const WORLD_H = 900;

/** Paso fijo de simulación: la lógica corre a 60 Hz aunque el render vaya más lento o más rápido. */
export const FIXED_DT = 1 / 60;
export const MAX_FRAME_DT = 0.25;

/** Altitudes de referencia para los renderizadores 2.5D y 3D. */
export const ALT_PLAYER = 42;
export const ALT_ENEMY = 48;
export const ALT_BOSS = 70;
export const ALT_CLOUD = 120;
