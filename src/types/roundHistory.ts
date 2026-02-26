/**
 * Saved round for historical stats across all rounds, handicaps, and characters.
 */

import type { UserHoleStats, AIHoleStats } from './holeStats';

/** AI profile as stored (string name or number handicap). */
export type StoredAIProfile = string | number;

export interface SavedRound {
  id: string;
  /** ISO date string (date only) when the round was completed/ended. */
  date: string;
  /** Timestamp when saved (for ordering). */
  savedAt: number;
  courseName: string;
  selectedTeeSet?: string;
  holeCount: number;
  totalPar: number;
  /** User total score. */
  userTotal: number;
  userScoresByHole: (number | undefined)[];
  userStatsByHole: (UserHoleStats | undefined)[];
  /** Precomputed for aggregation (par 4/5 = fairway possible). */
  userFairwaysHit?: number;
  userFairwaysPossible?: number;
  userGirHit?: number;
  userScrambleSuccess?: number;
  userScrambleOpps?: number;
  userPutts?: number;
  /** AI opponent: character name or handicap number. */
  aiProfile: StoredAIProfile;
  aiTotal: number;
  aiScoresByHole: (number | undefined)[];
  aiStatsByHole: (AIHoleStats | undefined)[];
}

export type StatsPeriod =
  | 'round'   // last round only (1)
  | 'week'    // last 7 days
  | 'month'   // last 30 days
  | 'quarter' // last 90 days
  | '6months' // last 180 days
  | 'year';   // last 365 days

export interface AggregatedStats {
  rounds: number;
  avgScore: number;
  avgVsPar: number;
  fairwaysHit: number;
  fairwaysPossible: number;
  girHit: number;
  girPossible: number;
  scrambleSuccess: number;
  scrambleOpportunities: number;
  totalPutts: number;
  avgPuttsPerRound: number;
}
