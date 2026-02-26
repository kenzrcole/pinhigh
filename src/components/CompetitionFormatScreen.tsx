import { ChevronLeft, Home, Trophy, Users, Swords, Award } from 'lucide-react';
import { useGolfGame } from '../context/GolfGameContext';
import type { CompetitionFormat, TeamScrambleOptions } from '../context/GolfGameContext';

interface CompetitionFormatScreenProps {
  onConfirm: () => void;
  onBackToCourse: () => void;
  onBackToHome: () => void;
}

const FORMATS: { id: CompetitionFormat; label: string; shortDesc: string; Icon: typeof Trophy }[] = [
  { id: 'stroke-play', label: 'Stroke play', shortDesc: 'Total strokes for 18 holes', Icon: Trophy },
  { id: 'match-play', label: 'Match play', shortDesc: 'Win holes, not total score', Icon: Swords },
  { id: 'team-scramble', label: 'Team best ball scramble', shortDesc: 'Partner picks best shot each time', Icon: Users },
  { id: 'tournament', label: 'Tournament mode', shortDesc: 'Custom field, net or gross', Icon: Award },
];

export function CompetitionFormatScreen({
  onConfirm,
  onBackToCourse,
  onBackToHome,
}: CompetitionFormatScreenProps) {
  const { gameState, setCompetitionFormat, setTeamScrambleOptions } = useGolfGame();
  const format = gameState.competitionFormat;
  const teamOpts = gameState.teamScrambleOptions;

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
        <h1 className="text-lg font-semibold text-white">Competition format</h1>
        <button
          onClick={onBackToCourse}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          aria-label="Back to course"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <p className="text-slate-400 text-sm mb-4">Choose how you want to compete this round.</p>

        <div className="space-y-2 mb-6">
          {FORMATS.map(({ id, label, shortDesc, Icon }) => (
            <button
              key={id}
              onClick={() => setCompetitionFormat(id)}
              className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition ${
                format === id
                  ? 'bg-green-500/20 border-green-500/60 text-white'
                  : 'bg-slate-800/80 border-slate-700 text-slate-200 hover:border-slate-600'
              }`}
            >
              <div className={`p-2 rounded-lg ${format === id ? 'bg-green-500/30' : 'bg-slate-700'}`}>
                <Icon className={`w-5 h-5 ${format === id ? 'text-green-400' : 'text-slate-400'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{label}</p>
                <p className="text-xs text-slate-400 truncate">{shortDesc}</p>
              </div>
            </button>
          ))}
        </div>

        {format === 'team-scramble' && (
          <div className="space-y-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700 mb-6">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
              Team scramble options
            </h2>

            <div>
              <p className="text-slate-400 text-sm mb-2">Playing with</p>
              <div className="flex gap-2">
                {(['friend', 'ai'] as const).map((partnerType) => (
                  <button
                    key={partnerType}
                    onClick={() =>
                      setTeamScrambleOptions({
                        ...(teamOpts ?? { partnerType: 'ai', opponentsCount: 1 }),
                        partnerType,
                      } as TeamScrambleOptions)
                    }
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium capitalize transition ${
                      (teamOpts?.partnerType ?? 'ai') === partnerType
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {partnerType === 'ai' ? 'AI partner' : 'Friend'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-slate-400 text-sm mb-2">Playing against</p>
              <div className="flex gap-2">
                {([1, 2] as const).map((opponentsCount) => (
                  <button
                    key={opponentsCount}
                    onClick={() =>
                      setTeamScrambleOptions({
                        ...(teamOpts ?? { partnerType: 'ai', opponentsCount: 1 }),
                        opponentsCount,
                      } as TeamScrambleOptions)
                    }
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition ${
                      (teamOpts?.opponentsCount ?? 1) === opponentsCount
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {opponentsCount} {opponentsCount === 1 ? 'opponent' : 'opponents'}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-slate-500 text-xs">
              Opponent(s) will be chosen on the next screen (real players or AI).
            </p>
          </div>
        )}

        {format === 'tournament' && (
          <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700 mb-6">
            <p className="text-slate-400 text-sm">
              Customize the tournament field (size, net/gross, handicap range) on the next screen.
            </p>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-800">
        <button
          onClick={onConfirm}
          className="w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold transition"
        >
          Next: Choose AI Competitor
        </button>
      </div>
    </div>
  );
}
