/**
 * Putting Module — Patent distance bands (0–3 ft, 3–5 ft) for make probability.
 * Returns holed or leave position.
 */

import type { LatLng } from './LieDetector';
import { vincentyDirect } from '../utils/geodesic';

const M_TO_FT = 3.28084;

/** Make probability by band (patent: 0–3 ft, 3–5 ft, etc.). */
function makeProbability(distanceFeet: number): number {
  if (distanceFeet <= 3) return 0.998;
  if (distanceFeet <= 5) return 0.96;
  if (distanceFeet <= 9) return 0.65;
  if (distanceFeet <= 15) return 0.38;
  if (distanceFeet <= 20) return 0.22;
  if (distanceFeet <= 25) return 0.15;
  return Math.max(0.02, 0.15 * Math.exp(-0.08 * (distanceFeet - 25)));
}

export interface PuttResult {
  holed: boolean;
  leavePosition: LatLng;
}

/**
 * Resolve one putt: distance-based make probability; on miss, leave 1–3 ft from pin.
 */
export function executePutt(
  fromPosition: LatLng,
  pinPosition: LatLng,
  distanceToPinMeters: number
): PuttResult {
  const distanceFeet = distanceToPinMeters * M_TO_FT;
  const p = makeProbability(distanceFeet);
  if (Math.random() < p) {
    return { holed: true, leavePosition: pinPosition };
  }
  const leaveFeet = 1 + Math.random() * 2;
  const leaveMeters = leaveFeet * 0.3048;
  const bearing = Math.random() * 360;
  const leavePosition = vincentyDirect(pinPosition, bearing, leaveMeters);
  return { holed: false, leavePosition: { lat: leavePosition.lat, lng: leavePosition.lng } };
}
