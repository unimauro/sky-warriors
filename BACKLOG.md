# BACKLOG — Sky Warriors: Evolution

## Hecho
- [x] Fase 1 — MVP 2D jugable: misión 1, 3 aviones, enemigos, disparos, misiles, sonido sintetizado, puntuación, HUD, pausa, victoria/derrota, continuar.
- [x] Fase 2 — 5 misiones con jefes propios (2-3 fases), progresión con estrellas, créditos y hangar de mejoras, dificultad configurable.
- [x] Fase 3 — Motor 2.5D isométrico (proyección con cizalla + sombras) compartiendo el 100% de las reglas (core/GameSim).
- [x] Fase 4 — Motor 3D Three.js: aviones low-poly procedurales, cámara persecución/cenital/cinemática (C), terreno con scroll, niebla, iluminación por tema, partículas con pool.
- [x] Fase 5 — Pruebas (21 unitarias Vitest + 4 e2e Playwright), calidad gráfica adaptable (auto-degradación por FPS), object pooling, GitHub Actions con CI + deploy a Pages.
- [x] Controles personalizables persistidos en localStorage; tabla de puntuaciones top-10.
- [x] Interfaz opcional para agentes IA externos (src/ai/agentBridge.ts), sin dependencia de red.

## Pendiente
- [ ] Soporte táctil/gamepad para jugar en móvil.
- [ ] Más variedad visual por misión en 3D (olas animadas, cañones entre montañas).
- [ ] Repetición de jefes como modo "boss rush".
- [ ] Backend opcional de directivas IA (contrato ya definido en agentBridge.ts).
- [ ] Marcadores online (requeriría backend; hoy todo es local).
