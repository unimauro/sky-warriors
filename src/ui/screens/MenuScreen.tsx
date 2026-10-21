import { useStore } from '../store';
import { audio } from '../../audio/engine';

export function MenuScreen() {
  const goTo = useStore((s) => s.goTo);
  const nav = (screen: Parameters<typeof goTo>[0]) => () => {
    audio.play('uiClick');
    goTo(screen);
  };

  return (
    <div className="app">
      <div className="screen">
        <div>
          <h1 className="title">SKY WARRIORS</h1>
          <p className="subtitle">Evolution</p>
        </div>
        <div className="menu-buttons">
          <button className="btn primary" onClick={nav('planeSelect')} autoFocus>Jugar</button>
          <button className="btn" onClick={nav('hangar')}>Hangar · Mejoras</button>
          <button className="btn" onClick={nav('scores')}>Puntuaciones</button>
          <button className="btn" onClick={nav('settings')}>Configuración</button>
        </div>
        <div className="controls-hint">
          <span><b>WASD/←↑↓→</b> mover</span>
          <span><b>Espacio</b> disparar</span>
          <span><b>J</b> misiles</span>
          <span><b>K</b> especial</span>
          <span><b>Shift</b> turbo</span>
          <span><b>Q/E</b> tonel</span>
          <span><b>C</b> cámara (3D)</span>
          <span><b>P/Esc</b> pausa</span>
          <span><b>M</b> silenciar</span>
        </div>
      </div>
    </div>
  );
}
