/**
 * Lie Detection Module — FIG 3: Priority-order containment (water → green → bunker → fairway → rough).
 * Input: current coordinate and hole geometry (circles or polygons).
 */

export type LieType = 'LIE_WATER' | 'LIE_GREEN' | 'LIE_BUNKER' | 'LIE_FAIRWAY' | 'LIE_ROUGH';

export interface LatLng {
  lat: number;
  lng: number;
}

/** Circle region: center + radius in meters. */
export interface CircleRegion {
  type: 'circle';
  center: LatLng;
  radiusMeters: number;
}

/** Polygon region: closed ring [lat,lng] (first point = last). GeoJSON-style. */
export interface PolygonRegion {
  type: 'polygon';
  coordinates: LatLng[];
}

export type Region = CircleRegion | PolygonRegion;

export interface HoleGeoJSON {
  water: Region[];
  green: Region;
  bunker: Region[];
  fairway: Region[];
}

function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371e3;
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

function isInCircle(point: LatLng, region: CircleRegion): boolean {
  return haversineMeters(point, region.center) <= region.radiusMeters;
}

/** Ray-casting point-in-polygon (closed ring). */
function isInPolygon(point: LatLng, ring: LatLng[]): boolean {
  const { lat, lng } = point;
  const n = ring.length;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i].lng;
    const yi = ring[i].lat;
    const xj = ring[j].lng;
    const yj = ring[j].lat;
    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function contains(point: LatLng, region: Region): boolean {
  if (region.type === 'circle') return isInCircle(point, region);
  return isInPolygon(point, region.coordinates);
}

function inAny(point: LatLng, regions: Region[]): boolean {
  return regions.some((r) => contains(point, r));
}

/**
 * FIG 3: Lie detection in priority order.
 * 1. Is in Water? → LIE_WATER
 * 2. Is on Green? → LIE_GREEN
 * 3. Is in Bunker? → LIE_BUNKER
 * 4. Is on Fairway? → LIE_FAIRWAY
 * 5. Else → LIE_ROUGH
 */
export function detectLie(currentCoordinate: LatLng, holeGeoJSON: HoleGeoJSON): LieType {
  if (holeGeoJSON.water.length && inAny(currentCoordinate, holeGeoJSON.water)) return 'LIE_WATER';
  if (contains(currentCoordinate, holeGeoJSON.green)) return 'LIE_GREEN';
  if (holeGeoJSON.bunker.length && inAny(currentCoordinate, holeGeoJSON.bunker)) return 'LIE_BUNKER';
  if (holeGeoJSON.fairway.length && inAny(currentCoordinate, holeGeoJSON.fairway)) return 'LIE_FAIRWAY';
  return 'LIE_ROUGH';
}

/**
 * Convert circle-based HoleFeaturesForAI (Lincoln Park) to HoleGeoJSON for LieDetector.
 */
export function holeFeaturesToGeoJSON(features: {
  water: { center: LatLng; radiusMeters: number }[];
  green: { center: LatLng; radiusMeters: number };
  bunkers: { center: LatLng; radiusMeters: number }[];
  fairways: { center: LatLng; radiusMeters: number }[];
}): HoleGeoJSON {
  return {
    water: features.water.map((w) => ({ type: 'circle' as const, center: w.center, radiusMeters: w.radiusMeters })),
    green: { type: 'circle', center: features.green.center, radiusMeters: features.green.radiusMeters },
    bunker: features.bunkers.map((b) => ({ type: 'circle' as const, center: b.center, radiusMeters: b.radiusMeters })),
    fairway: features.fairways.map((f) => ({ type: 'circle' as const, center: f.center, radiusMeters: f.radiusMeters })),
  };
}

