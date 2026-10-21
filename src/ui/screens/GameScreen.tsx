import { useEffect, useRef, useState } from 'react';
import { GameSim } from '../../core/game';
import type { MissionResult, QualityLevel } from '../../core/types';
import { createPhaserEngine } from '../../engines/phaser/renderer';
import { createThreeEngine } from '../../engines/three/renderer';
import type { EngineHandle } from '../../engines/types';
import { KeyboardManager } from '../../input/keyboard';
import { audio } from '../../audio/engine';
import { useStore } from '../store';
import { getMission } from '../../scenes/missions';

interface HudState {
  score: number;
  hp: number; maxHp: number;
  shield: number; maxShield: number;
  turbo: number;
  energy: number;
  missiles: number;
  lives: number;
  combo: number;
  multiplier: number;
  bossName: string | null;
  bossHp: number;
  time: number;
}

interface Notice { id: number; text: string }

let noticeId = 0;

export function GameScreen() {
  const { selectedMission, selectedPlane, selectedMode, save, finishMission, goTo } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<GameSim | null>(null);
  const engineRef = useRef<EngineHandle | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [paused, setPaused] = useState(false);
  const [ended, setEnded] = useState<MissionResult | null>(null);
  const [runKey, setRunKey] = useState(0);
  const pausedRef = useRef(false);
  const endedRef = useRef(false);

  const pushNotice = (text: string) => {
    const id = ++noticeId;
    setNotices((n) => [...n.slice(-2), { id, text }]);
    setTimeout(() => setNotices((n) => n.filter((x) => x.id !== id)), 2600);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const sim = new GameSim({
      missionId: selectedMission,
      planeId: selectedPlane,
      mode: selectedMode,
      difficulty: save.settings.difficulty,
      upgrades: save.upgrades,
    });
    simRef.current = sim;
    endedRef.current = false;
    setEnded(null);
    setPaused(false);
    pausedRef.current = false;

    const keyboard = new KeyboardManager(save.settings.bindings);
    keyboard.attach();

    const callbacks = {
      onHud: (s: GameSim) => {
        const boss = s.boss;
        setHud({
          score: s.score,
          hp: s.player.hp, maxHp: s.player.maxHp,
          shield: s.player.shield, maxShield: s.player.maxShield,
          turbo: s.player.turbo,
          energy: s.player.energy,
          missiles: s.player.missiles,
          lives: s.player.lives,
          combo: s.combo,
          multiplier: s.multiplier,
          bossName: boss && boss.state !== 'enter' ? bossName(s) : null,
          bossHp: boss ? boss.hp / boss.maxHp : 0,
          time: s.time,
        });
      },
      onEnd: (result: MissionResult) => {
        if (endedRef.current) return;
        endedRef.current = true;
        setEnded(result);
      },
      onNotice: pushNotice,
    };

    const quality: QualityLevel = save.settings.quality === 'auto' ? 'high' : save.settings.quality;
    const autoQuality = save.settings.quality === 'auto';

    const engine: EngineHandle =
      selectedMode === '3d'
        ? createThreeEngine(container, sim, keyboard, callbacks, quality, autoQuality)
        : createPhaserEngine(container, sim, keyboard, callbacks, selectedMode === '2.5d', quality, autoQuality);
    engineRef.current = engine;

    audio.unlock();
    audio.playMusic('combat');
    audio.startEngineLoop();

    const offMeta = keyboard.onMeta((action) => {
      if (action === 'pause') {
        if (endedRef.current) return;
        pausedRef.current = !pausedRef.current;
        setPaused(pausedRef.current);
        engine.setPaused(pausedRef.current);
        audio.play('uiClick');
      } else if (action === 'mute') {
        useStore.getState().toggleMuted();
      }
    });

    // Pausa automática al perder el foco de la pestaña.
    const onVisibility = () => {
      if (document.hidden && !pausedRef.current && !endedRef.current) {
        pausedRef.current = true;
        setPaused(true);
        engine.setPaused(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      offMeta();
      keyboard.detach();
      audio.stopEngineLoop();
      audio.stopMusic();
      engine.destroy();
      engineRef.current = null;
      simRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey]);

  const resume = () => {
    pausedRef.current = false;
    setPaused(false);
    engineRef.current?.setPaused(false);
    audio.play('uiClick');
  };

  const continueRun = () => {
    const sim = simRef.current;
    if (!sim) return;
    sim.continueRun();
    endedRef.current = false;
    setEnded(null);
    audio.play('uiClick');
    audio.playMusic('combat');
    audio.startEngineLoop();
  };

  const mission = getMission(selectedMission);

  return (
    <div className="app">
      <div className="game-root">
        <div ref={containerRef} className="game-canvas" />

        {hud && !ended && <Hud hud={hud} mission={`M${mission.id} · ${mission.name}`} />}

        {notices.map((n) => (
          <div key={n.id} className="notice">{n.text}</div>
        ))}

        {paused && !ended && (
          <div className="overlay">
            <h2 className="pause">PAUSA</h2>
            <div className="menu-buttons">
              <button className="btn primary" onClick={resume} autoFocus>Reanudar</button>
              <button className="btn" onClick={() => { setRunKey((k) => k + 1); }}>Reiniciar misión</button>
              <button className="btn danger" onClick={() => goTo('menu')}>Abandonar</button>
            </div>
            <p className="overlay hint" style={{ position: 'static', background: 'none' }}>P o Esc para reanudar</p>
          </div>
        )}

        {ended && !ended.victory && (
          <div className="overlay">
            <h2 className="defeat">DERRIBADO</h2>
            <p className="hint">{ended.reason} · Puntuación: {ended.score.toLocaleString('es-PE')}</p>
            <div className="menu-buttons">
              <button className="btn primary" onClick={continueRun} autoFocus>Continuar (puntos × 0.7)</button>
              <button className="btn" onClick={() => setRunKey((k) => k + 1)}>Reiniciar misión</button>
              <button className="btn" onClick={() => finishMission(ended)}>Ver resultados</button>
            </div>
          </div>
        )}

        {ended && ended.victory && (
          <div className="overlay">
            <h2 className="victory">¡VICTORIA!</h2>
            <p className="hint">{mission.name} completada · {'★'.repeat(ended.stars)}{'☆'.repeat(3 - ended.stars)}</p>
            <div className="menu-buttons">
              <button className="btn primary" onClick={() => finishMission(ended)} autoFocus>Ver resultados</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function bossName(sim: GameSim): string {
  const variant = sim.boss?.variant ?? '';
  const names: Record<string, string> = {
    kraken: 'Fragata Kraken', condor: 'Cóndor de Hierro', dune: 'Fortaleza Duna',
    spectre: 'Espectro Nocturno', leviathan: 'Leviatán Omega',
  };
  return names[variant] ?? 'Jefe';
}

function Hud({ hud, mission }: { hud: HudState; mission: string }) {
  return (
    <div className="hud">
      <div className="hud-top">
        <div className="hud-score">
          <small>PUNTOS</small>
          {hud.score.toLocaleString('es-PE')}
          {hud.combo >= 4 && (
            <div className="hud-combo">COMBO ×{hud.combo} · {hud.multiplier.toFixed(2)}×</div>
          )}
        </div>
        <div>
          <div className="hud-lives">{'▲'.repeat(Math.max(0, hud.lives))}</div>
          <div className="hud-mission">{mission}</div>
        </div>
      </div>

      {hud.bossName && (
        <div className="boss-bar-wrap">
          <div className="name">{hud.bossName}</div>
          <div className="bar boss"><div className="fill" style={{ width: `${hud.bossHp * 100}%` }} /></div>
        </div>
      )}

      <div className="hud-bottom">
        <div className="hud-bars">
          <div className="bar hp"><div className="fill" style={{ width: `${(hud.hp / hud.maxHp) * 100}%` }} /><span>CASCO</span></div>
          <div className="bar shield"><div className="fill" style={{ width: `${(hud.shield / hud.maxShield) * 100}%` }} /><span>ESCUDO</span></div>
          <div className="bar turbo"><div className="fill" style={{ width: `${hud.turbo}%` }} /><span>TURBO</span></div>
          <div className="bar energy"><div className="fill" style={{ width: `${hud.energy}%` }} /><span>ENERGÍA</span></div>
        </div>
        <div className="hud-ammo">
          <div className="big">{hud.missiles}</div>
          <div className="label">MISILES (J)</div>
          {hud.energy >= 100 && <div className="special-ready">ESPECIAL LISTO (K)</div>}
        </div>
      </div>
    </div>
  );
}
