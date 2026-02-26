/**
 * Build HoleFeaturesForAI from course editor HoleOverride so the AI test run uses the edited layout.
 * When building for a hole, all mapping objects inside the course boundary are in play (including
 * adjacent holes' greens, bunkers, water, fairways) so e.g. hole 3's elements are in view and in play when playing hole 4.
 */

import type { HoleOverride, HazardShape, TreeShape, TreePatch, LatLng } from '../services/courseEditorStore';
import type { HoleFeaturesForAI, CircleFeature, TreeObstacle } from '../data/lincolnParkCourse';
import { getHoleOverride } from '../services/courseEditorStore';
import { isInBounds } from './courseLie';

function polygonToCircle(points: LatLng[]): CircleFeature {
  if (points.length === 0) return { center: { lat: 0, lng: 0 }, radiusMeters: 20 };
  const n = points.length;
  let sumLat = 0, sumLng = 0;
  for (const p of points) {
    sumLat += p.lat;
    sumLng += p.lng;
  }
  const center = { lat: sumLat / n, lng: sumLng / n };
  const R = 6371e3;
  const toRad = (x: number) => (x * Math.PI) / 180;
  let maxDist = 0;
  for (const p of points) {
    const φ1 = toRad(center.lat);
    const φ2 = toRad(p.lat);
    const Δφ = toRad(p.lat - center.lat);
    const Δλ = toRad(p.lng - center.lng);
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    if (d > maxDist) maxDist = d;
  }
  return { center, radiusMeters: Math.max(15, maxDist + 5) };
}

export function buildHoleFeaturesFromEditor(data: HoleOverride): HoleFeaturesForAI {
  const fairwayPaths = data.fairways ?? [];
  const fairways: CircleFeature[] = fairwayPaths.map((path) => polygonToCircle(path));
  const fairwayPolygons: { lat: number; lng: number }[][] =
    fairwayPaths.length > 0 ? fairwayPaths.map((path) => path.map((p) => ({ lat: p.lat, lng: p.lng }))) : undefined;
  const hazardToCircle = (h: HazardShape): CircleFeature => {
    if (h.shape === 'circle') return { center: { ...h.center }, radiusMeters: h.radiusMeters };
    return polygonToCircle(h.vertices);
  };
  const bunkers: CircleFeature[] = (data.hazards ?? [])
    .filter((h): h is HazardShape => h.type === 'bunker')
    .map(hazardToCircle);
  const water: CircleFeature[] = (data.hazards ?? [])
    .filter((h): h is HazardShape => h.type === 'water')
    .map(hazardToCircle);
  // Green: use greenBoundary polygon to get radius so putts near the edge count as "on green" (avoids putt→rough→chip loop).
  const green: CircleFeature =
    data.greenBoundary && data.greenBoundary.length >= 3
      ? polygonToCircle(data.greenBoundary)
      : { center: { ...data.green }, radiusMeters: 18 };
  const treeObstacles: TreeObstacle[] = [
    ...(data.trees ?? []).map((t: TreeShape) => ({
      lat: t.center.lat,
      lng: t.center.lng,
      radiusMeters: t.radiusMeters ?? 5,
      heightMeters: t.heightMeters ?? 10,
    })),
    ...(data.treePatches ?? []).map((p: TreePatch) => {
      const circle = polygonToCircle(p.vertices);
      return {
        lat: circle.center.lat,
        lng: circle.center.lng,
        radiusMeters: circle.radiusMeters,
        heightMeters: 12,
        vertices: [...p.vertices],
      };
    }),
  ];
  return { fairways, fairwayPolygons, bunkers, green, water, treeObstacles };
}

/** True if circle feature center is inside course boundary (or no boundary defined). */
function isFeatureInBounds(f: CircleFeature, courseName: string): boolean {
  return isInBounds(f.center, courseName);
}

/**
 * Build in-play features for one hole: current hole's features plus any other holes' mapping
 * objects that lie inside the course boundary. So when playing hole 4, hole 3's green/bunkers etc.
 * are in play if they're inside the boundary. Used for gameplay and batch tests.
 */
export function buildInPlayFeaturesForHole(
  courseName: string,
  holeNumber: number
): HoleFeaturesForAI | null {
  const currentOverride = getHoleOverride(courseName, holeNumber);
  if (!currentOverride) return null;

  const current = buildHoleFeaturesFromEditor(currentOverride);
  const fairways: CircleFeature[] = [...current.fairways];
  const bunkers: CircleFeature[] = [...current.bunkers];
  const water: CircleFeature[] = [...current.water];
  const otherGreens: CircleFeature[] = [];
  const treeObstacles: TreeObstacle[] = [...current.treeObstacles];

  for (let h = 1; h <= 18; h++) {
    if (h === holeNumber) continue;
    const override = getHoleOverride(courseName, h);
    if (!override) continue;
    const features = buildHoleFeaturesFromEditor(override);
    for (const f of features.fairways) {
      if (isFeatureInBounds(f, courseName)) fairways.push(f);
    }
    for (const b of features.bunkers) {
      if (isFeatureInBounds(b, courseName)) bunkers.push(b);
    }
    for (const w of features.water) {
      if (isFeatureInBounds(w, courseName)) water.push(w);
    }
    if (isFeatureInBounds(features.green, courseName)) otherGreens.push(features.green);
    for (const t of features.treeObstacles) {
      const center = { lat: t.lat, lng: t.lng };
      if (isInBounds(center, courseName)) treeObstacles.push(t);
    }
  }

  return {
    fairways,
    fairwayPolygons: current.fairwayPolygons,
    bunkers,
    green: current.green,
    otherGreens: otherGreens.length > 0 ? otherGreens : undefined,
    water,
    treeObstacles,
  };
}
