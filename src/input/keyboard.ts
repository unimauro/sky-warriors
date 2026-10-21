import type { Action, InputState } from '../core/types';
import { emptyInput } from '../core/types';
import type { KeyBindings } from '../persistence/storage';

export type MetaAction = Extract<Action, 'pause' | 'mute' | 'camera'>;

/**
 * Gestor de teclado global: traduce códigos físicos (event.code) a acciones
 * según los controles configurados. Las acciones continuas se leen por frame;
 * pausa/silencio/cámara se emiten como eventos discretos.
 */
export class KeyboardManager {
  readonly state: InputState = emptyInput();
  private keyToActions = new Map<string, Action[]>();
  private listeners = new Set<(action: MetaAction) => void>();
  private pressed = new Set<string>();
  private attached = false;

  constructor(bindings: KeyBindings) {
    this.setBindings(bindings);
  }

  setBindings(bindings: KeyBindings): void {
    this.keyToActions.clear();
    for (const [action, codes] of Object.entries(bindings)) {
      for (const code of codes) {
        const arr = this.keyToActions.get(code) ?? [];
        arr.push(action as Action);
        this.keyToActions.set(code, arr);
      }
    }
  }

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.reset();
  }

  onMeta(fn: (action: MetaAction) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  reset(): void {
    this.pressed.clear();
    Object.assign(this.state, emptyInput());
  }

  private onKeyDown = (ev: KeyboardEvent): void => {
    const actions = this.keyToActions.get(ev.code);
    if (!actions) return;
    // Evita el scroll con Espacio/flechas mientras se juega.
    ev.preventDefault();
    if (this.pressed.has(ev.code)) return;
    this.pressed.add(ev.code);
    for (const action of actions) {
      if (action === 'pause' || action === 'mute' || action === 'camera') {
        for (const fn of this.listeners) fn(action);
      } else {
        this.state[action as keyof InputState] = true;
      }
    }
  };

  private onKeyUp = (ev: KeyboardEvent): void => {
    const actions = this.keyToActions.get(ev.code);
    if (!actions) return;
    this.pressed.delete(ev.code);
    for (const action of actions) {
      if (action !== 'pause' && action !== 'mute' && action !== 'camera') {
        this.state[action as keyof InputState] = false;
      }
    }
  };

  private onBlur = (): void => this.reset();
}

/** Nombres legibles para la pantalla de configuración. */
export function keyLabel(code: string): string {
  const map: Record<string, string> = {
    Space: 'Espacio', ShiftLeft: 'Shift izq', ShiftRight: 'Shift der',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    Escape: 'Esc', ControlLeft: 'Ctrl izq', ControlRight: 'Ctrl der',
    AltLeft: 'Alt izq', AltRight: 'Alt der', Enter: 'Enter', Tab: 'Tab',
  };
  if (map[code]) return map[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

export const ACTION_LABELS: Record<Action, string> = {
  up: 'Avanzar', down: 'Retroceder', left: 'Izquierda', right: 'Derecha',
  fire: 'Disparo principal', missile: 'Misiles', special: 'Arma especial',
  turbo: 'Turbo', rollLeft: 'Tonel izquierda', rollRight: 'Tonel derecha',
  camera: 'Cambiar cámara', pause: 'Pausa', mute: 'Silenciar',
};
