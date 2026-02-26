/**
 * Course Data for MVP
 * TypeScript interfaces and course definitions
 */

export interface Position {
  lat: number;
  lng: number;
}

/** One tee marker (e.g. Blue, White, Red) with position and optional scorecard yardage. */
export interface TeeMarker {
  name: string;
  position: Position;
  yardage?: number;
}

/** Per-tee summary from scorecard: total yardage, USGA course rating, slope rating. */
export interface TeeSetInfo {
  name: string;
  totalYardage: number;
  courseRating: number;
  slopeRating: number;
}

export interface Hazard {
  position: Position;
  type: 'bunker' | 'water' | 'rough' | 'trees' | 'out_of_bounds';
}

export interface Hole {
  holeNumber: number;
  par: number;
  handicap: number;
  /** Used when tees is empty or missing (single-tee courses). */
  teePosition: Position;
  greenPosition: Position;
  hazards: Hazard[];
  /** Official scorecard yardage when a single tee; ignored when tees[] is set. */
  yardage?: number;
  /** Multiple tee markers (e.g. Blue, White, Red). When set, overrides teePosition/yardage for that hole. */
  tees?: TeeMarker[];
}

export interface Course {
  name: string;
  location: string;
  holes: Hole[];
  /** True when course mapping (tee/green, boundary, hazards) is complete for MVP play. */
  mvpComplete?: boolean;
  /** Scorecard tee set summary (total yardage, course rating, slope). When set, used for tee picker and display. */
  teeSets?: TeeSetInfo[];
}

/** A club/venue that may have one or more golf courses. */
export interface Venue {
  name: string;
  location: string;
  courses: Course[];
}

/** Helper: one GGP hole with multiple tees (Blue, White, Red). Same position for all tees; yardages per scorecard. */
function ggpHole(
  holeNumber: number,
  handicap: number,
  teePos: Position,
  greenPos: Position,
  blueYds: number,
  whiteYds: number,
  redYds: number
): Hole {
  return {
    holeNumber,
    par: 3,
    handicap,
    teePosition: teePos,
    greenPosition: greenPos,
    hazards: [],
    tees: [
      { name: 'Blue', position: { ...teePos }, yardage: blueYds },
      { name: 'White', position: { ...teePos }, yardage: whiteYds },
      { name: 'Red', position: { ...teePos }, yardage: redYds },
    ],
  };
}

/**
 * Golden Gate Park Golf Course - San Francisco, CA
 * 9-hole par-3 executive course. Multiple tees per scorecard: Blue, White, Red.
 * @see https://www.goldengateparkgolf.com/scorecard/
 */
const GOLDEN_GATE_PARK_HOLES: Hole[] = [
  ggpHole(1, 4, { lat: 37.76854, lng: -122.50525 }, { lat: 37.76793, lng: -122.50505 }, 157, 164, 133),
  ggpHole(2, 6, { lat: 37.76780, lng: -122.50490 }, { lat: 37.76820, lng: -122.50470 }, 120, 131, 88),
  ggpHole(3, 9, { lat: 37.76840, lng: -122.50450 }, { lat: 37.76880, lng: -122.50430 }, 126, 109, 99),
  ggpHole(4, 2, { lat: 37.76900, lng: -122.50410 }, { lat: 37.76940, lng: -122.50390 }, 111, 178, 74),
  ggpHole(5, 1, { lat: 37.76960, lng: -122.50370 }, { lat: 37.77000, lng: -122.50350 }, 154, 183, 110),
  ggpHole(6, 8, { lat: 37.77020, lng: -122.50330 }, { lat: 37.77060, lng: -122.50310 }, 134, 113, 106),
  ggpHole(7, 5, { lat: 37.77080, lng: -122.50290 }, { lat: 37.77120, lng: -122.50270 }, 148, 163, 82),
  ggpHole(8, 7, { lat: 37.77140, lng: -122.50250 }, { lat: 37.77180, lng: -122.50230 }, 90, 123, 70),
  ggpHole(9, 3, { lat: 37.77200, lng: -122.50210 }, { lat: 37.77240, lng: -122.50190 }, 171, 193, 99),
];

/** GGP 9-hole totals from scorecard (Blue, White, Red). Rating/slope from course. */
const GGP_TEE_SETS: TeeSetInfo[] = [
  { name: 'Blue', totalYardage: 1211, courseRating: 36.0, slopeRating: 82 },
  { name: 'White', totalYardage: 1357, courseRating: 35.3, slopeRating: 80 },
  { name: 'Red', totalYardage: 861, courseRating: 34.0, slopeRating: 78 },
];

export const GOLDEN_GATE_PARK_COURSE: Course = {
  name: 'Golden Gate Park Golf Course',
  location: 'San Francisco, CA',
  holes: GOLDEN_GATE_PARK_HOLES,
  teeSets: GGP_TEE_SETS,
};

/** Lincoln Park scorecard: Blue, White, Red (yardage, rating, slope from scorecard). */
const LINCOLN_PARK_TEE_SETS: TeeSetInfo[] = [
  { name: 'Blue', totalYardage: 5146, courseRating: 65.9, slopeRating: 113 },
  { name: 'White', totalYardage: 4948, courseRating: 65.0, slopeRating: 107 },
  { name: 'Red', totalYardage: 4732, courseRating: 67.4, slopeRating: 113 },
];

/** Lincoln Park Golf Course - San Francisco, CA. 18 holes, par 68–72 by tee; full map data in lincolnParkCourse.ts. MVP mapping complete. */
export const LINCOLN_PARK_COURSE: Course = {
  name: 'Lincoln Park Golf Course',
  location: 'San Francisco, CA',
  holes: [] as Hole[], // Hole data in lincolnParkCourse.ts; map uses getHoleByNumber, getTeeAndGreen, etc.
  mvpComplete: true,
  teeSets: LINCOLN_PARK_TEE_SETS,
};

/** Generate 18-hole placeholder hole data (par 72) for mapping. Par 3s at 3,8,12,16; par 5s at 6,13,15,18; rest par 4. */
function make18HolePlaceholder(
  baseLat: number,
  baseLng: number,
  name: string
): Hole[] {
  const pars = [4, 4, 3, 4, 4, 5, 4, 3, 4, 4, 4, 3, 5, 4, 5, 3, 4, 5] as const;
  const hcps = [7, 5, 15, 11, 3, 1, 9, 17, 13, 4, 8, 12, 2, 6, 14, 18, 10, 16];
  const step = 0.0004;
  return pars.map((par, i) => {
    const t = i * 0.6;
    const tee = { lat: baseLat + Math.sin(t) * step * 8, lng: baseLng + Math.cos(t) * step * 8 };
    const green = { lat: tee.lat + step * 2, lng: tee.lng + step * 1.5 };
    return {
      holeNumber: i + 1,
      par,
      handicap: hcps[i],
      teePosition: tee,
      greenPosition: green,
      hazards: [],
    };
  });
}

/** Base position for TPC Harding Park (Lake Merced peninsula). Used to lay out holes for course map / AI mapping. */
const TPC_HARDING_BASE = { lat: 37.724, lng: -122.493 };

/** Build one TPC Harding Park hole: layout for map/AI, with par and yardage from official scorecard. */
function tpcHardingHole(
  holeNumber: number,
  par: number,
  yardage: number,
  handicap: number
): Hole {
  const step = 0.0004;
  const t = (holeNumber - 1) * 0.6;
  const tee = {
    lat: TPC_HARDING_BASE.lat + Math.sin(t) * step * 8,
    lng: TPC_HARDING_BASE.lng + Math.cos(t) * step * 8,
  };
  const green = { lat: tee.lat + step * 2, lng: tee.lng + step * 1.5 };
  return {
    holeNumber,
    par,
    handicap,
    teePosition: tee,
    greenPosition: green,
    yardage,
    hazards: [],
  };
}

/**
 * TPC Harding Park - San Francisco, CA. 18 holes, par 72, 7,169 yards (Championship tees).
 * Scorecard: https://tpc.com/hardingpark/scorecard/
 * Tee/green positions are layout placeholders for course map and AI mapping; use Course Editor to refine.
 */
const TPC_HARDING_PARK_HOLES: Hole[] = [
  tpcHardingHole(1, 4, 395, 7),   // Out
  tpcHardingHole(2, 4, 449, 5),
  tpcHardingHole(3, 3, 183, 15),
  tpcHardingHole(4, 5, 606, 11),
  tpcHardingHole(5, 4, 429, 3),
  tpcHardingHole(6, 4, 473, 1),
  tpcHardingHole(7, 4, 344, 9),
  tpcHardingHole(8, 3, 230, 17),
  tpcHardingHole(9, 5, 525, 13),
  tpcHardingHole(10, 5, 562, 4),  // In
  tpcHardingHole(11, 3, 200, 8),
  tpcHardingHole(12, 5, 494, 12),
  tpcHardingHole(13, 4, 428, 2),
  tpcHardingHole(14, 4, 467, 6),
  tpcHardingHole(15, 4, 405, 14),
  tpcHardingHole(16, 4, 336, 18),
  tpcHardingHole(17, 3, 175, 10),
  tpcHardingHole(18, 4, 468, 16),
];

/** TPC Harding Park scorecard: Tour, Blue, White, Gold, Red (yardage, rating, slope). */
const TPC_HARDING_TEE_SETS: TeeSetInfo[] = [
  { name: 'Tour', totalYardage: 7154, courseRating: 74.9, slopeRating: 136 },
  { name: 'Blue', totalYardage: 6845, courseRating: 72.8, slopeRating: 126 },
  { name: 'White', totalYardage: 6405, courseRating: 70.6, slopeRating: 123 },
  { name: 'Gold', totalYardage: 5375, courseRating: 70.4, slopeRating: 116 },
  { name: 'Red', totalYardage: 5875, courseRating: 73.4, slopeRating: 131 },
];

export const TPC_HARDING_PARK_COURSE: Course = {
  name: 'TPC Harding Park',
  location: 'San Francisco, CA',
  holes: TPC_HARDING_PARK_HOLES,
  teeSets: TPC_HARDING_TEE_SETS,
};

/** Fleming Course at TPC Harding Park - 9-hole. Placeholder hole data. */
const FLEMING_HOLES: Hole[] = make18HolePlaceholder(37.723, -122.494, 'Fleming').slice(0, 9);

/** Fleming 9-hole: single tee set (placeholder rating/slope). */
const FLEMING_TEE_SETS: TeeSetInfo[] = [
  { name: 'White', totalYardage: 2250, courseRating: 31.0, slopeRating: 95 },
];

export const FLEMING_COURSE: Course = {
  name: 'Fleming Course',
  location: 'San Francisco, CA',
  holes: FLEMING_HOLES,
  teeSets: FLEMING_TEE_SETS,
};

/** Half Moon Bay Golf Links - Ocean Course. 18 holes, par 72. Placeholder hole data; official: halfmoonbaygolf.com */
const HALF_MOON_BAY_OCEAN_HOLES: Hole[] = make18HolePlaceholder(37.4347, -122.4399, 'Ocean');

/** Half Moon Bay Ocean: placeholder tee set. */
const HALF_MOON_BAY_OCEAN_TEE_SETS: TeeSetInfo[] = [
  { name: 'Blue', totalYardage: 6850, courseRating: 72.5, slopeRating: 132 },
  { name: 'White', totalYardage: 6420, courseRating: 70.2, slopeRating: 126 },
];

export const HALF_MOON_BAY_OCEAN_COURSE: Course = {
  name: 'Half Moon Bay - Ocean Course',
  location: 'Half Moon Bay, CA',
  holes: HALF_MOON_BAY_OCEAN_HOLES,
  teeSets: HALF_MOON_BAY_OCEAN_TEE_SETS,
};

/** Half Moon Bay Golf Links - Old Course. 18 holes, par 72. Placeholder hole data; official: halfmoonbaygolf.com */
const HALF_MOON_BAY_OLD_HOLES: Hole[] = make18HolePlaceholder(37.436, -122.442, 'Old');

const HALF_MOON_BAY_OLD_TEE_SETS: TeeSetInfo[] = [
  { name: 'Blue', totalYardage: 6720, courseRating: 71.8, slopeRating: 128 },
  { name: 'White', totalYardage: 6310, courseRating: 69.6, slopeRating: 122 },
];

export const HALF_MOON_BAY_OLD_COURSE: Course = {
  name: 'Half Moon Bay - Old Course',
  location: 'Half Moon Bay, CA',
  holes: HALF_MOON_BAY_OLD_HOLES,
  teeSets: HALF_MOON_BAY_OLD_TEE_SETS,
};

/** All courses (flat list for editor, bounds, etc.). */
export const COURSES: Course[] = [
  LINCOLN_PARK_COURSE,
  GOLDEN_GATE_PARK_COURSE,
  TPC_HARDING_PARK_COURSE,
  FLEMING_COURSE,
  HALF_MOON_BAY_OCEAN_COURSE,
  HALF_MOON_BAY_OLD_COURSE,
];

/** Venues (clubs) with one or more courses. First screen shows one option per venue; multi-course venues get a follow-up course picker. */
export const VENUES: Venue[] = [
  { name: 'Lincoln Park Golf Course', location: 'San Francisco, CA', courses: [LINCOLN_PARK_COURSE] },
  { name: 'Golden Gate Park Golf Course', location: 'San Francisco, CA', courses: [GOLDEN_GATE_PARK_COURSE] },
  {
    name: 'TPC Harding Park',
    location: 'San Francisco, CA',
    courses: [TPC_HARDING_PARK_COURSE, FLEMING_COURSE],
  },
  {
    name: 'Half Moon Bay Golf Links',
    location: 'Half Moon Bay, CA',
    courses: [HALF_MOON_BAY_OCEAN_COURSE, HALF_MOON_BAY_OLD_COURSE],
  },
];
