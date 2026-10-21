export interface Circle {
  x: number;
  y: number;
  radius: number;
}

export const circlesOverlap = (ax: number, ay: number, ar: number, bx: number, by: number, br: number): boolean => {
  const dx = ax - bx;
  const dy = ay - by;
  const r = ar + br;
  return dx * dx + dy * dy <= r * r;
};

/**
 * Hash espacial uniforme: reduce las pruebas proyectil-enemigo de O(n·m) a las celdas vecinas.
 * Se reconstruye en cada paso (los enemigos se mueven todo el tiempo y son pocos).
 */
export class SpatialHash<T extends Circle> {
  private cells = new Map<number, T[]>();
  private used: T[][] = [];

  constructor(private cellSize = 64) {}

  private key(cx: number, cy: number): number {
    return (cx + 1024) * 4096 + (cy + 1024);
  }

  clear(): void {
    for (const arr of this.used) arr.length = 0;
    this.used.length = 0;
  }

  insert(item: T): void {
    const cs = this.cellSize;
    const x0 = Math.floor((item.x - item.radius) / cs);
    const x1 = Math.floor((item.x + item.radius) / cs);
    const y0 = Math.floor((item.y - item.radius) / cs);
    const y1 = Math.floor((item.y + item.radius) / cs);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const k = this.key(cx, cy);
        let arr = this.cells.get(k);
        if (!arr) {
          arr = [];
          this.cells.set(k, arr);
        }
        if (arr.length === 0) this.used.push(arr);
        arr.push(item);
      }
    }
  }

  /** Devuelve los candidatos cercanos a un círculo (sin duplicados). */
  query(x: number, y: number, r: number, out: T[] = []): T[] {
    out.length = 0;
    const cs = this.cellSize;
    const x0 = Math.floor((x - r) / cs);
    const x1 = Math.floor((x + r) / cs);
    const y0 = Math.floor((y - r) / cs);
    const y1 = Math.floor((y + r) / cs);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const arr = this.cells.get(this.key(cx, cy));
        if (!arr) continue;
        for (const it of arr) if (!out.includes(it)) out.push(it);
      }
    }
    return out;
  }
}
