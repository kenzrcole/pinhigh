import { useState, useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import type { StatsPeriod } from '../../types/roundHistory';
import { getAggregatedStatsForPeriod } from '../../services/roundHistoryStore';

const PERIOD_LABELS: Record<StatsPeriod, string> = {
  round: 'Last round',
  week: 'Week',
  month: 'Month',
  quarter: 'Quarter',
  '6months': '6 mo',
  year: 'Year',
};

const PERIOD_ORDER: StatsPeriod[] = ['round', 'week', 'month', 'quarter', '6months', 'year'];

export function StatsSection() {
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
    <div className="w-full max-w-sm">
      <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-slate-400" />
        Stats
      </h2>
      <p className="text-slate-400 text-sm mb-4">
        Progress across all rounds, handicaps, and characters.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {PERIOD_ORDER.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              period === p
                ? 'bg-green-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {stats.rounds === 0 ? (
        <div className="rounded-2xl bg-slate-800/50 border border-slate-700 p-6 text-center text-slate-400 text-sm">
          No rounds in this period. Finish a round to see progress here.
        </div>
      ) : (
        <div className="space-y-3">
          <section className="rounded-2xl bg-slate-800/50 border border-slate-700 p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Rounds &amp; score
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <div className="text-xl font-bold text-white">{stats.rounds}</div>
                <div className="text-xs text-slate-500">Rounds</div>
              </div>
              <div>
                <div className="text-xl font-bold text-white">{stats.avgScore.toFixed(1)}</div>
                <div className="text-xs text-slate-500">Avg score</div>
              </div>
              <div>
                <div className="text-xl font-bold text-white">
                  {stats.avgVsPar >= 0 ? '+' : ''}
                  {stats.avgVsPar.toFixed(1)}
                </div>
                <div className="text-xs text-slate-500">Vs par</div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-slate-800/50 border border-slate-700 p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Ball striking
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xl font-bold text-white">
                  {fairwayPct != null ? `${fairwayPct}%` : '—'}
                </div>
                <div className="text-xs text-slate-500">
                  Fairways ({stats.fairwaysHit}/{stats.fairwaysPossible})
                </div>
              </div>
              <div>
                <div className="text-xl font-bold text-white">
                  {girPct != null ? `${girPct}%` : '—'}
                </div>
                <div className="text-xs text-slate-500">
                  GIR ({stats.girHit}/{stats.girPossible})
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-slate-800/50 border border-slate-700 p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Short game &amp; putting
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xl font-bold text-white">
                  {scramblePct != null ? `${scramblePct}%` : '—'}
                </div>
                <div className="text-xs text-slate-500">
                  Scrambling ({stats.scrambleSuccess}/{stats.scrambleOpportunities})
                </div>
              </div>
              <div>
                <div className="text-xl font-bold text-white">
                  {stats.avgPuttsPerRound.toFixed(1)}
                </div>
                <div className="text-xs text-slate-500">Avg putts/round</div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
