import { useStore } from '../store';
import { MISSIONS } from '../../scenes/missions';
import { audio } from '../../audio/engine';

export function MissionSelectScreen() {
  const { save, selectedMission, selectMission, goTo } = useStore();

  return (
    <div className="app">
      <div className="screen">
        <h2 className="screen-heading">Selecciona misión</h2>
        <div className="row">
          {MISSIONS.map((m) => {
            const locked = m.id > save.unlockedMission;
            const stars = save.stars[m.id] ?? 0;
            return (
              <button
                key={m.id}
                className={`card ${selectedMission === m.id ? 'selected' : ''} ${locked ? 'locked' : ''}`}
                disabled={locked}
                onClick={() => { audio.play('uiClick'); selectMission(m.id); }}
              >
                <h3>{m.id}. {m.name}</h3>
                <div className="role">{m.subtitle}</div>
                <p>{locked ? 'Completa la misión anterior para desbloquear.' : m.briefing.slice(0, 95) + '…'}</p>
                <div className="stars">{'★'.repeat(stars)}{'☆'.repeat(3 - stars)}</div>
              </button>
            );
          })}
        </div>
        <div className="row">
          <button className="btn" onClick={() => goTo('planeSelect')}>← Volver</button>
          <button
            className="btn primary"
            disabled={selectedMission > save.unlockedMission}
            onClick={() => { audio.play('uiClick'); goTo('briefing'); }}
          >
            Informe de misión →
          </button>
        </div>
      </div>
    </div>
  );
}
