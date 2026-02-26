import { GolfGameProvider } from './context/GolfGameContext';
import { CurrentRoundProvider } from './context/CurrentRoundContext';
import { GolfGPSApp } from './components/GolfGPSApp';

function App() {
  return (
    <GolfGameProvider>
      <CurrentRoundProvider>
        <GolfGPSApp />
      </CurrentRoundProvider>
    </GolfGameProvider>
  );
}

export default App;
