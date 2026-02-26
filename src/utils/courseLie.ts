/**
 * Lie and in-bounds from mapped course data.
 * Rule: inside course boundary = in bounds (then green > water > bunker > fairway > rough);
 * outside course boundary = out of bounds (OB).
 */

import { getCourseBoundary, getHoleOverride } from '../services/courseEditorStore';
import type { LatLng } from '../services/courseEditorStore';

function pointInPolygon(point: LatLng, polygon: LatLng[]): boolean {
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

function isInCircle(point: LatLng, center: LatLng, radiusMeters: number): boolean {
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

/** True if position is inside at least one course boundary polygon. */
export function isInBounds(position: LatLng, courseName: string): boolean {
  const boundary = getCourseBoundary(courseName);
  if (boundary.length === 0) return true; // no boundary defined => treat all as in bounds
  return boundary.some((poly) => poly.length >= 3 && pointInPolygon(position, poly));
}

/**
 * Lie from mapped course: OB if outside course boundary; else green > water > bunker > fairway > rough.
 * Uses editor overrides for the hole when present.
 */
export function getLieFromMappedCourse(
  position: LatLng,
  courseName: string,
  holeNumber: number
): 'green' | 'water' | 'bunker' | 'fairway' | 'rough' | 'ob' {
  if (!isInBounds(position, courseName)) return 'ob';

  const override = getHoleOverride(courseName, holeNumber);
  if (!override) return 'rough'; // no mapping => rough

  const greenCenter = override.green;
  const greenRadius =
    override.greenBoundary && override.greenBoundary.length >= 3
      ? (() => {
          const pts = override.greenBoundary!;
          let maxDist = 0;
          const R = 6371e3;
          for (const p of pts) {
            const φ1 = (greenCenter.lat * Math.PI) / 180;
            const φ2 = (p.lat * Math.PI) / 180;
            const Δφ = ((p.lat - greenCenter.lat) * Math.PI) / 180;
            const Δλ = ((p.lng - greenCenter.lng) * Math.PI) / 180;
            const a =
              Math.sin(Δφ / 2) ** 2 +
              Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            maxDist = Math.max(maxDist, R * c);
          }
          return maxDist + 5;
        })()
      : 18;

  if (isInCircle(position, greenCenter, greenRadius)) return 'green';

  for (const h of override.hazards ?? []) {
    if (h.type === 'water') {
      if (h.shape === 'circle' && isInCircle(position, h.center, h.radiusMeters)) return 'water';
      if (h.shape === 'polygon' && h.vertices.length >= 3 && pointInPolygon(position, h.vertices))
        return 'water';
    }
    if (h.type === 'bunker') {
      if (h.shape === 'circle' && isInCircle(position, h.center, h.radiusMeters)) return 'bunker';
      if (h.shape === 'polygon' && h.vertices.length >= 3 && pointInPolygon(position, h.vertices))
        return 'bunker';
    }
  }

  for (const path of override.fairways ?? []) {
    if (path.length >= 3 && pointInPolygon(position, path)) return 'fairway';
  }

  return 'rough';
}
