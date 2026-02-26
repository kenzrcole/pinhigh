/**
 * AI mapping: first-pass mapping of a hole using OSM hazards and heuristic
 * fairway/green/trees, following patterns used for Lincoln Park and Golden Gate Park.
 */

import { HazardService } from './hazardService';
import type { Hazard } from '../types/smartCaddie';
import type {
  LatLng,
  HazardShape,
  HazardCircle,
  HazardType,
  TreeShape,
} from './courseEditorStore';

const METERS_TO_DEG_LAT = 1 / 111320;
function metersToDegLng(meters: number, centerLat: number): number {
  return meters / (111320 * Math.cos((centerLat * Math.PI) / 180));
}

function bboxFromTeeGreen(tee: LatLng, green: LatLng, paddingMeters: number) {
  const latPadding = paddingMeters * METERS_TO_DEG_LAT;
  const lngPadding = metersToDegLng(paddingMeters, (tee.lat + green.lat) / 2);
  return {
    south: Math.min(tee.lat, green.lat) - latPadding,
    north: Math.max(tee.lat, green.lat) + latPadding,
    west: Math.min(tee.lng, green.lng) - lngPadding,
    east: Math.max(tee.lng, green.lng) + lngPadding,
  };
}

/** Convert OSM Hazard (GeoJSON) to editor HazardShape. */
function osmHazardToEditorShape(osm: Hazard, id: string): HazardShape {
  const ring = osm.geometry.coordinates[0];
  if (!ring || ring.length < 3) {
    const center = { lat: 0, lng: 0 };
    return { id, type: 'bunker', shape: 'circle', center, radiusMeters: 8 };
  }
  const vertices: LatLng[] = ring.map((c) => ({ lat: c[1], lng: c[0] }));
  let editorType: HazardType = 'bunker';
  if (osm.type === 'water_hazard') editorType = 'water';
  else if (osm.type === 'bunker') editorType = 'bunker';
  // rough -> skip or treat as bunker; we treat as bunker for simplicity
  if (osm.type === 'rough') editorType = 'bunker';

  const n = vertices.length;
  if (n <= 8) {
    return {
      id,
      type: editorType,
      shape: 'polygon',
      vertices,
      ...(editorType === 'water' ? { stake: 'yellow' as const } : {}),
    };
  }
  const sumLat = vertices.reduce((a, v) => a + v.lat, 0);
  const sumLng = vertices.reduce((a, v) => a + v.lng, 0);
  const center = { lat: sumLat / n, lng: sumLng / n };
  const avgRadius =
    vertices.reduce((sum, v) => {
      const dLat = (v.lat - center.lat) / METERS_TO_DEG_LAT;
      const dLng = (v.lng - center.lng) / metersToDegLng(1, center.lat);
      return sum + Math.sqrt(dLat * dLat + dLng * dLng) * 111320;
    }, 0) / n;
  const radiusMeters = Math.max(5, Math.min(40, Math.round(avgRadius)));
  return {
    id,
    type: editorType,
    shape: 'circle',
    center,
    radiusMeters,
    ...(editorType === 'water' ? { stake: 'yellow' as const } : {}),
  } as HazardCircle;
}

/** Point at fraction t (0–1) along line from a to b. */
function lerp(a: LatLng, b: LatLng, t: number): LatLng {
  return {
    lat: a.lat + t * (b.lat - a.lat),
    lng: a.lng + t * (b.lng - a.lng),
  };
}

/** Perpendicular offset (meters) from point on line a->b at fraction t; side +1 = left, -1 = right. */
function perpendicularOffset(
  tee: LatLng,
  green: LatLng,
  t: number,
  offsetMeters: number,
  side: 1 | -1
): LatLng {
  const centerLat = (tee.lat + green.lat) / 2;
  const dx = (green.lng - tee.lng) * 111320 * Math.cos((centerLat * Math.PI) / 180);
  const dy = (green.lat - tee.lat) * 111320;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = (-dy / len) * (offsetMeters / 111320) / Math.cos((centerLat * Math.PI) / 180);
  const ny = (dx / len) * (offsetMeters / 111320);
  const p = lerp(tee, green, t);
  return {
    lat: p.lat + side * ny,
    lng: p.lng + side * nx,
  };
}

/** Generate heuristic fairway polygon (trapezoid along tee–green). */
function heuristicFairway(tee: LatLng, green: LatLng, widthMeters: number): LatLng[] {
  const half = widthMeters / 2;
  return [
    perpendicularOffset(tee, green, 0.1, half, -1),
    perpendicularOffset(tee, green, 0.1, half, 1),
    perpendicularOffset(tee, green, 0.9, half, 1),
    perpendicularOffset(tee, green, 0.9, half, -1),
  ];
}

/** Generate green boundary as polygon (regular circle around green). */
function heuristicGreenBoundary(green: LatLng, radiusMeters: number, points: number): LatLng[] {
  const centerLat = green.lat;
  const dLat = radiusMeters * METERS_TO_DEG_LAT;
  const dLng = metersToDegLng(radiusMeters, centerLat);
  const out: LatLng[] = [];
  for (let i = 0; i < points; i++) {
    const angle = (2 * Math.PI * i) / points;
    out.push({
      lat: green.lat + dLat * Math.cos(angle),
      lng: green.lng + dLng * Math.sin(angle),
    });
  }
  return out;
}

/** Heuristic tree positions (left/right of hole, like Lincoln Park tree line). */
function heuristicTrees(tee: LatLng, green: LatLng, offsetMeters: number): Omit<TreeShape, 'id'>[] {
  const centerLat = (tee.lat + green.lat) / 2;
  const left = perpendicularOffset(tee, green, 0.45, offsetMeters, 1);
  const right = perpendicularOffset(tee, green, 0.55, offsetMeters, -1);
  return [
    { center: left, radiusMeters: 6, heightMeters: 10 },
    { center: right, radiusMeters: 6, heightMeters: 10 },
  ];
}

export interface AIMappingResult {
  hazards: HazardShape[];
  trees: Omit<TreeShape, 'id'>[];
  fairwayPolygon: LatLng[];
  greenBoundaryPolygon: LatLng[];
}

/**
 * First-pass AI mapping for one hole: OSM hazards in bbox + heuristic fairway, green, trees.
 * Uses same visual patterns as Lincoln Park / Golden Gate Park (green fairway, green boundary, tree circles).
 */
export async function mapHoleWithAI(
  tee: LatLng,
  green: LatLng
): Promise<AIMappingResult> {
  const bbox = bboxFromTeeGreen(tee, green, 250);
  let hazards: Hazard[] = [];
  try {
    hazards = await HazardService.fetchHazards(bbox);
  } catch (_) {
    // OSM can fail; continue with heuristics only
  }

  const editorHazards: HazardShape[] = hazards.map((h, i) =>
    osmHazardToEditorShape(h, `ai_hazard_${Date.now()}_${i}`)
  );

  const fairwayPolygon = heuristicFairway(tee, green, 35);
  const greenBoundaryPolygon = heuristicGreenBoundary(green, 12, 12);
  const trees = heuristicTrees(tee, green, 28);

  return {
    hazards: editorHazards,
    trees,
    fairwayPolygon,
    greenBoundaryPolygon,
  };
}
