/**
 * Benchmark golf statistics by handicap for AI calibration.
 * Sources: golfexpectations.com (Arccos, TheGrint, SwingU, Lou Stagner); Break X / Golf Monthly (fairways).
 *
 * - Fairways hit %: Break X / Golf Monthly (scratch ~56.5%, 10 ~49%, 20 ~43%).
 * - GIR %: BreakXGolf / TheGrint (scratch 56.8%, 5→46.1%, 10→37.3%); 15/20 from blog targets.
 * - Putts per round: MyGolfSpy / Pitchmarks (scratch ~29.6, 10 ~31.1, 15 ~32, 20 ~32.8).
 * - 3-putt: Lou Stagner / Arccos (15 HCP ~2.5–3.3 per round; scratch ~5–7% of holes).
 * - GIR+1: Lou Stagner (scratch 16–17 chances/round, 20 HCP 11–12).
 * - Double bogey or worse: Lou Stagner / Arccos (used for blow-up hole calibration).
 * - Scrambling / up-and-down %: Break X / TheGrint / SwingU (scratch ~50%, 10 ~32%, 15 ~25%, 20 ~22%).
 */

export type HandicapTier = 0 | 5 | 10 | 15 | 20 | 25;

export interface HandicapBenchmarkStats {
  /** Fairways hit % (tee shot on par 4/5). */
  fairwaysPercent: number;
  /** Scrambling / up-and-down % when GIR missed (get up and down for par). */
  scramblingPercent: number;
  /** Greens in regulation % (0–100). */
  girPercent: number;
  /** Average GIR per 18 holes. */
  girPerRound: number;
  /** Putts per 18 holes (average). */
  puttsPerRound: number;
  /** 3-putt % of holes (0–100). */
  threePuttPercent: number;
  /** 3-putts per 18 holes (average). */
  threePuttsPerRound: number;
  /** GIR+1: chances to save par with one putt per round (Lou Stagner). */
  girPlus1PerRound: number;
  /** Double bogey or worse % of holes (approx). */
  doubleBogeyOrWorsePercent: number;
}

/** Benchmarks by handicap tier. Interpolate for non-tier values (e.g. 7 → between 5 and 10). */
export const HANDICAP_BENCHMARK_STATS: Record<HandicapTier, HandicapBenchmarkStats> = {
  0: {
    fairwaysPercent: 56.5,
    scramblingPercent: 50,
    girPercent: 56.8,
    girPerRound: 10.2,
    puttsPerRound: 29.6,
    threePuttPercent: 6,
    threePuttsPerRound: 1.1,
    girPlus1PerRound: 16.5,
    doubleBogeyOrWorsePercent: 8,
  },
  5: {
    fairwaysPercent: 52,
    scramblingPercent: 38,
    girPercent: 46.1,
    girPerRound: 8.3,
    puttsPerRound: 30.4,
    threePuttPercent: 9,
    threePuttsPerRound: 1.6,
    girPlus1PerRound: 14.5,
    doubleBogeyOrWorsePercent: 12,
  },
  10: {
    fairwaysPercent: 49.3,
    scramblingPercent: 32,
    girPercent: 37.3,
    girPerRound: 6.7,
    puttsPerRound: 31.1,
    threePuttPercent: 12,
    threePuttsPerRound: 2.2,
    girPlus1PerRound: 13,
    doubleBogeyOrWorsePercent: 16,
  },
  15: {
    fairwaysPercent: 46,
    scramblingPercent: 25,
    girPercent: 27,
    girPerRound: 4.86,
    puttsPerRound: 32,
    threePuttPercent: 15,
    threePuttsPerRound: 2.7,
    girPlus1PerRound: 11.5,
    doubleBogeyOrWorsePercent: 22,
  },
  20: {
    fairwaysPercent: 42.8,
    scramblingPercent: 22,
    girPercent: 20,
    girPerRound: 3.6,
    puttsPerRound: 32.8,
    threePuttPercent: 18,
    threePuttsPerRound: 3.2,
    girPlus1PerRound: 11,
    doubleBogeyOrWorsePercent: 28,
  },
  25: {
    fairwaysPercent: 40,
    scramblingPercent: 18,
    girPercent: 14,
    girPerRound: 2.5,
    puttsPerRound: 33.5,
    threePuttPercent: 21,
    threePuttsPerRound: 3.8,
    girPlus1PerRound: 10,
    doubleBogeyOrWorsePercent: 34,
  },
};

/**
 * Map numeric handicap to tier for lookup (0, 5, 10, 15, 20, 25).
 */
export function handicapToTier(h: number): HandicapTier {
  const capped = Math.max(0, Math.min(25, Math.round(h)));
  if (capped <= 2) return 0;
  if (capped <= 7) return 5;
  if (capped <= 12) return 10;
  if (capped <= 17) return 15;
  if (capped <= 22) return 20;
  return 25;
}

/**
 * Interpolated benchmark for any handicap (0–25). Used by AIGolfer to target putts/3-putt/GIR.
 */
/** Next tier for interpolation (0→5, 5→10, …). */
const NEXT_TIER: Record<HandicapTier, HandicapTier | null> = {
  0: 5,
  5: 10,
  10: 15,
  15: 20,
  20: 25,
  25: null,
};

/**
 * Interpolated benchmark for any handicap (0–25). Used by AIGolfer to target putts/3-putt/GIR.
 */
export function getBenchmarkStatsForHandicap(handicap: number): HandicapBenchmarkStats {
  const h = Math.max(0, Math.min(25, handicap));
  const t = handicapToTier(h);
  const tierStats = HANDICAP_BENCHMARK_STATS[t];
  const next = NEXT_TIER[t];
  if (next === null) return { ...tierStats };

  const f = Math.max(0, Math.min(1, (h - t) / (next - t)));
  const nextStats = HANDICAP_BENCHMARK_STATS[next];

  return {
    fairwaysPercent: tierStats.fairwaysPercent + f * (nextStats.fairwaysPercent - tierStats.fairwaysPercent),
    scramblingPercent: tierStats.scramblingPercent + f * (nextStats.scramblingPercent - tierStats.scramblingPercent),
    girPercent: tierStats.girPercent + f * (nextStats.girPercent - tierStats.girPercent),
    girPerRound: tierStats.girPerRound + f * (nextStats.girPerRound - tierStats.girPerRound),
    puttsPerRound: tierStats.puttsPerRound + f * (nextStats.puttsPerRound - tierStats.puttsPerRound),
    threePuttPercent: tierStats.threePuttPercent + f * (nextStats.threePuttPercent - tierStats.threePuttPercent),
    threePuttsPerRound: tierStats.threePuttsPerRound + f * (nextStats.threePuttsPerRound - tierStats.threePuttsPerRound),
    girPlus1PerRound: tierStats.girPlus1PerRound + f * (nextStats.girPlus1PerRound - tierStats.girPlus1PerRound),
    doubleBogeyOrWorsePercent:
      tierStats.doubleBogeyOrWorsePercent +
      f * (nextStats.doubleBogeyOrWorsePercent - tierStats.doubleBogeyOrWorsePercent),
  };
}
