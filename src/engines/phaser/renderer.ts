import Phaser from 'phaser';
import { WORLD_H, WORLD_W } from '../../core/constants';
import type { GameSim } from '../../core/game';
import type { GameEvent, QualityLevel } from '../../core/types';
import type { KeyboardManager } from '../../input/keyboard';
import { audio } from '../../audio/engine';
import { buildTextures, THEME_COLORS } from './textures';
import type { EngineCallbacks, EngineHandle } from '../types';

interface SpriteEntry {
  sprite: Phaser.GameObjects.Image;
  shadow?: Phaser.GameObjects.Image;
  flame?: Phaser.GameObjects.Image;
}

/** Proyección 2.5D: cizalla + escala según la profundidad (y) para un plano isométrico. */
const ISO = {
  shear: 0.5,
  scaleNear: 1.08,
  scaleFar: 0.56,
  ySquash: 0.84,
  yOffset: 70,
};

class BattleScene extends Phaser.Scene {
  private sim!: GameSim;
  private keyboard!: KeyboardManager;
  private callbacks!: EngineCallbacks;
  private iso = false;
  private quality: QualityLevel = 'high';
  private autoQuality = false;

  private planeSprites = new Map<number, SpriteEntry>();
  private projSprites = new Map<number, Phaser.GameObjects.Image>();
  private pickupSprites = new Map<number, Phaser.GameObjects.Image>();
  private obstacleSprites = new Map<number, Phaser.GameObjects.Container>();
  private playerEntry: SpriteEntry | null = null;

  private bgFar!: Phaser.GameObjects.TileSprite;
  private bgDetail!: Phaser.GameObjects.TileSprite;
  private clouds: Phaser.GameObjects.Image[] = [];
  private headlight: Phaser.GameObjects.Image | null = null;
  private flashRect!: Phaser.GameObjects.Rectangle;
  private emitters!: Record<'fire' | 'smoke' | 'spark' | 'trail', Phaser.GameObjects.Particles.ParticleEmitter>;
  private hudTimer = 0;
  private fpsLow = 0;
  private paused = false;
  private pendingLightning = 0;

  init(data: { sim: GameSim; keyboard: KeyboardManager; callbacks: EngineCallbacks; iso: boolean; quality: QualityLevel; autoQuality: boolean }): void {
    this.sim = data.sim;
    this.keyboard = data.keyboard;
    this.callbacks = data.callbacks;
    this.iso = data.iso;
    this.quality = data.quality;
    this.autoQuality = data.autoQuality;
  }

  create(): void {
    buildTextures(this);
    this.buildBackground();
    this.buildEmitters();

    this.flashRect = this.add
      .rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 0xffffff, 1)
      .setDepth(30)
      .setAlpha(0);

    // Oscuridad para misiones nocturnas + "faro" aditivo alrededor del jugador.
    const vis = this.sim.mission.visibility;
    if (vis < 1) {
      this.add
        .rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 0x010209, 1 - vis)
        .setDepth(20);
      this.headlight = this.add
        .image(0, 0, 'glow')
        .setScale(26)
        .setTint(0xfff2c4)
        .setAlpha(0.33)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(21);
    }
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  private tileCount(): number {
    return this.quality === 'low' ? 0.4 : this.quality === 'medium' ? 0.7 : 1;
  }

  private buildBackground(): void {
    const theme = THEME_COLORS[this.sim.mission.theme];
    const g = this.add.graphics();

    // Tile base del terreno/agua con variaciones.
    const tile = 256;
    g.fillStyle(theme.ground, 1).fillRect(0, 0, tile, tile);
    const rng = new Phaser.Math.RandomDataGenerator([String(this.sim.mission.id)]);
    g.fillStyle(theme.detail, 0.5);
    for (let i = 0; i < 46; i++) {
      const w = rng.between(14, 70);
      g.fillEllipse(rng.between(0, tile), rng.between(0, tile), w, w * rng.realInRange(0.2, 0.5));
    }
    g.generateTexture('bg-far', tile, tile);
    g.clear();

    // Capa de detalle (olas / grietas / dunas) que se desplaza más rápido.
    g.fillStyle(theme.detail, 0.35);
    for (let i = 0; i < 26; i++) {
      g.fillRoundedRect(rng.between(0, tile), rng.between(0, tile), rng.between(20, 90), 4, 2);
    }
    g.generateTexture('bg-detail', tile, tile);
    g.destroy();

    this.bgFar = this.add.tileSprite(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 'bg-far').setDepth(0);
    this.bgDetail = this.add
      .tileSprite(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 'bg-detail')
      .setDepth(1)
      .setAlpha(0.8);

    if (this.iso) {
      // En 2.5D el fondo se comprime y se inclina levemente para acompañar la proyección.
      for (const layer of [this.bgFar, this.bgDetail]) {
        layer.setScale(1.35, ISO.ySquash * 1.15);
        layer.y = WORLD_H / 2 + ISO.yOffset * 0.4;
      }
    }

    const cloudCount = Math.round(7 * this.tileCount());
    for (let i = 0; i < cloudCount; i++) {
      const c = this.add
        .image(Phaser.Math.Between(0, WORLD_W), Phaser.Math.Between(-WORLD_H, WORLD_H), `cloud-${i % 3}`)
        .setAlpha(this.sim.mission.theme === 'night' ? 0.1 : 0.32)
        .setScale(Phaser.Math.FloatBetween(0.8, 2))
        .setDepth(15);
      this.clouds.push(c);
    }
  }

  private buildEmitters(): void {
    const q = this.tileCount();
    const common = { lifespan: 600, quantity: 0, emitting: false } as const;
    this.emitters = {
      fire: this.add.particles(0, 0, 'particle', {
        ...common,
        speed: { min: 40, max: 260 },
        scale: { start: 1.6 * q + 0.4, end: 0 },
        tint: [0xfff3b0, 0xffb627, 0xff6b35, 0xd62828],
        lifespan: { min: 300, max: 700 },
        blendMode: Phaser.BlendModes.ADD,
      }).setDepth(12),
      smoke: this.add.particles(0, 0, 'particle', {
        ...common,
        speed: { min: 10, max: 60 },
        scale: { start: 1.8, end: 3.4 },
        alpha: { start: 0.35, end: 0 },
        tint: 0x3a3a40,
        lifespan: { min: 500, max: 1100 },
      }).setDepth(11),
      spark: this.add.particles(0, 0, 'particle', {
        ...common,
        speed: { min: 80, max: 330 },
        scale: { start: 0.7, end: 0 },
        tint: [0xffffff, 0xffe9a3],
        lifespan: { min: 120, max: 320 },
        blendMode: Phaser.BlendModes.ADD,
      }).setDepth(12),
      trail: this.add.particles(0, 0, 'particle', {
        ...common,
        speed: { min: 4, max: 24 },
        scale: { start: 0.55, end: 0 },
        alpha: { start: 0.6, end: 0 },
        tint: 0xbfd9ff,
        lifespan: 260,
        blendMode: Phaser.BlendModes.ADD,
      }).setDepth(9),
    };
  }

  /** Proyección mundo → pantalla. En 2D es identidad; en 2.5D aplica cizalla y escala. */
  private px(x: number, y: number): number {
    if (!this.iso) return x;
    const depth = y / WORLD_H; // 0 lejos, 1 cerca
    const spread = 0.62 + depth * ISO.shear;
    return WORLD_W / 2 + (x - WORLD_W / 2) * spread;
  }

  private py(y: number): number {
    if (!this.iso) return y;
    return y * ISO.ySquash + ISO.yOffset;
  }

  private pscale(y: number): number {
    if (!this.iso) return 1;
    return ISO.scaleFar + (ISO.scaleNear - ISO.scaleFar) * (y / WORLD_H);
  }

  update(_time: number, deltaMs: number): void {
    if (this.paused || this.sim.status !== 'playing') {
      this.syncAll();
      return;
    }
    const dt = deltaMs / 1000;
    const events = this.sim.tick(dt, this.keyboard.state);
    for (const ev of events) this.handleEvent(ev);

    // Desplazamiento del fondo.
    const sc = this.sim.scrollY;
    this.bgFar.tilePositionY = -sc * 0.55;
    this.bgDetail.tilePositionY = -sc * 0.95;
    this.bgDetail.tilePositionX = Math.sin(this.sim.time * 0.4) * 10;
    for (const c of this.clouds) {
      c.y += (this.sim.mission.scrollSpeed * 1.8 + c.scale * 26) * dt;
      if (c.y > WORLD_H + 80) {
        c.y = -90;
        c.x = Phaser.Math.Between(0, WORLD_W);
      }
    }

    // Tormenta: relámpagos ocasionales.
    if (this.sim.mission.wind > 0) {
      this.pendingLightning -= dt;
      if (this.pendingLightning <= 0) {
        this.pendingLightning = Phaser.Math.FloatBetween(4, 11);
        this.flash(0.35, 0xdfe8ff);
        audio.play('lightning');
      }
    }

    this.syncAll();

    // Sonido del motor según estado.
    audio.setEngineIntensity(
      this.sim.player.turboActive,
      Math.hypot(this.sim.player.vx, this.sim.player.vy) > 40,
    );

    // HUD a ~12 Hz (suficiente para barras y contadores).
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.08;
      this.callbacks.onHud(this.sim);
    }

    if (this.sim.status !== 'playing') {
      this.callbacks.onEnd(this.sim.buildResult());
    }

    // Calidad automática: si el FPS cae sostenidamente, bajar un escalón.
    if (this.autoQuality && this.quality !== 'low') {
      if (this.game.loop.actualFps < 46) this.fpsLow += dt;
      else this.fpsLow = Math.max(0, this.fpsLow - dt);
      if (this.fpsLow > 3) {
        this.fpsLow = 0;
        this.quality = this.quality === 'high' ? 'medium' : 'low';
      }
    }
  }

  // ── Sincronización de sprites con el estado de la simulación ───────────────
  private syncAll(): void {
    this.syncPlayer();
    this.syncEnemies();
    this.syncProjectiles();
    this.syncPickups();
    this.syncObstacles();
  }

  private syncPlayer(): void {
    const p = this.sim.player;
    if (!this.playerEntry) {
      const shadow = this.add.image(0, 0, 'shadow').setDepth(2);
      const flame = this.add
        .image(0, 0, 'glow')
        .setTint(0x7fd4ff)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(4);
      const sprite = this.add.image(0, 0, `plane-${p.planeId}`).setDepth(5);
      this.playerEntry = { sprite, shadow, flame };
    }
    const { sprite, shadow, flame } = this.playerEntry;
    const visible = p.alive;
    sprite.setVisible(visible);
    shadow?.setVisible(visible && this.quality !== 'low');
    flame?.setVisible(visible);
    if (!visible) return;

    const sx = this.px(p.x, p.y);
    const sy = this.py(p.y);
    const sc = this.pscale(p.y);
    sprite.setPosition(sx, sy).setScale(sc);
    // Tonel: giro completo; si no, alabeo según velocidad lateral.
    if (p.roll > 0) {
      const t = 1 - p.roll / 0.5;
      sprite.scaleX = sc * Math.abs(Math.cos(t * Math.PI * 2));
      sprite.setRotation(0);
    } else {
      sprite.setRotation(p.bank * 0.4);
      sprite.scaleX = sc * (1 - Math.abs(p.bank) * 0.25);
    }
    // Parpadeo de invulnerabilidad y flash de daño.
    sprite.setAlpha(p.invuln > 0 && Math.floor(this.sim.time * 14) % 2 === 0 ? 0.35 : 1);
    sprite.setTint(p.damageFlash > 0 ? 0xff8080 : 0xffffff);

    shadow?.setPosition(sx + (this.iso ? 26 : 12), sy + (this.iso ? 34 : 42)).setScale(sc * (this.iso ? 1.1 : 0.9));
    if (flame) {
      flame.setPosition(sx - p.bank * 6 * sc, sy + 24 * sc);
      const thrust = p.turboActive ? 2.3 : 1.2;
      flame.setScale(sc * thrust * (1 + Math.sin(this.sim.time * 40) * 0.2));
      flame.setAlpha(p.turboActive ? 0.85 : 0.45);
      flame.setTint(p.turboActive ? 0xb08cff : 0x7fd4ff);
    }
    this.headlight?.setPosition(sx, sy - 60);

    if (this.quality !== 'low' && Math.hypot(p.vx, p.vy) > 60) {
      this.emitters.trail.emitParticleAt(sx - 10 * sc, sy + 20 * sc, 1);
      this.emitters.trail.emitParticleAt(sx + 10 * sc, sy + 20 * sc, 1);
    }
  }

  private enemyTexture(e: { type: string; variant: string }): string {
    return e.type === 'boss' ? `boss-${e.variant}` : `enemy-${e.type}`;
  }

  private syncEnemies(): void {
    const seen = new Set<number>();
    for (const e of this.sim.enemies) {
      if (!e.alive) continue;
      seen.add(e.id);
      let entry = this.planeSprites.get(e.id);
      if (!entry) {
        const sprite = this.add.image(0, 0, this.enemyTexture(e)).setDepth(e.ground ? 3 : 5);
        const shadow = e.ground || this.quality === 'low'
          ? undefined
          : this.add.image(0, 0, 'shadow').setDepth(2).setScale(e.type === 'boss' ? 3 : 1);
        entry = { sprite, shadow };
        this.planeSprites.set(e.id, entry);
      }
      const sx = this.px(e.x, e.y);
      const sy = this.py(e.y);
      const sc = this.pscale(e.y);
      entry.sprite.setPosition(sx, sy).setScale(sc);
      if (e.type !== 'turret' && e.type !== 'boss') {
        entry.sprite.setRotation(e.heading - Math.PI / 2);
      } else if (e.type === 'turret') {
        entry.sprite.setRotation(e.heading + Math.PI / 2);
      }
      if (e.type === 'drone') entry.sprite.setRotation(this.sim.time * 6);
      entry.sprite.setTint(e.flash > 0 ? 0xffb0b0 : 0xffffff);
      entry.shadow?.setPosition(sx + 14, sy + (e.type === 'boss' ? 60 : 34)).setScale(sc * (e.type === 'boss' ? 3 : 1));
    }
    for (const [id, entry] of this.planeSprites) {
      if (!seen.has(id)) {
        entry.sprite.destroy();
        entry.shadow?.destroy();
        this.planeSprites.delete(id);
      }
    }
  }

  private syncProjectiles(): void {
    const seen = new Set<number>();
    this.sim.projectiles.forEachActive((pr) => {
      seen.add(pr.id);
      let img = this.projSprites.get(pr.id);
      if (!img) {
        const tex =
          pr.kind === 'bullet' ? 'bullet'
          : pr.kind === 'missile' ? 'missile'
          : pr.kind === 'enemyMissile' ? 'enemy-missile'
          : 'enemy-bullet';
        img = this.add.image(0, 0, tex).setDepth(6);
        this.projSprites.set(pr.id, img);
      }
      const sc = this.pscale(pr.y);
      img.setPosition(this.px(pr.x, pr.y), this.py(pr.y)).setScale(sc);
      if (pr.kind === 'missile' || pr.kind === 'enemyMissile') {
        img.setRotation(Math.atan2(pr.vy, pr.vx) + Math.PI / 2);
        if (this.quality === 'high') this.emitters.smoke.emitParticleAt(this.px(pr.x, pr.y), this.py(pr.y), 1);
      } else if (pr.kind === 'bullet') {
        img.setRotation(Math.atan2(pr.vy, pr.vx) + Math.PI / 2);
      }
    });
    for (const [id, img] of this.projSprites) {
      if (!seen.has(id)) {
        img.destroy();
        this.projSprites.delete(id);
      }
    }
  }

  private syncPickups(): void {
    const seen = new Set<number>();
    for (const pk of this.sim.pickups) {
      if (!pk.active) continue;
      seen.add(pk.id);
      let img = this.pickupSprites.get(pk.id);
      if (!img) {
        img = this.add.image(0, 0, `pickup-${pk.kind}`).setDepth(4);
        this.pickupSprites.set(pk.id, img);
      }
      const pulse = 1 + Math.sin(pk.t * 5) * 0.12;
      img.setPosition(this.px(pk.x, pk.y), this.py(pk.y)).setScale(this.pscale(pk.y) * pulse);
    }
    for (const [id, img] of this.pickupSprites) {
      if (!seen.has(id)) {
        img.destroy();
        this.pickupSprites.delete(id);
      }
    }
  }

  private syncObstacles(): void {
    const seen = new Set<number>();
    const theme = THEME_COLORS[this.sim.mission.theme];
    for (const o of this.sim.obstacles) {
      if (!o.active) continue;
      seen.add(o.id);
      let c = this.obstacleSprites.get(o.id);
      if (!c) {
        c = this.add.container(0, 0).setDepth(3);
        const g = this.add.graphics();
        if (o.kind === 'peak') {
          g.fillStyle(theme.detail, 1);
          g.fillTriangle(-o.radius, o.radius * 0.8, o.radius, o.radius * 0.8, 0, -o.radius);
          g.fillStyle(0xffffff, this.sim.mission.theme === 'night' ? 0.1 : 0.75);
          g.fillTriangle(-o.radius * 0.3, -o.radius * 0.25, o.radius * 0.3, -o.radius * 0.25, 0, -o.radius);
          g.fillStyle(0x000000, 0.25);
          g.fillTriangle(0, -o.radius, o.radius, o.radius * 0.8, o.radius * 0.45, o.radius * 0.8);
        } else {
          g.fillStyle(0x5c5248, 1).fillRoundedRect(-o.radius * 0.6, -o.radius, o.radius * 1.2, o.radius * 2, 4);
          g.fillStyle(0x7a6e5f, 1).fillRect(-o.radius * 0.6, -o.radius, o.radius * 0.35, o.radius * 2);
          g.fillStyle(0xff4040, 1).fillCircle(0, -o.radius + 5, 3);
        }
        c.add(g);
        this.obstacleSprites.set(o.id, c);
      }
      c.setPosition(this.px(o.x, o.y), this.py(o.y)).setScale(this.pscale(o.y));
    }
    for (const [id, c] of this.obstacleSprites) {
      if (!seen.has(id)) {
        c.destroy();
        this.obstacleSprites.delete(id);
      }
    }
  }

  // ── Eventos de la simulación → efectos y audio ──────────────────────────────
  private handleEvent(ev: GameEvent): void {
    switch (ev.type) {
      case 'shot':
        audio.play('shot');
        break;
      case 'missile':
        audio.play('missile');
        break;
      case 'enemyShot':
        break;
      case 'hit':
        this.emitters.spark.emitParticleAt(this.px(ev.x, ev.y), this.py(ev.y), 4);
        audio.play('hit');
        break;
      case 'explosion': {
        const sx = this.px(ev.x, ev.y);
        const sy = this.py(ev.y);
        const q = this.quality === 'low' ? 0.45 : this.quality === 'medium' ? 0.75 : 1;
        this.emitters.fire.emitParticleAt(sx, sy, Math.round(16 * ev.size * q));
        this.emitters.smoke.emitParticleAt(sx, sy, Math.round(7 * ev.size * q));
        this.emitters.spark.emitParticleAt(sx, sy, Math.round(10 * ev.size * q));
        if (ev.size >= 1.4) {
          this.cameras.main.shake(220 * ev.size, 0.004 * ev.size);
          audio.play('bigExplosion');
        } else {
          audio.play('explosion');
        }
        break;
      }
      case 'playerHit':
        audio.play(ev.shield ? 'shieldHit' : 'playerHit');
        if (!ev.shield) {
          this.cameras.main.shake(150, 0.006);
          this.flash(0.22, 0xff3030);
        }
        break;
      case 'pickup':
        audio.play('pickup');
        this.emitters.spark.emitParticleAt(this.px(ev.x, ev.y), this.py(ev.y), 12);
        break;
      case 'special': {
        audio.play('special');
        this.flash(0.5, 0x9fe8ff);
        this.cameras.main.shake(400, 0.008);
        const sx = this.px(ev.x, ev.y);
        const sy = this.py(ev.y);
        this.emitters.spark.emitParticleAt(sx, sy, 40);
        const ring = this.add.image(sx, sy, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x9fe8ff).setDepth(13);
        this.tweens.add({ targets: ring, scale: 90, alpha: 0, duration: 650, onComplete: () => ring.destroy() });
        break;
      }
      case 'roll':
        audio.play('roll');
        break;
      case 'proximity':
        audio.play('alert');
        break;
      case 'bossWarning':
        audio.play('bossWarning');
        audio.playMusic('boss');
        this.callbacks.onNotice(`⚠ ${ev.name} ⚠`);
        break;
      case 'bossPhase':
        if (ev.phase > 1) {
          this.flash(0.3, 0xffb627);
          this.callbacks.onNotice(`El jefe entra en fase ${ev.phase}`);
        }
        break;
      case 'combo':
        audio.play('combo');
        break;
      case 'lifeLost':
        audio.play('lifeLost');
        break;
      case 'objective':
        this.callbacks.onNotice(ev.text);
        break;
      case 'lightning':
        break;
      case 'victory':
        audio.playMusic('victory');
        break;
      case 'defeat':
        audio.playMusic('defeat');
        break;
    }
  }

  private flash(alpha: number, color: number): void {
    this.flashRect.setFillStyle(color, 1).setAlpha(alpha);
    this.tweens.add({ targets: this.flashRect, alpha: 0, duration: 260 });
  }
}

export function createPhaserEngine(
  container: HTMLElement,
  sim: GameSim,
  keyboard: KeyboardManager,
  callbacks: EngineCallbacks,
  iso: boolean,
  quality: QualityLevel,
  autoQuality: boolean,
): EngineHandle {
  const theme = THEME_COLORS[sim.mission.theme];
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    width: WORLD_W,
    height: WORLD_H,
    backgroundColor: Phaser.Display.Color.IntegerToColor(theme.sky[0]).rgba,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, powerPreference: 'high-performance' },
    audio: { noAudio: true }, // el audio lo lleva nuestro motor Web Audio
    fps: { target: 60 },
  });
  let scene: BattleScene | null = null;
  game.events.once(Phaser.Core.Events.READY, () => {
    game.scene.add('battle', BattleScene, true, { sim, keyboard, callbacks, iso, quality, autoQuality });
    scene = game.scene.getScene('battle') as BattleScene;
  });

  // Pérdida de contexto WebGL: avisamos a la UI; Phaser intenta restaurar solo.
  const canvas = game.canvas;
  const onLost = (e: Event) => {
    e.preventDefault();
    callbacks.onNotice('Contexto gráfico perdido: intentando recuperar…');
  };
  canvas?.addEventListener('webglcontextlost', onLost);

  return {
    setPaused(paused: boolean) {
      scene?.setPaused(paused);
    },
    destroy() {
      canvas?.removeEventListener('webglcontextlost', onLost);
      game.destroy(true);
    },
  };
}
