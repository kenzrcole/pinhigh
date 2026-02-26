import { ChevronLeft, ChevronRight, Home, User, Award, Users } from 'lucide-react';
import {
  useGolfGame,
  FREE_TIER_AI_HANDICAPS,
  TOURNAMENT_FIELD_SIZES,
  type AIProfile,
  type TournamentOptions,
} from '../context/GolfGameContext';
import { getBenchmarkForHandicap } from '../engine/BenchmarkSystem';
import {
  AI_HANDICAP_OPTIONS,
  AI_CHARACTER_NAMES,
  formatHandicapDisplay,
} from '../data/clubDistancesByHandicap';

const FULL_AI_OPTIONS: AIProfile[] = [...AI_CHARACTER_NAMES, ...AI_HANDICAP_OPTIONS];
const FREE_AI_OPTIONS: AIProfile[] = [...FREE_TIER_AI_HANDICAPS];

function getStatsForProfile(profile: AIProfile): {
  driving: number;
  approach: number;
  shortGame: number;
  putting: number;
} {
  const h =
    typeof profile === 'number'
      ? profile
      : profile === 'EW 2K'
        ? 0
        : profile === 'LPGA Tour'
          ? 2
          : 0;
  const b = getBenchmarkForHandicap(h);
  return {
    driving: b.fairwaysHitPercent,
    approach: b.girPercent,
    shortGame: b.scramblingPercent,
    putting: Math.max(0, 100 - (b.puttsPerRound - 27) * 4),
  };
}

function StatBar({ label, value, variance }: { label: string; value: number; variance: number }) {
  const adjusted = Math.max(0, Math.min(100, value * (1 + variance)));
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-400">{label}</span>
        <span className="text-white font-medium">{Math.round(adjusted)}%</span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 rounded-full transition-all duration-200"
          style={{ width: `${adjusted}%` }}
        />
      </div>
    </div>
  );
}

function TournamentCustomizer({
  options,
  onChange,
  className = '',
}: {
  options: TournamentOptions;
  onChange: (opts: TournamentOptions) => void;
  className?: string;
}) {
  const variancePct = Math.round(options.fieldHandicapVariance * 100);
  return (
    <div className={`space-y-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700 ${className}`}>
      <div className="flex items-center gap-2">
        <Award className="w-5 h-5 text-green-400" />
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
          Tournament field
        </h2>
      </div>

      <div>
        <p className="text-slate-400 text-sm mb-2">Field size</p>
        <div className="flex flex-wrap gap-2">
          {TOURNAMENT_FIELD_SIZES.map((size) => (
            <button
              key={size}
              onClick={() => onChange({ ...options, fieldSize: size })}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                options.fieldSize === size
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-slate-400 text-sm mb-2">Play style</p>
        <div className="flex gap-2">
          {(['net', 'gross'] as const).map((playStyle) => (
            <button
              key={playStyle}
              onClick={() => onChange({ ...options, playStyle })}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium capitalize transition ${
                options.playStyle === playStyle
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {playStyle} stroke play
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-slate-400">Field handicap</span>
          <span
            className={`font-semibold ${
              variancePct > 0 ? 'text-green-400' : variancePct < 0 ? 'text-orange-400' : 'text-slate-300'
            }`}
            >
              {variancePct > 0 ? '+' : ''}{variancePct}%
            </span>
        </div>
        <div className="relative">
          <div
            className="absolute inset-0 h-3 rounded-full pointer-events-none"
            style={{
              background: 'linear-gradient(to right, #dc2626 0%, #ea580c 30%, #eab308 50%, #22c55e 100%)',
            }}
          />
          <input
            type="range"
            min="-10"
            max="10"
            step="1"
            value={variancePct}
            onChange={(e) =>
              onChange({
                ...options,
                fieldHandicapVariance: Number(e.target.value) / 100,
              })
            }
            className="relative w-full h-3 rounded-full cursor-pointer appearance-none bg-transparent
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-slate-300
              [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-slate-300"
          />
        </div>
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span className="text-red-400/80">10% worse</span>
          <span>Stock</span>
          <span className="text-green-400/80">10% better</span>
        </div>
      </div>
    </div>
  );
}

interface AISelectionScreenProps {
  onStartRound: () => void;
  onBackToCompetition: () => void;
  onBackToHome: () => void;
}

export function AISelectionScreen({
  onStartRound,
  onBackToCompetition,
  onBackToHome,
}: AISelectionScreenProps) {
  const { gameState, setAiProfile, setAiVariance, setTournamentOptions } = useGolfGame();
  const tier = gameState.appTier;
  const options = tier === 'free' ? FREE_AI_OPTIONS : FULL_AI_OPTIONS;
  const profile = gameState.aiProfile;
  let selectedIndex = options.indexOf(profile);
  if (selectedIndex < 0) selectedIndex = options.indexOf(15 as AIProfile);
  if (selectedIndex < 0) selectedIndex = 0;
  const displayProfile = options[selectedIndex];
  const stats = getStatsForProfile(displayProfile);
  const variance = gameState.aiVariance;
  const variancePct = Math.round(variance * 100);
  const showVariance = tier !== 'free';
  const competitionFormat = gameState.competitionFormat;
  const isTeamScramble = competitionFormat === 'team-scramble';
  const isTournament = competitionFormat === 'tournament';
  const tournamentOpts = gameState.tournamentOptions;
  const teamScrambleOpponents = gameState.teamScrambleOptions?.opponentsCount ?? 1;

  return (
    <div className="h-full w-full bg-slate-900 flex flex-col">
      <header className="flex items-center justify-between p-4 border-b border-slate-800">
        <button
          onClick={onBackToHome}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          aria-label="Home"
        >
          <Home className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold text-white">AI Competitor</h1>
        <button
          onClick={onBackToCompetition}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          aria-label="Back to competition format"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isTeamScramble && (
          <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-slate-800/80 border border-slate-700">
            <Users className="w-5 h-5 text-green-400 shrink-0" />
            <p className="text-sm text-slate-300">
              You chose to play against <strong>{teamScrambleOpponents}</strong> opponent{teamScrambleOpponents === 2 ? 's' : ''}. Select AI competitor{teamScrambleOpponents === 2 ? 's' : ''} below.
            </p>
          </div>
        )}

        {isTournament && (
          <TournamentCustomizer
            options={
              tournamentOpts ?? {
                fieldSize: 30,
                playStyle: 'net',
                fieldHandicapVariance: 0,
              }
            }
            onChange={(opts) => setTournamentOptions(opts)}
            className="mb-6"
          />
        )}
        <div className="flex items-center justify-center gap-2 mb-6">
          <button
            onClick={() => {
              const next = (selectedIndex - 1 + options.length) % options.length;
              setAiProfile(options[next]);
            }}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
            aria-label="Previous AI"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <div className="flex-1 max-w-[200px] flex items-center justify-center gap-2 py-3 px-4 bg-slate-800/80 rounded-xl border border-slate-700">
            <User className="w-5 h-5 text-green-400" />
            <span className="font-bold text-white">
              {typeof displayProfile === 'string'
                ? displayProfile
                : `HCP ${formatHandicapDisplay(displayProfile)}`}
            </span>
          </div>

          <button
            onClick={() => {
              const next = (selectedIndex + 1) % options.length;
              setAiProfile(options[next]);
            }}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
            aria-label="Next AI"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
            {showVariance ? 'Performance (with variance)' : 'Performance'}
          </h2>
          <div className="space-y-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
            <StatBar label="Driving (fairways %)" value={stats.driving} variance={variance} />
            <StatBar label="Approach (GIR %)" value={stats.approach} variance={variance} />
            <StatBar label="Short game (scrambling %)" value={stats.shortGame} variance={variance} />
            <StatBar label="Putting quality" value={stats.putting} variance={variance} />
          </div>
        </div>

        {showVariance && (
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">AI plays</span>
              <span
                className={`font-semibold ${
                  variancePct > 0 ? 'text-green-400' : variancePct < 0 ? 'text-orange-400' : 'text-slate-300'
                }`}
              >
                {variancePct > 0 ? '+' : ''}{variancePct}%
              </span>
            </div>
            <div className="relative">
              <div
                className="absolute inset-0 h-3 rounded-full pointer-events-none"
                style={{
                  background: 'linear-gradient(to right, #dc2626 0%, #ea580c 30%, #eab308 50%, #22c55e 100%)',
                }}
              />
              <input
                type="range"
                min="-10"
                max="10"
                step="1"
                value={variancePct}
                onChange={(e) => setAiVariance(Number(e.target.value) / 100)}
                className="relative w-full h-3 rounded-full cursor-pointer appearance-none bg-transparent
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-slate-300
                  [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-slate-300"
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span className="text-red-400/80">10% worse</span>
              <span>Stock</span>
              <span className="text-green-400/80">10% better</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-800 space-y-2">
        <button
          onClick={() => {
            setAiProfile(displayProfile);
            onStartRound();
          }}
          className="w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold transition"
        >
          Start Round
        </button>
      </div>
    </div>
  );
}
