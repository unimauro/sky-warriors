/**
 * Steering behaviors (Reynolds) usados por la IA enemiga. Cada función devuelve una
 * fuerza de dirección; applySteering la integra respetando fuerza y velocidad máximas.
 */
export interface Kinematic {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface Force {
  x: number;
  y: number;
}

const ZERO: Force = { x: 0, y: 0 };

export function seek(k: Kinematic, tx: number, ty: number, maxSpeed: number): Force {
  const dx = tx - k.x;
  const dy = ty - k.y;
  const d = Math.hypot(dx, dy) || 1;
  return { x: (dx / d) * maxSpeed - k.vx, y: (dy / d) * maxSpeed - k.vy };
}

export function flee(k: Kinematic, tx: number, ty: number, maxSpeed: number): Force {
  const f = seek(k, tx, ty, maxSpeed);
  return { x: -f.x - 2 * k.vx, y: -f.y - 2 * k.vy };
}

/** Como seek, pero frena al acercarse al objetivo. */
export function arrive(k: Kinematic, tx: number, ty: number, maxSpeed: number, slowRadius: number): Force {
  const dx = tx - k.x;
  const dy = ty - k.y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return { x: -k.vx, y: -k.vy };
  const speed = d < slowRadius ? maxSpeed * (d / slowRadius) : maxSpeed;
  return { x: (dx / d) * speed - k.vx, y: (dy / d) * speed - k.vy };
}

/** Persigue la posición futura estimada del objetivo. */
export function pursue(k: Kinematic, target: Kinematic, maxSpeed: number, maxPrediction = 0.8): Force {
  const d = Math.hypot(target.x - k.x, target.y - k.y);
  const t = Math.min(d / Math.max(maxSpeed, 1), maxPrediction);
  return seek(k, target.x + target.vx * t, target.y + target.vy * t, maxSpeed);
}

/** Huye de la posición futura de una amenaza. */
export function evade(k: Kinematic, threat: Kinematic, maxSpeed: number, maxPrediction = 0.5): Force {
  const d = Math.hypot(threat.x - k.x, threat.y - k.y);
  const t = Math.min(d / Math.max(maxSpeed, 1), maxPrediction);
  return flee(k, threat.x + threat.vx * t, threat.y + threat.vy * t, maxSpeed);
}

/** Mantiene distancia con los vecinos para que las formaciones no se amontonen. */
export function separation(k: Kinematic, neighbors: readonly Kinematic[], radius: number, strength: number): Force {
  let fx = 0;
  let fy = 0;
  for (const n of neighbors) {
    if (n === k) continue;
    const dx = k.x - n.x;
    const dy = k.y - n.y;
    const d = Math.hypot(dx, dy);
    if (d > 0 && d < radius) {
      const push = (1 - d / radius) * strength;
      fx += (dx / d) * push;
      fy += (dy / d) * push;
    }
  }
  return fx === 0 && fy === 0 ? ZERO : { x: fx, y: fy };
}

export function combine(...forces: Force[]): Force {
  let x = 0;
  let y = 0;
  for (const f of forces) {
    x += f.x;
    y += f.y;
  }
  return { x, y };
}

export function applySteering(k: Kinematic, force: Force, maxForce: number, maxSpeed: number, dt: number): void {
  let fx = force.x;
  let fy = force.y;
  const fm = Math.hypot(fx, fy);
  if (fm > maxForce) {
    fx = (fx / fm) * maxForce;
    fy = (fy / fm) * maxForce;
  }
  k.vx += fx * dt;
  k.vy += fy * dt;
  const sp = Math.hypot(k.vx, k.vy);
  if (sp > maxSpeed) {
    k.vx = (k.vx / sp) * maxSpeed;
    k.vy = (k.vy / sp) * maxSpeed;
  }
  k.x += k.vx * dt;
  k.y += k.vy * dt;
}
