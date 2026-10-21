import { useEffect } from 'react';
import { useStore } from './store';
import { audio } from '../audio/engine';
import { MenuScreen } from './screens/MenuScreen';
import { PlaneSelectScreen } from './screens/PlaneSelectScreen';
import { MissionSelectScreen } from './screens/MissionSelectScreen';
import { HangarScreen } from './screens/HangarScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ScoresScreen } from './screens/ScoresScreen';
import { BriefingScreen } from './screens/BriefingScreen';
import { GameScreen } from './screens/GameScreen';
import { ResultsScreen } from './screens/ResultsScreen';

export function App() {
  const screen = useStore((s) => s.screen);

  // Música de menú en todas las pantallas fuera del combate.
  useEffect(() => {
    if (screen !== 'game') audio.playMusic('menu');
  }, [screen]);

  switch (screen) {
    case 'menu': return <MenuScreen />;
    case 'planeSelect': return <PlaneSelectScreen />;
    case 'missionSelect': return <MissionSelectScreen />;
    case 'hangar': return <HangarScreen />;
    case 'settings': return <SettingsScreen />;
    case 'scores': return <ScoresScreen />;
    case 'briefing': return <BriefingScreen />;
    case 'game': return <GameScreen />;
    case 'results': return <ResultsScreen />;
  }
}
