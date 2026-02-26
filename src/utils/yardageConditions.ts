/**
 * Yardage adjustment for wind and slope (elevation).
 * Used to show "plays as" distance and how conditions affect the ball.
 */

/** Wind is FROM this direction (degrees, 0=N, 90=E, 270=W). Shot bearing is TO target (0=N). */
export interface WindConditions {
  speedMph: number;
  directionDeg: number;
}

/**
 * Bearing from point A to B in degrees (0 = North, 90 = East).
 * Pass from player/tee to green for "shot direction".
 */
export function bearingDeg(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const bearing = Math.atan2(y, x);
  return ((bearing * 180) / Math.PI + 360) % 360;
}

/**
 * Wind direction to short label (e.g. "W", "SSE").
 */
export function windDirectionLabel(deg: number): string {
  const labels = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const idx = Math.round(deg / 22.5) % 16;
  return labels[idx];
}

/**
 * Compute yardage adjustment from wind and slope.
 * - Wind: tailwind adds yards, headwind subtracts. ~0.8 yd per mph per 100 yd of carry.
 * - Slope: positive = uphill = plays longer. ~1% of distance per degree.
 */
export function adjustYardageForConditions(
  rawYards: number,
  windSpeedMph: number,
  windDirectionDeg: number,
  shotBearingDeg: number,
  slopeDegrees: number
): { adjustedYards: number; windEffectYards: number; slopeEffectYards: number } {
  // Wind: direction wind is blowing TOWARD = direction + 180. Tailwind when that aligns with shot.
  const windBlowingToward = (windDirectionDeg + 180) % 360;
  let diff = windBlowingToward - shotBearingDeg;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  const cosComponent = Math.cos((diff * Math.PI) / 180); // 1 = tailwind, -1 = headwind
  const windComponentMph = windSpeedMph * cosComponent;
  // ~0.8 yards per mph per 100 yards (tailwind adds, headwind subtracts)
  const windEffectYards = windComponentMph * (rawYards / 100) * 0.8;

  // Slope: positive = uphill = plays longer. ~1% per degree.
  const slopeEffectYards = slopeDegrees * rawYards * 0.01;

  const adjustedYards = Math.round(rawYards + windEffectYards + slopeEffectYards);
  return {
    adjustedYards: Math.max(1, adjustedYards),
    windEffectYards: Math.round(windEffectYards * 10) / 10,
    slopeEffectYards: Math.round(slopeEffectYards * 10) / 10,
  };
}

/**
 * Slope effect in yards per 100 yards of carry. 1° ≈ 1% of distance (uphill = positive = plays longer).
 * e.g. 2.5° uphill → +2.5 yards per 100 yards.
 */
export function slopeEffectPer100Yards(slopeDegrees: number): number {
  return slopeDegrees * 0.01 * 100; // 1% per degree of 100 yd = 1 yd per degree per 100 yd
}

/**
 * Human-readable description of how wind affects the shot (e.g. "8 mph tailwind", "5 mph headwind").
 */
export function windEffectDescription(
  windSpeedMph: number,
  windDirectionDeg: number,
  shotBearingDeg: number
): string {
  if (windSpeedMph <= 0) return 'No wind';
  const windBlowingToward = (windDirectionDeg + 180) % 360;
  let diff = windBlowingToward - shotBearingDeg;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  const cosComponent = Math.cos((diff * Math.PI) / 180);
  const windComponentMph = Math.round(windSpeedMph * cosComponent * 10) / 10;
  if (Math.abs(windComponentMph) < 0.5) return 'Crosswind';
  if (windComponentMph > 0) return `${Math.abs(windComponentMph).toFixed(1)} mph tailwind`;
  return `${Math.abs(windComponentMph).toFixed(1)} mph headwind`;
}
