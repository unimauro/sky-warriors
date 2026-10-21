import { useStore } from '../store';
import { getMission } from '../../scenes/missions';
import { audio } from '../../audio/engine';

export function ResultsScreen() {
  const { lastResult, goTo, selectMission, save } = useStore();
  if (!lastResult) {
    goTo('menu');
    return null;
  }
  const r = lastResult;
  const mission = getMission(r.missionId);
  const accuracy = r.stats.shotsFired > 0 ? Math.round((r.stats.shotsHit / r.stats.shotsFired) * 100) : 0;
  const mins = Math.floor(r.time / 60);
  const secs = Math.floor(r.time % 60).toString().padStart(2, '0');
  const nextUnlocked = r.victory && r.missionId < 5 && save.unlockedMission > r.missionId;

  return (
    <div className="app">
      <div className="screen">
        <h2 className="screen-heading" style={{ color: r.victory ? 'var(--green)' : 'var(--red)' }}>
          {r.victory ? 'Misión cumplida' : 'Misión fallida'}
        </h2>
        <div className="stars" style={{ fontSize: 26 }}>{'★'.repeat(r.stars)}{'☆'.repeat(3 - r.stars)}</div>
        <div className="panel">
          <dl className="results-grid">
            <dt>Misión</dt><dd>{mission.id}. {mission.name}</dd>
            <dt>Puntuación</dt><dd>{r.score.toLocaleString('es-PE')}</dd>
            <dt>Derribos</dt><dd>{r.stats.kills}</dd>
            <dt>Precisión</dt><dd>{accuracy}%</dd>
            <dt>Combo máximo</dt><dd>×{r.stats.maxCombo}</dd>
            {r.stats.basesDestroyed > 0 && (<><dt>Bases destruidas</dt><dd>{r.stats.basesDestroyed}</dd></>)}
            <dt>Tiempo</dt><dd>{mins}:{secs}</dd>
            <dt>Créditos ganados</dt><dd style={{ color: 'var(--amber)' }}>+{r.credits.toLocaleString('es-PE')}</dd>
          </dl>
        </div>
        <div className="menu-buttons">
          {nextUnlocked && (
            <button
              className="btn primary"
              autoFocus
              onClick={() => { audio.play('uiClick'); selectMission(r.missionId + 1); goTo('briefing'); }}
            >
              Siguiente misión →
            </button>
          )}
          <button className="btn" onClick={() => { audio.play('uiClick'); goTo('briefing'); }}>
            {r.victory ? 'Repetir misión' : 'Reintentar'}
          </button>
          <button className="btn" onClick={() => goTo('hangar')}>Hangar · Mejoras</button>
          <button className="btn" onClick={() => goTo('menu')}>Menú principal</button>
        </div>
      </div>
    </div>
  );
}
