import { ClubStats } from '../types/smartCaddie';

/**
 * Standard club statistics for typical golfer.
 * Distances in meters, standard deviations based on PGA Tour ShotLink data.
 */
export const CLUB_DATABASE: ClubStats[] = [
  {
    name: 'Driver',
    meanDistance: 235,
    standardDeviation: 18,
    dispersionAngle: 0.25,
  },
  {
    name: '3-Wood',
    meanDistance: 210,
    standardDeviation: 15,
    dispersionAngle: 0.22,
  },
  {
    name: '5-Wood',
    meanDistance: 195,
    standardDeviation: 13,
    dispersionAngle: 0.20,
  },
  {
    name: '3-Iron',
    meanDistance: 185,
    standardDeviation: 12,
    dispersionAngle: 0.18,
  },
  {
    name: '4-Iron',
    meanDistance: 175,
    standardDeviation: 11,
    dispersionAngle: 0.17,
  },
  {
    name: '5-Iron',
    meanDistance: 165,
    standardDeviation: 10,
    dispersionAngle: 0.16,
  },
  {
    name: '6-Iron',
    meanDistance: 155,
    standardDeviation: 9,
    dispersionAngle: 0.15,
  },
  {
    name: '7-Iron',
    meanDistance: 145,
    standardDeviation: 8,
    dispersionAngle: 0.14,
  },
  {
    name: '8-Iron',
    meanDistance: 135,
    standardDeviation: 7,
    dispersionAngle: 0.13,
  },
  {
    name: '9-Iron',
    meanDistance: 125,
    standardDeviation: 6,
    dispersionAngle: 0.12,
  },
  {
    name: 'PW',
    meanDistance: 110,
    standardDeviation: 5,
    dispersionAngle: 0.11,
  },
  {
    name: 'GW',
    meanDistance: 95,
    standardDeviation: 4,
    dispersionAngle: 0.10,
  },
  {
    name: 'SW',
    meanDistance: 80,
    standardDeviation: 4,
    dispersionAngle: 0.09,
  },
  {
    name: 'LW',
    meanDistance: 65,
    standardDeviation: 3,
    dispersionAngle: 0.08,
  },
];

/**
 * Gets club by name from database.
 */
export function getClubByName(name: string): ClubStats | undefined {
  return CLUB_DATABASE.find((club) => club.name === name);
}

/**
 * Recommends optimal club based on distance to target.
 */
export function recommendClub(distanceMeters: number): ClubStats {
  let bestClub = CLUB_DATABASE[0];
  let minDiff = Math.abs(CLUB_DATABASE[0].meanDistance - distanceMeters);

  for (const club of CLUB_DATABASE) {
    const diff = Math.abs(club.meanDistance - distanceMeters);
    if (diff < minDiff) {
      minDiff = diff;
      bestClub = club;
    }
  }

  return bestClub;
}
