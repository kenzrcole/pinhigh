/**
 * Per-hole stats for play mode. User-entered (fairway, GIR, scrambling, putts)
 * and AI-summarized (derived from shot history).
 */

/** Miss direction for fairway or GIR when answer is No. */
export type MissDirection = 'left' | 'right' | 'short' | 'long' | 'ob';

export interface UserHoleStats {
  /** Hit fairway (par 4/5) or N/A (par 3). */
  fairway: boolean;
  /** When fairway = false: where the drive went. */
  fairwayMiss?: MissDirection;
  /** Green in regulation (on green in par-2 or less for par 3, par-3 or less for par 4, etc.). */
  gir: boolean;
  /** When gir = false: where the approach missed. */
  girMiss?: MissDirection;
  /** Scrambling: got up and down (par or better after missing GIR). */
  scrambling: boolean;
  /** When scrambling = false and was from bunker. */
  scrambleSand?: boolean;
  /** Number of putts; 0 is valid (holed out from off green). */
  putts: number;
}

export interface AIHoleStats {
  fairwayHit: boolean;
  girHit: boolean;
  putts: number;
  /** Got up and down when missed GIR. */
  scrambleSuccess: boolean;
}
