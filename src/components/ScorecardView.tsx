import { useGolfGame } from '../context/GolfGameContext';
import { useCurrentRound } from '../context/CurrentRoundContext';
import { getCourseHoleCount, getHoleInfoForCourse } from '../services/courseBounds';
import { formatHandicapDisplay } from '../data/clubDistancesByHandicap';
import { Trophy, Target, TrendingUp } from 'lucide-react';

export function ScorecardView() {
  const { gameState, getTotalScore } = useGolfGame();
  const { round: currentRound } = useCurrentRound();

  const useMapRound = Boolean(currentRound.courseName);
  const holeCount = useMapRound ? (getCourseHoleCount(currentRound.courseName) || 18) : 18;
  const totalPar = useMapRound
    ? Array.from({ length: holeCount }, (_, i) =>
        getHoleInfoForCourse(currentRound.courseName, i + 1, currentRound.selectedTeeSet).par
      ).reduce((a, b) => a + b, 0)
    : 72;
  const currentHole = useMapRound ? currentRound.currentHoleNumber : gameState.currentHole;
  const playerTotal = useMapRound
    ? (currentRound.userScoresByHole.reduce<number>((sum, s) => sum + (s ?? 0), 0) || 0)
    : getTotalScore('player');
  const aiTotal = useMapRound
    ? (currentRound.aiScoresByHole.reduce<number>((sum, s) => sum + (s ?? 0), 0) || 0)
    : getTotalScore('ai');

  const AI_HANDICAP =
    typeof gameState.aiProfile === 'string'
      ? gameState.aiProfile === 'LPGA Tour'
        ? 2
        : 0
      : Math.max(0, gameState.aiProfile);
  const aiStrokesReceived = useMapRound
    ? Array.from({ length: holeCount }, (_, i) => i + 1).filter(
        (holeNum) =>
          currentRound.aiScoresByHole[holeNum - 1] != null &&
          (getHoleInfoForCourse(currentRound.courseName, holeNum, currentRound.selectedTeeSet).strokeIndex ?? 99) <=
            AI_HANDICAP
      ).length
    : 0;
  const aiNet = useMapRound ? Math.max(0, aiTotal - aiStrokesReceived) : aiTotal;

  const getScoreColor = (strokes: number, par: number) => {
    if (strokes < par) return 'text-green-400';
    if (strokes > par) return 'text-red-400';
    return 'text-slate-200';
  };

  const getScoreName = (strokes: number, par: number) => {
    const diff = strokes - par;
    if (diff <= -2) return 'Eagle';
    if (diff === -1) return 'Birdie';
    if (diff === 0) return 'Par';
    if (diff === 1) return 'Bogey';
    if (diff === 2) return 'Double';
    return 'Triple+';
  };

  const userStats = useMapRound ? (currentRound.userStatsByHole ?? []) : [];
  const parByHole = useMapRound ? Array.from({ length: holeCount }, (_, i) => getHoleInfoForCourse(currentRound.courseName, i + 1, currentRound.selectedTeeSet).par) : [];
  const fairwaysPossible = userStats.reduce((n, s, i) => n + (s != null && parByHole[i] >= 4 ? 1 : 0), 0);
  const fairwaysHit = userStats.reduce((n, s, i) => n + (s != null && parByHole[i] >= 4 && s.fairway ? 1 : 0), 0);
  const girHit = userStats.reduce((n, s) => n + (s != null && s.gir ? 1 : 0), 0);
  const holesWithStats = userStats.filter((s): s is NonNullable<typeof s> => s != null).length;
  const scrambleOpps = userStats.reduce((n, s) => n + (s != null && !s.gir ? 1 : 0), 0);
  const scrambleSuccess = userStats.reduce((n, s) => n + (s != null && !s.gir && s.scrambling ? 1 : 0), 0);
  const totalPutts = userStats.reduce((sum, s) => sum + (s?.putts ?? 0), 0);
  const hasAnyUserStats = holesWithStats > 0;
  const roundComplete = useMapRound && Array.from({ length: holeCount }, (_, i) => currentRound.userScoresByHole[i]).every((s) => s != null);

  return (
    <div className="h-full w-full bg-slate-900 overflow-y-auto pb-24">
      <div className="p-4 space-y-4">
        <div className="text-center pt-4 pb-2">
          <Trophy className="w-12 h-12 mx-auto text-green-500 mb-2" />
          <h1 className="text-2xl font-bold text-white">Scorecard</h1>
          {useMapRound && (
            <p className="text-slate-300 font-medium mt-1">{currentRound.courseName}</p>
          )}
          <p className="text-slate-400 text-sm">
            Hole {currentHole} of {holeCount}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-green-600/20 to-green-700/20 border border-green-500/30 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5 text-green-400" />
              <span className="text-sm text-slate-300">You</span>
            </div>
            <p className="text-4xl font-bold text-white">{playerTotal}</p>
            <p className="text-xs text-green-400 mt-1">
              {playerTotal > 0 ? `${playerTotal > totalPar ? '+' : ''}${playerTotal - totalPar}` : 'E'}
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple-600/20 to-purple-700/20 border border-purple-500/30 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              <span className="text-sm text-slate-300">
                {typeof gameState.aiProfile === 'string'
                  ? gameState.aiProfile
                  : `HCP ${formatHandicapDisplay(gameState.aiProfile)}`}
              </span>
              {useMapRound && gameState.aiProfile !== 'EW 2K' && typeof gameState.aiProfile === 'number' && gameState.aiProfile > 0 && (
                <span className="text-xs text-slate-500">receives {AI_HANDICAP} strokes</span>
              )}
            </div>
            <p className="text-4xl font-bold text-white">{aiTotal}</p>
            <p className="text-xs text-purple-400 mt-1">
              {aiTotal > 0 ? `${aiTotal > totalPar ? '+' : ''}${aiTotal - totalPar}` : 'E'}
              {useMapRound && aiStrokesReceived > 0 && (
                <span className="block text-slate-500 mt-0.5">
                  Net {aiNet} (gross − {aiStrokesReceived} HCP strokes)
                </span>
              )}
            </p>
          </div>
        </div>

        {gameState.settings.isProMode && (
          <div className="bg-gradient-to-r from-amber-600/20 to-amber-700/20 border border-amber-500/30 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-300 mb-1">Pro Mode Active</p>
                <p className="text-xs text-amber-300">
                  Tiger 2000 (+8 Handicap) • Wind & Slope Data
                </p>
              </div>
              <Trophy className="w-8 h-8 text-amber-400" />
            </div>
          </div>
        )}

        {useMapRound && hasAnyUserStats && (
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700">
              <h3 className="font-semibold text-white">{roundComplete ? 'Round stats' : 'Your stats'}</h3>
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Fairways</p>
                <p className="text-lg font-bold text-white">{fairwaysHit}/{fairwaysPossible}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">GIR</p>
                <p className="text-lg font-bold text-white">{girHit}/{holesWithStats}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Scrambling</p>
                <p className="text-lg font-bold text-white">{scrambleOpps > 0 ? `${scrambleSuccess}/${scrambleOpps}` : '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Putts</p>
                <p className="text-lg font-bold text-white">{totalPutts}</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h3 className="font-semibold text-white">Hole by Hole</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/50">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400">Hole</th>
                  {useMapRound && (
                    <th className="text-center py-3 px-2 text-xs font-semibold text-slate-500" title="Stroke index (1=hardest)">SI</th>
                  )}
                  <th className="text-center py-3 px-3 text-xs font-semibold text-slate-400">Par</th>
                  <th className="text-center py-3 px-3 text-xs font-semibold text-green-400">You</th>
                  <th className="text-center py-3 px-3 text-xs font-semibold text-purple-400">AI</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: holeCount }, (_, i) => {
                  const holeNum = i + 1;
                  const holeInfo = useMapRound ? getHoleInfoForCourse(currentRound.courseName, holeNum, currentRound.selectedTeeSet) : { par: 4 as number, strokeIndex: undefined as number | undefined };
                  const par = useMapRound ? holeInfo.par : 4;
                  const strokeIndex = holeInfo.strokeIndex;
                  const playerStrokes = useMapRound
                    ? currentRound.userScoresByHole[holeNum - 1]
                    : gameState.playerScores.find(s => s.holeNumber === holeNum)?.strokes;
                  const aiStrokes = useMapRound
                    ? currentRound.aiScoresByHole[holeNum - 1]
                    : gameState.aiScores.find(s => s.holeNumber === holeNum)?.strokes;
                  const aiGetsStroke = useMapRound && strokeIndex != null && strokeIndex <= AI_HANDICAP;
                  const holeSkipped = useMapRound && (playerStrokes === undefined || playerStrokes === null);
                  const statsSkipped = useMapRound && playerStrokes != null && !currentRound.userStatsByHole?.[holeNum - 1];
                  const rowHighlight = holeSkipped ? 'bg-amber-950/30' : statsSkipped ? 'bg-amber-950/15' : '';

                  return (
                    <tr key={holeNum} className={`border-b border-slate-800 ${rowHighlight}`}>
                      <td className="py-3 px-4 text-slate-300 font-medium">
                        {holeNum}
                        {holeSkipped && (
                          <span className="ml-1 text-[10px] text-amber-400/90 font-normal" title="Hole skipped">Skipped</span>
                        )}
                        {statsSkipped && !holeSkipped && (
                          <span className="ml-1 text-[10px] text-amber-400/80 font-normal" title="Stats skipped">No stats</span>
                        )}
                      </td>
                      {useMapRound && (
                        <td className="text-center py-3 px-2 text-slate-500 text-xs">
                          {strokeIndex ?? '—'}
                          {aiGetsStroke && (
                            <span className="block text-purple-400/80 text-[10px]" title="AI gets 1 stroke here">●</span>
                          )}
                        </td>
                      )}
                      <td className="text-center py-3 px-3 text-slate-400">{par}</td>
                      <td className="text-center py-3 px-3">
                        {playerStrokes !== undefined && playerStrokes !== null ? (
                          <div>
                            <span className={`font-bold ${getScoreColor(playerStrokes, par)}`}>
                              {playerStrokes}
                            </span>
                            <span className="block text-xs text-slate-500">
                              {getScoreName(playerStrokes, par)}
                            </span>
                            {useMapRound && currentRound.userStatsByHole?.[holeNum - 1] && (
                              <span className="block text-[10px] text-slate-500 mt-0.5">
                                FW {currentRound.userStatsByHole[holeNum - 1].fairway ? '✓' : '✗'} GIR {currentRound.userStatsByHole[holeNum - 1].gir ? '✓' : '✗'} Sc {currentRound.userStatsByHole[holeNum - 1].scrambling ? '✓' : '✗'} P{currentRound.userStatsByHole[holeNum - 1].putts}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="text-center py-3 px-3">
                        {aiStrokes !== undefined && aiStrokes !== null ? (
                          <div>
                            <span className={`font-bold ${getScoreColor(aiStrokes, par)}`}>
                              {aiStrokes}
                            </span>
                            <span className="block text-xs text-slate-500">
                              {getScoreName(aiStrokes, par)}
                            </span>
                            {useMapRound && currentRound.aiStatsByHole?.[holeNum - 1] && (
                              <span className="block text-[10px] text-slate-500 mt-0.5">
                                FW {currentRound.aiStatsByHole[holeNum - 1].fairwayHit ? '✓' : '✗'} GIR {currentRound.aiStatsByHole[holeNum - 1].girHit ? '✓' : '✗'} P{currentRound.aiStatsByHole[holeNum - 1].putts}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-800/80 font-bold">
                  <td className="py-4 px-4 text-slate-200">Total</td>
                  {useMapRound && <td className="py-4 px-2" />}
                  <td className="text-center py-4 px-3 text-slate-400">{totalPar}</td>
                  <td className="text-center py-4 px-3 text-green-400 text-lg">{playerTotal || '-'}</td>
                  <td className="text-center py-4 px-3 text-purple-400 text-lg">{aiTotal || '-'}</td>
                </tr>
                {useMapRound && aiStrokesReceived > 0 && (
                  <tr className="bg-slate-800/60 text-slate-300">
                    <td className="py-2 px-4 text-slate-400 text-sm">Net (HCP {AI_HANDICAP})</td>
                    {useMapRound && <td className="py-2 px-2" />}
                    <td className="py-2 px-3" />
                    <td className="text-center py-2 px-3 text-slate-500 text-sm">—</td>
                    <td className="text-center py-2 px-3 text-purple-300 text-sm">{aiNet}</td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
