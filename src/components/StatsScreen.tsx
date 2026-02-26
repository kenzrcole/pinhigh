import { useState, useMemo } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { StatsPeriod } from '../types/roundHistory';
import { getAggregatedStatsForPeriod } from '../services/roundHistoryStore';

const PERIOD_LABELS: Record<StatsPeriod, string> = {
  round: 'Last round',
  week: 'Week over week',
  month: 'Month over month',
  quarter: 'Quarter over quarter',
  '6months': '6 months over 6 months',
  year: 'Year over year',
};

const PERIOD_ORDER: StatsPeriod[] = ['round', 'week', 'month', 'quarter', '6months', 'year'];

interface StatsScreenProps {
  onBackToHome: () => void;
}

export function StatsScreen({ onBackToHome }: StatsScreenProps) {
  const [period, setPeriod] = useState<StatsPeriod>('month');

  const stats = useMemo(() => getAggregatedStatsForPeriod(period), [period]);

  const fairwayPct =
    stats.fairwaysPossible > 0
      ? Math.round((stats.fairwaysHit / stats.fairwaysPossible) * 100)
      : null;
  const girPct =
    stats.girPossible > 0 ? Math.round((stats.girHit / stats.girPossible) * 100) : null;
  const scramblePct =
    stats.scrambleOpportunities > 0
      ? Math.round((stats.scrambleSuccess / stats.scrambleOpportunities) * 100)
      : null;

  return (
    <div className="h-full w-full bg-slate-900 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 shrink-0">
        <button
          onClick={onBackToHome}
          className="p-2 -ml-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          aria-label="Back to home"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold text-white">Progress &amp; stats</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-8">
        <p className="text-slate-400 text-sm mt-1 mb-4">
          Historical stats across all rounds, handicaps, and characters.
        </p>

        <div className="mb-6">
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
            Time period
          </label>
          <div className="flex flex-wrap gap-2">
            {PERIOD_ORDER.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                  period === p
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        {stats.rounds === 0 ? (
          <div className="rounded-2xl bg-slate-800/50 border border-slate-700 p-6 text-center text-slate-400">
            No rounds in this period. Finish a round to see progress here.
          </div>
        ) : (
          <div className="space-y-4">
            <section className="rounded-2xl bg-slate-800/50 border border-slate-700 p-4">
              <h2 className="text-sm font-semibold text-slate-300 mb-3">Rounds &amp; score</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-2xl font-bold text-white">{stats.rounds}</div>
                  <div className="text-xs text-slate-500">Rounds</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">
                    {stats.avgScore.toFixed(1)}
                  </div>
                  <div className="text-xs text-slate-500">Avg score</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">
                    {stats.avgVsPar >= 0 ? '+' : ''}
                    {stats.avgVsPar.toFixed(1)}
                  </div>
                  <div className="text-xs text-slate-500">Avg vs par</div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl bg-slate-800/50 border border-slate-700 p-4">
              <h2 className="text-sm font-semibold text-slate-300 mb-3">Ball striking</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-2xl font-bold text-white">
                    {fairwayPct != null ? `${fairwayPct}%` : '—'}
                  </div>
                  <div className="text-xs text-slate-500">
                    Fairways ({stats.fairwaysHit}/{stats.fairwaysPossible})
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">
                    {girPct != null ? `${girPct}%` : '—'}
                  </div>
                  <div className="text-xs text-slate-500">
                    GIR ({stats.girHit}/{stats.girPossible})
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl bg-slate-800/50 border border-slate-700 p-4">
              <h2 className="text-sm font-semibold text-slate-300 mb-3">Short game &amp; putting</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-2xl font-bold text-white">
                    {scramblePct != null ? `${scramblePct}%` : '—'}
                  </div>
                  <div className="text-xs text-slate-500">
                    Scrambling ({stats.scrambleSuccess}/{stats.scrambleOpportunities})
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">
                    {stats.avgPuttsPerRound.toFixed(1)}
                  </div>
                  <div className="text-xs text-slate-500">Avg putts/round</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{stats.totalPutts}</div>
                  <div className="text-xs text-slate-500">Total putts</div>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
