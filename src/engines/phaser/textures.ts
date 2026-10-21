import Phaser from 'phaser';
import { PLANES } from '../../entities/planes';
import type { Theme } from '../../core/types';

/**
 * Todas las texturas se generan proceduralmente con Phaser.Graphics:
 * sin binarios en el repo y sin recursos con licencia dudosa.
 */
export function buildTextures(scene: Phaser.Scene): void {
  const g = scene.add.graphics();

  const done = (key: string, w: number, h: number) => {
    g.generateTexture(key, w, h);
    g.clear();
  };

  // ── Aviones del jugador ───────────────────────────────────────────────────
  for (const plane of PLANES) {
    drawPlayerPlane(g, plane.color, plane.accent);
    done(`plane-${plane.id}`, 48, 48);
  }

  // ── Enemigos ──────────────────────────────────────────────────────────────
  drawEnemyPlane(g, 0x8a9bb0, 0x5f6e80, 15);
  done('enemy-scout', 36, 36);
  drawEnemyPlane(g, 0xc46a4a, 0x7c3f2b, 17, true);
  done('enemy-interceptor', 40, 40);
  drawBomber(g);
  done('enemy-bomber', 64, 56);
  drawAce(g);
  done('enemy-ace', 42, 42);
  drawDrone(g);
  done('enemy-drone', 26, 26);
  drawTurret(g);
  done('enemy-turret', 48, 48);

  // ── Jefes (silueta grande parametrizada por color) ────────────────────────
  for (const [key, color] of [
    ['kraken', 0x4a5568], ['condor', 0x6b4f2a], ['dune', 0x8c6a3f],
    ['spectre', 0x35315e], ['leviathan', 0x7a1f2b],
  ] as const) {
    drawBoss(g, color);
    done(`boss-${key}`, 160, 120);
  }

  // ── Proyectiles ───────────────────────────────────────────────────────────
  g.fillStyle(0xffe9a3, 1).fillEllipse(5, 8, 6, 14);
  g.fillStyle(0xfff7df, 1).fillEllipse(5, 6, 3, 8);
  done('bullet', 10, 16);
  g.fillStyle(0xff5d5d, 1).fillCircle(5, 5, 4.5);
  g.fillStyle(0xffd0d0, 1).fillCircle(5, 4, 2);
  done('enemy-bullet', 10, 10);
  g.fillStyle(0xd8dee9, 1).fillRoundedRect(3, 0, 8, 20, 3);
  g.fillStyle(0xff8c42, 1).fillTriangle(3, 20, 11, 20, 7, 27);
  g.fillStyle(0x9aa7b8, 1).fillTriangle(0, 14, 3, 8, 3, 18).fillTriangle(14, 14, 11, 8, 11, 18);
  done('missile', 14, 27);
  g.fillStyle(0x2f2a33, 1).fillRoundedRect(3, 0, 8, 18, 3);
  g.fillStyle(0xff4040, 1).fillTriangle(3, 0, 11, 0, 7, -6).fillRect(3, 14, 8, 4);
  done('enemy-missile', 14, 18);

  // ── Power-ups ─────────────────────────────────────────────────────────────
  const pickups: Array<[string, number, string]> = [
    ['shield', 0x4fd1ff, 'S'], ['repair', 0x6ee76e, '+'], ['weapon', 0xffb627, 'W'],
    ['turbo', 0xc792ea, 'T'], ['missiles', 0xff8c42, 'M'],
  ];
  for (const [kind, color] of pickups) {
    g.fillStyle(0x0d1b2e, 1).fillCircle(14, 14, 13);
    g.lineStyle(3, color, 1).strokeCircle(14, 14, 12);
    g.fillStyle(color, 1).fillCircle(14, 14, 6);
    done(`pickup-${kind}`, 28, 28);
  }

  // ── Partículas y efectos ──────────────────────────────────────────────────
  g.fillStyle(0xffffff, 1).fillCircle(4, 4, 4);
  done('particle', 8, 8);
  g.fillStyle(0xffffff, 0.35).fillCircle(8, 8, 8);
  g.fillStyle(0xffffff, 0.8).fillCircle(8, 8, 4);
  done('glow', 16, 16);
  g.fillStyle(0x000000, 0.3).fillEllipse(16, 8, 30, 12);
  done('shadow', 32, 16);

  // Nubes (3 variantes).
  for (let i = 0; i < 3; i++) {
    g.fillStyle(0xffffff, 0.9);
    const w = 90 + i * 40;
    for (let b = 0; b < 6 + i * 2; b++) {
      g.fillCircle(20 + Math.random() * (w - 40), 18 + Math.random() * 10, 10 + Math.random() * 14);
    }
    done(`cloud-${i}`, w + 20, 52);
  }

  g.destroy();
}

function drawPlayerPlane(g: Phaser.GameObjects.Graphics, color: number, accent: number): void {
  const cx = 24;
  // Fuselaje
  g.fillStyle(color, 1);
  g.fillTriangle(cx, 2, cx - 7, 34, cx + 7, 34);
  // Alas
  g.fillTriangle(cx - 2, 14, cx - 22, 30, cx - 2, 28);
  g.fillTriangle(cx + 2, 14, cx + 22, 30, cx + 2, 28);
  // Cola
  g.fillTriangle(cx - 1, 32, cx - 9, 44, cx + 1, 38);
  g.fillTriangle(cx + 1, 32, cx + 9, 44, cx - 1, 38);
  // Detalles
  g.fillStyle(accent, 1);
  g.fillTriangle(cx, 6, cx - 3, 16, cx + 3, 16);
  g.fillRect(cx - 18, 26, 8, 3);
  g.fillRect(cx + 10, 26, 8, 3);
  // Cabina
  g.fillStyle(0x9fe8ff, 1).fillEllipse(cx, 18, 6, 10);
}

function drawEnemyPlane(g: Phaser.GameObjects.Graphics, color: number, dark: number, size: number, swept = false): void {
  const cx = size + 3;
  const cy = size + 3;
  g.fillStyle(color, 1);
  g.fillTriangle(cx, cy + size * 0.9, cx - size * 0.35, cy - size * 0.9, cx + size * 0.35, cy - size * 0.9);
  if (swept) {
    g.fillTriangle(cx - 2, cy - 4, cx - size, cy - size * 0.9, cx - 2, cy + 6);
    g.fillTriangle(cx + 2, cy - 4, cx + size, cy - size * 0.9, cx + 2, cy + 6);
  } else {
    g.fillTriangle(cx - 2, cy - 2, cx - size, cy + 4, cx - 2, cy + 6);
    g.fillTriangle(cx + 2, cy - 2, cx + size, cy + 4, cx + 2, cy + 6);
  }
  g.fillStyle(dark, 1).fillEllipse(cx, cy, 5, 9);
}

function drawBomber(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0x5a6351, 1);
  g.fillEllipse(32, 28, 22, 46);
  g.fillTriangle(32, 14, 2, 34, 32, 30);
  g.fillTriangle(32, 14, 62, 34, 32, 30);
  g.fillStyle(0x434a3c, 1);
  g.fillRect(10, 28, 10, 5).fillRect(44, 28, 10, 5);
  g.fillEllipse(32, 42, 12, 16);
  g.fillStyle(0x8a927f, 1).fillEllipse(32, 16, 8, 10);
}

function drawAce(g: Phaser.GameObjects.Graphics): void {
  const cx = 21;
  g.fillStyle(0x3b3f52, 1);
  g.fillTriangle(cx, 2, cx - 5, 36, cx + 5, 36);
  g.fillTriangle(cx - 2, 10, cx - 19, 34, cx - 2, 30);
  g.fillTriangle(cx + 2, 10, cx + 19, 34, cx + 2, 30);
  g.fillStyle(0xd6336c, 1);
  g.fillTriangle(cx, 4, cx - 3, 14, cx + 3, 14);
  g.fillRect(cx - 16, 30, 6, 3).fillRect(cx + 10, 30, 6, 3);
  g.fillStyle(0xffd9e5, 1).fillEllipse(cx, 18, 5, 8);
}

function drawDrone(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0x7d3f98, 1).fillCircle(13, 13, 9);
  g.fillStyle(0x4a2459, 1);
  g.fillRect(0, 11, 8, 4).fillRect(18, 11, 8, 4).fillRect(11, 0, 4, 8).fillRect(11, 18, 4, 8);
  g.fillStyle(0xff4040, 1).fillCircle(13, 13, 3);
}

function drawTurret(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0x6e5d41, 1).fillRoundedRect(4, 4, 40, 40, 8);
  g.fillStyle(0x4f4330, 1).fillCircle(24, 24, 15);
  g.fillStyle(0x2f2a1e, 1).fillCircle(24, 24, 9);
  g.fillStyle(0x8c8c8c, 1).fillRect(21, 2, 6, 24);
}

function drawBoss(g: Phaser.GameObjects.Graphics, color: number): void {
  const darker = Phaser.Display.Color.IntegerToColor(color).darken(25).color;
  const lighter = Phaser.Display.Color.IntegerToColor(color).lighten(18).color;
  g.fillStyle(color, 1);
  g.fillEllipse(80, 55, 70, 90);
  g.fillTriangle(80, 20, 4, 80, 80, 66);
  g.fillTriangle(80, 20, 156, 80, 80, 66);
  g.fillStyle(darker, 1);
  g.fillEllipse(80, 80, 40, 36);
  g.fillRect(16, 70, 22, 10).fillRect(122, 70, 22, 10);
  g.fillStyle(lighter, 1);
  g.fillEllipse(80, 34, 18, 22);
  g.fillCircle(46, 62, 7).fillCircle(114, 62, 7);
  g.fillStyle(0xff4040, 1).fillCircle(80, 86, 6).fillCircle(46, 62, 3).fillCircle(114, 62, 3);
}

export const THEME_COLORS: Record<Theme, { sky: [number, number]; ground: number; detail: number; fog: number }> = {
  ocean: { sky: [0x2d6fb5, 0x7db7e8], ground: 0x1d5a96, detail: 0x3a86c8, fog: 0xbcd9ef },
  mountains: { sky: [0x3f4a63, 0x8694b5], ground: 0x55617d, detail: 0x6e7b99, fog: 0x9aa6c0 },
  desert: { sky: [0xc98f4e, 0xf2cf8d], ground: 0xcaa25e, detail: 0xb58c48, fog: 0xead9ac },
  night: { sky: [0x05070f, 0x101a30], ground: 0x0a1222, detail: 0x15223c, fog: 0x0c1526 },
  final: { sky: [0x33111d, 0x7a2a1f], ground: 0x3d1a14, detail: 0x5c2a1c, fog: 0x8f4530 },
};
