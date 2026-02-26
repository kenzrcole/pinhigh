import { Hole, HoleFeature } from './mockHoleData';
import { GOLDEN_GATE_PARK_COURSE, TPC_HARDING_PARK_COURSE } from './courses';

/**
 * Lincoln Park Golf Course - San Francisco, CA
 * Historic municipal course with stunning views of the Golden Gate Bridge
 * GPS coordinates based on actual hole locations
 * Par 72, 5,149 yards from the blue tees
 *
 * Par 3s: Holes 3, 8, 12, 16, 17
 * Par 4s: Holes 1, 2, 4, 5, 6, 7, 9, 10, 11, 14, 15, 18
 * Par 5s: Hole 13
 *
 * Tree features (type: 'tree'): identified obstacles for shot physics (collision, clear-over, deflection).
 * Re-identified for full course: one tree per hole along tree line (≈45 m perpendicular from tee–green center).
 * radius/heightMeters in meters. getTreesForHole(holeNumber) feeds AIGolfer; no trees in fairway.
 */

export const LINCOLN_PARK_HOLES: Hole[] = [
  {
    number: 1,
    par: 4,
    yardage: 369,
    strokeIndex: 6,
    features: [
      {
        type: 'tee',
        name: 'Hole 1 Tee',
        coordinates: { lat: 37.7840, lng: -122.5005 },
      },
      {
        type: 'fairway',
        name: 'Landing Zone',
        coordinates: { lat: 37.7845, lng: -122.5000 },
        radius: 22,
      },
      {
        type: 'bunker',
        name: 'Right Fairway Bunker',
        coordinates: { lat: 37.7848, lng: -122.4998 },
        radius: 6,
      },
      {
        type: 'green',
        name: 'Hole 1 Green',
        coordinates: { lat: 37.7851, lng: -122.4995 },
        radius: 10,
      },
      { type: 'tree', name: 'Tree line R', coordinates: { lat: 37.78318, lng: -122.49557 }, radius: 8, heightMeters: 10 },
    ],
  },
  {
    number: 2,
    par: 4,
    yardage: 309,
    strokeIndex: 15,
    features: [
      {
        type: 'tee',
        name: 'Hole 2 Tee',
        coordinates: { lat: 37.783342, lng: -122.497522 },
      },
      {
        type: 'fairway',
        name: 'Landing Zone',
        coordinates: { lat: 37.7848, lng: -122.4972 },
        radius: 20,
      },
      {
        type: 'bunker',
        name: 'Front Bunker',
        coordinates: { lat: 37.7850, lng: -122.4970 },
        radius: 5,
      },
      {
        type: 'green',
        name: 'Hole 2 Green',
        coordinates: { lat: 37.785038, lng: -122.498981 },
        radius: 9,
      },
      { type: 'tree', name: 'Tree line L', coordinates: { lat: 37.78419, lng: -122.49875 }, radius: 8, heightMeters: 10 },
    ],
  },
  {
    number: 3,
    par: 3,
    yardage: 147,
    strokeIndex: 18,
    features: [
      {
        type: 'tee',
        name: 'Hole 3 Tee',
        coordinates: { lat: 37.786827, lng: -122.501433 },
      },
      {
        type: 'fairway',
        name: 'Landing Zone',
        coordinates: { lat: 37.7856, lng: -122.4970 },
        radius: 16,
      },
      {
        type: 'bunker',
        name: 'Left Fairway Bunker',
        coordinates: { lat: 37.7857, lng: -122.4972 },
        radius: 5,
      },
      {
        type: 'green',
        name: 'Hole 3 Green',
        coordinates: { lat: 37.786374, lng: -122.503015 },
        radius: 10,
      },
      { type: 'tree', name: 'Tree line R', coordinates: { lat: 37.78662, lng: -122.50215 }, radius: 6, heightMeters: 8 },
    ],
  },
  {
    number: 4,
    par: 4,
    yardage: 422,
    strokeIndex: 2,
    features: [
      {
        type: 'tee',
        name: 'Hole 4 Tee',
        coordinates: { lat: 37.786359, lng: -122.501714 },
      },
      {
        type: 'fairway',
        name: 'Landing Zone',
        coordinates: { lat: 37.7864, lng: -122.4982 },
        radius: 24,
      },
      {
        type: 'bunker',
        name: 'Right Greenside Bunker',
        coordinates: { lat: 37.7867, lng: -122.4985 },
        radius: 5,
      },
      {
        type: 'green',
        name: 'Hole 4 Green',
        coordinates: { lat: 37.784746, lng: -122.504300 },
        radius: 8,
      },
      { type: 'tree', name: 'Tree line L', coordinates: { lat: 37.78558, lng: -122.50358 }, radius: 8, heightMeters: 10 },
    ],
  },
  {
    number: 5,
    par: 4,
    yardage: 375,
    strokeIndex: 5,
    features: [
      {
        type: 'tee',
        name: 'Hole 5 Tee',
        coordinates: { lat: 37.784343, lng: -122.504069 },
      },
      {
        type: 'fairway',
        name: 'Landing Zone',
        coordinates: { lat: 37.7874, lng: -122.4994 },
        radius: 23,
      },
      {
        type: 'bunker',
        name: 'Left Fairway Bunker',
        coordinates: { lat: 37.7876, lng: -122.4996 },
        radius: 6,
      },
      {
        type: 'green',
        name: 'Hole 5 Green',
        coordinates: { lat: 37.785988, lng: -122.501258 },
        radius: 10,
      },
      { type: 'tree', name: 'Tree line R', coordinates: { lat: 37.78520, lng: -122.50258 }, radius: 8, heightMeters: 10 },
    ],
  },
  {
    number: 6,
    par: 4,
    yardage: 396,
    strokeIndex: 4,
    features: [
      {
        type: 'tee',
        name: 'Hole 6 Tee',
        coordinates: { lat: 37.784228, lng: -122.501562 },
      },
      {
        type: 'fairway',
        name: 'Landing Zone',
        coordinates: { lat: 37.7883, lng: -122.5003 },
        radius: 23,
      },
      {
        type: 'bunker',
        name: 'Front Left Bunker',
        coordinates: { lat: 37.7886, lng: -122.5005 },
        radius: 5,
      },
      {
        type: 'bunker',
        name: 'Front Right Bunker',
        coordinates: { lat: 37.7886, lng: -122.5003 },
        radius: 5,
      },
      {
        type: 'green',
        name: 'Hole 6 Green',
        coordinates: { lat: 37.782040, lng: -122.500938 },
        radius: 9,
      },
      { type: 'tree', name: 'Tree line L', coordinates: { lat: 37.78318, lng: -122.50142 }, radius: 8, heightMeters: 10 },
    ],
  },
  {
    number: 7,
    par: 4,
    yardage: 368,
    strokeIndex: 7,
    features: [
      {
        type: 'tee',
        name: 'Hole 7 Tee',
        coordinates: { lat: 37.781559, lng: -122.500885 },
      },
      {
        type: 'fairway',
        name: 'Landing Zone',
        coordinates: { lat: 37.7891, lng: -122.5010 },
        radius: 22,
      },
      {
        type: 'green',
        name: 'Hole 7 Green',
        coordinates: { lat: 37.782131, lng: -122.497582 },
        radius: 10,
      },
      { type: 'tree', name: 'Tree line R', coordinates: { lat: 37.78192, lng: -122.49892 }, radius: 7, heightMeters: 8 },
    ],
  },
  {
    number: 8,
    par: 3,
    yardage: 168,
    strokeIndex: 12,
    features: [
      {
        type: 'tee',
        name: 'Hole 8 Tee',
        coordinates: { lat: 37.781827, lng: -122.497508 },
      },
      {
        type: 'fairway',
        name: 'Landing Zone',
        coordinates: { lat: 37.7897, lng: -122.5020 },
        radius: 18,
      },
      {
        type: 'bunker',
        name: 'Right Fairway Bunker',
        coordinates: { lat: 37.7898, lng: -122.5018 },
        radius: 6,
      },
      {
        type: 'green',
        name: 'Hole 8 Green',
        coordinates: { lat: 37.782106, lng: -122.495849 },
        radius: 10,
      },
      { type: 'tree', name: 'Tree line L', coordinates: { lat: 37.78188, lng: -122.49778 }, radius: 6, heightMeters: 9 },
    ],
  },
  {
    number: 9,
    par: 4,
    yardage: 318,
    strokeIndex: 14,
    features: [
      {
        type: 'tee',
        name: 'Hole 9 Tee',
        coordinates: { lat: 37.782470, lng: -122.495606 },
      },
      {
        type: 'fairway',
        name: 'Landing Zone',
        coordinates: { lat: 37.7896, lng: -122.5028 },
        radius: 21,
      },
      {
        type: 'green',
        name: 'Hole 9 Green',
        coordinates: { lat: 37.782509, lng: -122.498816 },
        radius: 10,
      },
      { type: 'tree', name: 'Tree line R', coordinates: { lat: 37.78252, lng: -122.49718 }, radius: 8, heightMeters: 10 },
    ],
  },
  {
    number: 10,
    par: 4,
    yardage: 351,
    strokeIndex: 10,
    features: [
      {
        type: 'tee',
        name: 'Hole 10 Tee',
        coordinates: { lat: 37.782313, lng: -122.499485 },
      },
      {
        type: 'fairway',
        name: 'Landing Zone',
        coordinates: { lat: 37.7886, lng: -122.5036 },
        radius: 22,
      },
      {
        type: 'bunker',
        name: 'Left Fairway Bunker',
        coordinates: { lat: 37.7884, lng: -122.5037 },
        radius: 6,
      },
      {
        type: 'green',
        name: 'Hole 10 Green',
        coordinates: { lat: 37.784273, lng: -122.500006 },
        radius: 10,
      },
      { type: 'tree', name: 'Tree line L', coordinates: { lat: 37.78326, lng: -122.50042 }, radius: 8, heightMeters: 10 },
    ],
  },
  {
    number: 11,
    par: 4,
    yardage: 287,
    strokeIndex: 13,
    features: [
      {
        type: 'tee',
        name: 'Hole 11 Tee',
        coordinates: { lat: 37.784434, lng: -122.499766 },
      },
      {
        type: 'fairway',
        name: 'Landing Zone',
        coordinates: { lat: 37.7878, lng: -122.5042 },
        radius: 20,
      },
      {
        type: 'bunker',
        name: 'Front Bunker',
        coordinates: { lat: 37.7876, lng: -122.5043 },
        radius: 5,
      },
      {
        type: 'green',
        name: 'Hole 11 Green',
        coordinates: { lat: 37.782939, lng: -122.497966 },
        radius: 9,
      },
      { type: 'tree', name: 'Tree line R', coordinates: { lat: 37.78378, lng: -122.49862 }, radius: 7, heightMeters: 9 },
    ],
  },
  {
    number: 12,
    par: 3,
    yardage: 184,
    strokeIndex: 11,
    features: [
      {
        type: 'tee',
        name: 'Hole 12 Tee',
        coordinates: { lat: 37.783685, lng: -122.497507 },
      },
      {
        type: 'fairway',
        name: 'Landing Zone',
        coordinates: { lat: 37.7870, lng: -122.5048 },
        radius: 18,
      },
      {
        type: 'bunker',
        name: 'Right Fairway Bunker',
        coordinates: { lat: 37.7869, lng: -122.5047 },
        radius: 6,
      },
      {
        type: 'bunker',
        name: 'Left Greenside Bunker',
        coordinates: { lat: 37.7867, lng: -122.5050 },
        radius: 5,
      },
      {
        type: 'green',
        name: 'Hole 12 Green',
        coordinates: { lat: 37.785137, lng: -122.498589 },
        radius: 10,
      },
      { type: 'tree', name: 'Tree line L', coordinates: { lat: 37.78434, lng: -122.49908 }, radius: 6, heightMeters: 8 },
    ],
  },
  {
    number: 13,
    par: 5,
    yardage: 503,
    strokeIndex: 1,
    features: [
      {
        type: 'tee',
        name: 'Hole 13 Tee',
        coordinates: { lat: 37.785571, lng: -122.498797 },
      },
      {
        type: 'fairway',
        name: 'Landing Zone',
        coordinates: { lat: 37.7862, lng: -122.5048 },
        radius: 25,
      },
      {
        type: 'green',
        name: 'Hole 13 Green',
        coordinates: { lat: 37.783152, lng: -122.494693 },
        radius: 10,
      },
      { type: 'tree', name: 'Tree line R', coordinates: { lat: 37.78442, lng: -122.49638 }, radius: 9, heightMeters: 11 },
      { type: 'tree', name: 'Tree line R', coordinates: { lat: 37.78358, lng: -122.49522 }, radius: 7, heightMeters: 9 },
    ],
  },
  {
    number: 14,
    par: 4,
    yardage: 349,
    strokeIndex: 8,
    features: [
      {
        type: 'tee',
        name: 'Hole 14 Tee',
        coordinates: { lat: 37.783492, lng: -122.494471 },
      },
      {
        type: 'fairway',
        name: 'Landing Zone',
        coordinates: { lat: 37.7854, lng: -122.5040 },
        radius: 22,
      },
      {
        type: 'bunker',
        name: 'Right Greenside Bunker',
        coordinates: { lat: 37.7852, lng: -122.5038 },
        radius: 5,
      },
      {
        type: 'green',
        name: 'Hole 14 Green',
        coordinates: { lat: 37.784676, lng: -122.496535 },
        radius: 9,
      },
      { type: 'tree', name: 'Tree line L', coordinates: { lat: 37.78398, lng: -122.49608 }, radius: 8, heightMeters: 10 },
    ],
  },
  {
    number: 15,
    par: 4,
    yardage: 414,
    strokeIndex: 3,
    features: [
      {
        type: 'tee',
        name: 'Hole 15 Tee',
        coordinates: { lat: 37.784924, lng: -122.496366 },
      },
      {
        type: 'fairway',
        name: 'Landing Zone',
        coordinates: { lat: 37.7846, lng: -122.5030 },
        radius: 24,
      },
      {
        type: 'bunker',
        name: 'Left Fairway Bunker',
        coordinates: { lat: 37.7845, lng: -122.5028 },
        radius: 6,
      },
      {
        type: 'bunker',
        name: 'Right Greenside Bunker',
        coordinates: { lat: 37.7842, lng: -122.5025 },
        radius: 5,
      },
      {
        type: 'green',
        name: 'Hole 15 Green',
        coordinates: { lat: 37.786019, lng: -122.498909 },
        radius: 10,
      },
      { type: 'tree', name: 'Tree line L', coordinates: { lat: 37.78544, lng: -122.49852 }, radius: 8, heightMeters: 10 },
    ],
  },
  {
    number: 16,
    par: 3,
    yardage: 169,
    strokeIndex: 17,
    features: [
      {
        type: 'tee',
        name: 'Hole 16 Tee',
        coordinates: { lat: 37.786050, lng: -122.498143 },
      },
      {
        type: 'fairway',
        name: 'Landing Zone',
        coordinates: { lat: 37.7839, lng: -122.5020 },
        radius: 18,
      },
      {
        type: 'bunker',
        name: 'Front Left Bunker',
        coordinates: { lat: 37.7838, lng: -122.5019 },
        radius: 5,
      },
      {
        type: 'green',
        name: 'Hole 16 Green',
        coordinates: { lat: 37.785140, lng: -122.495955 },
        radius: 9,
      },
      { type: 'tree', name: 'Tree line R', coordinates: { lat: 37.78554, lng: -122.49658 }, radius: 6, heightMeters: 8 },
    ],
  },
  {
    number: 17,
    par: 3,
    yardage: 175,
    strokeIndex: 16,
    features: [
      {
        type: 'tee',
        name: 'Hole 17 Tee',
        coordinates: { lat: 37.786297, lng: -122.496995 },
      },
      {
        type: 'fairway',
        name: 'Landing Zone',
        coordinates: { lat: 37.7838, lng: -122.5010 },
        radius: 18,
      },
      {
        type: 'bunker',
        name: 'Right Fairway Bunker',
        coordinates: { lat: 37.7839, lng: -122.5008 },
        radius: 6,
      },
      {
        type: 'green',
        name: 'Hole 17 Green',
        coordinates: { lat: 37.786299, lng: -122.494539 },
        radius: 10,
      },
      { type: 'tree', name: 'Tree line L', coordinates: { lat: 37.78608, lng: -122.49598 }, radius: 6, heightMeters: 9 },
    ],
  },
  {
    number: 18,
    par: 4,
    yardage: 346,
    strokeIndex: 9,
    features: [
      {
        type: 'tee',
        name: 'Hole 18 Tee',
        coordinates: { lat: 37.785944, lng: -122.494148 },
      },
      {
        type: 'fairway',
        name: 'Landing Zone',
        coordinates: { lat: 37.7838, lng: -122.4998 },
        radius: 22,
      },
      {
        type: 'bunker',
        name: 'Left Fairway Bunker',
        coordinates: { lat: 37.7837, lng: -122.4996 },
        radius: 6,
      },
      {
        type: 'bunker',
        name: 'Right Greenside Bunker',
        coordinates: { lat: 37.7835, lng: -122.4993 },
        radius: 5,
      },
      {
        type: 'green',
        name: 'Hole 18 Green',
        coordinates: { lat: 37.782706, lng: -122.494163 },
        radius: 10,
      },
      { type: 'tree', name: 'Tree line R', coordinates: { lat: 37.78442, lng: -122.49652 }, radius: 8, heightMeters: 10 },
    ],
  },
];

/** USGA course rating (expected score for scratch) and slope rating from the blue tees. Source: Lincoln Park local rules. */
export const LINCOLN_PARK_COURSE = {
  name: 'Lincoln Park Golf Course',
  location: 'San Francisco, CA',
  par: 72,
  yardage: 5149,
  /** Course rating (scratch expected score) from blue tees. */
  courseRating: 65.9,
  /** Slope rating from blue tees (113 = average). */
  slopeRating: 110,
  holes: LINCOLN_PARK_HOLES,
  description: 'Historic municipal course with stunning Golden Gate Bridge views',
  established: 1917,
};

export function getHoleByNumber(holeNumber: number): Hole | undefined {
  return LINCOLN_PARK_HOLES.find((hole) => hole.number === holeNumber);
}

/** USGA course rating and slope for AI calibration. Returns null if course has no ratings. */
export function getCourseRatingAndSlope(
  courseName: string
): { courseRating: number; slopeRating: number; totalPar: number } | null {
  if (courseName === LINCOLN_PARK_COURSE.name) {
    return {
      courseRating: LINCOLN_PARK_COURSE.courseRating,
      slopeRating: LINCOLN_PARK_COURSE.slopeRating,
      totalPar: LINCOLN_PARK_COURSE.par,
    };
  }
  if (courseName === GOLDEN_GATE_PARK_COURSE.name) {
    return { courseRating: 25, slopeRating: 80, totalPar: 27 };
  }
  /** TPC Harding Park – Championship tees (7,169 yds). Update from USGA Course Rating database if available. */
  if (courseName === TPC_HARDING_PARK_COURSE.name) {
    return { courseRating: 74.5, slopeRating: 140, totalPar: 72 };
  }
  return null;
}

export interface TeeAndGreen {
  tee: { lat: number; lng: number };
  green: { lat: number; lng: number };
}

/** Get tee and green coordinates for a hole from its features. Hole 1 uses user-provided overrides for correct placement. */
export function getTeeAndGreen(holeNumber: number): TeeAndGreen | undefined {
  if (holeNumber === 1) {
    return { tee: { ...HOLE_1_TEE_OVERRIDE }, green: { ...HOLE_1_GREEN_OVERRIDE } };
  }
  const hole = getHoleByNumber(holeNumber);
  if (!hole) return undefined;
  const teeFeature = hole.features.find((f) => f.type === 'tee');
  const greenFeature = hole.features.find((f) => f.type === 'green');
  if (!teeFeature || !greenFeature) return undefined;
  return {
    tee: { ...teeFeature.coordinates },
    green: { ...greenFeature.coordinates },
  };
}

/** User-provided coordinates for Hole 1 (override course data for accuracy). */
export const HOLE_1_TEE_OVERRIDE: TeeAndGreen['tee'] = {
  lat: 37.78237186701465,
  lng: -122.49481822364827,
};
export const HOLE_1_GREEN_OVERRIDE: TeeAndGreen['green'] = {
  lat: 37.78399164867041,
  lng: -122.49732070604578,
};

export function calculateTotalPar(holes: Hole[]): number {
  return holes.reduce((sum, hole) => sum + hole.par, 0);
}

export function calculateTotalYardage(holes: Hole[]): number {
  return holes.reduce((sum, hole) => sum + hole.yardage, 0);
}

export interface TreeObstacle {
  lat: number;
  lng: number;
  radiusMeters: number;
  heightMeters: number;
  /** For tree patches: polygon vertices so AI uses actual shape instead of bounding circle. */
  vertices?: { lat: number; lng: number }[];
}

/**
 * Get identified tree obstacles for a hole. Used for shot physics only:
 * segment–tree intersection, clear-over (trajectory height vs tree height), deflection on hit.
 * All 18 holes have tree(s) identified; no separate marking required.
 */
export function getTreesForHole(holeNumber: number): TreeObstacle[] {
  const hole = getHoleByNumber(holeNumber);
  if (!hole) return [];
  return hole.features
    .filter((f): f is HoleFeature & { type: 'tree'; radius: number } => f.type === 'tree' && typeof f.radius === 'number')
    .map((f) => ({
      lat: f.coordinates.lat,
      lng: f.coordinates.lng,
      radiusMeters: f.radius,
      heightMeters: f.heightMeters ?? 10,
    }));
}

/** Circle (center + radius in meters) for lie detection and AI targeting */
export interface CircleFeature {
  center: { lat: number; lng: number };
  radiusMeters: number;
}

/** All hole features the AI uses: fairway, bunkers, green, water, trees. Radii in meters. */
export interface HoleFeaturesForAI {
  fairways: CircleFeature[];
  /** When present (editor data), use polygon containment for lie so "fairway around green" is always fairway. */
  fairwayPolygons?: { lat: number; lng: number }[][];
  bunkers: CircleFeature[];
  green: CircleFeature;
  /** Other holes' greens (in course boundary); ball on any green gets green lie. */
  otherGreens?: CircleFeature[];
  water: CircleFeature[];
  treeObstacles: TreeObstacle[];
}

const YARDS_TO_METERS = 0.9144;

function pointInPolygon(point: { lat: number; lng: number }, polygon: { lat: number; lng: number }[]): boolean {
  const x = point.lng;
  const y = point.lat;
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function isInCircle(
  point: { lat: number; lng: number },
  center: { lat: number; lng: number },
  radiusMeters: number
): boolean {
  const R = 6371e3;
  const φ1 = (point.lat * Math.PI) / 180;
  const φ2 = (center.lat * Math.PI) / 180;
  const Δφ = ((center.lat - point.lat) * Math.PI) / 180;
  const Δλ = ((center.lng - point.lng) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c <= radiusMeters;
}

/**
 * Get all course features for AI: fairways, bunkers, green (with radius), water, trees.
 * Used for lie detection, fairway targeting, bunker/water penalties, and putting.
 */
export function getHoleFeaturesForAI(holeNumber: number): HoleFeaturesForAI | null {
  const hole = getHoleByNumber(holeNumber);
  if (!hole) return null;
  const greenFeature = hole.features.find((f) => f.type === 'green');
  if (!greenFeature) return null;

  const toMeters = (yards: number) => yards * YARDS_TO_METERS;
  const fairways: CircleFeature[] = hole.features
    .filter((f): f is HoleFeature & { type: 'fairway'; radius: number } => f.type === 'fairway' && typeof f.radius === 'number')
    .map((f) => ({ center: { ...f.coordinates }, radiusMeters: toMeters(f.radius) }));

  const bunkers: CircleFeature[] = hole.features
    .filter((f): f is HoleFeature & { type: 'bunker'; radius: number } => f.type === 'bunker' && typeof f.radius === 'number')
    .map((f) => ({ center: { ...f.coordinates }, radiusMeters: toMeters(f.radius) }));

  const greenRadius = (greenFeature as HoleFeature & { radius?: number }).radius;
  const green: CircleFeature = {
    center: { ...greenFeature.coordinates },
    radiusMeters: toMeters(greenRadius ?? 10),
  };

  const water: CircleFeature[] = hole.features
    .filter((f): f is HoleFeature & { type: 'water'; radius: number } => f.type === 'water' && typeof f.radius === 'number')
    .map((f) => ({ center: { ...f.coordinates }, radiusMeters: toMeters(f.radius) }));

  return {
    fairways,
    bunkers,
    green,
    water,
    treeObstacles: getTreesForHole(holeNumber),
  };
}

/**
 * Determine lie from position (green > water > bunker > fairway > rough).
 * Fairway: when fairwayPolygons are present (editor data), check polygon containment first so
 * "everything around the green" drawn as fairway is always fairway; otherwise use fairway circles.
 */
export function getLieFromPosition(
  position: { lat: number; lng: number },
  features: HoleFeaturesForAI
): 'green' | 'water' | 'bunker' | 'fairway' | 'rough' {
  if (features.water.some((w) => isInCircle(position, w.center, w.radiusMeters))) return 'water';
  if (isInCircle(position, features.green.center, features.green.radiusMeters)) return 'green';
  if (features.otherGreens?.some((g) => isInCircle(position, g.center, g.radiusMeters))) return 'green';
  if (features.bunkers.some((b) => isInCircle(position, b.center, b.radiusMeters))) return 'bunker';
  // Editor fairway polygons take precedence so "fairway around green" is always fairway
  if (features.fairwayPolygons?.length) {
    for (const path of features.fairwayPolygons) {
      if (path.length >= 3 && pointInPolygon(position, path)) return 'fairway';
    }
  }
  if (features.fairways.some((f) => isInCircle(position, f.center, f.radiusMeters))) return 'fairway';
  return 'rough';
}
