import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { ACTION_LABELS, keyLabel } from '../../input/keyboard';
import type { Action, Difficulty, QualitySetting } from '../../core/types';
import { audio } from '../../audio/engine';

const ACTIONS = Object.keys(ACTION_LABELS) as Action[];

export function SettingsScreen() {
  const { save, setVolumes, toggleMuted, setQuality, setDifficulty, setBinding, resetBindings, goTo } = useStore();
  const s = save.settings;
  const [listening, setListening] = useState<{ action: string; index: number } | null>(null);

  // Captura de tecla para reasignar controles.
  useEffect(() => {
    if (!listening) return;
    const onKey = (ev: KeyboardEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.code !== 'Escape') {
        setBinding(listening.action, listening.index, ev.code);
        audio.play('uiClick');
      }
      setListening(null);
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [listening, setBinding]);

  return (
    <div className="app">
      <div className="screen">
        <h2 className="screen-heading">Configuración</h2>

        <div className="panel settings-grid">
          <div className="setting-row">
            <label>Volumen de música</label>
            <input
              type="range" min={0} max={1} step={0.05} value={s.musicVolume}
              onChange={(e) => setVolumes(Number(e.target.value), s.sfxVolume)}
            />
          </div>
          <div className="setting-row">
            <label>Volumen de efectos</label>
            <input
              type="range" min={0} max={1} step={0.05} value={s.sfxVolume}
              onChange={(e) => { setVolumes(s.musicVolume, Number(e.target.value)); audio.play('shot'); }}
            />
          </div>
          <div className="setting-row">
            <label>Silencio (M en partida)</label>
            <button className="btn small" onClick={toggleMuted}>{s.muted ? 'Activar sonido' : 'Silenciar'}</button>
          </div>
          <div className="setting-row">
            <label>Calidad gráfica</label>
            <select value={s.quality} onChange={(e) => setQuality(e.target.value as QualitySetting)}>
              <option value="auto">Automática</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </select>
          </div>
          <div className="setting-row">
            <label>Dificultad</label>
            <select value={s.difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
              <option value="easy">Recluta</option>
              <option value="normal">Piloto</option>
              <option value="hard">As</option>
            </select>
          </div>
        </div>

        <div className="panel settings-grid">
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 14, letterSpacing: 2, color: 'var(--cyan)' }}>
            Controles {listening && <span style={{ color: 'var(--amber)' }}>— pulsa una tecla (Esc cancela)</span>}
          </h3>
          <div className="keybind-grid">
            {ACTIONS.map((action) => {
              const codes = s.bindings[action] ?? [];
              return [
                <span className="klabel" key={`${action}-l`}>{ACTION_LABELS[action]}</span>,
                ...[0, 1].map((i) => (
                  <button
                    key={`${action}-${i}`}
                    className={`keycap ${listening?.action === action && listening.index === i ? 'listening' : ''}`}
                    onClick={() => setListening({ action, index: i })}
                  >
                    {listening?.action === action && listening.index === i ? '···' : codes[i] ? keyLabel(codes[i]) : '—'}
                  </button>
                )),
              ];
            })}
          </div>
          <button className="btn small" onClick={() => { resetBindings(); audio.play('uiClick'); }}>
            Restaurar controles por defecto
          </button>
        </div>

        <button className="btn" onClick={() => goTo('menu')}>← Volver</button>
      </div>
    </div>
  );
}
