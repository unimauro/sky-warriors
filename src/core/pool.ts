/**
 * Pool de objetos con lista libre: evita crear/destruir objetos en cada disparo
 * (sin presión sobre el recolector de basura durante el combate).
 */
export class Pool<T extends { active: boolean; poolIndex: number }> {
  readonly items: T[] = [];
  private free: number[] = [];
  private _active = 0;

  constructor(private factory: () => T, capacity: number) {
    for (let i = 0; i < capacity; i++) this.grow();
  }

  get activeCount(): number {
    return this._active;
  }

  private grow(): void {
    const item = this.factory();
    item.poolIndex = this.items.length;
    item.active = false;
    this.items.push(item);
    this.free.push(item.poolIndex);
  }

  acquire(): T {
    if (this.free.length === 0) this.grow();
    const item = this.items[this.free.pop()!];
    item.active = true;
    this._active++;
    return item;
  }

  release(item: T): void {
    if (!item.active) return;
    item.active = false;
    this._active--;
    this.free.push(item.poolIndex);
  }

  releaseAll(): void {
    for (const item of this.items) this.release(item);
  }

  forEachActive(fn: (item: T) => void): void {
    for (const item of this.items) if (item.active) fn(item);
  }
}
