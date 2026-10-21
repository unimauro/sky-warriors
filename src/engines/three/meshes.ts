import * as THREE from 'three';
import type { Theme } from '../../core/types';

/** Aviones y escenario low-poly construidos con primitivas: cero modelos externos. */

export function makePlayerPlane(color: number, accent: number): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.35 });
  const accentMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.4, metalness: 0.3 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x9fe8ff, roughness: 0.1, metalness: 0.7 });

  const fuselage = new THREE.Mesh(new THREE.ConeGeometry(0.55, 4.4, 8), mat);
  fuselage.rotation.x = -Math.PI / 2;
  group.add(fuselage);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.12, 1.3), mat);
  wing.position.z = 0.3;
  group.add(wing);

  const wingTipL = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.9), accentMat);
  wingTipL.position.set(-2.5, 0, 0.3);
  const wingTipR = wingTipL.clone();
  wingTipR.position.x = 2.5;
  group.add(wingTipL, wingTipR);

  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.1, 0.7), mat);
  tail.position.z = 1.9;
  group.add(tail);

  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.8), accentMat);
  fin.position.set(0, 0.45, 1.9);
  group.add(fin);

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), glassMat);
  canopy.scale.set(0.7, 0.55, 1.4);
  canopy.position.set(0, 0.35, -0.4);
  group.add(canopy);

  group.traverse((o) => {
    o.castShadow = true;
  });
  return group;
}

export function makeEnemyMesh(type: string, variant: string): THREE.Group {
  const group = new THREE.Group();
  const add = (mesh: THREE.Mesh) => {
    mesh.castShadow = true;
    group.add(mesh);
  };
  switch (type) {
    case 'bomber': {
      const mat = new THREE.MeshStandardMaterial({ color: 0x5a6351, roughness: 0.7 });
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.9, 3.4, 4, 8), mat);
      body.rotation.x = Math.PI / 2;
      add(body);
      const wing = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.16, 1.7), mat);
      add(wing);
      for (const x of [-2.4, 2.4]) {
        const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.4, 8), new THREE.MeshStandardMaterial({ color: 0x434a3c }));
        engine.rotation.x = Math.PI / 2;
        engine.position.set(x, -0.25, 0);
        add(engine);
      }
      break;
    }
    case 'turret': {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.1, 0.9, 8), new THREE.MeshStandardMaterial({ color: 0x6e5d41, roughness: 0.9 }));
      add(base);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x4f4330 }));
      dome.position.y = 0.45;
      add(dome);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.4, 6), new THREE.MeshStandardMaterial({ color: 0x8c8c8c }));
      barrel.rotation.x = Math.PI / 2.6;
      barrel.position.set(0, 0.9, -0.9);
      add(barrel);
      break;
    }
    case 'drone': {
      const mat = new THREE.MeshStandardMaterial({ color: 0x7d3f98, roughness: 0.5, emissive: 0x30103c });
      add(new THREE.Mesh(new THREE.OctahedronGeometry(0.75), mat));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 6, 16), new THREE.MeshStandardMaterial({ color: 0x4a2459 }));
      ring.rotation.x = Math.PI / 2;
      add(ring);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 6), new THREE.MeshStandardMaterial({ color: 0xff4040, emissive: 0xff2020 }));
      eye.position.z = -0.6;
      add(eye);
      break;
    }
    case 'boss': {
      const colors: Record<string, number> = { kraken: 0x4a5568, condor: 0x6b4f2a, dune: 0x8c6a3f, spectre: 0x35315e, leviathan: 0x7a1f2b };
      const color = colors[variant] ?? 0x4a5568;
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.4 });
      const hull = new THREE.Mesh(new THREE.CapsuleGeometry(2.4, 7, 4, 10), mat);
      hull.rotation.x = Math.PI / 2;
      add(hull);
      const wing = new THREE.Mesh(new THREE.BoxGeometry(16, 0.5, 4.4), mat);
      wing.position.z = 1;
      add(wing);
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 3), new THREE.MeshStandardMaterial({ color: 0x20242e, metalness: 0.5 }));
      bridge.position.y = 1.4;
      add(bridge);
      for (const x of [-5.4, 5.4]) {
        const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1, 2.6, 8), new THREE.MeshStandardMaterial({ color: 0x20242e }));
        engine.rotation.x = Math.PI / 2;
        engine.position.set(x, -0.2, 2);
        add(engine);
        const glow = new THREE.Mesh(new THREE.SphereGeometry(0.5, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff5030 }));
        glow.position.set(x, -0.2, 3.4);
        group.add(glow);
      }
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff3030 }));
      core.position.set(0, -0.6, -1);
      group.add(core);
      break;
    }
    case 'ace': {
      const mat = new THREE.MeshStandardMaterial({ color: 0x3b3f52, roughness: 0.4, metalness: 0.5 });
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.45, 3.6, 6), mat);
      body.rotation.x = Math.PI / 2;
      add(body);
      const wing = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 1.6), mat);
      wing.position.z = 0.6;
      wing.rotation.y = 0.16;
      add(wing);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 1), new THREE.MeshStandardMaterial({ color: 0xd6336c }));
      stripe.position.z = -1;
      add(stripe);
      break;
    }
    case 'interceptor': {
      const mat = new THREE.MeshStandardMaterial({ color: 0xc46a4a, roughness: 0.6 });
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3, 6), mat);
      body.rotation.x = Math.PI / 2;
      add(body);
      const wing = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.1, 1.2), mat);
      wing.position.z = 0.5;
      add(wing);
      break;
    }
    default: {
      // scout
      const mat = new THREE.MeshStandardMaterial({ color: 0x8a9bb0, roughness: 0.6 });
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.42, 2.6, 6), mat);
      body.rotation.x = Math.PI / 2;
      add(body);
      const wing = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 1), mat);
      add(wing);
    }
  }
  return group;
}

const THEME_3D: Record<Theme, { sky: number; horizon: number; ground: number; detail: number; sun: number; ambient: number; fogDist: number }> = {
  ocean: { sky: 0x6fb3e8, horizon: 0xbcd9ef, ground: 0x1d5a96, detail: 0x3a86c8, sun: 0xfff2d4, ambient: 0.75, fogDist: 320 },
  mountains: { sky: 0x5c6a8c, horizon: 0x9aa6c0, ground: 0x55617d, detail: 0x6e7b99, sun: 0xdfe4ff, ambient: 0.6, fogDist: 260 },
  desert: { sky: 0xe8b56b, horizon: 0xf4dca4, ground: 0xcaa25e, detail: 0xb58c48, sun: 0xffe9bd, ambient: 0.8, fogDist: 300 },
  night: { sky: 0x05070f, horizon: 0x101a30, ground: 0x0a1222, detail: 0x15223c, sun: 0x8090c0, ambient: 0.16, fogDist: 190 },
  final: { sky: 0x4a1d20, horizon: 0x8f4530, ground: 0x3d1a14, detail: 0x5c2a1c, sun: 0xffb08c, ambient: 0.55, fogDist: 280 },
};

export const theme3d = (theme: Theme) => THEME_3D[theme];

/** Textura procedural del terreno (canvas), repetida y desplazada para el scroll. */
export function makeGroundTexture(theme: Theme, seed: number): THREE.CanvasTexture {
  const t = THEME_3D[theme];
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const toCss = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
  ctx.fillStyle = toCss(t.ground);
  ctx.fillRect(0, 0, size, size);
  let s = seed;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  ctx.fillStyle = toCss(t.detail);
  for (let i = 0; i < 90; i++) {
    ctx.globalAlpha = 0.25 + rnd() * 0.4;
    const w = 12 + rnd() * 90;
    ctx.beginPath();
    ctx.ellipse(rnd() * size, rnd() * size, w, w * (0.25 + rnd() * 0.4), rnd() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 6);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Sprite circular con degradado radial para partículas y nubes. */
export function makeGlowTexture(inner: string, outer: string): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
