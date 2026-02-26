import { ArrowLeft, Check, MapPin, Crown, Zap } from 'lucide-react';
import { useGolfGame } from '../context/GolfGameContext';
import type { AppTier } from '../context/GolfGameContext';

interface AppSettingsScreenProps {
  onBackToHome: () => void;
  onEditCourse: () => void;
}

const TIERS: { id: AppTier; label: string; description: string; icon: typeof Zap }[] = [
  {
    id: 'free',
    label: 'Free',
    description: 'Play, Explore, Store & Settings. AI handicaps 0, 5, 10, 15, 20 only. No improve/harm variance.',
    icon: Zap,
  },
  {
    id: 'premium',
    label: 'Premium',
    description: 'All features: full AI roster (including EW 2K), variance slider, and more.',
    icon: Crown,
  },
  {
    id: 'course-pro',
    label: 'Course Pro',
    description: 'Everything in Premium, plus edit tees & greens and outline fairways, trees, hazards, and greens to map the course. Save once and the course stays until you update it.',
    icon: MapPin,
  },
];

export function AppSettingsScreen({ onBackToHome, onEditCourse }: AppSettingsScreenProps) {
  const { gameState, setAppTier } = useGolfGame();
  const currentTier = gameState.appTier;

  return (
    <div className="h-full w-full bg-slate-900 flex flex-col">
      <header className="flex items-center gap-3 p-4 border-b border-slate-800">
        <button
          onClick={onBackToHome}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          aria-label="Back to home"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold text-white">Settings</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <p className="text-slate-400 text-sm">Choose your plan. Your selection is saved locally.</p>

        {TIERS.map(({ id, label, description, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setAppTier(id)}
            className={`w-full text-left p-4 rounded-2xl border-2 transition ${
              currentTier === id
                ? 'border-green-500 bg-green-500/10'
                : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-slate-700">
                  <Icon className="w-5 h-5 text-slate-300" />
                </div>
                <span className="font-semibold text-white">{label}</span>
              </div>
              {currentTier === id && (
                <Check className="w-5 h-5 text-green-400 shrink-0" />
              )}
            </div>
            <p className="text-sm text-slate-400">{description}</p>
          </button>
        ))}

        {currentTier === 'course-pro' && (
          <div className="pt-2">
            <button
              onClick={onEditCourse}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-slate-800 border border-slate-700 text-white font-medium hover:bg-slate-700 transition"
            >
              <MapPin className="w-5 h-5 text-green-400" />
              <span>Edit course</span>
            </button>
            <p className="text-xs text-slate-500 mt-2">
              Update tee markers and greens, and outline fairways, trees, hazards, and greens to map the course accurately.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
