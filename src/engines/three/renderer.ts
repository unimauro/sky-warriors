import * as THREE from 'three';
import { ALT_BOSS, ALT_ENEMY, ALT_PLAYER, WORLD_H, WORLD_W } from '../../core/constants';
import type { GameSim } from '../../core/game';
import type { GameEvent, QualityLevel } from '../../core/types';
import type { KeyboardManager } from '../../input/keyboard';
import { audio } from '../../audio/engine';
import { getPlane } from '../../entities/planes';
import type { EngineCallbacks, EngineHandle } from '../types';
import { makeEnemyMesh, makeGlowTexture, makeGroundTexture, makePlayerPlane, theme3d } from './meshes';

/** Escala mundo-2D → espacio 3D. El mundo lógico es el MISMO para los tres modos. */
const S = 0.085;
const ALT_SCALE = 0.1;

const wx = (x: number) => (x - WORLD_W / 2) * S;
const wz = (y: number) => (y - WORLD_H / 2) * S;

type CameraMode = 'chase' | 'top' | 'cinematic';

interface Particle {
  sprite: THREE.Sprite;
  vx: number; vy: number; vz: number;
  life: number;
  maxLife: number;
  grow: number;
}

export function createThreeEngine(
  container: HTMLElement,
  sim: GameSim,
  keyboard: KeyboardManager,
  callbacks: EngineCallbacks,
  quality: QualityLevel,
  autoQuality: boolean,
): EngineHandle {
  const theme = theme3d(sim.mission.theme);
  const renderer = new THREE.WebGLRenderer({
    antialias: quality !== 'low',
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'high' ? 2 : 1.25));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = quality === 'high';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(theme.sky);
  scene.fog = new THREE.Fog(theme.horizon, 40, theme.fogDist * (sim.mission.visibility < 0.6 ? 0.45 : 1));

  const camera = new THREE.PerspectiveCamera(58, container.clientWidth / container.clientHeight, 0.1, 600);
  let cameraMode: CameraMode = 'chase';

  // ── Iluminación ─────────────────────────────────────────────────────────────
  scene.add(new THREE.HemisphereLight(theme.sky, theme.ground, theme.ambient));
  const sun = new THREE.DirectionalLight(theme.sun, sim.mission.theme === 'night' ? 0.25 : 1.1);
  sun.position.set(30, 60, -20);
  if (quality === 'high') {
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -50;
    sun.shadow.camera.right = 50;
    sun.shadow.camera.top = 50;
    sun.shadow.camera.bottom = -50;
  }
  scene.add(sun);
  // Luz del jugador: imprescindible de noche, sutil de día.
  const playerLight = new THREE.PointLight(0xfff2c4, sim.mission.theme === 'night' ? 60 : 8, 50);
  scene.add(playerLight);

  // ── Terreno y decoración ────────────────────────────────────────────────────
  const groundTex = makeGroundTexture(sim.mission.theme, sim.mission.id * 7919);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(240, 480),
    new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.receiveShadow = quality === 'high';
  scene.add(ground);

  // Montañas/islas de fondo: conos dispersos que se reciclan con el scroll.
  const decoMat = new THREE.MeshStandardMaterial({ color: theme.detail, roughness: 1, flatShading: true });
  const decoGeo = new THREE.ConeGeometry(1, 1, 5);
  const decoCount = quality === 'low' ? 14 : quality === 'medium' ? 24 : 36;
  const deco = new THREE.InstancedMesh(decoGeo, decoMat, decoCount);
  const decoData: { x: number; z: number; s: number; h: number }[] = [];
  const dummy = new THREE.Object3D();
  for (let i = 0; i < decoCount; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    decoData.push({
      x: side * (32 + Math.random() * 60),
      z: -200 + Math.random() * 400,
      s: 4 + Math.random() * 14,
      h: 3 + Math.random() * (sim.mission.theme === 'mountains' ? 22 : 9),
    });
  }
  scene.add(deco);

  // Nubes: sprites suaves por encima del campo de juego.
  const cloudTex = makeGlowTexture('rgba(255,255,255,0.85)', 'rgba(255,255,255,0)');
  const cloudMat = new THREE.SpriteMaterial({
    map: cloudTex,
    transparent: true,
    opacity: sim.mission.theme === 'night' ? 0.08 : 0.5,
    depthWrite: false,
  });
  const clouds: THREE.Sprite[] = [];
  const cloudCount = quality === 'low' ? 6 : 14;
  for (let i = 0; i < cloudCount; i++) {
    const c = new THREE.Sprite(cloudMat);
    c.scale.setScalar(14 + Math.random() * 26);
    c.position.set((Math.random() - 0.5) * 160, 12 + Math.random() * 10, -180 + Math.random() * 360);
    scene.add(c);
    clouds.push(c);
  }

  // ── Jugador ────────────────────────────────────────────────────────────────
  const planeDef = getPlane(sim.player.planeId);
  const playerMesh = makePlayerPlane(planeDef.color, planeDef.accent);
  scene.add(playerMesh);
  const flameTex = makeGlowTexture('rgba(190,230,255,1)', 'rgba(120,160,255,0)');
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  flame.scale.setScalar(1.6);
  playerMesh.add(flame);
  flame.position.set(0, 0, 2.6);

  // ── Pools de visuales por entidad ──────────────────────────────────────────
  const enemyMeshes = new Map<number, THREE.Group>();
  const projMeshes = new Map<number, THREE.Mesh | THREE.Sprite>();
  const pickupMeshes = new Map<number, THREE.Mesh>();
  const obstacleMeshes = new Map<number, THREE.Mesh>();

  const bulletGeo = new THREE.SphereGeometry(0.32, 6, 6);
  const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffe9a3 });
  const enemyBulletMat = new THREE.MeshBasicMaterial({ color: 0xff5d5d });
  const missileGeo = new THREE.ConeGeometry(0.22, 1.3, 6);
  const missileMat = new THREE.MeshStandardMaterial({ color: 0xd8dee9, metalness: 0.5 });
  const enemyMissileMat = new THREE.MeshStandardMaterial({ color: 0x2f2a33 });
  const pickupGeo = new THREE.IcosahedronGeometry(0.9, 0);
  const PICKUP_COLORS: Record<string, number> = {
    shield: 0x4fd1ff, repair: 0x6ee76e, weapon: 0xffb627, turbo: 0xc792ea, missiles: 0xff8c42,
  };

  // ── Partículas (humo, fuego, chispas) con pool manual ──────────────────────
  const fireTex = makeGlowTexture('rgba(255,220,140,1)', 'rgba(255,80,30,0)');
  const smokeTex = makeGlowTexture('rgba(70,70,78,0.7)', 'rgba(50,50,56,0)');
  const particles: Particle[] = [];
  const freeParticles: Particle[] = [];
  const maxParticles = quality === 'low' ? 90 : quality === 'medium' ? 180 : 320;

  const spawnParticle = (
    tex: THREE.Texture, additive: boolean,
    x: number, y: number, z: number,
    speed: number, life: number, scale: number, grow: number,
  ) => {
    let p = freeParticles.pop();
    if (!p) {
      if (particles.length >= maxParticles) return;
      const mat = new THREE.SpriteMaterial({ transparent: true, depthWrite: false });
      p = { sprite: new THREE.Sprite(mat), vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, grow: 0 };
      scene.add(p.sprite);
      particles.push(p);
    }
    const mat = p.sprite.material as THREE.SpriteMaterial;
    mat.map = tex;
    mat.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    mat.needsUpdate = true;
    p.sprite.visible = true;
    p.sprite.position.set(x, y, z);
    p.sprite.scale.setScalar(scale);
    p.vx = (Math.random() - 0.5) * speed;
    p.vy = Math.random() * speed * 0.7;
    p.vz = (Math.random() - 0.5) * speed;
    p.life = life * (0.6 + Math.random() * 0.7);
    p.maxLife = p.life;
    p.grow = grow;
  };

  const burst = (x: number, y: number, z: number, size: number) => {
    const q = quality === 'low' ? 0.4 : quality === 'medium' ? 0.7 : 1;
    for (let i = 0; i < 10 * size * q; i++) spawnParticle(fireTex, true, x, y, z, 9 * size, 0.6, 1.4 * size, -0.4);
    for (let i = 0; i < 5 * size * q; i++) spawnParticle(smokeTex, false, x, y, z, 4 * size, 1.1, 1.8 * size, 2.2);
  };

  // ── Eventos → audio y efectos ──────────────────────────────────────────────
  let shake = 0;
  const handleEvent = (ev: GameEvent) => {
    switch (ev.type) {
      case 'shot': audio.play('shot'); break;
      case 'missile': audio.play('missile'); break;
      case 'hit':
        audio.play('hit');
        spawnParticle(fireTex, true, wx(ev.x), ALT_ENEMY * ALT_SCALE, wz(ev.y), 5, 0.3, 0.8, -0.5);
        break;
      case 'explosion': {
        const alt = ev.ground ? 0.6 : ALT_ENEMY * ALT_SCALE;
        burst(wx(ev.x), alt, wz(ev.y), ev.size);
        if (ev.size >= 1.4) { audio.play('bigExplosion'); shake = Math.min(1.2, shake + 0.35 * ev.size); }
        else audio.play('explosion');
        break;
      }
      case 'playerHit':
        audio.play(ev.shield ? 'shieldHit' : 'playerHit');
        if (!ev.shield) shake = Math.min(1.2, shake + 0.4);
        break;
      case 'pickup': audio.play('pickup'); break;
      case 'special': {
        audio.play('special');
        shake = 1;
        burst(wx(ev.x), ALT_PLAYER * ALT_SCALE, wz(ev.y), 3);
        break;
      }
      case 'roll': audio.play('roll'); break;
      case 'proximity': audio.play('alert'); break;
      case 'bossWarning':
        audio.play('bossWarning');
        audio.playMusic('boss');
        callbacks.onNotice(`⚠ ${ev.name} ⚠`);
        break;
      case 'bossPhase':
        if (ev.phase > 1) callbacks.onNotice(`El jefe entra en fase ${ev.phase}`);
        break;
      case 'combo': audio.play('combo'); break;
      case 'lifeLost': audio.play('lifeLost'); break;
      case 'objective': callbacks.onNotice(ev.text); break;
      case 'victory': audio.playMusic('victory'); break;
      case 'defeat': audio.playMusic('defeat'); break;
      default: break;
    }
  };

  // ── Bucle principal ────────────────────────────────────────────────────────
  let paused = false;
  let destroyed = false;
  let hudTimer = 0;
  let last = performance.now();
  let fpsLow = 0;
  let currentQuality = quality;

  const camOffsets: Record<CameraMode, { pos: THREE.Vector3; look: THREE.Vector3 }> = {
    chase: { pos: new THREE.Vector3(0, 14, 20), look: new THREE.Vector3(0, 2, -16) },
    top: { pos: new THREE.Vector3(0, 46, 6), look: new THREE.Vector3(0, 0, -6) },
    cinematic: { pos: new THREE.Vector3(16, 6, 12), look: new THREE.Vector3(0, 3, -10) },
  };

  const syncScene = (dt: number) => {
    const p = sim.player;
    const px3 = wx(p.x);
    const pz3 = wz(p.y);
    const altitude = ALT_PLAYER * ALT_SCALE;

    playerMesh.visible = p.alive && !(p.invuln > 0 && Math.floor(sim.time * 14) % 2 === 0);
    playerMesh.position.set(px3, altitude, pz3);
    const rollAngle = p.roll > 0 ? (1 - p.roll / 0.5) * Math.PI * 2 * p.rollDir : -p.bank * 0.9;
    playerMesh.rotation.set(p.vy * -0.0012, 0, rollAngle);
    flame.scale.setScalar(p.turboActive ? 2.6 : 1.4 + Math.sin(sim.time * 38) * 0.18);
    (flame.material as THREE.SpriteMaterial).opacity = p.turboActive ? 0.95 : 0.6;
    playerLight.position.set(px3, altitude + 2, pz3);

    // Humo al estar dañado.
    if (p.alive && p.hp < p.maxHp * 0.3 && Math.random() < 0.3) {
      spawnParticle(smokeTex, false, px3, altitude, pz3 + 0.8, 1.5, 0.9, 0.8, 1.6);
    }

    // Enemigos.
    const seen = new Set<number>();
    for (const e of sim.enemies) {
      if (!e.alive) continue;
      seen.add(e.id);
      let mesh = enemyMeshes.get(e.id);
      if (!mesh) {
        mesh = makeEnemyMesh(e.type, e.variant);
        scene.add(mesh);
        enemyMeshes.set(e.id, mesh);
      }
      const alt = e.ground ? 0.4 : (e.type === 'boss' ? ALT_BOSS : ALT_ENEMY) * ALT_SCALE;
      mesh.position.set(wx(e.x), alt, wz(e.y));
      if (e.type === 'drone') mesh.rotation.y = sim.time * 5;
      else if (!e.ground) {
        mesh.rotation.y = Math.PI - (e.heading - Math.PI / 2);
        mesh.rotation.z = -e.vx * 0.002;
      } else if (e.type === 'turret') {
        mesh.rotation.y = -e.heading - Math.PI / 2;
      }
      const scale = e.flash > 0 ? 1.08 : 1;
      mesh.scale.setScalar(scale);
    }
    for (const [id, mesh] of enemyMeshes) {
      if (!seen.has(id)) {
        scene.remove(mesh);
        enemyMeshes.delete(id);
      }
    }

    // Proyectiles.
    const seenP = new Set<number>();
    sim.projectiles.forEachActive((pr) => {
      seenP.add(pr.id);
      let m = projMeshes.get(pr.id);
      if (!m) {
        if (pr.kind === 'bullet') m = new THREE.Mesh(bulletGeo, bulletMat);
        else if (pr.kind === 'enemyBullet') m = new THREE.Mesh(bulletGeo, enemyBulletMat);
        else m = new THREE.Mesh(missileGeo, pr.kind === 'missile' ? missileMat : enemyMissileMat);
        scene.add(m);
        projMeshes.set(pr.id, m);
      }
      const alt = (pr.kind === 'bullet' || pr.kind === 'missile' ? ALT_PLAYER : ALT_ENEMY) * ALT_SCALE;
      m.position.set(wx(pr.x), alt, wz(pr.y));
      if (pr.kind === 'missile' || pr.kind === 'enemyMissile') {
        m.rotation.set(Math.PI / 2, 0, -Math.atan2(pr.vy, pr.vx) - Math.PI / 2, 'YXZ');
        if (currentQuality !== 'low' && Math.random() < 0.5) {
          spawnParticle(smokeTex, false, m.position.x, m.position.y, m.position.z, 0.8, 0.5, 0.5, 1);
        }
      }
    });
    for (const [id, m] of projMeshes) {
      if (!seenP.has(id)) {
        scene.remove(m);
        projMeshes.delete(id);
      }
    }

    // Power-ups.
    const seenPk = new Set<number>();
    for (const pk of sim.pickups) {
      if (!pk.active) continue;
      seenPk.add(pk.id);
      let m = pickupMeshes.get(pk.id);
      if (!m) {
        m = new THREE.Mesh(pickupGeo, new THREE.MeshStandardMaterial({
          color: PICKUP_COLORS[pk.kind], emissive: PICKUP_COLORS[pk.kind], emissiveIntensity: 0.5,
        }));
        scene.add(m);
        pickupMeshes.set(pk.id, m);
      }
      m.position.set(wx(pk.x), ALT_PLAYER * ALT_SCALE, wz(pk.y));
      m.rotation.y += dt * 2.5;
    }
    for (const [id, m] of pickupMeshes) {
      if (!seenPk.has(id)) {
        scene.remove(m);
        (m.material as THREE.Material).dispose();
        pickupMeshes.delete(id);
      }
    }

    // Obstáculos (picos / torres).
    const seenO = new Set<number>();
    for (const o of sim.obstacles) {
      if (!o.active) continue;
      seenO.add(o.id);
      let m = obstacleMeshes.get(o.id);
      if (!m) {
        const h = o.height * 0.14;
        m = o.kind === 'peak'
          ? new THREE.Mesh(new THREE.ConeGeometry(o.radius * S * 1.2, h, 6), decoMat)
          : new THREE.Mesh(new THREE.CylinderGeometry(o.radius * S * 0.7, o.radius * S, h, 8), new THREE.MeshStandardMaterial({ color: 0x5c5248 }));
        m.position.y = h / 2;
        scene.add(m);
        obstacleMeshes.set(o.id, m);
      }
      m.position.x = wx(o.x);
      m.position.z = wz(o.y);
    }
    for (const [id, m] of obstacleMeshes) {
      if (!seenO.has(id)) {
        scene.remove(m);
        obstacleMeshes.delete(id);
      }
    }

    // Scroll: el terreno y la decoración se mueven hacia la cámara.
    groundTex.offset.y = sim.scrollY * S * 0.0125;
    for (let i = 0; i < decoData.length; i++) {
      const d = decoData[i];
      d.z += sim.mission.scrollSpeed * S * dt;
      if (d.z > 220) {
        d.z = -240;
        d.x = (i % 2 === 0 ? -1 : 1) * (32 + Math.random() * 60);
      }
      dummy.position.set(d.x, d.h / 2 - 0.2, d.z);
      dummy.scale.set(d.s, d.h, d.s);
      dummy.updateMatrix();
      deco.setMatrixAt(i, dummy.matrix);
    }
    deco.instanceMatrix.needsUpdate = true;
    for (const c of clouds) {
      c.position.z += sim.mission.scrollSpeed * S * 2.2 * dt;
      if (c.position.z > 160) {
        c.position.z = -220;
        c.position.x = (Math.random() - 0.5) * 160;
      }
    }

    // Partículas.
    for (const pt of particles) {
      if (!pt.sprite.visible) continue;
      pt.life -= dt;
      if (pt.life <= 0) {
        pt.sprite.visible = false;
        freeParticles.push(pt);
        continue;
      }
      pt.sprite.position.x += pt.vx * dt;
      pt.sprite.position.y += pt.vy * dt;
      pt.sprite.position.z += pt.vz * dt;
      const t = pt.life / pt.maxLife;
      (pt.sprite.material as THREE.SpriteMaterial).opacity = t;
      pt.sprite.scale.addScalar(pt.grow * dt);
    }

    // Cámara.
    const off = camOffsets[cameraMode];
    const targetPos = new THREE.Vector3(px3 * 0.8 + off.pos.x, off.pos.y, pz3 * 0.55 + off.pos.z);
    camera.position.lerp(targetPos, Math.min(1, dt * 4));
    if (shake > 0) {
      shake = Math.max(0, shake - dt * 2.4);
      camera.position.x += (Math.random() - 0.5) * shake * 0.8;
      camera.position.y += (Math.random() - 0.5) * shake * 0.8;
    }
    camera.lookAt(px3 * 0.55 + off.look.x, off.look.y, pz3 * 0.4 + off.look.z);
  };

  const loop = (now: number) => {
    if (destroyed) return;
    requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!paused && sim.status === 'playing') {
      const events = sim.tick(dt, keyboard.state);
      for (const ev of events) handleEvent(ev);
      audio.setEngineIntensity(sim.player.turboActive, Math.hypot(sim.player.vx, sim.player.vy) > 40);
      hudTimer -= dt;
      if (hudTimer <= 0) {
        hudTimer = 0.08;
        callbacks.onHud(sim);
      }
      if (sim.status !== 'playing') callbacks.onEnd(sim.buildResult());

      if (autoQuality && currentQuality !== 'low') {
        if (dt > 1 / 45) fpsLow += dt;
        else fpsLow = Math.max(0, fpsLow - dt);
        if (fpsLow > 3) {
          fpsLow = 0;
          currentQuality = currentQuality === 'high' ? 'medium' : 'low';
          renderer.setPixelRatio(1);
          renderer.shadowMap.enabled = false;
        }
      }
    }
    syncScene(paused ? 0 : dt);
    renderer.render(scene, camera);
  };
  requestAnimationFrame(loop);

  const onResize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', onResize);

  const onContextLost = (e: Event) => {
    e.preventDefault();
    callbacks.onNotice('Contexto gráfico perdido: intentando recuperar…');
  };
  renderer.domElement.addEventListener('webglcontextlost', onContextLost);

  const offMeta = keyboard.onMeta((action) => {
    if (action === 'camera') {
      cameraMode = cameraMode === 'chase' ? 'top' : cameraMode === 'top' ? 'cinematic' : 'chase';
      callbacks.onNotice(`Cámara: ${cameraMode === 'chase' ? 'persecución' : cameraMode === 'top' ? 'cenital' : 'cinemática'}`);
    }
  });

  return {
    setPaused(p: boolean) {
      paused = p;
    },
    destroy() {
      destroyed = true;
      offMeta();
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = (mesh as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
