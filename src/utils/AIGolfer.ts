/**
 * AI Golfer - Simulates an opponent based on Handicap/Skill level
 * Uses Gaussian distribution for realistic shot dispersion
 * Club distances by handicap: https://hackmotion.com/golf-club-distances-by-handicap/
 */

import {
  clubFromDistanceYards,
  clubFromDistanceYardsForSkill,
  getMaxShotDistanceYards,
  getMaxShotDistanceYardsForSkill,
  skillLevelToHandicapTier,
  handicapNumberToTier,
  isTiger2000Skill,
} from '../data/clubDistancesByHandicap';
import { getBenchmarkStatsForHandicap } from '../data/handicapBenchmarkStats';
import { getCalibration, type AICalibration } from './aiCalibration';
import type { HoleFeaturesForAI } from '../data/lincolnParkCourse';
import { getLieFromPosition } from '../data/lincolnParkCourse';
import { adjustYardageForConditions } from './yardageConditions';
import { isInBounds } from './courseLie';

export type SkillLevel =
  | 'Tour Pro'
  | '15 Handicap'
  | '10 Handicap'
  | '20 Handicap'
  | 'Beginner'
  | 'EW 2K'
  | 'PGA Tour'
  | 'LPGA Tour'
  | 'D.B.'
  | 'J.D.'
  | 'M.R.'
  | 'N.J.'
  | number;

export interface ShotOutcome {
  landingPosition: {
    lat: number;
    lng: number;
  };
  distance: number; // Actual distance traveled in meters
  error: number; // Error from target in meters
  angleError: number; // Degrees (positive = right, negative = left)
}

export interface ShotCommentary {
  distanceYards: number;
  club: string;
  shotShape: string;
  shotHeight: string;
  proximityToHole: string;
  weatherLie: string;
}

export interface ShotHistory {
  shotNumber: number;
  fromPosition: { lat: number; lng: number };
  toPosition: { lat: number; lng: number };
  /** When the ball deflects off a tree/patch, position where it hit (so tracer can show solid line then dashed). */
  treeImpactPosition?: { lat: number; lng: number };
  distance: number;
  targetDistance: number;
  commentary?: ShotCommentary;
}

/**
 * Generate a random number from a Gaussian distribution using Box-Muller transform
 * @param mean - Mean of the distribution
 * @param stdDev - Standard deviation
 * @returns Random number from Gaussian distribution
 */
function gaussianRandom(mean: number = 0, stdDev: number = 1): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return z0 * stdDev + mean;
}

/**
 * Calculate bearing from one point to another
 */
function calculateBearing(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  const bearing = Math.atan2(y, x);
  return ((bearing * 180) / Math.PI + 360) % 360;
}

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(point1: { lat: number; lng: number }, point2: { lat: number; lng: number }): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (point1.lat * Math.PI) / 180;
  const φ2 = (point2.lat * Math.PI) / 180;
  const Δφ = ((point2.lat - point1.lat) * Math.PI) / 180;
  const Δλ = ((point2.lng - point1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/** Gimme range: hole out and "Gimme range" commentary within this distance. 6 inches ≈ 0.1524 m */
const GIMME_METERS = 0.1524;
/** Max distance for putting (on green); meters */
const PUTT_MAX_METERS = 18;
/** Max distance for bunker shot; meters (~20 yards) */
const BUNKER_SHOT_MAX_METERS = 18.3;
/** Putting has very low dispersion (2% of distance) */
const PUTT_STD_DEV_PERCENT = 0.02;
/** Bunker shot high dispersion (25%) */
const BUNKER_STD_DEV_PERCENT = 0.25;
/** Rough: multiply distance std dev by this */
const ROUGH_DISPERSION_MULTIPLIER = 1.35;
/** Rough: max distance multiplier (slightly shorter) */
const ROUGH_DISTANCE_MULTIPLIER = 0.92;
/** First shot targets fairway when tee-to-green exceeds this (meters) */
const FAIRWAY_TARGET_MIN_DISTANCE = 180;
/** Tee shot: never use a target distance shorter than this (avoids wedges when fairway center is e.g. another hole's nearby fairway). ~100 yd */
const MIN_TEE_SHOT_METERS = 91.44;
/** When within this distance of the green, always aim at the hole (never fairway). */
const GREEN_IN_RANGE_METERS = 55;
/** When within this distance of the pin, always putt/chip (never full shot). Ensures we never hit a 7-iron from 3 yards. */
const PUTT_CHIP_RANGE_METERS = 20;
/** Chip out: max distance for recovery shot to get ball back in play (fairway). ~60 yd so we can reach fairway from tree trouble */
const CHIP_OUT_MAX_METERS = 54.86;
/** Chip out: min distance so we don't "chip" a trivial 2 yd */
const CHIP_OUT_MIN_METERS = 10;
/** Ball is "in tree trouble" when within this distance of any tree (single tree or patch) – triggers chip-out option. */
const TREE_TROUBLE_RADIUS_METERS = 28;
/** From bunker: chip out to fairway when green is farther than this (then use bunker shot max for the chip out). */
const BUNKER_CHIP_OUT_TO_FAIRWAY_WHEN_GREEN_BEYOND_METERS = 40;
/** From bunker: max distance for chip-out to fairway (get out of sand onto grass). */
const BUNKER_CHIP_OUT_MAX_METERS = 22.86;

/** EW 2K: "automatic zone" inside 3 feet – hole out with P ≥ 0.998 */
const TIGER_THREE_FEET_METERS = 0.9144;
/** EW 2K: reduced rough penalty (strong from rough) */
const TIGER_ROUGH_DISPERSION_MULTIPLIER = 1.15;
const TIGER_ROUGH_DISTANCE_MULTIPLIER = 0.98;

/**
 * Tiger Woods 2000-era putting make probability by distance (feet).
 * 0–3 ft ~99.8%, 4–5 ft ~96%, 6–9 ft ~65%, 10–15 ft ~38%, 15–20 ft ~22%, 20–25 ft ~15%, >25 ft decay.
 * Par-save bias: +5% when putting for par.
 */
function getTigerPuttMakeProbability(distanceFeet: number, isParSave: boolean = false): number {
  let p: number;
  if (distanceFeet <= 3) p = 0.998;
  else if (distanceFeet <= 5) p = 0.96;
  else if (distanceFeet <= 9) p = 0.65;
  else if (distanceFeet <= 15) p = 0.38;
  else if (distanceFeet <= 20) p = 0.22;
  else if (distanceFeet <= 25) p = 0.15;
  else p = Math.max(0.02, 0.15 * Math.exp(-0.08 * (distanceFeet - 25)));
  if (isParSave) p = Math.min(1, p + 0.05);
  return p;
}

/**
 * EW 2K: resolve putt using distance-based make probability. If miss, leave ball 1–3 ft from hole.
 */
function executeTigerPutt(
  distanceToHoleMeters: number,
  holePosition: { lat: number; lng: number },
  isParSave: boolean
): { holed: boolean; leavePosition: { lat: number; lng: number } } {
  const distanceFeet = distanceToHoleMeters * 3.28084;
  const p = getTigerPuttMakeProbability(distanceFeet, isParSave);
  if (Math.random() < p) {
    return { holed: true, leavePosition: holePosition };
  }
  const leaveFeet = 1 + Math.random() * 2;
  const leaveMeters = leaveFeet * 0.3048;
  const bearing = Math.random() * 360;
  const leavePosition = calculateDestination(holePosition, bearing, leaveMeters);
  return { holed: false, leavePosition };
}

/**
 * Make probability for numeric handicap putts (so EW 2K stays best).
 * Plus handicaps (negative h) blend toward Tiger make % so +3/+1 putt better than scratch.
 */
function getNumericHandicapPuttMakeProbability(distanceFeet: number, handicap: number): number {
  const h = Math.max(-5, Math.min(25, handicap)); // allow -5..25 for plus handicaps
  const hForBench = Math.max(0, h);
  const bench = getBenchmarkStatsForHandicap(hForBench);
  const threePuttScale = 1 - (bench.threePuttPercent - 6) / 100;
  const scale = Math.max(0.5, Math.min(1.2, threePuttScale));

  let p: number;
  if (distanceFeet <= 3) p = 0.99 - hForBench * 0.01;
  else if (distanceFeet <= 5) p = 0.92 - hForBench * 0.014;
  else if (distanceFeet <= 9) p = 0.58 - hForBench * 0.018;
  else if (distanceFeet <= 15) p = (0.34 - hForBench * 0.016) * scale;
  else if (distanceFeet <= 20) p = (0.2 - hForBench * 0.01) * scale;
  else if (distanceFeet <= 25) p = (0.12 - hForBench * 0.006) * scale;
  else p = Math.max(0.02, (0.12 - hForBench * 0.004) * scale * Math.exp(-0.08 * (distanceFeet - 25)));
  p = Math.max(0.02, Math.min(0.99, p));
  const tigerMax = getTigerPuttMakeProbability(distanceFeet, false);
  p = Math.min(p, tigerMax);
  // Plus handicaps: blend toward Tiger so they putt better than scratch but not better than EW 2K
  if (h < 0) {
    const blend = Math.min(1, -h / 5);
    p = p + (tigerMax - p) * blend;
  }
  return Math.min(tigerMax, p);
}

function executeNumericPutt(
  distanceToHoleMeters: number,
  holePosition: { lat: number; lng: number },
  handicap: number
): { holed: boolean; leavePosition: { lat: number; lng: number } } {
  const distanceFeet = distanceToHoleMeters * 3.28084;
  const p = getNumericHandicapPuttMakeProbability(distanceFeet, handicap);
  if (Math.random() < p) {
    return { holed: true, leavePosition: holePosition };
  }
  const leaveFeet = 1 + Math.random() * 2;
  const leaveMeters = leaveFeet * 0.3048;
  const bearing = Math.random() * 360;
  const leavePosition = calculateDestination(holePosition, bearing, leaveMeters);
  return { holed: false, leavePosition };
}

export interface TreeObstacle {
  lat: number;
  lng: number;
  radiusMeters: number;
  heightMeters: number;
  /** When set, hit detection uses this polygon (tree patch) instead of the circle. Avoids "hit" in empty bounding circle. */
  vertices?: { lat: number; lng: number }[];
}

/**
 * First intersection of segment from->to with polygon (closed). Returns distance from start or null.
 * Projects to same frame as circle: segment is x-axis from 0 to L, y is perpendicular.
 */
function segmentPolygonIntersection(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  vertices: { lat: number; lng: number }[]
): { t: number; distanceFromStart: number } | null {
  if (vertices.length < 3) return null;
  const L = calculateDistance(from, to);
  if (L < 1e-6) return null;
  const bearingAB = calculateBearing(from, to);

  const project = (p: { lat: number; lng: number }) => {
    const dAP = calculateDistance(from, p);
    const bearingAP = calculateBearing(from, p);
    const angleRad = ((bearingAP - bearingAB) * Math.PI) / 180;
    return { x: dAP * Math.cos(angleRad), y: dAP * Math.sin(angleRad) };
  };

  let best: { t: number; distanceFromStart: number } | null = null;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const a = project(vertices[i]);
    const b = project(vertices[(i + 1) % n]);
    const dy = b.y - a.y;
    if (Math.abs(dy) < 1e-9) continue;
    const tEdge = -a.y / dy;
    if (tEdge < 0 || tEdge > 1) continue;
    const x = a.x + tEdge * (b.x - a.x);
    if (x <= 0 || x >= L) continue;
    const t = x / L;
    if (!best || x < best.distanceFromStart) {
      best = { t, distanceFromStart: x };
    }
  }
  return best;
}

/**
 * Find first intersection of segment A->B with tree (circle or polygon patch).
 * Returns parameter t in [0,1] and distance from A to impact, or null if no hit.
 */
function segmentTreeIntersection(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  tree: TreeObstacle
): { t: number; distanceFromStart: number } | null {
  if (tree.vertices != null && tree.vertices.length >= 3) {
    return segmentPolygonIntersection(from, to, tree.vertices);
  }
  const L = calculateDistance(from, to);
  if (L < 1e-6) return null;
  const bearingAB = calculateBearing(from, to);
  const dAC = calculateDistance(from, { lat: tree.lat, lng: tree.lng });
  const bearingAC = calculateBearing(from, { lat: tree.lat, lng: tree.lng });
  const angleRad = ((bearingAC - bearingAB) * Math.PI) / 180;
  const cx = dAC * Math.cos(angleRad);
  const cy = dAC * Math.sin(angleRad);
  const R = tree.radiusMeters;
  if (cy * cy > R * R) return null;
  const sqrtTerm = Math.sqrt(R * R - cy * cy);
  const xEntry = cx - sqrtTerm;
  const t = xEntry / L;
  if (t >= 0 && t <= 1) {
    return { t, distanceFromStart: t * L };
  }
  const xExit = cx + sqrtTerm;
  const tExit = xExit / L;
  if (tExit >= 0 && tExit <= 1) return { t: tExit, distanceFromStart: tExit * L };
  return null;
}

/** True if the direct segment from from to to intersects any tree (used to decide chip-out from rough/trees). */
function isDirectPathBlockedByTree(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  trees: TreeObstacle[]
): boolean {
  for (const tree of trees) {
    if (segmentTreeIntersection(from, to, tree)) return true;
  }
  return false;
}

/** True if ball is within TREE_TROUBLE_RADIUS_METERS of any tree (single tree or patch). Enables chip-out when beside a tree even if direct path to green doesn't intersect it. */
function isBallNearAnyTree(
  position: { lat: number; lng: number },
  trees: TreeObstacle[]
): boolean {
  for (const tree of trees) {
    const dist = calculateDistance(position, { lat: tree.lat, lng: tree.lng });
    if (dist <= tree.radiusMeters + TREE_TROUBLE_RADIUS_METERS) return true;
  }
  return false;
}

/** Approximate ball height (m) at distance d along a shot of total distance D (parabolic trajectory, peak ~7% of D). */
function trajectoryHeightAt(distanceFromStart: number, totalDistance: number): number {
  if (totalDistance < 1e-6) return 0;
  const f = distanceFromStart / totalDistance;
  if (f <= 0 || f >= 1) return 0;
  const hMax = 0.07 * totalDistance;
  return 4 * hMax * f * (1 - f);
}

const SHOT_SHAPES = ['straight', 'slight draw', 'draw', 'slight fade', 'fade'] as const;
const SHOT_HEIGHTS = ['high', 'medium', 'low'] as const;
const WEATHER_LIE = [
  'Clean lie, light breeze',
  'Slight downwind',
  'Into a gentle breeze',
  'Slight uphill lie',
  'Fluffy lie, calm',
  'Tight lie, crosswind',
  'Clean fairway, no wind',
  'Slight downhill lie',
  'First cut, light wind',
  'Perfect lie, still air',
] as const;

/**
 * Calculate destination point given start point, bearing, and distance
 */
function calculateDestination(
  start: { lat: number; lng: number },
  bearing: number,
  distance: number
): { lat: number; lng: number } {
  const R = 6371e3; // Earth's radius in meters
  const lat1 = (start.lat * Math.PI) / 180;
  const lon1 = (start.lng * Math.PI) / 180;
  const brng = (bearing * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distance / R) +
    Math.cos(lat1) * Math.sin(distance / R) * Math.cos(brng)
  );

  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(distance / R) * Math.cos(lat1),
      Math.cos(distance / R) - Math.sin(lat1) * Math.sin(lat2)
    );

  return {
    lat: (lat2 * 180) / Math.PI,
    lng: (lon2 * 180) / Math.PI,
  };
}

const STANDARD_SLOPE = 113;

export class AIGolfer {
  private skillLevel: SkillLevel;
  private currentPosition: { lat: number; lng: number };
  private shotHistory: ShotHistory[] = [];
  private _courseRating: number | undefined;
  private _slopeRating: number = STANDARD_SLOPE;
  private _totalPar: number | undefined;
  private _calibration: AICalibration = { dispersionScale: 1, chipMultScale: 1 };

  constructor(skillLevel: SkillLevel, startingPosition: { lat: number; lng: number }) {
    this.skillLevel = skillLevel;
    this.currentPosition = startingPosition;
  }

  /** Effective handicap for current course slope (USGA: slope 113 = standard). Used for dispersion and benchmarks. */
  private getEffectiveHandicap(): number | null {
    if (typeof this.skillLevel !== 'number') return null;
    const slope = this._slopeRating ?? STANDARD_SLOPE;
    return this.skillLevel * (slope / STANDARD_SLOPE);
  }

  /**
   * Get standard deviation percentage based on skill level. Plus handicaps (-3, -1) get tighter
   * dispersion than scratch; floor 2% so EW 2K (1%) remains best. Scratch+ use benchmark GIR scaling.
   * Course rating: scale dispersion so scratch expected score trends toward course rating (higher dispersion when rating < par).
   */
  private getStandardDeviationPercent(): number {
    if (typeof this.skillLevel === 'number') {
      const eff = this.getEffectiveHandicap();
      const h = eff ?? this.skillLevel;
      const base = Math.min(0.25, Math.max(0.02, 0.01 + h * 0.006));
      const bench = getBenchmarkStatsForHandicap(Math.max(0, h));
      const girScale = Math.max(1.0, Math.min(1.4, 37 / bench.girPercent));
      let result = Math.min(0.28, base * girScale);
      if (this._courseRating != null && this._totalPar != null && this._totalPar > 0) {
        const ratingScale = this._totalPar / this._courseRating;
        const handicapFactor = typeof this.skillLevel === 'number' && this.skillLevel <= 5 ? 0.7 + (this.skillLevel / 5) * 0.6 : 1;
        result *= Math.min(1.5, 1 + (ratingScale - 1) * 2.2 * handicapFactor);
      }
      return result * this._calibration.dispersionScale;
    }
    switch (this.skillLevel) {
      case 'EW 2K':
        return 0.01;
      case 'Tour Pro':
      case 'PGA Tour':
      case 'D.B.':
      case 'J.D.':
      case 'M.R.':
      case 'N.J.':
        return 0.05;
      case 'LPGA Tour':
        return 0.06;
      case '10 Handicap':
        return 0.10;
      case '15 Handicap':
        return 0.15;
      case '20 Handicap':
        return 0.20;
      case 'Beginner':
        return 0.25;
      default:
        return 0.15;
    }
  }

  private getAngleStdDevDegrees(): number {
    if (typeof this.skillLevel === 'number') {
      const eff = this.getEffectiveHandicap();
      const h = eff ?? this.skillLevel;
      const base = Math.min(8, Math.max(1.0, 0.5 + h * 0.25)); // plus HCP can go to 1°, EW 2K stays 0.5°
      const bench = getBenchmarkStatsForHandicap(Math.max(0, h));
      const girScale = Math.max(1.0, Math.min(1.4, 37 / bench.girPercent));
      let result = Math.min(9, base * girScale);
      if (this._courseRating != null && this._totalPar != null && this._totalPar > 0) {
        const ratingScale = this._totalPar / this._courseRating;
        const handicapFactor = typeof this.skillLevel === 'number' && this.skillLevel <= 5 ? 0.7 + (this.skillLevel / 5) * 0.6 : 1;
        result *= Math.min(1.5, 1 + (ratingScale - 1) * 2.2 * handicapFactor);
      }
      return result * this._calibration.dispersionScale;
    }
    if (this.skillLevel === 'EW 2K') return 0.5;
    if (this.skillLevel === 'Tour Pro') return 2;
    if (
      this.skillLevel === 'PGA Tour' ||
      this.skillLevel === 'D.B.' ||
      this.skillLevel === 'J.D.' ||
      this.skillLevel === 'M.R.' ||
      this.skillLevel === 'N.J.'
    )
      return 2;
    if (this.skillLevel === 'LPGA Tour') return 2.5;
    if (this.skillLevel === '15 Handicap') return 5;
    return 8;
  }

  /**
   * Calculate shot outcome using Gaussian distribution
   * @param targetPosition - Where the AI is aiming
   * @param targetDistance - Intended distance to travel in meters
   * @param options - Override dispersion or cap distance (e.g. for putting, bunker)
   * @returns ShotOutcome with landing position and error
   */
  shotOutcome(
    targetPosition: { lat: number; lng: number },
    targetDistance: number,
    options?: { stdDevPercent?: number; maxDistanceMeters?: number }
  ): ShotOutcome {
    const maxDist = options?.maxDistanceMeters;
    const cappedDistance = maxDist != null ? Math.min(targetDistance, maxDist) : targetDistance;
    const stdDevPercent = options?.stdDevPercent ?? this.getStandardDeviationPercent();
    const stdDev = cappedDistance * stdDevPercent;

    // Generate distance error using Gaussian distribution
    const distanceError = gaussianRandom(0, stdDev);
    let actualDistance = Math.max(0, cappedDistance + distanceError);
    if (maxDist != null) actualDistance = Math.min(actualDistance, maxDist);

    const angleStdDev = this.getAngleStdDevDegrees();
    const angleError = gaussianRandom(0, angleStdDev);

    // Calculate bearing to target
    const bearing = calculateBearing(this.currentPosition, targetPosition);
    const adjustedBearing = (bearing + angleError + 360) % 360;

    // Calculate landing position
    const landingPosition = calculateDestination(this.currentPosition, adjustedBearing, actualDistance);

    // Calculate error from target
    const error = calculateDistance(landingPosition, targetPosition);

    return {
      landingPosition,
      distance: actualDistance,
      error,
      angleError,
    };
  }

  /**
   * Build commentary for a shot (distance, club, shape, height, proximity, weather/lie).
   * When targetYardsForClub is set (e.g. wind/slope adjusted), club and displayed distance use it.
   */
  private buildCommentary(
    distanceMeters: number,
    errorMeters: number,
    angleErrorDeg: number,
    isHoled: boolean,
    hitTree: boolean = false,
    targetYardsForClub?: number,
    chipOut: boolean = false
  ): ShotCommentary {
    const distanceYards = targetYardsForClub != null ? Math.round(targetYardsForClub) : Math.round(distanceMeters * 1.09361);
    const tier = typeof this.skillLevel === 'number'
      ? handicapNumberToTier(Math.round(this.getEffectiveHandicap() ?? this.skillLevel))
      : skillLevelToHandicapTier(this.skillLevel);
    const club = isTiger2000Skill(this.skillLevel)
      ? clubFromDistanceYardsForSkill(distanceYards, this.skillLevel)
      : clubFromDistanceYards(distanceYards, tier);
    const shapeIndex = Math.max(0, Math.min(4, Math.floor((angleErrorDeg + 8) / 4)));
    const shotShape = SHOT_SHAPES[shapeIndex];
    const shotHeight = SHOT_HEIGHTS[Math.floor(Math.random() * SHOT_HEIGHTS.length)];
    const weatherLie = hitTree
      ? 'Hit tree! Ball deflected.'
      : chipOut
        ? 'Chipped out to fairway'
        : WEATHER_LIE[Math.floor(Math.random() * WEATHER_LIE.length)];
    const ONE_FOOT_METERS = 0.3048;
    let proximityToHole: string;
    if (isHoled) proximityToHole = 'Holed!';
    else if (hitTree) proximityToHole = 'Deflected off tree';
    else if (errorMeters < ONE_FOOT_METERS) proximityToHole = `${Math.round(errorMeters * 39.3701)} in`;
    else if (errorMeters < 2) proximityToHole = `${Math.round(errorMeters * 3.28084)} ft`;
    else if (errorMeters < 10) proximityToHole = `${Math.round(errorMeters * 1.09361)} yds`;
    else proximityToHole = `${Math.round(errorMeters * 1.09361)} yds to pin`;

    return {
      distanceYards,
      club,
      shotShape,
      shotHeight,
      proximityToHole,
      weatherLie,
    };
  }

  /**
   * Play a hole until the ball is within gimme range (6 inches) of the hole.
   * When options.conditions is set, the AI uses wind and slope to adjust effective yardage for club selection.
   * Stroke index (hole handicap) is used for both net scoring and for shot simulation: the competitor recognizes
   * the difficulty of the hole and plans accordingly.
   */
  playHole(
    greenPosition: { lat: number; lng: number },
    maxShots: number = 20,
    treeObstacles: TreeObstacle[] = [],
    options?: {
      holeFeatures?: HoleFeaturesForAI;
      par: number;
      conditions?: { windSpeedMph: number; windDirectionDeg: number; slopeDegrees: number };
      /** USGA course rating (scratch expected score). When set with totalPar, scratch plays easier on easier courses. */
      courseRating?: number;
      /** USGA slope rating (113 = standard). Scales handicap effect on difficulty. */
      slopeRating?: number;
      /** Total par for the round (e.g. 72). Used with courseRating for scratch calibration. */
      totalPar?: number;
      /** Override calibration (dispersion/chip scale). When omitted, uses getCalibration() for test/app alignment. */
      calibration?: AICalibration;
      /** When set, shots landing outside this course's boundary (Lincoln Park sections) are treated as OB (stroke-and-distance). */
      courseName?: string;
    }
  ): ShotHistory[] {
    this.shotHistory = [];
    this.currentPosition = { ...this.currentPosition };
    this._courseRating = options?.courseRating;
    this._slopeRating = options?.slopeRating ?? STANDARD_SLOPE;
    this._totalPar = options?.totalPar;
    this._calibration = options?.calibration ?? getCalibration();
    const features = options?.holeFeatures ?? null;
    const par = options?.par ?? 4;
    const conditions = options?.conditions;
    const trees = features ? features.treeObstacles : treeObstacles;
    const courseName = options?.courseName;
    /** Max score per hole is triple par (e.g. Par 3 → 9, Par 4 → 12, Par 5 → 15). Cap by stroke count so penalty (water) doesn't exceed cap. */
    const effectiveMaxShots = options?.par != null ? Math.min(maxShots, options.par * 3) : maxShots;

    let shotNumber = 0;
    /** Consecutive tree hits so far; if >= 3, next shot from rough is chip out by default. */
    let consecutiveTreeHits = 0;

    while (shotNumber < effectiveMaxShots && this.shotHistory.length < effectiveMaxShots) {
      shotNumber++;

      const distanceToGreen = calculateDistance(this.currentPosition, greenPosition);
      const shotBearing = calculateBearing(this.currentPosition, greenPosition);
      const rawYards = distanceToGreen * 1.09361;
      const effectiveYards =
        conditions && rawYards > 0
          ? adjustYardageForConditions(
              rawYards,
              conditions.windSpeedMph,
              conditions.windDirectionDeg,
              shotBearing,
              conditions.slopeDegrees
            ).adjustedYards
          : rawYards;
      const effectiveDistanceToGreenMeters = effectiveYards / 1.09361;

      if (distanceToGreen < GIMME_METERS) {
        const commentary = this.buildCommentary(distanceToGreen, 0, 0, true);
        this.shotHistory.push({
          shotNumber,
          fromPosition: { ...this.currentPosition },
          toPosition: greenPosition,
          distance: distanceToGreen,
          targetDistance: distanceToGreen,
          commentary,
        });
        this.currentPosition = greenPosition;
        break;
      }

      // Cap shot distance to this handicap’s club max (HackMotion) so a 15 doesn’t “hit” 400 yd
      const currentLie =
        features && shotNumber === 1
          ? 'fairway'
          : features
            ? getLieFromPosition(this.currentPosition, features)
            : 'fairway';

      if (isTiger2000Skill(this.skillLevel) && distanceToGreen <= TIGER_THREE_FEET_METERS) {
        const holed = Math.random() < 0.998;
        const toPos = holed ? greenPosition : calculateDestination(greenPosition, Math.random() * 360, 0.46);
        const commentary = this.buildCommentary(distanceToGreen, 0, 0, holed);
        this.shotHistory.push({
          shotNumber,
          fromPosition: { ...this.currentPosition },
          toPosition: toPos,
          distance: distanceToGreen,
          targetDistance: distanceToGreen,
          commentary,
        });
        this.currentPosition = toPos;
        if (holed) break;
        consecutiveTreeHits = 0;
        continue;
      }

      if (distanceToGreen <= PUTT_CHIP_RANGE_METERS && features) {
        if (isTiger2000Skill(this.skillLevel)) {
          const isParSave = shotNumber >= par;
          const { holed, leavePosition } = executeTigerPutt(distanceToGreen, greenPosition, isParSave);
          const commentary = this.buildCommentary(distanceToGreen, 0, 0, holed);
          this.shotHistory.push({
            shotNumber,
            fromPosition: { ...this.currentPosition },
            toPosition: holed ? greenPosition : leavePosition,
            distance: distanceToGreen,
            targetDistance: distanceToGreen,
            commentary,
          });
          this.currentPosition = holed ? greenPosition : leavePosition;
          if (holed) break;
          consecutiveTreeHits = 0;
          continue;
        }
        if (currentLie === 'green' && typeof this.skillLevel === 'number') {
          const puttHandicap = this.getEffectiveHandicap() ?? this.skillLevel;
          const { holed, leavePosition } = executeNumericPutt(distanceToGreen, greenPosition, puttHandicap);
          const commentary = this.buildCommentary(distanceToGreen, 0, 0, holed);
          this.shotHistory.push({
            shotNumber,
            fromPosition: { ...this.currentPosition },
            toPosition: holed ? greenPosition : leavePosition,
            distance: distanceToGreen,
            targetDistance: distanceToGreen,
            commentary,
          });
          this.currentPosition = holed ? greenPosition : leavePosition;
          if (holed) break;
          consecutiveTreeHits = 0;
          continue;
        }
        // Chip from off green: dispersion tuned so up-and-down % trends toward benchmark (scratch ~50%, 20 HCP ~22%).
        const chipStdDev =
          typeof this.skillLevel === 'number'
            ? (() => {
                const h = this.getEffectiveHandicap() ?? this.skillLevel;
                const scramblingTarget =
                  h < 0 ? Math.min(58, 50 - h * 2) : getBenchmarkStatsForHandicap(Math.max(0, h)).scramblingPercent;
                const mult = (11 + (50 - scramblingTarget) / 2.5) * this._calibration.chipMultScale;
                return Math.min(0.45, this.getStandardDeviationPercent() * mult);
              })()
            : PUTT_STD_DEV_PERCENT;
        const puttOutcome = this.shotOutcome(
          greenPosition,
          Math.min(distanceToGreen, PUTT_MAX_METERS),
          { stdDevPercent: chipStdDev, maxDistanceMeters: PUTT_MAX_METERS }
        );
        this.shotHistory.push({
          shotNumber,
          fromPosition: { ...this.currentPosition },
          toPosition: puttOutcome.landingPosition,
          distance: puttOutcome.distance,
          targetDistance: distanceToGreen,
          commentary: this.buildCommentary(puttOutcome.distance, puttOutcome.error, puttOutcome.angleError, false),
        });
        this.currentPosition = puttOutcome.landingPosition;
        if (calculateDistance(this.currentPosition, greenPosition) < GIMME_METERS) {
          this.currentPosition = greenPosition;
          this.shotHistory[this.shotHistory.length - 1] = {
            ...this.shotHistory[this.shotHistory.length - 1],
            toPosition: greenPosition,
            distance: distanceToGreen,
            commentary: this.buildCommentary(distanceToGreen, 0, 0, true),
          };
          break;
        }
        consecutiveTreeHits = 0;
        continue;
      }

      if (features && currentLie === 'green' && isTiger2000Skill(this.skillLevel)) {
        const isParSave = shotNumber >= par;
        const { holed, leavePosition } = executeTigerPutt(distanceToGreen, greenPosition, isParSave);
        const commentary = this.buildCommentary(distanceToGreen, 0, 0, holed);
        this.shotHistory.push({
          shotNumber,
          fromPosition: { ...this.currentPosition },
          toPosition: holed ? greenPosition : leavePosition,
          distance: distanceToGreen,
          targetDistance: distanceToGreen,
          commentary,
        });
        this.currentPosition = holed ? greenPosition : leavePosition;
        if (holed) break;
        consecutiveTreeHits = 0;
        continue;
      }
      if (features && currentLie === 'green' && typeof this.skillLevel === 'number') {
        const puttHandicap = this.getEffectiveHandicap() ?? this.skillLevel;
        const { holed, leavePosition } = executeNumericPutt(distanceToGreen, greenPosition, puttHandicap);
        const commentary = this.buildCommentary(distanceToGreen, 0, 0, holed);
        this.shotHistory.push({
          shotNumber,
          fromPosition: { ...this.currentPosition },
          toPosition: holed ? greenPosition : leavePosition,
          distance: distanceToGreen,
          targetDistance: distanceToGreen,
          commentary,
        });
        this.currentPosition = holed ? greenPosition : leavePosition;
        if (holed) break;
        consecutiveTreeHits = 0;
        continue;
      }

      let targetPosition = greenPosition;
      let targetDistanceMeters = distanceToGreen;
      let shotOptions: { stdDevPercent?: number; maxDistanceMeters?: number } | undefined;
      let isChipOut = false;

      if (features) {
        const distanceToGreenYards = effectiveYards;
        const shotTier = typeof this.skillLevel === 'number'
          ? handicapNumberToTier(Math.round(this.getEffectiveHandicap() ?? this.skillLevel))
          : skillLevelToHandicapTier(this.skillLevel);
        const maxShotYards = isTiger2000Skill(this.skillLevel)
          ? getMaxShotDistanceYardsForSkill(distanceToGreenYards, this.skillLevel)
          : getMaxShotDistanceYards(distanceToGreenYards, shotTier);
        const fullMaxMeters = maxShotYards / 1.09361;
        const roughDispMult = isTiger2000Skill(this.skillLevel) ? TIGER_ROUGH_DISPERSION_MULTIPLIER : ROUGH_DISPERSION_MULTIPLIER;
        const roughDistMult = isTiger2000Skill(this.skillLevel) ? TIGER_ROUGH_DISTANCE_MULTIPLIER : ROUGH_DISTANCE_MULTIPLIER;

        if (currentLie === 'green') {
          targetPosition = greenPosition;
          targetDistanceMeters = Math.min(effectiveDistanceToGreenMeters, PUTT_MAX_METERS);
          shotOptions = { stdDevPercent: PUTT_STD_DEV_PERCENT, maxDistanceMeters: PUTT_MAX_METERS };
        } else if (currentLie === 'bunker') {
          // Option to chip out to fairway when green is far (get ball in play, then full shot next).
          let chipOutFw: (typeof features.fairways)[0] | null = null;
          let chipOutDist = 0;
          if (
            distanceToGreen > BUNKER_CHIP_OUT_TO_FAIRWAY_WHEN_GREEN_BEYOND_METERS &&
            features.fairways.length > 0
          ) {
            for (const fw of features.fairways) {
              const d = calculateDistance(this.currentPosition, fw.center);
              if (d < distanceToGreen && d <= BUNKER_CHIP_OUT_MAX_METERS && d > chipOutDist) {
                chipOutFw = fw;
                chipOutDist = d;
              }
            }
          }
          if (chipOutFw != null) {
            isChipOut = true;
            targetPosition = chipOutFw.center;
            targetDistanceMeters = Math.min(chipOutDist, BUNKER_CHIP_OUT_MAX_METERS);
            shotOptions = {
              stdDevPercent: BUNKER_STD_DEV_PERCENT,
              maxDistanceMeters: BUNKER_CHIP_OUT_MAX_METERS,
            };
          } else {
            targetPosition = greenPosition;
            targetDistanceMeters = Math.min(effectiveDistanceToGreenMeters, BUNKER_SHOT_MAX_METERS);
            shotOptions = {
              stdDevPercent: BUNKER_STD_DEV_PERCENT,
              maxDistanceMeters: BUNKER_SHOT_MAX_METERS,
            };
          }
        } else if (currentLie === 'rough') {
          // Chip out to fairway when: path blocked, OR ball near a tree, OR 3+ tree hits in a row (force chip out by default).
          const pathBlocked = trees.length > 0 && isDirectPathBlockedByTree(this.currentPosition, greenPosition, trees);
          const nearTree = trees.length > 0 && isBallNearAnyTree(this.currentPosition, trees);
          const inTreeTrouble = pathBlocked || nearTree || consecutiveTreeHits >= 3;
          let chipOutFw: (typeof features.fairways)[0] | null = null;
          let chipOutDist = 0;
          if (
            inTreeTrouble &&
            features.fairways.length > 0 &&
            distanceToGreen > CHIP_OUT_MIN_METERS
          ) {
            for (const fw of features.fairways) {
              const d = calculateDistance(this.currentPosition, fw.center);
              if (
                d >= CHIP_OUT_MIN_METERS &&
                d <= CHIP_OUT_MAX_METERS &&
                d < distanceToGreen &&
                d > chipOutDist
              ) {
                chipOutFw = fw;
                chipOutDist = d;
              }
            }
          }
          if (chipOutFw != null) {
            isChipOut = true;
            targetPosition = chipOutFw.center;
            targetDistanceMeters = Math.min(chipOutDist, CHIP_OUT_MAX_METERS);
            shotOptions = {
              stdDevPercent: this.getStandardDeviationPercent() * roughDispMult,
              maxDistanceMeters: CHIP_OUT_MAX_METERS,
            };
          } else {
            // Play from rough: full shot toward green with rough multipliers.
            targetPosition = greenPosition;
            targetDistanceMeters = Math.min(effectiveDistanceToGreenMeters, fullMaxMeters * roughDistMult);
            shotOptions = {
              stdDevPercent: this.getStandardDeviationPercent() * roughDispMult,
              maxDistanceMeters: targetDistanceMeters,
            };
          }
        } else {
          // Shot 1 tee shot: pick a fairway toward the green. Prefer one at least MIN_TEE_SHOT_METERS away (avoids targeting another hole's nearby fairway and teeing off with a wedge).
          let distToFairway = Infinity;
          let chosenFw: (typeof features.fairways)[0] | null = null;
          if (features.fairways.length > 0) {
            const teeShotLongHole =
              shotNumber === 1 && par >= 4 && distanceToGreen > FAIRWAY_TARGET_MIN_DISTANCE;
            if (teeShotLongHole) {
              // Prefer farthest fairway center that is at least MIN_TEE_SHOT_METERS (main fairway, not another hole's nearby fairway).
              let bestFar = 0;
              for (const fw of features.fairways) {
                const d = calculateDistance(this.currentPosition, fw.center);
                if (d >= distanceToGreen) continue;
                if (d >= MIN_TEE_SHOT_METERS && d > bestFar) {
                  chosenFw = fw;
                  distToFairway = d;
                  bestFar = d;
                }
              }
              if (chosenFw == null) {
                for (const fw of features.fairways) {
                  const d = calculateDistance(this.currentPosition, fw.center);
                  if (d < distanceToGreen && (chosenFw == null || d > distToFairway)) {
                    chosenFw = fw;
                    distToFairway = d;
                  }
                }
              }
            } else {
              for (const fw of features.fairways) {
                const d = calculateDistance(this.currentPosition, fw.center);
                if (d < distanceToGreen && (chosenFw == null || d < distToFairway)) {
                  chosenFw = fw;
                  distToFairway = d;
                }
              }
            }
            if (chosenFw == null) {
              chosenFw = features.fairways[0];
              distToFairway = calculateDistance(this.currentPosition, chosenFw.center);
            }
          }
          const fairwayCenterTowardGreen = chosenFw != null && distToFairway < distanceToGreen;
          // Par 3: always aim at green from tee. Par 4/5: aim at fairway when hole is long enough.
          if (
            shotNumber === 1 &&
            par >= 4 &&
            distanceToGreen > FAIRWAY_TARGET_MIN_DISTANCE &&
            distanceToGreen > GREEN_IN_RANGE_METERS &&
            chosenFw != null &&
            fairwayCenterTowardGreen
          ) {
            targetPosition = chosenFw.center;
            // Never tee off with a wedge: use at least MIN_TEE_SHOT_METERS so club matches a full shot.
            targetDistanceMeters = Math.max(
              MIN_TEE_SHOT_METERS,
              Math.min(distToFairway, fullMaxMeters)
            );
          } else {
            targetDistanceMeters = Math.min(effectiveDistanceToGreenMeters, fullMaxMeters);
          }
          if (currentLie !== 'rough') shotOptions = undefined;
        }
      } else {
        const distanceToGreenYards = effectiveYards;
        const noFeaturesTier = typeof this.skillLevel === 'number'
          ? handicapNumberToTier(Math.round(this.getEffectiveHandicap() ?? this.skillLevel))
          : skillLevelToHandicapTier(this.skillLevel);
        const maxShotYards = isTiger2000Skill(this.skillLevel)
          ? getMaxShotDistanceYardsForSkill(distanceToGreenYards, this.skillLevel)
          : getMaxShotDistanceYards(distanceToGreenYards, noFeaturesTier);
        targetDistanceMeters = Math.min(effectiveDistanceToGreenMeters, maxShotYards / 1.09361);
      }

      let outcome = this.shotOutcome(targetPosition, targetDistanceMeters, shotOptions);
      let hitTree = false;
      let treeImpactPoint: { lat: number; lng: number } | undefined;

      // Check tree obstacles: first hit (if any) where ball doesn't clear the tree height
      if (trees.length > 0) {
        const segmentLength = outcome.distance;
        let firstHit: { t: number; distanceFromStart: number; tree: TreeObstacle } | null = null;
        for (const tree of trees) {
          const hit = segmentTreeIntersection(this.currentPosition, outcome.landingPosition, tree);
          if (!hit) continue;
          const ballHeight = trajectoryHeightAt(hit.distanceFromStart, segmentLength);
          if (ballHeight > tree.heightMeters) continue; // Ball clears the tree
          if (!firstHit || hit.t < firstHit.t) {
            firstHit = { t: hit.t, distanceFromStart: hit.distanceFromStart, tree };
          }
        }
        if (firstHit) {
          hitTree = true;
          const bearingToTarget = calculateBearing(this.currentPosition, outcome.landingPosition);
          treeImpactPoint = calculateDestination(
            this.currentPosition,
            bearingToTarget,
            firstHit.distanceFromStart
          );
          // Deflection: bounce off tree, ball ends up near tree with random direction (2–7 m)
          const deflectionAngle = (bearingToTarget + 90 + (Math.random() * 60 - 30) + 360) % 360;
          const deflectionDist = 2 + Math.random() * 5;
          outcome = {
            ...outcome,
            landingPosition: calculateDestination(treeImpactPoint, deflectionAngle, deflectionDist),
            distance: firstHit.distanceFromStart + deflectionDist,
            error: outcome.error + deflectionDist,
            angleError: outcome.angleError,
          };
        }
      }

      const landingLie = features ? getLieFromPosition(outcome.landingPosition, features) : 'rough';
      const outOfBounds = courseName && !isInBounds(outcome.landingPosition, courseName);

      if (features && landingLie === 'water') {
        const commentary = this.buildCommentary(
          outcome.distance,
          outcome.error,
          outcome.angleError,
          false,
          hitTree,
          undefined,
          isChipOut
        );
        this.shotHistory.push({
          shotNumber,
          fromPosition: { ...this.currentPosition },
          toPosition: outcome.landingPosition,
          ...(hitTree && treeImpactPoint && { treeImpactPosition: treeImpactPoint }),
          distance: outcome.distance,
          targetDistance: distanceToGreen,
          commentary: { ...commentary, weatherLie: 'Ball in water – penalty' },
        });
        consecutiveTreeHits = hitTree ? consecutiveTreeHits + 1 : 0;
        if (this.shotHistory.length >= effectiveMaxShots) break;
        shotNumber++;
        const penaltyCommentary: ShotCommentary = {
          distanceYards: 0,
          club: 'Penalty',
          shotShape: '—',
          shotHeight: '—',
          proximityToHole: 'Penalty stroke',
          weatherLie: 'Ball in water – re-hit from previous spot',
        };
        this.shotHistory.push({
          shotNumber,
          fromPosition: { ...this.currentPosition },
          toPosition: { ...this.currentPosition },
          distance: 0,
          targetDistance: 0,
          commentary: penaltyCommentary,
        });
        continue;
      }

      if (outOfBounds) {
        const commentary = this.buildCommentary(
          outcome.distance,
          outcome.error,
          outcome.angleError,
          false,
          hitTree,
          undefined,
          isChipOut
        );
        this.shotHistory.push({
          shotNumber,
          fromPosition: { ...this.currentPosition },
          toPosition: outcome.landingPosition,
          ...(hitTree && treeImpactPoint && { treeImpactPosition: treeImpactPoint }),
          distance: outcome.distance,
          targetDistance: distanceToGreen,
          commentary: { ...commentary, weatherLie: 'Out of bounds – penalty' },
        });
        consecutiveTreeHits = hitTree ? consecutiveTreeHits + 1 : 0;
        if (this.shotHistory.length >= effectiveMaxShots) break;
        shotNumber++;
        const penaltyCommentary: ShotCommentary = {
          distanceYards: 0,
          club: 'Penalty',
          shotShape: '—',
          shotHeight: '—',
          proximityToHole: 'Penalty stroke',
          weatherLie: 'OB – re-hit from previous spot',
        };
        this.shotHistory.push({
          shotNumber,
          fromPosition: { ...this.currentPosition },
          toPosition: { ...this.currentPosition },
          distance: 0,
          targetDistance: 0,
          commentary: penaltyCommentary,
        });
        continue;
      }

      // When ball hits a tree, show intended club/distance (what the AI chose), not the shortened actual travel.
      const yardsForClub =
        hitTree
          ? Math.round(targetDistanceMeters * 1.09361)
          : conditions
            ? effectiveYards
            : undefined;
      const commentary = this.buildCommentary(
        outcome.distance,
        outcome.error,
        outcome.angleError,
        false,
        hitTree,
        yardsForClub,
        isChipOut
      );

      this.shotHistory.push({
        shotNumber,
        fromPosition: { ...this.currentPosition },
        toPosition: outcome.landingPosition,
        ...(hitTree && treeImpactPoint && { treeImpactPosition: treeImpactPoint }),
        distance: outcome.distance,
        targetDistance: distanceToGreen,
        commentary,
      });

      this.currentPosition = outcome.landingPosition;
      consecutiveTreeHits = hitTree ? consecutiveTreeHits + 1 : 0;
    }

    return this.shotHistory;
  }

  /**
   * Get current position
   */
  getCurrentPosition(): { lat: number; lng: number } {
    return { ...this.currentPosition };
  }

  /**
   * Get shot history
   */
  getShotHistory(): ShotHistory[] {
    return [...this.shotHistory];
  }

  /**
   * Reset to starting position
   */
  reset(startingPosition: { lat: number; lng: number }): void {
    this.currentPosition = startingPosition;
    this.shotHistory = [];
  }
}
