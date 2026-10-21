import { useStore } from '../store';
import { getPlane } from '../../entities/planes';

const MODE_LABEL = { '2d': '2D', '2.5d': '2.5D', '3d': '3D' } as const;

export function ScoresScreen() {
  const { save, goTo } = useStore();

  return (
    <div className="app">
      <div className="screen">
        <h2 className="screen-heading">Mejores puntuaciones</h2>
        {save.highScores.length === 0 ? (
          <p className="fade-note">Aún no hay partidas registradas. ¡Despega y haz historia!</p>
        ) : (
          <div className="panel">
            <table className="scores">
              <thead>
                <tr><th>#</th><th>Puntos</th><th>Misión</th><th>Modo</th><th>Avión</th><th>Fecha</th></tr>
              </thead>
              <tbody>
                {save.highScores.map((s, i) => (
                  <tr key={i}>
                    <td className="rank">{i + 1}</td>
                    <td>{s.score.toLocaleString('es-PE')}</td>
                    <td>M{s.missionId}</td>
                    <td>{MODE_LABEL[s.mode]}</td>
                    <td>{getPlane(s.planeId).name.split(' ')[0]}</td>
                    <td>{s.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button className="btn" onClick={() => goTo('menu')}>← Volver</button>
      </div>
    </div>
  );
}
