/**
 * Benchmark System — Patent-aligned handicap benchmark data and interpolation.
 * Maps real-world handicap tiers to human performance stats (PGA/Amateur data).
 * Used by the Dispersion Mapper to drive Gaussian shot-outcome parameters.
 */

export interface HandicapBenchmark {
  fairwaysHitPercent: number;
  girPercent: number;
  puttsPerRound: number;
  threePuttPercent: number;
  scramblingPercent: number;
}

/** Handicap tiers in the benchmark table (0, 5, 10, 15, 20, 25). */
export type HandicapTier = 0 | 5 | 10 | 15 | 20 | 25;

/**
 * Benchmark data table by tier. Approximations from PGA/amateur sources
 * (Arccos, TheGrint, SwingU, Lou Stagner, Break X, Golf Monthly).
 */
export const BENCHMARK_TABLE: Record<HandicapTier, HandicapBenchmark> = {
  0: {
    fairwaysHitPercent: 56.5,
    girPercent: 56.8,
    puttsPerRound: 29.6,
    threePuttPercent: 6,
    scramblingPercent: 50,
  },
  5: {
    fairwaysHitPercent: 52,
    girPercent: 46.1,
    puttsPerRound: 30.4,
    threePuttPercent: 9,
    scramblingPercent: 38,
  },
  10: {
    fairwaysHitPercent: 49.3,
    girPercent: 37.3,
    puttsPerRound: 31.1,
    threePuttPercent: 12,
    scramblingPercent: 32,
  },
  15: {
    fairwaysHitPercent: 46,
    girPercent: 27,
    puttsPerRound: 32,
    threePuttPercent: 15,
    scramblingPercent: 25,
  },
  20: {
    fairwaysHitPercent: 42.8,
    girPercent: 20,
    puttsPerRound: 32.8,
    threePuttPercent: 18,
    scramblingPercent: 22,
  },
  25: {
    fairwaysHitPercent: 40,
    girPercent: 14,
    puttsPerRound: 33.5,
    threePuttPercent: 21,
    scramblingPercent: 18,
  },
};

const TIERS: HandicapTier[] = [0, 5, 10, 15, 20, 25];

function tierForHandicap(h: number): HandicapTier {
  const capped = Math.max(0, Math.min(25, Math.round(h)));
  if (capped <= 2) return 0;
  if (capped <= 7) return 5;
  if (capped <= 12) return 10;
  if (capped <= 17) return 15;
  if (capped <= 22) return 20;
  return 25;
}

/**
 * Returns interpolated benchmark for any handicap (e.g. 7.5 → between tier 5 and 10).
 * Used by the Dispersion Mapper for GIR-based and scrambling-based parameters.
 */
export function getBenchmarkForHandicap(handicap: number): HandicapBenchmark {
  const h = Math.max(0, Math.min(25, handicap));
  const t = tierForHandicap(h);
  const tierStats = BENCHMARK_TABLE[t];
  const idx = TIERS.indexOf(t);
  const nextTier = TIERS[idx + 1];
  if (nextTier === undefined) return { ...tierStats };

  const f = Math.max(0, Math.min(1, (h - t) / (nextTier - t)));
  const nextStats = BENCHMARK_TABLE[nextTier];

  return {
    fairwaysHitPercent: tierStats.fairwaysHitPercent + f * (nextStats.fairwaysHitPercent - tierStats.fairwaysHitPercent),
    girPercent: tierStats.girPercent + f * (nextStats.girPercent - tierStats.girPercent),
    puttsPerRound: tierStats.puttsPerRound + f * (nextStats.puttsPerRound - tierStats.puttsPerRound),
    threePuttPercent: tierStats.threePuttPercent + f * (nextStats.threePuttPercent - tierStats.threePuttPercent),
    scramblingPercent: tierStats.scramblingPercent + f * (nextStats.scramblingPercent - tierStats.scramblingPercent),
  };
}
