import { Play, Compass, ShoppingBag, BarChart3, Settings } from 'lucide-react';

interface HomeScreenProps {
  onPlay: () => void;
  onExplore: () => void;
  onStore: () => void;
  onStats: () => void;
  onSettings: () => void;
}

export function HomeScreen({ onPlay, onExplore, onStore, onStats, onSettings }: HomeScreenProps) {
  return (
    <div className="h-full w-full bg-slate-900 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto flex flex-col items-center px-6 pb-24">
        <div className="text-center mb-12 pt-6">
          <h1 className="text-3xl font-bold text-white tracking-tight">PinHigh</h1>
          <p className="text-slate-400 mt-1 text-sm">Golf GPS & AI Rounds</p>
        </div>

        <div className="w-full max-w-sm space-y-3">
          <button
            onClick={onPlay}
            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-green-600 hover:bg-green-500 text-white font-semibold text-left transition shadow-lg"
          >
            <div className="p-2.5 rounded-xl bg-white/20">
              <Play className="w-6 h-6" />
            </div>
            <span>Play</span>
          </button>

          <button
            onClick={onExplore}
            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold text-left transition"
          >
            <div className="p-2.5 rounded-xl bg-slate-700">
              <Compass className="w-6 h-6 text-slate-300" />
            </div>
            <span>Explore</span>
          </button>

          <button
            onClick={onStore}
            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold text-left transition"
          >
            <div className="p-2.5 rounded-xl bg-slate-700">
              <ShoppingBag className="w-6 h-6 text-slate-300" />
            </div>
            <span>Store</span>
          </button>

          <button
            onClick={onStats}
            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold text-left transition"
          >
            <div className="p-2.5 rounded-xl bg-slate-700">
              <BarChart3 className="w-6 h-6 text-slate-300" />
            </div>
            <span>Stats</span>
          </button>

          <button
            onClick={onSettings}
            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold text-left transition"
          >
            <div className="p-2.5 rounded-xl bg-slate-700">
              <Settings className="w-6 h-6 text-slate-300" />
            </div>
            <span>Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
}
