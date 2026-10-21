# Sky Warriors: Evolution

Shooter aéreo arcade para navegador, jugable en **tres modos de render — 2D, 2.5D isométrico y 3D —** que comparten exactamente las mismas reglas de combate.

**Jugar:** https://unimauro.github.io/sky-warriors/

Inspirado en *1942*, *Raiden*, *Sky Force* y *Ace Combat*, con todos los gráficos y sonidos generados proceduralmente (sin assets de terceros).

## Cómo se juega

| Tecla | Acción |
|---|---|
| `W` `A` `S` `D` / flechas | Mover |
| `Espacio` | Disparo principal |
| `J` | Misiles guiados |
| `K` | Arma especial (pulso EMP, requiere energía llena) |
| `Shift` | Turbo |
| `Q` / `E` | Tonel evasivo (breve invulnerabilidad) |
| `C` | Cambiar cámara (modo 3D) |
| `P` / `Esc` | Pausa |
| `M` | Silenciar |

Todos los controles son personalizables en **Configuración** y se guardan en el navegador.

### Contenido
- **3 aviones** con estadísticas distintas (polivalente, pesado, interceptor).
- **5 misiones**: Defensa del Pacífico, Tormenta Andina (viento + montañas), Operación Desierto (bases en tierra), Ataque Nocturno (visibilidad reducida) y Batalla Final.
- **5 jefes** con 2-3 fases y ataques encadenados (abanicos, espirales, drones, misiles guiados, embestidas).
- **5 tipos de enemigos** con IA propia: exploradores (patrones sinusoidales), interceptores (persecución con separación), bombarderos (bombardeo en abanico), cazas avanzados (ráfagas + evasión de proyectiles) y drones kamikaze; más bases antiaéreas.
- Power-ups (escudo, reparación, arma, turbo, misiles), combos con multiplicador, 3 dificultades, hangar de mejoras con créditos, tabla de puntuaciones.

## Stack

- **TypeScript + Vite** · **Phaser 3** (2D y 2.5D) · **Three.js** (3D) · **React + Zustand** (menús y HUD) · **Web Audio API** (música y SFX 100% sintetizados) · **localStorage** (progreso) · **Vitest + Playwright** (pruebas) · **GitHub Actions → GitHub Pages** (CI/CD).

## Arquitectura

```
src/
  core/         GameSim: reglas y estado del juego (sin render, paso fijo 60 Hz, RNG determinista)
  systems/      jugador, combate, colisiones (hash espacial), steering behaviors, IA (FSM)
  ai/           puente opcional para directivas de agentes IA externos (nunca por frame)
  entities/     definiciones de aviones, enemigos, jefes y mejoras
  scenes/       las 5 misiones (oleadas, objetivos, jefes, dificultad)
  engines/
    phaser/     renderizador 2D y 2.5D (proyección isométrica, texturas procedurales)
    three/      renderizador 3D (mallas low-poly procedurales, cámara dinámica)
  audio/        motor Web Audio: SFX sintetizados + secuenciador musical
  input/        teclado con controles reasignables
  persistence/  guardado validado en localStorage
  ui/           pantallas React + HUD
tests/
  unit/         21 pruebas de la simulación (Vitest)
  e2e/          4 flujos completos en navegador (Playwright)
```

La clave del diseño: **los tres motores solo dibujan**. `GameSim` corre la simulación con paso fijo y expone estado + eventos; Phaser y Three.js la consumen sin duplicar ninguna regla.

### Rendimiento
- Object pooling para proyectiles y partículas (cero presión de GC en combate).
- Hash espacial para colisiones.
- Calidad gráfica `auto`: si el FPS cae sostenidamente, se degrada sola (partículas, sombras, pixel ratio).
- Manejo de pérdida de contexto WebGL y pausa automática al perder el foco.

## Desarrollo

```bash
npm install
npm run dev        # servidor de desarrollo
npm test           # pruebas unitarias
npm run test:e2e   # pruebas end-to-end (requiere: npx playwright install chromium)
npm run build      # build de producción (dist/)
npm run preview    # sirve el build en :4399
```

## Despliegue

Cada push a `main` ejecuta typecheck, pruebas unitarias y e2e; si todo pasa, publica `dist/` en GitHub Pages con `BASE_PATH=/sky-warriors/` (rutas relativas al subdirectorio). No requiere ningún servicio de pago.

## IA de enemigos

Máquinas de estados finitos + steering behaviors (seek, pursue, evade, arrive, separation) + patrones parametrizados por el RNG determinista de la misión. Todo corre localmente. `src/ai/agentBridge.ts` define una interfaz opcional para que un backend module a baja frecuencia (nunca por frame) la agresividad, puntería y vitalidad enemigas; sin backend, el juego es 100% offline.
