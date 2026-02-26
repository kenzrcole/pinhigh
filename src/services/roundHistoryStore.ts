/**
 * Persist and query historical rounds for stats across round/week/month/quarter/6mo/year.
 */

import type { SavedRound, StatsPeriod, AggregatedStats } from '../types/roundHistory';
import type { CurrentRoundState } from '../context/CurrentRoundContext';
import type { AIProfile } from '../context/GolfGameContext';
import { getCourseHoleCount, getHoleInfoForCourse } from './courseBounds';

const STORAGE_KEY = 'golfGPS_roundHistory';
/** When saving, only the most recent MAX_SAVED rounds are kept; older rounds are dropped (no warning). */
const MAX_SAVED = 500;

function loadRounds(): SavedRound[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRounds(rounds: SavedRound[]): void {
  try {
    // Keep only the most recent MAX_SAVED rounds; oldest are dropped
    const toPersist = rounds.length > MAX_SAVED ? rounds.slice(-MAX_SAVED) : rounds;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersist));
  } catch {
    // ignore
  }
}

function toStoredAIProfile(profile: AIProfile): string | number {
  return typeof profile === 'number' ? profile : profile;
}

/** Save current round to history. Call when user ends round. */
export function saveRoundToHistory(
  round: CurrentRoundState,
  aiProfile: AIProfile
): SavedRound | null {
  if (!round.courseName) return null;
  const holeCount = getCourseHoleCount(round.courseName) || 18;
  const userScores = round.userScoresByHole ?? [];
  const userTotal = userScores.slice(0, holeCount).reduce((sum, s) => sum + (s ?? 0), 0);
  const hasAnyScore = userScores.some((s, i) => i < holeCount && s != null);
  if (!hasAnyScore) return null;

  const aiScores = round.aiScoresByHole ?? [];
  const aiTotal = aiScores.slice(0, holeCount).reduce((sum, s) => sum + (s ?? 0), 0);
  const totalPar =
    holeCount <= 0
      ? 72
      : Array.from({ length: holeCount }, (_, i) =>
          getHoleInfoForCourse(round.courseName, i + 1, round.selectedTeeSet).par
        ).reduce((a, b) => a + b, 0);

  const userStats = round.userStatsByHole ?? [];
  const parByHole = Array.from({ length: holeCount }, (_, i) =>
    getHoleInfoForCourse(round.courseName, i + 1, round.selectedTeeSet).par
  );
  let userFairwaysHit = 0;
  let userFairwaysPossible = 0;
  let userGirHit = 0;
  let userScrambleSuccess = 0;
  let userScrambleOpps = 0;
  let userPutts = 0;
  userStats.forEach((s, i) => {
    if (s == null) return;
    if (i < parByHole.length && parByHole[i] >= 4) {
      userFairwaysPossible++;
      if (s.fairway) userFairwaysHit++;
    }
    userGirHit += s.gir ? 1 : 0;
    if (!s.gir) {
      userScrambleOpps++;
      if (s.scrambling) userScrambleSuccess++;
    }
    userPutts += s.putts;
  });

  const saved: SavedRound = {
    id: `round_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    date: new Date().toISOString().slice(0, 10),
    savedAt: Date.now(),
    courseName: round.courseName,
    selectedTeeSet: round.selectedTeeSet,
    holeCount,
    totalPar,
    userTotal,
    userScoresByHole: userScores.slice(0, holeCount),
    userStatsByHole: (round.userStatsByHole ?? []).slice(0, holeCount),
    userFairwaysHit,
    userFairwaysPossible,
    userGirHit,
    userScrambleSuccess,
    userScrambleOpps,
    userPutts,
    aiProfile: toStoredAIProfile(aiProfile),
    aiTotal,
    aiScoresByHole: aiScores.slice(0, holeCount),
    aiStatsByHole: (round.aiStatsByHole ?? []).slice(0, holeCount),
  };

  const rounds = loadRounds();
  rounds.push(saved);
  saveRounds(rounds);
  return saved;
}

export function getRoundHistory(): SavedRound[] {
  return loadRounds();
}

function periodToDays(period: StatsPeriod): number {
  switch (period) {
    case 'round':
      return 0;
    case 'week':
      return 7;
    case 'month':
      return 30;
    case 'quarter':
      return 90;
    case '6months':
      return 180;
    case 'year':
      return 365;
    default:
      return 30;
  }
}

/** Get rounds in the given period (relative to now). */
export function getRoundsInPeriod(period: StatsPeriod): SavedRound[] {
  const rounds = loadRounds();
  if (period === 'round') {
    const last = rounds[rounds.length - 1];
    return last ? [last] : [];
  }
  const days = periodToDays(period);
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return rounds.filter((r) => r.savedAt >= cutoff);
}

/** Aggregate user stats over a set of rounds. */
export function aggregateStats(rounds: SavedRound[]): AggregatedStats {
  let fairwaysHit = 0;
  let fairwaysPossible = 0;
  let girHit = 0;
  let girPossible = 0;
  let scrambleSuccess = 0;
  let scrambleOpportunities = 0;
  let totalPutts = 0;
  let totalScore = 0;
  let totalPar = 0;

  rounds.forEach((r) => {
    totalScore += r.userTotal;
    totalPar += r.totalPar;
    fairwaysHit += r.userFairwaysHit ?? 0;
    fairwaysPossible += r.userFairwaysPossible ?? 0;
    const holesWithStats = (r.userStatsByHole ?? []).filter((s) => s != null).length;
    girHit += r.userGirHit ?? (r.userStatsByHole ?? []).filter((s) => s?.gir).length;
    girPossible += holesWithStats;
    scrambleSuccess += r.userScrambleSuccess ?? 0;
    scrambleOpportunities += r.userScrambleOpps ?? 0;
    totalPutts += r.userPutts ?? (r.userStatsByHole ?? []).reduce((sum, s) => sum + (s?.putts ?? 0), 0);
  });

  const n = rounds.length;
  return {
    rounds: n,
    avgScore: n > 0 ? totalScore / n : 0,
    avgVsPar: n > 0 ? (totalScore - totalPar) / n : 0,
    fairwaysHit,
    fairwaysPossible,
    girHit,
    girPossible,
    scrambleSuccess,
    scrambleOpportunities,
    totalPutts,
    avgPuttsPerRound: n > 0 ? totalPutts / n : 0,
  };
}

export function getAggregatedStatsForPeriod(period: StatsPeriod): AggregatedStats {
  const rounds = getRoundsInPeriod(period);
  return aggregateStats(rounds);
}
