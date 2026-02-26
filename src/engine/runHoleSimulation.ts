/**
 * Pure run of the recursive shot loop (no React). Used by useHoleSimulation and runCalibrationTest.
 */

import { vincentyInverse } from '../utils/geodesic';
import { detectLie, type LieType, type HoleGeoJSON, type LatLng } from './LieDetector';
import { BallisticsEngine } from './BallisticsEngine';
import { DispersionCalculator } from './DispersionCalculator';
import { executePutt } from './PuttingModule';
import { getMaxShotDistanceYards, handicapNumberToTier } from '../data/clubDistancesByHandicap';

const GIMME_THRESHOLD_METERS = 0.2;
const PUTT_CHIP_RANGE_METERS = 20;
const FAIRWAY_TARGET_MIN_METERS = 200 * 0.9144;
const BUNKER_MAX_SHOT_METERS = 25;
const YARDS_TO_METERS = 0.9144;

export interface ShotStep {
  from: LatLng;
  to: LatLng;
  lie: LieType;
  penalty?: boolean;
  holed?: boolean;
}

export interface RunHoleSimulationParams {
  teePosition: LatLng;
  pinPosition: LatLng;
  holeGeoJSON: HoleGeoJSON;
  par: number;
  handicap: number;
  fairwayCenter?: LatLng | null;
  maxShots?: number;
}

export interface RunHoleSimulationResult {
  shots: ShotStep[];
  finalPosition: LatLng;
  isHoled: boolean;
  shotCount: number;
}

function distanceMeters(a: LatLng, b: LatLng): number {
  return vincentyInverse(a, b).distance;
}

export function runHoleSimulation(params: RunHoleSimulationParams): RunHoleSimulationResult {
  const {
    teePosition,
    pinPosition,
    holeGeoJSON,
    par,
    handicap,
    fairwayCenter,
    maxShots = 20,
  } = params;

  const ballistics = new BallisticsEngine();
  const dispersion = new DispersionCalculator(handicap);
  const tier = handicapNumberToTier(handicap);

  const shots: ShotStep[] = [];
  let position: LatLng = { ...teePosition };
  let strokes = 0;

  while (strokes < maxShots) {
    const distanceToPin = distanceMeters(position, pinPosition);

    if (distanceToPin < GIMME_THRESHOLD_METERS) {
      shots.push({
        from: position,
        to: pinPosition,
        lie: 'LIE_GREEN',
        holed: true,
      });
      return {
        shots,
        finalPosition: pinPosition,
        isHoled: true,
        shotCount: strokes + 1,
      };
    }

    const lie = detectLie(position, holeGeoJSON);

    if (lie === 'LIE_GREEN') {
      const putt = executePutt(position, pinPosition, distanceToPin);
      shots.push({
        from: position,
        to: putt.leavePosition,
        lie: 'LIE_GREEN',
        holed: putt.holed,
      });
      position = putt.leavePosition;
      strokes += 1;
      if (putt.holed) {
        return { shots, finalPosition: pinPosition, isHoled: true, shotCount: strokes };
      }
      continue;
    }

    if (lie === 'LIE_WATER') {
      shots.push({ from: position, to: position, lie: 'LIE_WATER', penalty: true });
      strokes += 1;
      continue;
    }

    if (lie === 'LIE_BUNKER') {
      const targetDistance = Math.min(distanceToPin, BUNKER_MAX_SHOT_METERS);
      const result = ballistics.executeShot(
        position,
        pinPosition,
        targetDistance,
        dispersion.getBunkerDispersion(),
        { maxDistanceMeters: BUNKER_MAX_SHOT_METERS }
      );
      shots.push({ from: position, to: result.landingPosition, lie: 'LIE_BUNKER' });
      position = result.landingPosition;
      strokes += 1;
      continue;
    }

    const distanceToPinYards = distanceToPin / YARDS_TO_METERS;
    const maxShotYards = getMaxShotDistanceYards(distanceToPinYards, tier);
    const maxShotMeters = maxShotYards * YARDS_TO_METERS;

    let target: LatLng;
    let intendedDistanceMeters: number;

    if (par > 3 && distanceToPin > FAIRWAY_TARGET_MIN_METERS && fairwayCenter) {
      const distToFairway = distanceMeters(position, fairwayCenter);
      target = fairwayCenter;
      intendedDistanceMeters = Math.min(distToFairway, maxShotMeters);
    } else {
      target = pinPosition;
      intendedDistanceMeters = Math.min(distanceToPin, maxShotMeters);
    }

    const disp =
      distanceToPin <= PUTT_CHIP_RANGE_METERS && lie !== 'LIE_GREEN'
        ? dispersion.getChipDispersion()
        : dispersion.getFullShotDispersion();

    const result = ballistics.executeShot(position, target, intendedDistanceMeters, disp);
    shots.push({
      from: position,
      to: result.landingPosition,
      lie,
    });
    position = result.landingPosition;
    strokes += 1;
  }

  return {
    shots,
    finalPosition: position,
    isHoled: false,
    shotCount: strokes,
  };
}
