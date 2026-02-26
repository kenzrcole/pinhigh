/**
 * Golf club distances by handicap (yards).
 * Sources:
 * - HackMotion – Golf Club Distances by Handicap
 * - Golf Sidekick – Golf Club Distance Charts By Age, Gender And Skill Level
 *   https://www.golfsidekick.com/distance-finder/golf-club-distance-charts/
 *
 * Used to pick the club the AI "hit" based on shot distance and skill level.
 */

export type HandicapTier = 0 | 5 | 10 | 15 | 20 | 25;

export interface ClubDistances {
  driver: number;
  '3-wood': number;
  '4-hybrid': number;
  '4-iron': number;
  '5-iron': number;
  '6-iron': number;
  '7-iron': number;
  '8-iron': number;
  '9-iron': number;
  PW: number;
  GW: number;
  SW: number;
  LW: number;
  putter: number; // treat as 0–5 yd for selection
}

/** Long game + irons + wedges by handicap (yards). Putter = 0 for “on green” only. */
export const HACKMOTION_DISTANCES_BY_HANDICAP: Record<HandicapTier, ClubDistances> = {
  0: {
    driver: 280,
    '3-wood': 250,
    '4-hybrid': 230,
    '4-iron': 210,
    '5-iron': 195,
    '6-iron': 180,
    '7-iron': 165,
    '8-iron': 155,
    '9-iron': 145,
    PW: 135,
    GW: 120,
    SW: 105,
    LW: 85,
    putter: 0,
  },
  5: {
    driver: 265,
    '3-wood': 240,
    '4-hybrid': 220,
    '4-iron': 200,
    '5-iron': 185,
    '6-iron': 172,
    '7-iron': 165,
    '8-iron': 150,
    '9-iron': 140,
    PW: 130,
    GW: 115,
    SW: 95,
    LW: 75,
    putter: 0,
  },
  10: {
    driver: 255,
    '3-wood': 230,
    '4-hybrid': 210,
    '4-iron': 195,
    '5-iron': 180,
    '6-iron': 170,
    '7-iron': 160,
    '8-iron': 148,
    '9-iron': 138,
    PW: 125,
    GW: 110,
    SW: 90,
    LW: 70,
    putter: 0,
  },
  15: {
    driver: 235,
    '3-wood': 215,
    '4-hybrid': 195,
    '4-iron': 180,
    '5-iron': 170,
    '6-iron': 160,
    '7-iron': 150,
    '8-iron': 140,
    '9-iron': 130,
    PW: 120,
    GW: 105,
    SW: 85,
    LW: 65,
    putter: 0,
  },
  20: {
    driver: 220,
    '3-wood': 195,
    '4-hybrid': 180,
    '4-iron': 165,
    '5-iron': 155,
    '6-iron': 148,
    '7-iron': 142,
    '8-iron': 133,
    '9-iron': 125,
    PW: 110,
    GW: 95,
    SW: 80,
    LW: 60,
    putter: 0,
  },
  25: {
    driver: 200,
    '3-wood': 175,
    '4-hybrid': 160,
    '4-iron': 150,
    '5-iron': 140,
    '6-iron': 135,
    '7-iron': 130,
    '8-iron': 120,
    '9-iron': 110,
    PW: 100,
    GW: 85,
    SW: 70,
    LW: 50,
    putter: 0,
  },
};

/** Long to short so we pick the smallest club that carries at least the distance. */
const CLUB_ORDER: (keyof Omit<ClubDistances, 'putter'>)[] = [
  'driver',
  '3-wood',
  '4-hybrid',
  '4-iron',
  '5-iron',
  '6-iron',
  '7-iron',
  '8-iron',
  '9-iron',
  'PW',
  'GW',
  'SW',
  'LW',
];

function clubDisplayName(club: keyof Omit<ClubDistances, 'putter'>): string {
  switch (club) {
    case 'PW': return 'Pitching wedge';
    case 'GW': return 'Gap wedge';
    case 'SW': return 'Sand wedge';
    case 'LW': return 'Lob wedge';
    default: return club;
  }
}

/**
 * Pick the club name for a given distance (yards) and handicap tier.
 * Uses the smallest club that carries at least that distance (per HackMotion chart).
 * Beyond driver distance, returns Driver. Inside putter range, returns Putter.
 */
export function clubFromDistanceYards(
  distanceYards: number,
  handicap: HandicapTier
): string {
  const distances = HACKMOTION_DISTANCES_BY_HANDICAP[handicap];
  if (distanceYards <= 5) return 'Putter';
  if (distanceYards > distances.driver) return 'Driver';
  for (let i = CLUB_ORDER.length - 1; i >= 0; i--) {
    const club = CLUB_ORDER[i];
    const yd = distances[club];
    if (distanceYards <= yd) return clubDisplayName(club);
  }
  return 'Driver';
}

/**
 * Max distance in yards the player can hit for a given target distance and handicap.
 * Used to cap the AI’s shot so a 15 doesn’t “hit” 400 yd; they hit at most their driver distance.
 */
export function getMaxShotDistanceYards(
  distanceYards: number,
  handicap: HandicapTier
): number {
  const distances = HACKMOTION_DISTANCES_BY_HANDICAP[handicap];
  if (distanceYards <= 5) return 5;
  if (distanceYards > distances.driver) return distances.driver;
  for (let i = CLUB_ORDER.length - 1; i >= 0; i--) {
    const club = CLUB_ORDER[i];
    const yd = distances[club];
    if (distanceYards <= yd) return yd;
  }
  return distances.driver;
}

/**
 * Tiger Woods 2000 stock yardages (carry). Peak 2000–2002.
 * Driver 295–300, 3W 275, 2I 255, 3I 240, 4I 225, 5I 210, 6I 195, 7I 180, 8I 165, 9I 150,
 * PW 135, SW 120, LW 105. 4-hybrid slot used for 2-iron (255).
 */
export const TIGER_2000_YARDAGES: ClubDistances = {
  driver: 297,
  '3-wood': 275,
  '4-hybrid': 255,
  '4-iron': 225,
  '5-iron': 210,
  '6-iron': 195,
  '7-iron': 180,
  '8-iron': 165,
  '9-iron': 150,
  PW: 135,
  GW: 127,
  SW: 120,
  LW: 105,
  putter: 0,
};

/** Named character / tour profiles. Yardages from Golf Sidekick (PGA Tour, LPGA Tour, pros). GW/SW/LW interpolated from PW. */
export const CHARACTER_YARDAGES: Record<string, ClubDistances> = {
  'PGA Tour': {
    driver: 275,
    '3-wood': 243,
    '4-hybrid': 230,
    '4-iron': 203,
    '5-iron': 194,
    '6-iron': 183,
    '7-iron': 172,
    '8-iron': 160,
    '9-iron': 148,
    PW: 136,
    GW: 122,
    SW: 108,
    LW: 88,
    putter: 0,
  },
  'LPGA Tour': {
    driver: 255,
    '3-wood': 230,
    '4-hybrid': 215,
    '4-iron': 186,
    '5-iron': 175,
    '6-iron': 164,
    '7-iron': 153,
    '8-iron': 142,
    '9-iron': 130,
    PW: 118,
    GW: 104,
    SW: 90,
    LW: 70,
    putter: 0,
  },
  'D.B.': {
    driver: 325,
    '3-wood': 295,
    '4-hybrid': 275,
    '4-iron': 255,
    '5-iron': 235,
    '6-iron': 220,
    '7-iron': 205,
    '8-iron': 190,
    '9-iron': 175,
    PW: 160,
    GW: 146,
    SW: 132,
    LW: 112,
    putter: 0,
  },
  'J.D.': {
    driver: 312,
    '3-wood': 282,
    '4-hybrid': 267,
    '4-iron': 236,
    '5-iron': 225,
    '6-iron': 212,
    '7-iron': 200,
    '8-iron': 186,
    '9-iron': 172,
    PW: 158,
    GW: 144,
    SW: 130,
    LW: 110,
    putter: 0,
  },
  'M.R.': {
    driver: 360,
    '3-wood': 325,
    '4-hybrid': 300,
    '4-iron': 272,
    '5-iron': 256,
    '6-iron': 235,
    '7-iron': 222,
    '8-iron': 200,
    '9-iron': 188,
    PW: 169,
    GW: 155,
    SW: 141,
    LW: 121,
    putter: 0,
  },
  'N.J.': {
    driver: 250,
    '3-wood': 235,
    '4-hybrid': 220,
    '4-iron': 195,
    '5-iron': 180,
    '6-iron': 167,
    '7-iron': 155,
    '8-iron': 145,
    '9-iron': 130,
    PW: 120,
    GW: 106,
    SW: 92,
    LW: 72,
    putter: 0,
  },
};

/** Display names for character/tour profiles (for UI). Last-name initial first: D.B., J.D., M.R., N.J. */
export const AI_CHARACTER_NAMES = ['EW 2K', 'PGA Tour', 'LPGA Tour', 'D.B.', 'J.D.', 'M.R.', 'N.J.'] as const;
export type AICharacterName = (typeof AI_CHARACTER_NAMES)[number];

export function isTiger2000Skill(skillLevel: string | number): boolean {
  return skillLevel === 'EW 2K' || (typeof skillLevel === 'string' && (skillLevel.includes('Tiger') || skillLevel.includes('EW 2K')));
}

/** True if skill level is a named character/tour profile (has own yardages). */
export function isCharacterSkill(skillLevel: string | number): boolean {
  return typeof skillLevel === 'string' && skillLevel in CHARACTER_YARDAGES;
}

/** Resolve ClubDistances for any skill level (character name, EW 2K, or numeric handicap tier). */
export function getYardagesForSkill(skillLevel: string | number): ClubDistances {
  if (isTiger2000Skill(skillLevel)) return TIGER_2000_YARDAGES;
  if (typeof skillLevel === 'string' && skillLevel in CHARACTER_YARDAGES) return CHARACTER_YARDAGES[skillLevel];
  return HACKMOTION_DISTANCES_BY_HANDICAP[skillLevelToHandicapTier(skillLevel)];
}

/** Map numeric handicap to tier for club distance chart. Plus handicaps (≤0) use tier 0. */
export function handicapNumberToTier(handicap: number): HandicapTier {
  if (handicap <= 0) return 0;
  if (handicap <= 4) return 0;
  if (handicap <= 7) return 5;
  if (handicap <= 12) return 10;
  if (handicap <= 17) return 15;
  if (handicap <= 22) return 20;
  return 25;
}

/** Map skill level (string or numeric handicap) to handicap tier. Named characters use tier 0 for stats. */
export function skillLevelToHandicapTier(skillLevel: string | number): HandicapTier {
  if (typeof skillLevel === 'number') return handicapNumberToTier(skillLevel);
  if (isTiger2000Skill(skillLevel) || isCharacterSkill(skillLevel)) return 0;
  if (typeof skillLevel === 'string' && (skillLevel.includes('Pro') || skillLevel.includes('0'))) return 0;
  if (typeof skillLevel === 'string' && skillLevel.includes('10')) return 10;
  if (typeof skillLevel === 'string' && skillLevel.includes('15')) return 15;
  if (typeof skillLevel === 'string' && skillLevel.includes('20')) return 20;
  if (typeof skillLevel === 'string' && (skillLevel.includes('Beginner') || skillLevel.includes('25'))) return 25;
  return 5;
}

/**
 * Club for distance – uses character yardages or Tiger 2000 or tier by handicap.
 */
export function clubFromDistanceYardsForSkill(distanceYards: number, skillLevel: string | number): string {
  const distances = getYardagesForSkill(skillLevel);
  if (distanceYards <= 5) return 'Putter';
  if (distanceYards > distances.driver) return 'Driver';
  for (let i = CLUB_ORDER.length - 1; i >= 0; i--) {
    const club = CLUB_ORDER[i];
    const yd = distances[club];
    if (distanceYards <= yd) return clubDisplayName(club);
  }
  return 'Driver';
}

/**
 * Max shot distance for skill – uses character yardages or Tiger 2000 or tier.
 */
export function getMaxShotDistanceYardsForSkill(distanceYards: number, skillLevel: string | number): number {
  const distances = getYardagesForSkill(skillLevel);
  if (distanceYards <= 5) return 5;
  if (distanceYards > distances.driver) return distances.driver;
  for (let i = CLUB_ORDER.length - 1; i >= 0; i--) {
    const club = CLUB_ORDER[i];
    const yd = distances[club];
    if (distanceYards <= yd) return yd;
  }
  return distances.driver;
}

/** Selectable AI handicap values: +3, +1, 0, 1, 2, 3, 5, 7, 11, 13, 17, 19, 20 (plus stored as negative). */
export const AI_HANDICAP_OPTIONS: number[] = [-3, -1, 0, 1, 2, 3, 5, 7, 11, 13, 17, 19, 20];

export function formatHandicapDisplay(h: number): string {
  return h < 0 ? `+${Math.abs(h)}` : String(h);
}
