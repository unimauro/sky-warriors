import { useStore } from '../store';
import { UPGRADES } from '../../entities/upgrades';
import { audio } from '../../audio/engine';

export function HangarScreen() {
  const { save, buyUpgrade, goTo } = useStore();

  return (
    <div className="app">
      <div className="screen">
        <h2 className="screen-heading">Hangar</h2>
        <div className="credits">CRÉDITOS: {save.credits.toLocaleString('es-PE')}</div>
        <div className="panel" style={{ width: 'min(560px, 92vw)' }}>
          {UPGRADES.map((u) => {
            const level = save.upgrades[u.key];
            const maxed = level >= u.costs.length;
            const cost = maxed ? 0 : u.costs[level];
            return (
              <div className="upgrade-row" key={u.key}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 14 }}>{u.name}</h3>
                  <p style={{ color: 'var(--dim)', fontSize: 13 }}>{u.description}</p>
                  <div className="pips">{'●'.repeat(level)}{'○'.repeat(u.costs.length - level)}</div>
                </div>
                <button
                  className="btn small"
                  disabled={maxed || save.credits < cost}
                  onClick={() => { audio.play('uiClick'); buyUpgrade(u.key); }}
                >
                  {maxed ? 'MÁX' : `Mejorar · ${cost}`}
                </button>
              </div>
            );
          })}
        </div>
        <p className="fade-note">Los créditos se ganan al completar misiones. Las mejoras se aplican a todos los aviones.</p>
        <button className="btn" onClick={() => goTo('menu')}>← Volver</button>
      </div>
    </div>
  );
}
