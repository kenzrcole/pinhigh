import { useRef, useCallback, useState, useMemo, useEffect } from 'react';
import { useJsApiLoader, GoogleMap, MarkerF, PolygonF, PolylineF } from '@react-google-maps/api';
import { getCourseBounds, getCourseHoleCount, getHolesForCourse } from '../services/courseBounds';
import {
  getTeeGreenOverride,
  getCourseBoundary,
  setCourseBoundary,
  addCourseBoundarySection,
  removeCourseBoundarySection,
} from '../services/courseEditorStore';
import type { LatLng } from '../services/courseBounds';
import { LINCOLN_PARK_COURSE } from '../data/courses';

const mapContainerStyle = { width: '100%', height: '100%' };

/** Google Maps ControlPosition: TOP_RIGHT = 2 — zoom, map type, and fullscreen in the upper-right corner. */
const CONTROL_POSITION_TOP_RIGHT = 2;

const mapOptions: google.maps.MapOptions = {
  zoomControl: true,
  zoomControlOptions: { position: CONTROL_POSITION_TOP_RIGHT },
  scrollwheel: true,
  gestureHandling: 'greedy',
  streetViewControl: false,
  mapTypeControl: true,
  mapTypeControlOptions: { position: CONTROL_POSITION_TOP_RIGHT },
  fullscreenControl: true,
  fullscreenControlOptions: { position: CONTROL_POSITION_TOP_RIGHT },
  minZoom: 14,
  maxZoom: 20,
  mapTypeId: 'satellite',
  tilt: 0,
};

/** Half-width of the corridor strip in degrees (~25m). */
const CORRIDOR_HALF_WIDTH = 0.00012;

function corridorPolygon(tee: LatLng, green: LatLng): LatLng[] {
  const dlat = green.lat - tee.lat;
  const dlng = green.lng - tee.lng;
  const len = Math.sqrt(dlat * dlat + dlng * dlng) || 1;
  const perpLat = (-dlng / len) * CORRIDOR_HALF_WIDTH;
  const perpLng = (dlat / len) * CORRIDOR_HALF_WIDTH;
  return [
    { lat: tee.lat + perpLat, lng: tee.lng + perpLng },
    { lat: tee.lat - perpLat, lng: tee.lng - perpLng },
    { lat: green.lat - perpLat, lng: green.lng - perpLng },
    { lat: green.lat + perpLat, lng: green.lng + perpLng },
  ];
}

function midpoint(a: LatLng, b: LatLng): LatLng {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

/** Centroid of a polygon (average of vertices) for placing section labels. */
function polygonCentroid(path: LatLng[]): LatLng {
  if (path.length === 0) return { lat: 0, lng: 0 };
  const n = path.length;
  let sumLat = 0;
  let sumLng = 0;
  for (const p of path) {
    sumLat += p.lat;
    sumLng += p.lng;
  }
  return { lat: sumLat / n, lng: sumLng / n };
}

/** Squared distance in degree space (for comparing with threshold² to avoid sqrt). */
function distSqDeg(a: LatLng, b: LatLng): number {
  const dlat = a.lat - b.lat;
  const dlng = a.lng - b.lng;
  return dlat * dlat + dlng * dlng;
}

const LABEL_SEP_DEG = 0.00035; // ~35–40 m so section and hole labels don't overlap
const NUDGE_DEG = 0.0004;

/** Section label positions nudged so they don't overlap hole labels or each other. */
function sectionLabelPositions(
  courseBoundary: LatLng[][],
  holes: { number: number; tee: LatLng; green: LatLng }[]
): LatLng[] {
  const holeMidpoints = holes.map((h) => midpoint(h.tee, h.green));
  const sepSq = LABEL_SEP_DEG * LABEL_SEP_DEG;
  const positions: LatLng[] = [];

  for (let i = 0; i < courseBoundary.length; i++) {
    let pos = polygonCentroid(courseBoundary[i]);
    const tooClose = (p: LatLng) => distSqDeg(pos, p) < sepSq;

    for (let pass = 0; pass < 8; pass++) {
      const conflict =
        holeMidpoints.find(tooClose) ??
        positions.slice(0, i).find(tooClose);
      if (!conflict) break;
      const dlat = pos.lat - conflict.lat;
      const dlng = pos.lng - conflict.lng;
      const len = Math.sqrt(dlat * dlat + dlng * dlng) || 1;
      pos = {
        lat: pos.lat + (dlat / len) * NUDGE_DEG,
        lng: pos.lng + (dlng / len) * NUDGE_DEG,
      };
    }
    positions.push(pos);
  }
  return positions;
}

export interface CourseOverheadMapViewProps {
  courseName: string;
  onBack: () => void;
  /** When set, corridors and hole labels are clickable and header shows "tap a hole to edit". When omitted, view is read-only (explore mode). */
  onSelectHole?: (holeNumber: number) => void;
}

function normalizePolygonPath(path: LatLng[]): LatLng[] {
  if (path.length < 2) return path;
  const first = path[0];
  const last = path[path.length - 1];
  if (first.lat === last.lat && first.lng === last.lng) return path;
  return [...path, { ...first }];
}

export function CourseOverheadMapView({
  courseName,
  onBack,
  onSelectHole,
}: CourseOverheadMapViewProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [boundaryRevision, setBoundaryRevision] = useState(0);
  const [boundaryDrawing, setBoundaryDrawing] = useState(false);
  const [boundaryPoints, setBoundaryPoints] = useState<LatLng[]>([]);
  const [boundarySavedFeedback, setBoundarySavedFeedback] = useState(false);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    id: 'google-map-script',
    preventGoogleFontsLoading: true,
  });

  const holeCount = getCourseHoleCount(courseName);
  const baseHoles = useMemo(() => getHolesForCourse(courseName), [courseName]);
  const holes = useMemo(() => {
    return baseHoles.map((h) => {
      const override = getTeeGreenOverride(courseName, h.number);
      return override ? { number: h.number, tee: override.tee, green: override.green } : h;
    });
  }, [courseName, baseHoles]);

  const boundsFromHoles =
    holes.length > 0
      ? holes.reduce(
          (b, { tee, green }) => ({
            north: Math.max(b.north, tee.lat, green.lat),
            south: Math.min(b.south, tee.lat, green.lat),
            east: Math.max(b.east, tee.lng, green.lng),
            west: Math.min(b.west, tee.lng, green.lng),
          }),
          {
            north: holes[0].tee.lat,
            south: holes[0].tee.lat,
            east: holes[0].tee.lng,
            west: holes[0].tee.lng,
          }
        )
      : null;
  /** Fallback bounds (Lincoln Park course area) when no holes or course unknown so map always loads. */
  const DEFAULT_BOUNDS = {
    north: 37.787,
    south: 37.782,
    east: -122.496,
    west: -122.503,
  };
  const courseBounds = getCourseBounds(courseName);
  const bounds = boundsFromHoles ?? courseBounds ?? DEFAULT_BOUNDS;
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    const b = boundsRef.current;
    if (b) {
      const latLngBounds = new google.maps.LatLngBounds(
        { lat: b.south, lng: b.west },
        { lat: b.north, lng: b.east }
      );
      map.fitBounds(latLngBounds, 50);
    }
  }, []);

  /** Ensure map fits course bounds after load (and when bounds/holes update) so holes are always visible. */
  useEffect(() => {
    const map = mapRef.current;
    const b = boundsRef.current;
    if (!map || !b || !isLoaded) return;
    const latLngBounds = new google.maps.LatLngBounds(
      { lat: b.south, lng: b.west },
      { lat: b.north, lng: b.east }
    );
    map.fitBounds(latLngBounds, 50);
  }, [isLoaded, bounds.north, bounds.south, bounds.east, bounds.west]);

  const isEditMode = typeof onSelectHole === 'function';

  /** Seed Lincoln Park with 18 default sections (tee–green corridors) when no boundary is saved, so sections always load by default. */
  useEffect(() => {
    if (courseName !== LINCOLN_PARK_COURSE.name) return;
    const saved = getCourseBoundary(courseName);
    if (saved.length > 0) return;
    const holeList = getHolesForCourse(courseName);
    if (holeList.length === 0) return;
    const defaultSections = holeList.map((h) => corridorPolygon(h.tee, h.green));
    setCourseBoundary(courseName, defaultSections);
    setBoundaryRevision((r) => r + 1);
  }, [courseName]);

  const courseBoundary = useMemo(
    () => getCourseBoundary(courseName),
    [courseName, boundaryRevision]
  );
  const sectionLabelPos = useMemo(
    () => sectionLabelPositions(courseBoundary, holes),
    [courseBoundary, holes]
  );
  const onMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!boundaryDrawing || !e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setBoundaryPoints((prev) => [...prev, { lat, lng }]);
    },
    [boundaryDrawing]
  );
  const finishBoundarySection = useCallback(() => {
    if (boundaryPoints.length < 3) return;
    addCourseBoundarySection(courseName, boundaryPoints);
    setBoundaryPoints([]);
    setBoundaryRevision((r) => r + 1);
    setBoundarySavedFeedback(true);
  }, [courseName, boundaryPoints]);

  useEffect(() => {
    if (!boundarySavedFeedback) return;
    const t = setTimeout(() => setBoundarySavedFeedback(false), 2500);
    return () => clearTimeout(t);
  }, [boundarySavedFeedback]);
  const removeBoundarySection = useCallback(
    (index: number) => {
      removeCourseBoundarySection(courseName, index);
      setBoundaryRevision((r) => r + 1);
    },
    [courseName]
  );

  if (!apiKey) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-900 text-red-400 p-4">
        <p className="font-semibold">Missing Google Maps API key</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 rounded-lg bg-slate-700 text-white">
          Back
        </button>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-900 text-red-400 p-4">
        <p className="font-semibold">Failed to load map</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 rounded-lg bg-slate-700 text-white">
          Back
        </button>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="h-full min-h-[50vh] w-full flex flex-col items-center justify-center gap-3 bg-slate-900 text-slate-300 p-4">
        <p className="text-base font-medium">Loading map…</p>
        <p className="text-sm text-slate-500">Course: {courseName}</p>
        <button
          onClick={onBack}
          className="mt-2 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium"
        >
          ← Back
        </button>
      </div>
    );
  }

  const center = bounds
    ? { lat: (bounds.north + bounds.south) / 2, lng: (bounds.east + bounds.west) / 2 }
    : { lat: 37.78, lng: -122.5 };
  const headerSubtitle = isEditMode
    ? `${holes.length} holes — tap a hole to edit`
    : `${holeCount} holes`;

  return (
    <div className="h-full min-h-0 w-full flex flex-col relative flex-1">
      <div className="absolute top-2 left-2 z-[1000] flex flex-col gap-1 max-w-[calc(100%-100px)]">
        <button
          onClick={onBack}
          className="self-start px-3 py-2 rounded-xl bg-slate-900/95 text-white font-medium shadow-lg"
        >
          ← Back
        </button>
        <span className="text-slate-300 text-sm font-medium truncate" title="Tap a hole on the map to edit it">
          {courseName} — {headerSubtitle}
        </span>
      </div>
      {isEditMode && (
        <div className="absolute left-2 top-20 bottom-2 z-[1000] w-56 flex flex-col gap-2 overflow-auto">
          <div className="rounded-xl bg-slate-900/95 text-white p-2 shadow-lg">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
              Course boundary
            </p>
            <p className="text-[10px] text-slate-300 mb-2">
              Draw in-bounds areas. Everything outside is OB unless marked (e.g. hazards). Sections are saved when you click Finish section.
            </p>
            {boundarySavedFeedback && (
              <p className="text-xs text-green-400 font-medium mb-1">Saved!</p>
            )}
            {boundaryDrawing ? (
              <div className="space-y-1.5">
                <p className="text-xs text-slate-300">
                  Tap map to add points. {boundaryPoints.length} points.
                </p>
                <div className="flex gap-1 flex-wrap">
                  <button
                    onClick={() => setBoundaryPoints((prev) => (prev.length > 0 ? prev.slice(0, -1) : prev))}
                    disabled={boundaryPoints.length === 0}
                    className="py-1.5 px-2 rounded-lg bg-slate-600 disabled:opacity-50 text-slate-300 text-xs"
                  >
                    Undo
                  </button>
                  <button
                    onClick={finishBoundarySection}
                    disabled={boundaryPoints.length < 3}
                    className="py-1.5 px-2 rounded-lg bg-green-600 disabled:opacity-50 text-white text-xs font-medium"
                  >
                    Finish section
                  </button>
                  <button
                    onClick={() => setBoundaryPoints([])}
                    className="py-1.5 px-2 rounded-lg bg-slate-600 text-slate-300 text-xs"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => {
                      setBoundaryDrawing(false);
                      setBoundaryPoints([]);
                    }}
                    className="py-1.5 px-2 rounded-lg bg-slate-600 text-slate-300 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={() => {
                    setBoundaryDrawing(true);
                    setBoundaryPoints([]);
                  }}
                  className="w-full py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-medium"
                >
                  Add section
                </button>
                {courseBoundary.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setBoundarySavedFeedback(true)}
                    className="w-full py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium border border-slate-600"
                  >
                    Save course boundary
                  </button>
                )}
                {courseBoundary.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {courseBoundary.map((section, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg bg-slate-800/70 border border-slate-700"
                      >
                        <span className="text-xs text-slate-300">
                          Section {i + 1} ({section.length} pts)
                        </span>
                        <button
                          onClick={() => removeBoundarySection(i)}
                          className="text-red-400 hover:text-red-300 text-xs shrink-0"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      )}
      <div className="flex-1 min-h-[300px] w-full">
        <GoogleMap
          mapContainerStyle={{ ...mapContainerStyle, position: 'absolute', inset: 0 }}
          center={center}
          zoom={15}
          options={mapOptions}
          onLoad={onMapLoad}
          onClick={onMapClick}
        >
          {courseBoundary.map((path, i) => (
            <PolygonF
              key={`course-boundary-${i}`}
              paths={[normalizePolygonPath(path)]}
              options={{
                fillColor: '#22c55e',
                fillOpacity: 0.2,
                strokeColor: '#16a34a',
                strokeWeight: 3,
                clickable: false,
                zIndex: 1,
              }}
            />
          ))}
          {courseBoundary.map((path, i) => (
            <MarkerF
              key={`section-label-${i}`}
              position={sectionLabelPos[i] ?? polygonCentroid(path)}
              zIndex={14}
              label={{
                text: `S${i + 1}`,
                color: '#fff',
                fontWeight: 'bold',
                fontSize: '14px',
              }}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 14,
                fillColor: '#16a34a',
                fillOpacity: 0.95,
                strokeColor: '#fff',
                strokeWeight: 2.5,
              }}
              cursor="default"
            />
          ))}
          {boundaryPoints.length >= 3 && (
            <PolygonF
              paths={[normalizePolygonPath(boundaryPoints)]}
              options={{
                fillColor: '#3b82f6',
                fillOpacity: 0.35,
                strokeColor: '#2563eb',
                strokeWeight: 2,
                clickable: false,
                zIndex: 4,
              }}
            />
          )}
          {boundaryPoints.length === 2 && (
            <PolylineF
              path={boundaryPoints}
              options={{
                geodesic: true,
                strokeColor: '#2563eb',
                strokeWeight: 2,
              }}
            />
          )}
          {boundaryPoints.map((p, i) => (
            <MarkerF
              key={`bp-${i}`}
              position={p}
              zIndex={5}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 6,
                fillColor: '#2563eb',
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 2,
              }}
            />
          ))}
          {holes.map(({ number, tee, green }) => (
            <PolygonF
              key={`corridor-${number}`}
              paths={corridorPolygon(tee, green)}
              options={{
                fillColor: '#22c55e',
                fillOpacity: 0.4,
                strokeColor: '#15803d',
                strokeWeight: 3,
                clickable: isEditMode && !boundaryDrawing,
                zIndex: 8,
              }}
              onClick={isEditMode && !boundaryDrawing ? () => onSelectHole!(number) : undefined}
            />
          ))}
          {holes.map(({ number, tee }) => (
            <MarkerF
              key={`tee-${number}`}
              position={tee}
              zIndex={12}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: '#1e3a5f',
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 3,
              }}
              cursor="default"
            />
          ))}
          {holes.map(({ number, green }) => (
            <MarkerF
              key={`green-${number}`}
              position={green}
              zIndex={12}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 9,
                fillColor: '#f0fdf4',
                fillOpacity: 1,
                strokeColor: '#0f766e',
                strokeWeight: 3,
              }}
              cursor="default"
            />
          ))}
          {holes.map(({ number, tee, green }) => (
            <MarkerF
              key={`label-${number}`}
              position={midpoint(tee, green)}
              label={{
                text: String(number),
                color: '#fff',
                fontWeight: 'bold',
                fontSize: '16px',
              }}
              zIndex={13}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 16,
                fillColor: '#15803d',
                fillOpacity: 0.95,
                strokeColor: '#fff',
                strokeWeight: 3,
              }}
              cursor={isEditMode ? 'pointer' : 'default'}
              onClick={isEditMode ? () => onSelectHole!(number) : undefined}
            />
          ))}
        </GoogleMap>
      </div>
    </div>
  );
}
