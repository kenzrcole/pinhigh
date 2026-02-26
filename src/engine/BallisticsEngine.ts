/**
 * Ballistics Engine — Patent-aligned shot execution with Benchmark-to-Dispersion.
 * Keeps trajectory integration (Euler/RK4) for gravity/drag; executeShot applies
 * distance/angle errors via Box-Muller from DispersionCalculator params.
 */

import { GolfPhysics, type TrajectoryPoint } from '../utils/PhysicsEngine';
import { vincentyInverse, vincentyDirect, boxMullerPair } from '../utils/geodesic';
import type { DispersionParams } from './DispersionCalculator';

export type { TrajectoryPoint };

export interface LatLng {
  lat: number;
  lng: number;
}

export interface ExecuteShotResult {
  landingPosition: LatLng;
  actualDistanceMeters: number;
  distanceErrorMeters: number;
  angleErrorDegrees: number;
}

/**
 * Ballistics engine: trajectory physics + shot outcome with Gaussian dispersion.
 */
export class BallisticsEngine {
  private physics: GolfPhysics;

  constructor() {
    this.physics = new GolfPhysics();
  }

  /**
   * Compute 3D trajectory (Euler integration: gravity + drag).
   * Use for visualization or when full path is needed.
   */
  calculateTrajectory(speed: number, angle: number, backspin: number = 0): TrajectoryPoint[] {
    return this.physics.calculateTrajectory(speed, angle, backspin);
  }

  /**
   * Execute a shot: apply distance and angle errors from dispersion params (Box-Muller),
   * then resolve landing position on the geodetic surface.
   * Uses the patent's Benchmark-to-Dispersion parameters (GIR scaling, scrambling for chips).
   *
   * @param fromPosition - Current ball position (lat/lng)
   * @param intendedTarget - Aim point (lat/lng)
   * @param intendedDistanceMeters - Intended carry distance (m)
   * @param dispersionParams - From DispersionCalculator (full-shot or chip)
   * @param options - Optional max distance cap (e.g. for bunker/chip)
   */
  executeShot(
    fromPosition: LatLng,
    intendedTarget: LatLng,
    intendedDistanceMeters: number,
    dispersionParams: DispersionParams,
    options?: { maxDistanceMeters?: number }
  ): ExecuteShotResult {
    const cappedDistance = Math.min(
      intendedDistanceMeters,
      options?.maxDistanceMeters ?? intendedDistanceMeters
    );

    const distanceStdDev = cappedDistance * (dispersionParams.distanceStdDevPercent / 100);
    const angleStdDev = dispersionParams.angularStdDevDegrees;

    const [z1, z2] = boxMullerPair();
    const distanceErrorMeters = z1 * distanceStdDev;
    const angleErrorDegrees = z2 * angleStdDev;

    let actualDistanceMeters = Math.max(0, cappedDistance + distanceErrorMeters);
    if (options?.maxDistanceMeters != null) {
      actualDistanceMeters = Math.min(actualDistanceMeters, options.maxDistanceMeters);
    }

    const { initialBearing } = vincentyInverse(fromPosition, intendedTarget);
    const adjustedBearing = (initialBearing + angleErrorDegrees + 360) % 360;

    const landingPosition = vincentyDirect(fromPosition, adjustedBearing, actualDistanceMeters);

    return {
      landingPosition: { lat: landingPosition.lat, lng: landingPosition.lng },
      actualDistanceMeters,
      distanceErrorMeters,
      angleErrorDegrees,
    };
  }
}
