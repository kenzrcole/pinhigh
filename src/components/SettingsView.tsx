import { useGolfGame } from '../context/GolfGameContext';
import { useCurrentRound } from '../context/CurrentRoundContext';
import {
  AI_HANDICAP_OPTIONS,
  AI_CHARACTER_NAMES,
  formatHandicapDisplay,
} from '../data/clubDistancesByHandicap';
import { Settings, Crown, Wind, TrendingUp, RotateCcw, Info, Home } from 'lucide-react';

interface SettingsViewProps {
  onEndRound?: () => void;
}

export function SettingsView({ onEndRound }: SettingsViewProps) {
  const { gameState, setAiProfile, toggleProMode, resetGame } = useGolfGame();
  const { round } = useCurrentRound();
  const roundInProgress = Boolean(round.courseName);
  const isEW2K = gameState.aiProfile === 'EW 2K';
  const currentHcp = typeof gameState.aiProfile === 'number' ? gameState.aiProfile : null;
  const currentProfileLabel =
    typeof gameState.aiProfile === 'string'
      ? gameState.aiProfile
      : `HCP ${formatHandicapDisplay(gameState.aiProfile ?? 15)}`;

  return (
    <div className="h-full w-full bg-slate-900 overflow-y-auto pb-24">
      <div className="p-4 space-y-4">
        <div className="text-center pt-4 pb-2">
          <Settings className="w-12 h-12 mx-auto text-green-500 mb-2" />
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-slate-400 text-sm">Customize your game</p>
        </div>

        <div className="bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Crown className="w-5 h-5 text-amber-400" />
                  Pro Mode
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Unlock advanced features
                </p>
              </div>
              <button
                onClick={toggleProMode}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors min-h-[44px] min-w-[44px] ${
                  gameState.settings.isProMode ? 'bg-green-600' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                    gameState.settings.isProMode ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {gameState.settings.isProMode ? (
              <>
                <div className="flex items-start gap-3 p-3 bg-green-500/10 rounded-xl border border-green-500/30">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <Crown className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-white text-sm">Pro Mode Active</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Wind & slope data enabled
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Wind className="w-4 h-4 text-blue-400" />
                      <span className="text-sm text-slate-300">Wind Data</span>
                    </div>
                    <span className="text-sm font-semibold text-white">
                      {gameState.settings.windSpeed} mph @ {gameState.settings.windDirection}°
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-amber-400" />
                      <span className="text-sm text-slate-300">Slope Rating</span>
                    </div>
                    <span className="text-sm font-semibold text-white">
                      {gameState.settings.slope}°
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-start gap-3 p-3 bg-slate-700/50 rounded-xl">
                <Info className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-300">
                    Enable Pro Mode for wind and slope data. Choose AI Opponent above (characters or handicap).
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-4">
          <h3 className="font-semibold text-white mb-3">AI Opponent</h3>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {AI_CHARACTER_NAMES.map((name) => (
                <button
                  key={name}
                  onClick={() => setAiProfile(name)}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition ${
                    gameState.aiProfile === name
                      ? name === 'EW 2K'
                        ? 'bg-amber-600/30 border-amber-500 text-white'
                        : 'bg-green-600/30 border-green-500 text-white'
                      : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {name}
                </button>
              ))}
              {AI_HANDICAP_OPTIONS.map((h) => (
                <button
                  key={h}
                  onClick={() => setAiProfile(h)}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition ${
                    currentHcp === h ? 'bg-green-600/30 border-green-500 text-white' : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {formatHandicapDisplay(h)}
                </button>
              ))}
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-700">
              <span className="text-sm text-slate-400">Current</span>
              <span className="text-sm font-semibold text-white">{currentProfileLabel}</span>
            </div>
            <p className="text-xs text-slate-500 pt-1">Saved automatically</p>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-4">
          <h3 className="font-semibold text-white mb-3">Game Info</h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-400">Current Hole</span>
              <span className="text-sm font-semibold text-white">
                {gameState.currentHole} of 18
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-400">Holes Played</span>
              <span className="text-sm font-semibold text-white">
                {gameState.playerScores.length}
              </span>
            </div>
          </div>
        </div>

        {roundInProgress && onEndRound && (
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-4">
            <h3 className="font-semibold text-white mb-2">Round</h3>
            <button
              onClick={onEndRound}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-4 px-4 rounded-xl transition flex items-center justify-center gap-2 min-h-[44px]"
            >
              <Home className="w-5 h-5" />
              Quit round and go home
            </button>
            <p className="text-xs text-slate-500 mt-2 text-center">
              End this round and return to the home screen. Progress is not saved.
            </p>
          </div>
        )}

        <button
          onClick={resetGame}
          className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold py-4 px-4 rounded-xl transition transform active:scale-95 flex items-center justify-center gap-2 min-h-[44px]"
        >
          <RotateCcw className="w-5 h-5" />
          Reset Game
        </button>

        <div className="bg-slate-800/30 rounded-2xl border border-slate-700/50 p-4">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            About
          </h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Golf GPS App v1.0 - Built with React, Vite, and Tailwind CSS.
            Ready for CapacitorJS deployment to iOS and Android.
          </p>
        </div>
      </div>
    </div>
  );
}
