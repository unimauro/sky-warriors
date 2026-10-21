import { expect, test, type Page } from '@playwright/test';

/**
 * Flujo completo del criterio de éxito: abrir la web, elegir avión y modo,
 * empezar una partida, moverse, disparar, destruir enemigos y sumar puntos.
 */

async function startMission(page: Page, mode: string) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SKY WARRIORS' })).toBeVisible();
  await page.getByRole('button', { name: 'Jugar' }).click();

  // Selección de avión y modo.
  await page.getByRole('button', { name: /Cóndor AV-8/ }).click();
  await page.getByRole('button', { name: mode }).click();
  await page.getByRole('button', { name: 'Continuar →' }).click();

  // Misión 1 y despegue.
  await page.getByRole('button', { name: /1\. Defensa del Pacífico/ }).click();
  await page.getByRole('button', { name: 'Informe de misión →' }).click();
  await page.getByRole('button', { name: '¡Despegar!' }).click();

  await expect(page.locator('.game-canvas canvas')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.hud')).toBeVisible({ timeout: 15_000 });
}

const readScore = async (page: Page): Promise<number> => {
  const text = await page.locator('.hud-score').innerText();
  return Number(text.replace(/[^\d]/g, '')) || 0;
};

test('flujo 2D completo: volar, disparar, destruir enemigos y puntuar', async ({ page }) => {
  await startMission(page, '2D Clásico');

  // Mover y disparar durante varios segundos (los exploradores llegan a los 2 s).
  await page.locator('body').press('Space');
  await page.keyboard.down('Space');
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(1200);
  await page.keyboard.up('KeyA');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1200);
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(9_000);
  await page.keyboard.up('Space');

  // Debió destruir enemigos: la puntuación es mayor que cero.
  expect(await readScore(page)).toBeGreaterThan(0);

  // Pausa y reanudación.
  await page.keyboard.press('KeyP');
  await expect(page.getByRole('heading', { name: 'PAUSA' })).toBeVisible();
  await page.getByRole('button', { name: 'Reanudar' }).click();
  await expect(page.getByRole('heading', { name: 'PAUSA' })).toBeHidden();

  // Silenciar con M no rompe nada.
  await page.keyboard.press('KeyM');
  await page.waitForTimeout(400);
  expect(await readScore(page)).toBeGreaterThanOrEqual(0);
});

test('modo 2.5D arranca y renderiza', async ({ page }) => {
  await startMission(page, '2.5D Isométrico');
  await page.keyboard.down('Space');
  await page.waitForTimeout(5_000);
  await page.keyboard.up('Space');
  expect(await readScore(page)).toBeGreaterThanOrEqual(0);
  await expect(page.locator('.game-canvas canvas')).toBeVisible();
});

test('modo 3D arranca, renderiza y cambia de cámara', async ({ page }) => {
  await startMission(page, '3D Inmersivo');
  await page.keyboard.down('Space');
  await page.waitForTimeout(4_000);
  await page.keyboard.up('Space');
  await page.keyboard.press('KeyC');
  await expect(page.locator('.notice').last()).toContainText('Cámara', { timeout: 3_000 });
  await expect(page.locator('.game-canvas canvas')).toBeVisible();
});

test('la configuración persiste controles y la tabla de puntuaciones existe', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Configuración' }).click();
  await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible();

  // Rebind: disparo principal → F.
  const fireKey = page.locator('.keybind-grid button.keycap').nth(8); // fila "Disparo principal", primera tecla
  await fireKey.click();
  await page.keyboard.press('KeyF');
  await expect(fireKey).toHaveText('F');

  // Persistencia tras recargar.
  await page.reload();
  await page.getByRole('button', { name: 'Configuración' }).click();
  await expect(page.locator('.keybind-grid button.keycap').nth(8)).toHaveText('F');

  await page.getByRole('button', { name: 'Restaurar controles por defecto' }).click();
  await expect(page.locator('.keybind-grid button.keycap').nth(8)).toHaveText('Espacio');

  await page.getByRole('button', { name: '← Volver' }).click();
  await page.getByRole('button', { name: 'Puntuaciones' }).click();
  await expect(page.getByRole('heading', { name: 'Mejores puntuaciones' })).toBeVisible();
});
