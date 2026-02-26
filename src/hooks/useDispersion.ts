import { useMemo } from 'react';
import { GeoCoordinate } from '../types/courseData';
import { ClubStats, DispersionPolygon, DispersionResult } from '../types/smartCaddie';
import { vincentyDirect, boxMullerPair } from '../utils/geodesic';

/**
 * Custom hook for calculating probabilistic shot dispersion using 2-sigma (95% confidence) ellipse.
 *
 * Mathematical Basis:
 * - Uses Box-Muller transform to generate bivariate normal distribution
 * - Lateral dispersion follows N(0, σ_lateral²)
 * - Longitudinal dispersion follows N(μ_distance, σ_distance²)
 * - Converts Cartesian (x,y) offsets to Geodetic (lat,lng) via Vincenty's Direct Formula
 *
 * @param clubStats - Club statistics including mean distance and standard deviation
 * @param currentPosition - User's current GPS position
 * @param targetCoordinates - Aimed target point
 * @param numPoints - Number of boundary points to generate (default 50)
 * @returns DispersionResult containing GeoJSON polygon and confidence boundary points
 */
export function useDispersion(
  clubStats: ClubStats | null,
  currentPosition: GeoCoordinate,
  targetCoordinates: GeoCoordinate,
  numPoints: number = 50
): DispersionResult | null {
  return useMemo(() => {
    if (!clubStats) {
      return null;
    }

    const { meanDistance, standardDeviation, dispersionAngle } = clubStats;

    const confidencePoints: GeoCoordinate[] = [];
    const k = 2.0;

    const bearingToTarget = calculateBearing(currentPosition, targetCoordinates);

    for (let i = 0; i < numPoints; i++) {
      const angle = (2 * Math.PI * i) / numPoints;

      const [zLateral, zLongitudinal] = boxMullerPair();

      const lateralOffset = k * standardDeviation * dispersionAngle * Math.cos(angle);
      const longitudinalOffset = meanDistance + k * standardDeviation * Math.sin(angle);

      const distanceFromStart = Math.sqrt(
        lateralOffset * lateralOffset +
        longitudinalOffset * longitudinalOffset
      );

      const offsetBearing = Math.atan2(lateralOffset, longitudinalOffset) * (180 / Math.PI);
      const absoluteBearing = (bearingToTarget + offsetBearing + 360) % 360;

      const point = vincentyDirect(currentPosition, absoluteBearing, distanceFromStart);
      confidencePoints.push(point);
    }

    confidencePoints.push(confidencePoints[0]);

    const polygon: DispersionPolygon = {
      type: 'Polygon',
      coordinates: [confidencePoints.map(p => [p.lng, p.lat])],
    };

    const centerBearing = calculateBearing(currentPosition, targetCoordinates);
    const centerPoint = vincentyDirect(currentPosition, centerBearing, meanDistance);

    return {
      polygon,
      confidencePoints,
      centerPoint,
    };
  }, [clubStats, currentPosition, targetCoordinates, numPoints]);
}

/**
 * Calculates the initial bearing from one point to another using spherical geometry.
 * Simplified calculation suitable for initial bearing to target.
 *
 * @param from - Starting coordinate
 * @param to - Ending coordinate
 * @returns Bearing in degrees (0-360, clockwise from North)
 */
function calculateBearing(from: GeoCoordinate, to: GeoCoordinate): number {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  const bearing = Math.atan2(y, x);
  return ((bearing * 180) / Math.PI + 360) % 360;
}

/**
 * Hook for generating Monte Carlo shot simulation points for visualization.
 * Generates random shot outcomes based on club statistics.
 *
 * @param clubStats - Club statistics
 * @param currentPosition - Starting position
 * @param targetCoordinates - Target position
 * @param numSimulations - Number of simulated shots (default 100)
 * @returns Array of simulated landing positions
 */
export function useMonteCarloDispersion(
  clubStats: ClubStats | null,
  currentPosition: GeoCoordinate,
  targetCoordinates: GeoCoordinate,
  numSimulations: number = 100
): GeoCoordinate[] {
  return useMemo(() => {
    if (!clubStats) {
      return [];
    }

    const { meanDistance, standardDeviation, dispersionAngle } = clubStats;
    const bearingToTarget = calculateBearing(currentPosition, targetCoordinates);
    const simulatedPoints: GeoCoordinate[] = [];

    for (let i = 0; i < numSimulations; i++) {
      const [zLateral, zLongitudinal] = boxMullerPair();

      const lateralOffset = zLateral * standardDeviation * dispersionAngle;
      const distance = meanDistance + zLongitudinal * standardDeviation;

      const distanceFromStart = Math.sqrt(
        lateralOffset * lateralOffset +
        distance * distance
      );

      const offsetAngle = Math.atan2(lateralOffset, distance) * (180 / Math.PI);
      const bearing = (bearingToTarget + offsetAngle + 360) % 360;

      const landingPoint = vincentyDirect(currentPosition, bearing, distanceFromStart);
      simulatedPoints.push(landingPoint);
    }

    return simulatedPoints;
  }, [clubStats, currentPosition, targetCoordinates, numSimulations]);
}
