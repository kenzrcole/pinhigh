/**
 * Course bounds and hole positions for Explore (full course map, hole-by-hole).
 */

import { getTeeAndGreen, getHoleByNumber } from '../data/lincolnParkCourse';
import type { TeeSetInfo } from '../data/courses';
import {
  LINCOLN_PARK_COURSE,
  GOLDEN_GATE_PARK_COURSE,
  TPC_HARDING_PARK_COURSE,
  HALF_MOON_BAY_OCEAN_COURSE,
  HALF_MOON_BAY_OLD_COURSE,
  COURSES,
} from '../data/courses';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface TeeGreen {
  tee: LatLng;
  green: LatLng;
}

function extendBounds(b: Bounds, lat: number, lng: number): void {
  b.north = Math.max(b.north, lat);
  b.south = Math.min(b.south, lat);
  b.east = Math.max(b.east, lng);
  b.west = Math.min(b.west, lng);
}

export function getCourseBounds(courseName: string): Bounds | null {
  const points = getCourseHolePositions(courseName);
  if (points.length === 0) return null;
  const b: Bounds = {
    north: points[0].lat,
    south: points[0].lat,
    east: points[0].lng,
    west: points[0].lng,
  };
  points.forEach((p) => extendBounds(b, p.lat, p.lng));
  return b;
}

/** Returns the primary tee position for a hole (for bounds/positions). Uses first tee in tees[] or teePosition. */
function getPrimaryTeePosition(h: { teePosition: LatLng; tees?: { name: string; position: LatLng }[] }): LatLng {
  if (h.tees && h.tees.length > 0) return h.tees[0].position;
  return h.teePosition;
}

export function getCourseHolePositions(courseName: string): LatLng[] {
  const out: LatLng[] = [];
  if (courseName === LINCOLN_PARK_COURSE.name) {
    for (let n = 1; n <= 18; n++) {
      const tg = getTeeAndGreen(n);
          if (tg) {
            out.push(tg.tee);
            out.push(tg.green);
          }
    }
    return out;
  }
  if (courseName === GOLDEN_GATE_PARK_COURSE.name) {
    GOLDEN_GATE_PARK_COURSE.holes.forEach((h) => {
      out.push(getPrimaryTeePosition(h));
      out.push(h.greenPosition);
    });
    return out;
  }
  if (courseName === TPC_HARDING_PARK_COURSE.name) {
    TPC_HARDING_PARK_COURSE.holes.forEach((h) => {
      out.push(h.teePosition);
      out.push(h.greenPosition);
    });
    return out;
  }
  if (courseName === HALF_MOON_BAY_OCEAN_COURSE.name) {
    HALF_MOON_BAY_OCEAN_COURSE.holes.forEach((h) => {
      out.push(h.teePosition);
      out.push(h.greenPosition);
    });
    return out;
  }
  if (courseName === HALF_MOON_BAY_OLD_COURSE.name) {
    HALF_MOON_BAY_OLD_COURSE.holes.forEach((h) => {
      out.push(h.teePosition);
      out.push(h.greenPosition);
    });
    return out;
  }
  const course = COURSES.find((c) => c.name === courseName);
  if (course?.holes?.length) {
    course.holes.forEach((h) => {
      out.push(getPrimaryTeePosition(h));
      out.push(h.greenPosition);
    });
  }
  return out;
}

/** Tee set names for a course (e.g. ['Blue', 'White', 'Red']). Empty if single-tee. */
export function getTeeSetNames(courseName: string): string[] {
  const course = COURSES.find((c) => c.name === courseName);
  if (course?.teeSets && course.teeSets.length > 0) {
    return course.teeSets.map((t) => t.name);
  }
  const firstHole = course?.holes?.[0];
  if (firstHole?.tees && firstHole.tees.length > 0) {
    return firstHole.tees.map((t) => t.name);
  }
  return [];
}

/** Tee set summary for a course (total yardage, course rating, slope). Returns undefined if no tee sets or index out of range. */
export function getTeeSetInfo(courseName: string, teeSetIndex: number): TeeSetInfo | undefined {
  const course = COURSES.find((c) => c.name === courseName);
  const sets = course?.teeSets;
  if (!sets?.length || teeSetIndex < 0 || teeSetIndex >= sets.length) return undefined;
  return sets[teeSetIndex];
}

/**
 * Tee and green for a hole. Uses explicit branches for known courses, then a generic
 * COURSES lookup so every course in COURSES (Lincoln Park, GGP, TPC Harding Park, Fleming,
 * Half Moon Bay Ocean/Old) resolves for hole 1..N. Ensures hole editor always has data.
 */
export function getTeeAndGreenForCourse(
  courseName: string,
  holeNumber: number,
  teeSetName?: string
): TeeGreen | null {
  if (courseName === LINCOLN_PARK_COURSE.name) {
    const tg = getTeeAndGreen(holeNumber);
    return tg ? { tee: tg.tee, green: tg.green } : null;
  }
  if (courseName === GOLDEN_GATE_PARK_COURSE.name) {
    const h = GOLDEN_GATE_PARK_COURSE.holes.find((x) => x.holeNumber === holeNumber);
    if (!h) return null;
    if (h.tees && h.tees.length > 0) {
      const tee = teeSetName ? h.tees.find((t) => t.name === teeSetName) : h.tees[0];
      if (tee) return { tee: tee.position, green: h.greenPosition };
    }
    return { tee: h.teePosition, green: h.greenPosition };
  }
  if (courseName === TPC_HARDING_PARK_COURSE.name) {
    const h = TPC_HARDING_PARK_COURSE.holes.find((x) => x.holeNumber === holeNumber);
    return h ? { tee: h.teePosition, green: h.greenPosition } : null;
  }
  if (courseName === HALF_MOON_BAY_OCEAN_COURSE.name) {
    const h = HALF_MOON_BAY_OCEAN_COURSE.holes.find((x) => x.holeNumber === holeNumber);
    return h ? { tee: h.teePosition, green: h.greenPosition } : null;
  }
  if (courseName === HALF_MOON_BAY_OLD_COURSE.name) {
    const h = HALF_MOON_BAY_OLD_COURSE.holes.find((x) => x.holeNumber === holeNumber);
    return h ? { tee: h.teePosition, green: h.greenPosition } : null;
  }
  // Generic fallback: any course in COURSES (e.g. Fleming Course, or if name comparison ever fails)
  const course = COURSES.find((c) => c.name === courseName);
  if (course?.holes?.length) {
    const h = course.holes.find((x) => x.holeNumber === holeNumber);
    if (h) {
      if (h.tees && h.tees.length > 0) {
        const tee = teeSetName ? h.tees.find((t) => t.name === teeSetName) : h.tees[0];
        if (tee) return { tee: tee.position, green: h.greenPosition };
      }
      return { tee: h.teePosition, green: h.greenPosition };
    }
  }
  return null;
}

export function getCourseHoleCount(courseName: string): number {
  if (courseName === LINCOLN_PARK_COURSE.name) return 18;
  if (courseName === GOLDEN_GATE_PARK_COURSE.name) return GOLDEN_GATE_PARK_COURSE.holes.length;
  if (courseName === TPC_HARDING_PARK_COURSE.name) return 18;
  if (courseName === HALF_MOON_BAY_OCEAN_COURSE.name) return 18;
  if (courseName === HALF_MOON_BAY_OLD_COURSE.name) return 18;
  const course = COURSES.find((c) => c.name === courseName);
  return course?.holes?.length ?? 0;
}

/** All holes with tee and green for overhead map. Pass teeSetName for multi-tee courses. */
export function getHolesForCourse(
  courseName: string,
  teeSetName?: string
): { number: number; tee: LatLng; green: LatLng }[] {
  const count = getCourseHoleCount(courseName);
  const out: { number: number; tee: LatLng; green: LatLng }[] = [];
  for (let n = 1; n <= count; n++) {
    const tg = getTeeAndGreenForCourse(courseName, n, teeSetName);
    if (tg) out.push({ number: n, tee: tg.tee, green: tg.green });
  }
  return out;
}

/** Par, optional yardage, and optional stroke index for a hole. Pass teeSetName for multi-tee courses. */
export function getHoleInfoForCourse(
  courseName: string,
  holeNumber: number,
  teeSetName?: string
): { par: number; yardage?: number; strokeIndex?: number } {
  if (courseName === LINCOLN_PARK_COURSE.name) {
    const hole = getHoleByNumber(holeNumber);
    return { par: hole?.par ?? 4, yardage: hole?.yardage, strokeIndex: hole?.strokeIndex };
  }
  const course = COURSES.find((c) => c.name === courseName);
  const hole = course?.holes?.find((h) => h.holeNumber === holeNumber);
  if (!hole) return { par: 4 };
  let yardage: number | undefined;
  if (hole.tees && hole.tees.length > 0) {
    const tee = teeSetName ? hole.tees.find((t) => t.name === teeSetName) : hole.tees[0];
    yardage = tee?.yardage;
  }
  if (yardage == null) {
    yardage =
      hole.yardage ??
      (hole.teePosition && hole.greenPosition
        ? Math.round(
            (6371e3 *
              2 *
              Math.asin(
                Math.sqrt(
                  Math.sin(((hole.greenPosition.lat - hole.teePosition.lat) * Math.PI) / 360) ** 2 +
                    Math.cos((hole.teePosition.lat * Math.PI) / 180) *
                      Math.cos((hole.greenPosition.lat * Math.PI) / 180) *
                      Math.sin(((hole.greenPosition.lng - hole.teePosition.lng) * Math.PI) / 360) ** 2
                )
              )) *
              1.09361
            )
        : undefined);
  }
  return { par: hole.par, yardage, strokeIndex: hole.handicap };
}

/**
 * Verification: every course in COURSES must resolve for hole 1 so the hole editor loads.
 * Call in tests or dev to catch regressions. Lincoln Park uses getTeeAndGreen(1) (external data).
 */
export function verifyAllCoursesResolveForHole1(): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  for (const course of COURSES) {
    const count = getCourseHoleCount(course.name);
    if (count === 0) continue;
    const tg = getTeeAndGreenForCourse(course.name, 1);
    if (!tg) failures.push(`${course.name}: getTeeAndGreenForCourse(name, 1) returned null`);
  }
  return { ok: failures.length === 0, failures };
}
