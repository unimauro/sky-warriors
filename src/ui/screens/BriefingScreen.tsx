import { useStore } from '../store';
import { getMission, DIFFICULTY } from '../../scenes/missions';
import { getPlane } from '../../entities/planes';
import { audio } from '../../audio/engine';

const MODE_LABEL = { '2d': '2D Clásico', '2.5d': '2.5D Isométrico', '3d': '3D Inmersivo' } as const;

export function BriefingScreen() {
  const { selectedMission, selectedPlane, selectedMode, save, goTo, startMission } = useStore();
  const mission = getMission(selectedMission);
  const plane = getPlane(selectedPlane);

  return (
    <div className="app">
      <div className="screen">
        <h2 className="screen-heading">Misión {mission.id}: {mission.name}</h2>
        <div className="panel briefing-box">
          <div className="role">{mission.subtitle}</div>
          <p style={{ lineHeight: 1.5 }}>{mission.briefing}</p>
          <div>
            {mission.objectives.map((o, i) => (
              <div key={i} className="objective">
                ◆ {o.kind === 'destroyBoss' ? 'Destruye al jefe final'
                  : o.kind === 'destroyBases' ? `Destruye ${o.required} bases enemigas`
                  : 'Elimina a la mayoría de enemigos'}
              </div>
            ))}
          </div>
          <div className="fade-note">
            Avión: <b>{plane.name}</b> · Modo: <b>{MODE_LABEL[selectedMode]}</b> · Dificultad:{' '}
            <b>{DIFFICULTY[save.settings.difficulty].label}</b>
            {mission.wind > 0 && ' · ⚠ Viento fuerte'}
            {mission.visibility < 0.6 && ' · ⚠ Visibilidad reducida'}
          </div>
        </div>
        <div className="row">
          <button className="btn" onClick={() => goTo('missionSelect')}>← Volver</button>
          <button className="btn primary" autoFocus onClick={() => { audio.play('uiClick'); startMission(); }}>
            ¡Despegar!
          </button>
        </div>
      </div>
    </div>
  );
}
