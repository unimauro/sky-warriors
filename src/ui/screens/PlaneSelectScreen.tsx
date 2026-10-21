import { useStore } from '../store';
import { PLANES } from '../../entities/planes';
import type { GameMode } from '../../core/types';
import { audio } from '../../audio/engine';

const MODES: { id: GameMode; label: string; hint: string }[] = [
  { id: '2d', label: '2D Clásico', hint: 'Scroll vertical arcade' },
  { id: '2.5d', label: '2.5D Isométrico', hint: 'Profundidad y sombras' },
  { id: '3d', label: '3D Inmersivo', hint: 'Cámara de persecución' },
];

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

function PlaneArt({ color, accent }: { color: number; accent: number }) {
  return (
    <svg width="72" height="72" viewBox="0 0 48 48" aria-hidden>
      <polygon points="24,2 17,36 31,36" fill={hex(color)} />
      <polygon points="22,14 2,30 22,28" fill={hex(color)} />
      <polygon points="26,14 46,30 26,28" fill={hex(color)} />
      <polygon points="23,32 15,44 25,38" fill={hex(color)} />
      <polygon points="25,32 33,44 23,38" fill={hex(color)} />
      <polygon points="24,6 21,16 27,16" fill={hex(accent)} />
      <rect x="6" y="26" width="8" height="3" fill={hex(accent)} />
      <rect x="34" y="26" width="8" height="3" fill={hex(accent)} />
      <ellipse cx="24" cy="18" rx="3" ry="5" fill="#9fe8ff" />
    </svg>
  );
}

export function PlaneSelectScreen() {
  const { selectedPlane, selectedMode, selectPlane, selectMode, goTo } = useStore();

  return (
    <div className="app">
      <div className="screen">
        <h2 className="screen-heading">Elige tu avión</h2>
        <div className="row">
          {PLANES.map((p) => (
            <button
              key={p.id}
              className={`card ${selectedPlane === p.id ? 'selected' : ''}`}
              onClick={() => { audio.play('uiClick'); selectPlane(p.id); }}
            >
              <div className="plane-art"><PlaneArt color={p.color} accent={p.accent} /></div>
              <h3>{p.name}</h3>
              <div className="role">{p.role}</div>
              <p>{p.description}</p>
              {(
                [['Velocidad', p.stats.speed], ['Blindaje', p.stats.armor], ['Potencia', p.stats.firepower], ['Misiles', p.stats.missiles]] as const
              ).map(([label, v]) => (
                <div className="statbar" key={label}>
                  <span>{label}</span>
                  <div className="track"><div className="fill" style={{ width: `${v * 20}%` }} /></div>
                </div>
              ))}
            </button>
          ))}
        </div>

        <h2 className="screen-heading">Modo de juego</h2>
        <div className="mode-tabs">
          {MODES.map((m) => (
            <button
              key={m.id}
              className={`mode-tab ${selectedMode === m.id ? 'active' : ''}`}
              onClick={() => { audio.play('uiClick'); selectMode(m.id); }}
              title={m.hint}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="row">
          <button className="btn" onClick={() => goTo('menu')}>← Volver</button>
          <button className="btn primary" onClick={() => { audio.play('uiClick'); goTo('missionSelect'); }}>
            Continuar →
          </button>
        </div>
      </div>
    </div>
  );
}
