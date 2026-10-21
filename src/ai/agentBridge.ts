/**
 * Puente opcional para enemigos dirigidos por agentes de IA externos.
 *
 * El gameplay nunca depende de la red: la IA local (máquinas de estados +
 * steering) funciona siempre. Un backend opcional puede, a baja frecuencia
 * (nunca por frame), emitir "directivas" que modulan parámetros globales de la
 * IA local: agresividad, puntería y vitalidad. Si el backend no existe, falla
 * o tarda, el juego sigue con la directiva por defecto.
 *
 * Contrato previsto del backend (POST JSON):
 *   request:  { missionId, score, playerHp, time, kills }
 *   response: { aggression?: number; accuracy?: number; vitality?: number }
 * Los valores se acotan a rangos seguros antes de aplicarse.
 */
export interface AiDirective {
  /** 0.5–1.5 · frecuencia de maniobras ofensivas y evasivas. */
  aggression: number;
  /** 0.5–1.5 · precisión de la puntería enemiga (1 = base). */
  accuracy: number;
  /** 0.75–1.25 · multiplicador de vida de nuevos enemigos. */
  vitality: number;
}

export const defaultDirective = (): AiDirective => ({ aggression: 1, accuracy: 1, vitality: 1 });

const clamp = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

export const sanitizeDirective = (raw: unknown): AiDirective => {
  const obj = (raw ?? {}) as Record<string, unknown>;
  return {
    aggression: clamp(obj.aggression, 0.5, 1.5, 1),
    accuracy: clamp(obj.accuracy, 0.5, 1.5, 1),
    vitality: clamp(obj.vitality, 0.75, 1.25, 1),
  };
};

export interface AgentBridgeOptions {
  endpoint: string;
  /** Segundos entre consultas; mínimo 5 para no castigar el rendimiento. */
  intervalSeconds?: number;
  onDirective: (d: AiDirective) => void;
}

/** Cliente del backend de directivas. Inactivo salvo que se configure un endpoint. */
export class AgentBridge {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private opts: AgentBridgeOptions) {}

  start(getSnapshot: () => Record<string, number>): void {
    const interval = Math.max(5, this.opts.intervalSeconds ?? 10) * 1000;
    this.stop();
    this.timer = setInterval(async () => {
      try {
        const res = await fetch(this.opts.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(getSnapshot()),
          signal: AbortSignal.timeout(3000),
        });
        if (!res.ok) return;
        this.opts.onDirective(sanitizeDirective(await res.json()));
      } catch {
        // Silencioso por diseño: sin backend, el juego continúa con la IA local.
      }
    }, interval);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
