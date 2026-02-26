import type { ShotHistory } from './AIGolfer';
import type { AIHoleStats } from '../types/holeStats';

/** ~20 yards in meters; shots under this treated as putt/chip. */
const PUTT_DISTANCE_METERS = 18;

/**
 * Derive AI hole stats from shot history for display under AI score.
 * Fairway: first shot not OB/water. GIR: on green in par-2 or less. Putts: count of short shots. Scramble: missed GIR but made par or better.
 */
export function deriveAIHoleStats(shots: ShotHistory[], par: number): AIHoleStats {
  if (shots.length === 0) {
    return { fairwayHit: false, girHit: false, putts: 0, scrambleSuccess: false };
  }
  const first = shots[0];
  const fairwayHit =
    first.commentary?.weatherLie !== 'Ball in water – penalty' &&
    first.commentary?.weatherLie !== 'Out of bounds – penalty';

  let puttCount = 0;
  for (let i = shots.length - 1; i >= 0; i--) {
    if (shots[i].distance <= PUTT_DISTANCE_METERS) puttCount++;
    else break;
  }
  const strokesToGreen = shots.length - puttCount;
  const girStrokesAllowed = par - 2; // par 3: 1, par 4: 2, par 5: 3
  const girHit = strokesToGreen <= girStrokesAllowed;

  const scrambleSuccess = !girHit && shots.length <= par;

  return {
    fairwayHit,
    girHit,
    putts: puttCount,
    scrambleSuccess,
  };
}
