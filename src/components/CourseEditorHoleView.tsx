import { useRef, useEffect, useCallback, useState, useMemo, Fragment } from 'react';
import { useJsApiLoader, GoogleMap, Marker, Circle, Polygon } from '@react-google-maps/api';
import { getTeeAndGreenForCourse, getHoleInfoForCourse, getCourseBounds } from '../services/courseBounds';
import {
  getTeeGreenOverride,
  setTeeGreenOverride,
  getEffectiveHoleData,
  setHoleOverride,
  getHoleOverride,
  getCourseBoundary,
  addHazard,
  addHazardPolygon,
  removeHazard,
  updateHazardRadius,
  updateHazardStake,
  updateHazardObSide,
  addPin,
  removePin,
  updatePinPosition,
  addTree,
  addTreePatch,
  removeTree,
  removeTreePatch,
  updateTreePosition,
  updateTreeRadius,
  addFairway,
  removeFairway,
  setGreenBoundary,
  updateFairway,
  updateHazardCenter,
  updateHazardVertices,
  updateTreePatchVertices,
  discardHoleChanges,
  startHoleFromScratch,
  clearHoleFeaturesForAIMap,
  getPresets,
  saveAsPreset,
  loadPreset,
} from '../services/courseEditorStore';
import { mapHoleWithAI } from '../services/aiMappingService';
import { isInBounds } from '../utils/courseLie';
import type { HazardType, HazardStake, OBSide, HoleOverride } from '../services/courseEditorStore';
import { getCourseRatingAndSlope } from '../data/lincolnParkCourse';
import { AIGolfer, type ShotHistory } from '../utils/AIGolfer';
import { buildHoleFeaturesFromEditor } from '../utils/editorHoleToAI';
import { Pencil, RotateCcw, Trash2, Save, List, TreeDeciduous, Route, CircleDot, Undo2, Play, Sparkles } from 'lucide-react';

type LatLng = { lat: number; lng: number };

type UndoAction =
  | { type: 'removeHazard'; id: string }
  | { type: 'removeTree'; id: string }
  | { type: 'removeTreePatch'; id: string }
  | { type: 'popPolygonPoint' };

/** Return path as a single ring (vertices only). Strip duplicate closing point if present so Maps fills one interior. */
function normalizePolygonPath(path: LatLng[]): LatLng[] {
  if (path.length < 3) return path;
  const first = path[0];
  const last = path[path.length - 1];
  if (first && last && first.lat === last.lat && first.lng === last.lng) {
    return path.slice(0, -1);
  }
  return path;
}

function calculateBearing(from: LatLng, to: LatLng): number {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const bearing = Math.atan2(y, x);
  return ((bearing * 180) / Math.PI + 360) % 360;
}

function metersToDegrees(meters: number, centerLat: number): { lat: number; lng: number } {
  const degLat = meters / 111320;
  const degLng = meters / (111320 * Math.cos((centerLat * Math.PI) / 180));
  return { lat: degLat, lng: degLng };
}

/** Distance in meters between two points (Haversine). */
function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371e3;
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

function circlePath(center: LatLng, radiusMeters: number, numPoints = 24): LatLng[] {
  const deg = metersToDegrees(radiusMeters, center.lat);
  const path: LatLng[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = (2 * Math.PI * i) / numPoints;
    path.push({
      lat: center.lat + deg.lat * Math.cos(t),
      lng: center.lng + deg.lng * Math.sin(t),
    });
  }
  return path;
}

const mapContainerStyle = { width: '100%', height: '100%' };

const mapOptions: google.maps.MapOptions = {
  zoomControl: true,
  zoomControlOptions: { position: 5 }, // LEFT_TOP – keep right side clear for Hole Editor panel
  fullscreenControl: true,
  fullscreenControlOptions: { position: 5 }, // LEFT_TOP
  mapTypeControl: true,
  mapTypeControlOptions: { position: 5 }, // LEFT_TOP
  scrollwheel: true,
  gestureHandling: 'greedy',
  minZoom: 14,
  maxZoom: 20,
  mapTypeId: 'satellite',
  tilt: 0,
};

interface CourseEditorHoleViewProps {
  courseName: string;
  holeNumber: number;
  onBack: () => void;
}

function getEffectiveTeeGreen(courseName: string, holeNumber: number): { tee: LatLng; green: LatLng } | null {
  const override = getTeeGreenOverride(courseName, holeNumber);
  const base = getTeeAndGreenForCourse(courseName, holeNumber);
  const tg = override ?? base;
  return tg;
}

export function CourseEditorHoleView({ courseName, holeNumber, onBack }: CourseEditorHoleViewProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const fairwayPolylineRef = useRef<google.maps.Polyline | null>(null);
  /** Live path for each fairway/green while editing; prevents Polygon setPaths() from overwriting with stale effectiveData on re-render. */
  const fairwayPathRef = useRef<Record<number, LatLng[]>>({});
  const greenBoundaryPathRef = useRef<LatLng[] | null>(null);

  const baseTeeGreen = getEffectiveTeeGreen(courseName, holeNumber);
  const fallbackCenter = useMemo(() => {
    const bounds = getCourseBounds(courseName);
    if (bounds) {
      const lat = (bounds.north + bounds.south) / 2;
      const lng = (bounds.east + bounds.west) / 2;
      const dLat = (bounds.north - bounds.south) * 0.15;
      return { center: { lat, lng }, tee: { lat: lat - dLat, lng }, green: { lat: lat + dLat, lng } };
    }
    return { center: { lat: 37.7, lng: -122.4 }, tee: { lat: 37.699, lng: -122.4 }, green: { lat: 37.701, lng: -122.4 } };
  }, [courseName]);
  const [tee, setTee] = useState<LatLng>(baseTeeGreen?.tee ?? fallbackCenter.tee);
  const [green, setGreen] = useState<LatLng>(baseTeeGreen?.green ?? fallbackCenter.green);
  const [editMode, setEditMode] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [showPresets, setShowPresets] = useState(false);
  const [tool, setTool] = useState<'none' | 'hazard' | 'hazardPolygon' | 'tree' | 'treePatch' | 'fairway' | 'greenBoundary' | 'pin'>('none');
  const [hazardType, setHazardType] = useState<HazardType>('water');
  const [hazardStake, setHazardStake] = useState<HazardStake | null>(null);
  const [obSide, setObSide] = useState<OBSide | null>(null);
  const [polygonPoints, setPolygonPoints] = useState<LatLng[]>([]);
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [storeRevision, setStoreRevision] = useState(0);
  const [testRunShots, setTestRunShots] = useState<ShotHistory[] | null>(null);
  const [testRunKey, setTestRunKey] = useState(0);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [isAIMappingLoading, setIsAIMappingLoading] = useState(false);
  const [showOtherHolesOverlay, setShowOtherHolesOverlay] = useState(true);
  /** Bump to force hazard overlay remount so removed hazards don't persist on the map. */
  const [hazardOverlayRevision, setHazardOverlayRevision] = useState(0);
  /** True once map is ready so hole overlays can attach. */
  const [mapReady, setMapReady] = useState(false);
  /** True after mapReady + short delay so map context is set before Circle/Polygon mount (fixes trees/fairways not showing). */
  const [showOverlays, setShowOverlays] = useState(false);
  useEffect(() => {
    setMapReady(false);
    setShowOverlays(false);
  }, [courseName, holeNumber]);
  // Set mapReady: onLoad sets immediately; 600ms fallback when onLoad doesn't fire.
  useEffect(() => {
    if (mapReady) return;
    const t = setTimeout(() => setMapReady(true), 600);
    return () => clearTimeout(t);
  }, [courseName, holeNumber, mapReady]);
  // Delay overlay mount so map is in context when Circle/Polygon attach (fixes objects in panel but not on map).
  useEffect(() => {
    if (!mapReady) return;
    const t = setTimeout(() => setShowOverlays(true), 150);
    return () => clearTimeout(t);
  }, [mapReady]);
  // Sync tee/green from store when opening so saved override positions are used (fixes wrong center after refresh).
  useEffect(() => {
    const tg = getEffectiveTeeGreen(courseName, holeNumber);
    if (tg) {
      setTee(tg.tee);
      setGreen(tg.green);
    }
  }, [courseName, holeNumber]);
  const aiGolferRef = useRef<AIGolfer | null>(null);
  const pinMarkerRefs = useRef<Record<string, google.maps.Marker>>({});
  /** Latest pin positions so zoom/pan re-renders don't revert a pin before store revision flushes. */
  const pinPositionsRef = useRef<Record<string, LatLng>>({});
  /** When a pin was last dragged (by id). Skip overwriting ref from store briefly so drag isn't reverted. */
  const lastPinDragTimeRef = useRef<Record<string, number>>({});
  const hazardOverlaysRef = useRef<Map<string, google.maps.Circle | google.maps.Polygon>>(new Map());
  const treeOverlaysRef = useRef<Map<string, google.maps.Circle>>(new Map());
  const treePatchOverlaysRef = useRef<Map<string, google.maps.Polygon>>(new Map());
  const testRunOverlaysRef = useRef<(google.maps.Polyline | google.maps.Circle)[]>([]);

  // Initial map view (stable per course/hole). Pass this to GoogleMap so we don't create a control loop:
  // updating state from onCenterChanged/onZoomChanged would re-render and pass new center/zoom, causing the
  // library to call setCenter/setZoom again and fire the events again → "Maximum update depth exceeded".
  const initialMapView = useMemo(() => {
    const tg = getEffectiveTeeGreen(courseName, holeNumber);
    if (tg) {
      return {
        center: { lat: (tg.tee.lat + tg.green.lat) / 2, lng: (tg.tee.lng + tg.green.lng) / 2 },
        zoom: 17,
      };
    }
    const bounds = getCourseBounds(courseName);
    if (bounds) {
      return {
        center: { lat: (bounds.north + bounds.south) / 2, lng: (bounds.east + bounds.west) / 2 },
        zoom: 17,
      };
    }
    return { center: { lat: 37.7, lng: -122.4 }, zoom: 17 };
  }, [courseName, holeNumber]);

  const [mapView, setMapView] = useState<{ center: LatLng; zoom: number }>(initialMapView);

  // Sync map center/zoom from the map instance (for refs/read-only use). Does not feed back into map props.
  const syncMapViewFromMap = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    const z = map.getZoom();
    if (c && z != null) setMapView({ center: { lat: c.lat(), lng: c.lng() }, zoom: z });
  }, []);

  const refreshFromStore = useCallback(() => {
    syncMapViewFromMap();
    setStoreRevision((r) => r + 1);
  }, [syncMapViewFromMap]);

  const baseTg = getTeeAndGreenForCourse(courseName, holeNumber);
  const effectiveData = useMemo(
    () => getEffectiveHoleData(courseName, holeNumber, baseTg),
    [courseName, holeNumber, baseTg, storeRevision]
  );
  // storeRevision forces re-read from store when refreshFromStore() is called after mutations

  // Clear live-path refs when store has been refreshed so we use effectiveData again (stops fairway/green pins resetting)
  useEffect(() => {
    fairwayPathRef.current = {};
    greenBoundaryPathRef.current = null;
  }, [storeRevision]);

  // Keep pin positions ref in sync with store; skip overwriting a pin for a short time after drag so move isn't reverted
  const PIN_SYNC_SKIP_MS = 500;
  useEffect(() => {
    const pins = effectiveData.pins ?? [];
    const now = Date.now();
    pins.forEach((p) => {
      const lastDrag = lastPinDragTimeRef.current[p.id] ?? 0;
      if (now - lastDrag < PIN_SYNC_SKIP_MS) return;
      pinPositionsRef.current[p.id] = { ...p.position };
    });
  }, [effectiveData.pins, courseName, holeNumber]);

  // Other holes' mapping objects inside course boundary: show when editing this hole so e.g. hole 3 is in view when editing hole 4
  const { courseBoundaryPolys, otherHolesInBoundary } = useMemo(() => {
    const boundary = getCourseBoundary(courseName);
    const other: { holeNum: number; override: HoleOverride }[] = [];
    for (let h = 1; h <= 18; h++) {
      if (h === holeNumber) continue;
      const o = getHoleOverride(courseName, h);
      if (o) other.push({ holeNum: h, override: o });
    }
    return { courseBoundaryPolys: boundary, otherHolesInBoundary: other };
  }, [courseName, holeNumber, storeRevision]);

  const pathInBounds = useCallback(
    (path: LatLng[]) => path.length >= 3 && path.some((pt) => isInBounds(pt, courseName)),
    [courseName]
  );
  const pointInBounds = useCallback((p: LatLng) => isInBounds(p, courseName), [courseName]);

  // Sync from store when hole or course changes
  useEffect(() => {
    const tg = getEffectiveTeeGreen(courseName, holeNumber);
    if (tg) {
      setTee(tg.tee);
      setGreen(tg.green);
    }
  }, [courseName, holeNumber]);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    id: 'google-map-script',
    preventGoogleFontsLoading: true,
  });

  const holeInfo = getHoleInfoForCourse(courseName, holeNumber);
  const par = holeInfo.par;
  const yardage = holeInfo.yardage ?? 300;

  const applyMapForTeeGreen = useCallback((t: LatLng, g: LatLng, map: google.maps.Map) => {
    const center = { lat: (t.lat + g.lat) / 2, lng: (t.lng + g.lng) / 2 };
    map.setCenter(center);
    map.setHeading((calculateBearing(t, g) + 180) % 360);
    map.setTilt(0);
    map.setZoom(17);
    if (fairwayPolylineRef.current) fairwayPolylineRef.current.setMap(null);
    fairwayPolylineRef.current = new google.maps.Polyline({
      path: [t, g],
      geodesic: true,
      strokeColor: '#3b82f6',
      strokeOpacity: 0.8,
      strokeWeight: 4,
    });
    fairwayPolylineRef.current.setMap(map);
  }, []);

  // When hazards are removed (e.g. Undo or Remove), remove any leftover overlay from the map so circles don't persist.
  const hazardIdsKey = useMemo(
    () => (effectiveData.hazards ?? []).map((h) => h.id).sort().join(','),
    [effectiveData.hazards]
  );
  /** Remove one hazard's overlay from the map so it doesn't persist after Undo or Remove. */
  const removeHazardOverlayById = useCallback((id: string) => {
    const map = hazardOverlaysRef.current;
    const overlay = map.get(id);
    if (overlay) {
      try {
        overlay.setMap(null);
      } catch (_) {
        /* ignore */
      }
      map.delete(id);
    }
  }, []);

  const removeOrphanHazardOverlays = useCallback(() => {
    const override = getHoleOverride(courseName, holeNumber);
    const currentIds = new Set((override?.hazards ?? []).map((h) => h.id));
    const map = hazardOverlaysRef.current;
    for (const [id, overlay] of Array.from(map.entries())) {
      if (!currentIds.has(id)) {
        try {
          overlay.setMap(null);
        } catch (_) {
          // ignore if overlay already detached
        }
        map.delete(id);
      }
    }
  }, [courseName, holeNumber]);
  const treeIdsKey = useMemo(
    () => (effectiveData.trees ?? []).map((t) => t.id).sort().join(','),
    [effectiveData.trees]
  );
  const removeOrphanTreeOverlays = useCallback(() => {
    const override = getHoleOverride(courseName, holeNumber);
    const currentIds = new Set((override?.trees ?? []).map((t) => t.id));
    const map = treeOverlaysRef.current;
    for (const [id, overlay] of map) {
      if (!currentIds.has(id)) {
        try {
          overlay.setMap(null);
        } catch (_) {
          // ignore
        }
        map.delete(id);
      }
    }
  }, [courseName, holeNumber]);
  const treePatchIdsKey = useMemo(
    () => (effectiveData.treePatches ?? []).map((p) => p.id).sort().join(','),
    [effectiveData.treePatches]
  );
  const removeOrphanTreePatchOverlays = useCallback(() => {
    const override = getHoleOverride(courseName, holeNumber);
    const currentIds = new Set((override?.treePatches ?? []).map((p) => p.id));
    const map = treePatchOverlaysRef.current;
    for (const [id, overlay] of map) {
      if (!currentIds.has(id)) {
        try {
          overlay.setMap(null);
        } catch (_) {
          // ignore
        }
        map.delete(id);
      }
    }
  }, [courseName, holeNumber]);
  const onMapLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      const center = { lat: (tee.lat + green.lat) / 2, lng: (tee.lng + green.lng) / 2 };
      setMapView({ center, zoom: 17 });
      applyMapForTeeGreen(tee, green, map);
      removeOrphanHazardOverlays();
      removeOrphanTreeOverlays();
      removeOrphanTreePatchOverlays();
      setMapReady(true);
    },
    [applyMapForTeeGreen, tee.lat, tee.lng, green.lat, green.lng, removeOrphanHazardOverlays, removeOrphanTreeOverlays, removeOrphanTreePatchOverlays]
  );

  useEffect(() => {
    removeOrphanHazardOverlays();
    const t = setTimeout(removeOrphanHazardOverlays, 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hazardIdsKey encodes current hazard ids
  }, [hazardIdsKey, removeOrphanHazardOverlays]);
  useEffect(() => {
    removeOrphanTreeOverlays();
    const t = setTimeout(removeOrphanTreeOverlays, 50);
    return () => clearTimeout(t);
  }, [treeIdsKey, removeOrphanTreeOverlays]);
  useEffect(() => {
    removeOrphanTreePatchOverlays();
    const t = setTimeout(removeOrphanTreePatchOverlays, 50);
    return () => clearTimeout(t);
  }, [treePatchIdsKey, removeOrphanTreePatchOverlays]);
  // Clear hazard overlays on unmount
  useEffect(() => {
    return () => {
      hazardOverlaysRef.current.forEach((overlay) => {
        try {
          overlay.setMap(null);
        } catch (_) {
          // ignore
        }
      });
      hazardOverlaysRef.current.clear();
    };
  }, []);
  // Clear tree overlays on unmount
  useEffect(() => {
    return () => {
      treeOverlaysRef.current.forEach((overlay) => {
        try {
          overlay.setMap(null);
        } catch (_) {
          // ignore
        }
      });
      treeOverlaysRef.current.clear();
    };
  }, []);
  // Clear tree patch overlays on unmount
  useEffect(() => {
    return () => {
      treePatchOverlaysRef.current.forEach((overlay) => {
        try {
          overlay.setMap(null);
        } catch (_) {
          // ignore
        }
      });
      treePatchOverlaysRef.current.clear();
    };
  }, []);

  // Test run overlays: draw imperatively so we can clear previous run before drawing new one (avoids library leaving stale overlays)
  useEffect(() => {
    const map = mapRef.current;
    const overlays = testRunOverlaysRef.current;
    overlays.forEach((o) => {
      try {
        o.setMap(null);
      } catch (_) {
        // ignore
      }
    });
    overlays.length = 0;

    if (!map || !testRunShots || testRunShots.length === 0) return;

    const add = (overlay: google.maps.Polyline | google.maps.Circle) => {
      overlay.setMap(map);
      overlays.push(overlay);
    };

    for (const s of testRunShots) {
      const impact = s.treeImpactPosition;
      const solidPath = impact ? [s.fromPosition, impact] : [s.fromPosition, s.toPosition];
      add(
        new google.maps.Polyline({
          path: solidPath,
          geodesic: true,
          strokeColor: '#ffffff',
          strokeOpacity: 1,
          strokeWeight: 2.5,
          zIndex: 999,
          clickable: false,
        })
      );
      if (impact) {
        add(
          new google.maps.Polyline({
            path: [impact, s.toPosition],
            geodesic: true,
            strokeColor: '#ffffff',
            strokeOpacity: 0,
            strokeWeight: 0,
            icons: [{
              icon: { path: 'M 0,-1 0,1', strokeColor: '#ffffff', strokeOpacity: 0.9, scale: 1.2 },
              offset: '0',
              repeat: '5px',
            }],
            clickable: false,
          })
        );
      }
    }

    const spotRadius = 4;
    if (testRunShots.length > 0) {
      const origin = testRunShots[0].fromPosition;
      add(
        new google.maps.Circle({
          center: origin,
          radius: spotRadius,
          fillColor: '#fecaca',
          fillOpacity: 0.35,
          strokeColor: 'transparent',
          strokeWeight: 0,
          zIndex: 1000,
          clickable: false,
        })
      );
      add(
        new google.maps.Polyline({
          path: circlePath(origin, spotRadius),
          geodesic: false,
          strokeColor: '#ef4444',
          strokeOpacity: 0,
          strokeWeight: 0,
          icons: [{ icon: { path: 'M 0,-1 0,1', strokeColor: '#ef4444', strokeOpacity: 0.9, scale: 2 }, offset: '0', repeat: '8px' }],
          clickable: false,
        })
      );
    }
    for (const s of testRunShots) {
      const center = s.toPosition;
      add(
        new google.maps.Circle({
          center,
          radius: spotRadius,
          fillColor: '#fecaca',
          fillOpacity: 0.35,
          strokeColor: 'transparent',
          strokeWeight: 0,
          zIndex: 1000,
          clickable: false,
        })
      );
      add(
        new google.maps.Polyline({
          path: circlePath(center, spotRadius),
          geodesic: false,
          strokeColor: '#ef4444',
          strokeOpacity: 0,
          strokeWeight: 0,
          icons: [{ icon: { path: 'M 0,-1 0,1', strokeColor: '#ef4444', strokeOpacity: 0.9, scale: 2 }, offset: '0', repeat: '8px' }],
          clickable: false,
        })
      );
    }

    return () => {
      overlays.forEach((o) => {
        try {
          o.setMap(null);
        } catch (_) {
          // ignore
        }
      });
      overlays.length = 0;
    };
  }, [testRunShots, testRunKey]);

  // When switching holes (or course), clear test run overlays so the red circle doesn't persist on the new hole
  useEffect(() => {
    setTestRunShots(null);
    const overlays = testRunOverlaysRef.current;
    overlays.forEach((o) => {
      try {
        o.setMap(null);
      } catch (_) {
        /* ignore */
      }
    });
    overlays.length = 0;
  }, [courseName, holeNumber]);

  // Only recenter map when tee or green actually change (e.g. drag); do not change view while user is drawing a polygon
  useEffect(() => {
    if (!mapRef.current) return;
    if (polygonPoints.length > 0) return;
    const center = { lat: (tee.lat + green.lat) / 2, lng: (tee.lng + green.lng) / 2 };
    setMapView((prev) => ({ ...prev, center }));
    applyMapForTeeGreen(tee, green, mapRef.current);
  }, [tee.lat, tee.lng, green.lat, green.lng, applyMapForTeeGreen, polygonPoints.length]);

  const handleTeeDragEnd = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const newTee = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      setTee(newTee);
      setTeeGreenOverride(courseName, holeNumber, newTee, green);
    }
  };

  const handleGreenDragEnd = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const newGreen = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      setGreen(newGreen);
      setTeeGreenOverride(courseName, holeNumber, tee, newGreen);
    }
  };

  const lastTreeAddRef = useRef<number>(0);
  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    // Sync current map center/zoom into state before any updates so the next re-render doesn't reset the view
    syncMapViewFromMap();
    const latLng = { lat: e.latLng.lat(), lng: e.latLng.lng() };
    if (tool === 'hazard') {
      const radius = hazardType === 'water' ? 10 : hazardType === 'bunker' ? 4 : 8;
      const stake = hazardType === 'water' ? (hazardStake ?? undefined) : hazardType === 'out_of_bounds' ? (hazardStake ?? 'yellow') : undefined;
      const obSideVal = hazardType === 'out_of_bounds' && obSide ? obSide : undefined;
      const id = addHazard(courseName, holeNumber, effectiveData, { type: hazardType, center: latLng, radiusMeters: radius, stake, obSide: obSideVal });
      setUndoStack((prev) => [...prev, { type: 'removeHazard', id }]);
      setTool('none');
      refreshFromStore();
    } else if (tool === 'tree') {
      const now = Date.now();
      if (now - lastTreeAddRef.current < 400) return;
      lastTreeAddRef.current = now;
      const id = addTree(courseName, holeNumber, effectiveData, { center: latLng, radiusMeters: 5, heightMeters: 10 });
      setUndoStack((prev) => [...prev, { type: 'removeTree', id }]);
      refreshFromStore();
    } else if (tool === 'pin') {
      const id = addPin(courseName, holeNumber, latLng, effectiveData);
      setTool('none');
      refreshFromStore();
    } else if (tool === 'fairway' || tool === 'greenBoundary' || tool === 'hazardPolygon' || tool === 'treePatch') {
      setPolygonPoints((prev) => [...prev, latLng]);
      setUndoStack((s) => [...s, { type: 'popPolygonPoint' }]);
    }
  };

  const finishHazardPolygon = () => {
    if (polygonPoints.length < 3) return;
    const obSideVal = hazardType === 'out_of_bounds' && obSide ? obSide : undefined;
    const stakeVal = hazardType === 'water' ? (hazardStake ?? undefined) : hazardType === 'out_of_bounds' ? (hazardStake ?? 'yellow') : undefined;
    const id = addHazardPolygon(courseName, holeNumber, effectiveData, hazardType, polygonPoints, obSideVal, stakeVal);
    if (id) setUndoStack((prev) => [...prev, { type: 'removeHazard', id }]);
    setPolygonPoints([]);
    setUndoStack((s) => s.filter((a) => a.type !== 'popPolygonPoint'));
    setTool('none');
    refreshFromStore();
  };

  const finishTreePatch = () => {
    if (polygonPoints.length < 3) return;
    const id = addTreePatch(courseName, holeNumber, polygonPoints, effectiveData);
    if (id) setUndoStack((prev) => [...prev, { type: 'removeTreePatch', id }]);
    setPolygonPoints([]);
    setUndoStack((s) => s.filter((a) => a.type !== 'popPolygonPoint'));
    setTool('none');
    refreshFromStore();
  };

  const finishPolygon = (kind: 'fairway' | 'greenBoundary') => {
    if (polygonPoints.length < 3) return;
    // Store vertices only; Google Maps closes the path automatically and fills the interior
    if (kind === 'fairway') {
      addFairway(courseName, holeNumber, polygonPoints, effectiveData);
      setPolygonPoints([]);
      setUndoStack((s) => s.filter((a) => a.type !== 'popPolygonPoint'));
      // Stay in fairway tool so user can draw another fairway (e.g. other side of cart path)
    } else {
      setGreenBoundary(courseName, holeNumber, polygonPoints, effectiveData);
      setPolygonPoints([]);
      setUndoStack((s) => s.filter((a) => a.type !== 'popPolygonPoint'));
      setTool('none');
    }
  };

  const clearPolygonTool = () => {
    setPolygonPoints([]);
    setUndoStack((s) => s.filter((a) => a.type !== 'popPolygonPoint'));
    setTool('none');
  };

  const handleUndo = () => {
    const last = undoStack[undoStack.length - 1];
    if (!last) return;
    if (last.type === 'removeHazard') {
      const removedId = last.id;
      removeHazard(courseName, holeNumber, removedId);
      removeHazardOverlayById(removedId);
      setHazardOverlayRevision((r) => r + 1);
      setTestRunShots(null);
      refreshFromStore();
      removeOrphanHazardOverlays();
      setTimeout(removeOrphanHazardOverlays, 0);
      setTimeout(removeOrphanHazardOverlays, 50);
      setTimeout(removeOrphanHazardOverlays, 150);
    } else if (last.type === 'removeTree') {
      const removedId = last.id;
      removeTree(courseName, holeNumber, removedId);
      const treeMap = treeOverlaysRef.current;
      const overlay = treeMap.get(removedId);
      if (overlay) {
        try {
          overlay.setMap(null);
        } catch (_) {
          /* ignore */
        }
        treeMap.delete(removedId);
      }
      refreshFromStore();
      removeOrphanTreeOverlays();
      setTimeout(removeOrphanTreeOverlays, 50);
      setTimeout(removeOrphanTreeOverlays, 150);
    } else if (last.type === 'removeTreePatch') {
      const removedId = last.id;
      removeTreePatch(courseName, holeNumber, removedId);
      const patchMap = treePatchOverlaysRef.current;
      const overlay = patchMap.get(removedId);
      if (overlay) {
        try {
          overlay.setMap(null);
        } catch (_) {
          /* ignore */
        }
        patchMap.delete(removedId);
      }
      refreshFromStore();
      removeOrphanTreePatchOverlays();
      setTimeout(removeOrphanTreePatchOverlays, 50);
      setTimeout(removeOrphanTreePatchOverlays, 150);
    } else if (last.type === 'popPolygonPoint') {
      setPolygonPoints((prev) => prev.slice(0, -1));
    }
    setUndoStack((prev) => prev.slice(0, -1));
  };

  /** Stakes: yellow → amber, red → red. Water: stake or blue. Bunker → sand. */
  const getHazardDisplayColor = (type: HazardType, stake?: HazardStake | null): string => {
    if (type === 'out_of_bounds') {
      if (stake === 'red') return '#dc2626';
      if (stake === 'yellow') return '#ca8a04'; // amber/yellow
      return '#4b5563'; // legacy OB without stake
    }
    if (type === 'water') {
      if (stake === 'red') return '#dc2626';
      if (stake === 'yellow') return '#ca8a04';
      return '#0ea5e9'; // blue default
    }
    return '#d4a574'; // bunker sand
  };

  const runTestRun = useCallback(() => {
    setTestRunShots(null);
    setTestRunKey((k) => k + 1);
    setIsTestRunning(true);
    setTimeout(() => {
      try {
        const holeFeatures = buildHoleFeaturesFromEditor(effectiveData);
        const treeObstacles = holeFeatures.treeObstacles;
        const ratingSlope = getCourseRatingAndSlope(courseName);
        const opts = {
          holeFeatures,
          par: holeInfo.par,
          courseName,
          ...(ratingSlope && {
            courseRating: ratingSlope.courseRating,
            slopeRating: ratingSlope.slopeRating,
            totalPar: ratingSlope.totalPar,
          }),
        };
        if (!aiGolferRef.current) aiGolferRef.current = new AIGolfer(0, tee);
        aiGolferRef.current.reset(tee);
        // Par, course rating, and stroke index (hole difficulty) inform AI so competitor can plan accordingly.
        const shots = aiGolferRef.current.playHole(green, 20, treeObstacles, opts);
        setTestRunShots(shots);
      } catch (err) {
        console.error('Test run failed:', err);
      } finally {
        setIsTestRunning(false);
      }
    }, 80);
  }, [courseName, effectiveData, tee, green, holeInfo.par]);

  const handleDiscard = () => {
    discardHoleChanges(courseName, holeNumber);
    setTestRunShots(null);
    refreshFromStore();
    const tg = getEffectiveTeeGreen(courseName, holeNumber);
    if (tg) {
      setTee(tg.tee);
      setGreen(tg.green);
    }
    setUndoStack([]);
    setPolygonPoints([]);
    setEditMode(false);
    setHazardOverlayRevision((r) => r + 1);
    removeOrphanHazardOverlays();
    removeOrphanTreeOverlays();
    removeOrphanTreePatchOverlays();
    const testOverlays = testRunOverlaysRef.current;
    testOverlays.forEach((o) => {
      try {
        o.setMap(null);
      } catch (_) {
        /* ignore */
      }
    });
    testOverlays.length = 0;
    setTimeout(removeOrphanHazardOverlays, 0);
    setTimeout(removeOrphanHazardOverlays, 50);
  };

  const handleStartFromScratch = () => {
    startHoleFromScratch(courseName, holeNumber);
    setTestRunShots(null);
    refreshFromStore();
    const tg = getEffectiveTeeGreen(courseName, holeNumber);
    if (tg) {
      setTee(tg.tee);
      setGreen(tg.green);
    }
    setUndoStack([]);
    setPolygonPoints([]);
    setEditMode(false);
    setHazardOverlayRevision((r) => r + 1);
    removeOrphanHazardOverlays();
    removeOrphanTreeOverlays();
    removeOrphanTreePatchOverlays();
    const testOverlays = testRunOverlaysRef.current;
    testOverlays.forEach((o) => {
      try {
        o.setMap(null);
      } catch (_) {
        /* ignore */
      }
    });
    testOverlays.length = 0;
    setTimeout(removeOrphanHazardOverlays, 0);
    setTimeout(removeOrphanHazardOverlays, 50);
  };

  const handleAIMap = useCallback(async () => {
    setIsAIMappingLoading(true);
    try {
      const data = getEffectiveHoleData(courseName, holeNumber, baseTeeGreen ?? null);
      clearHoleFeaturesForAIMap(courseName, holeNumber, data);
      refreshFromStore();
      const result = await mapHoleWithAI(tee, green);
      let dataAfter = getEffectiveHoleData(courseName, holeNumber, baseTeeGreen ?? null);
      for (const h of result.hazards) {
        dataAfter = getEffectiveHoleData(courseName, holeNumber, baseTeeGreen ?? null);
        if (h.shape === 'circle') {
          addHazard(courseName, holeNumber, dataAfter, {
            type: h.type,
            center: h.center,
            radiusMeters: h.radiusMeters,
            stake: h.stake,
            obSide: h.obSide,
          });
        } else {
          addHazardPolygon(courseName, holeNumber, dataAfter, h.type, h.vertices, h.obSide, h.stake);
        }
      }
      dataAfter = getEffectiveHoleData(courseName, holeNumber, baseTeeGreen ?? null);
      for (const t of result.trees) {
        dataAfter = getEffectiveHoleData(courseName, holeNumber, baseTeeGreen ?? null);
        addTree(courseName, holeNumber, dataAfter, t);
      }
      dataAfter = getEffectiveHoleData(courseName, holeNumber, baseTeeGreen ?? null);
      addFairway(courseName, holeNumber, result.fairwayPolygon, dataAfter);
      dataAfter = getEffectiveHoleData(courseName, holeNumber, baseTeeGreen ?? null);
      setGreenBoundary(courseName, holeNumber, result.greenBoundaryPolygon, dataAfter);
      refreshFromStore();
      setHazardOverlayRevision((r) => r + 1);
    } catch (err) {
      console.error('AI mapping failed:', err);
    } finally {
      setIsAIMappingLoading(false);
    }
  }, [courseName, holeNumber, tee, green, baseTeeGreen, refreshFromStore]);

  const presets = getPresets(courseName);

  if (!apiKey) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-900 text-red-400 p-4">
        <p className="font-semibold">Missing Google Maps API key</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 rounded-lg bg-slate-700 text-white">Back</button>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-900 text-red-400 p-4">
        <p className="font-semibold">Failed to load map</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 rounded-lg bg-slate-700 text-white">Back</button>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900 text-slate-400">Loading map...</div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col relative">
      {/* Top bar: start right of map controls (zoom +/-, fullscreen, Map/Satellite) to avoid overlap */}
      <div className="absolute top-2 left-[5.5rem] right-2 z-[1000] flex items-center justify-between gap-2 pr-[14.5rem]">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="px-3 py-2 rounded-xl bg-slate-900/95 text-white font-medium shadow-lg"
          >
            ← Overhead
          </button>
          <span className="px-3 py-2 rounded-xl bg-slate-900/95 text-white text-sm font-medium">
            Hole {holeNumber} · Par {par} · {yardage} yds
          </span>
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/95 text-white font-medium shadow-lg disabled:opacity-50 disabled:pointer-events-none hover:bg-slate-800 transition"
            title="Undo last add"
          >
            <Undo2 className="w-4 h-4" />
            Undo
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        <GoogleMap
          key={`${courseName}-${holeNumber}`}
          mapContainerStyle={{ ...mapContainerStyle, position: 'absolute', inset: 0 }}
          center={initialMapView.center}
          zoom={initialMapView.zoom}
          options={mapOptions}
          onLoad={onMapLoad}
          onCenterChanged={syncMapViewFromMap}
          onZoomChanged={syncMapViewFromMap}
          onClick={tool !== 'none' ? handleMapClick : undefined}
        >
          {/* Tee–green line is drawn imperatively in applyMapForTeeGreen so it updates when tee/green are dragged (declarative Polyline path often doesn't update in this library). */}
          {/* Course boundary and other holes' in-boundary features (dimmed) so e.g. hole 3 is visible when editing hole 4 */}
          {showOtherHolesOverlay && courseBoundaryPolys.map((path, idx) =>
            path.length >= 3 ? (
              <Polygon
                key={`boundary-${idx}`}
                paths={[normalizePolygonPath(path)]}
                options={{
                  fillColor: '#22c55e',
                  fillOpacity: 0.06,
                  strokeColor: '#16a34a',
                  strokeOpacity: 0.5,
                  strokeWeight: 2,
                  clickable: false,
                  zIndex: 0,
                }}
              />
            ) : null
          )}
          {showOtherHolesOverlay && otherHolesInBoundary.map(({ holeNum, override }) => (
            <Fragment key={`other-hole-${holeNum}`}>
              {(override.fairways ?? []).filter((path) => pathInBounds(path)).map((path, idx) =>
                path.length >= 3 ? (
                  <Polygon
                    key={`other-fw-${holeNum}-${idx}`}
                    paths={[normalizePolygonPath(path)]}
                    options={{
                      fillColor: '#22c55e',
                      fillOpacity: 0.18,
                      strokeColor: '#16a34a',
                      strokeOpacity: 0.5,
                      strokeWeight: 1.5,
                      clickable: false,
                      zIndex: 1,
                    }}
                  />
                ) : null
              )}
              {override.greenBoundary && override.greenBoundary.length >= 3 && pathInBounds(override.greenBoundary) && (
                <Polygon
                  paths={[normalizePolygonPath(override.greenBoundary)]}
                  options={{
                    fillColor: '#dcfce7',
                    fillOpacity: 0.22,
                    strokeColor: '#0f766e',
                    strokeOpacity: 0.5,
                    strokeWeight: 1.5,
                    clickable: false,
                    zIndex: 2,
                  }}
                />
              )}
              {(override.hazards ?? []).map((h) => {
                const inBounds =
                  h.shape === 'circle' ? pointInBounds(h.center) : h.vertices.length >= 3 && pathInBounds(h.vertices);
                if (!inBounds) return null;
                const stakeForColor = 'stake' in h ? h.stake : undefined;
                const color = getHazardDisplayColor(h.type, stakeForColor);
                return h.shape === 'circle' ? (
                  <Circle
                    key={`other-h-${holeNum}-${h.id}`}
                    center={h.center}
                    radius={h.radiusMeters}
                    options={{
                      fillColor: color,
                      fillOpacity: 0.1,
                      strokeColor: color,
                      strokeOpacity: 0.35,
                      strokeWeight: 1.5,
                      clickable: false,
                      zIndex: 2,
                    }}
                  />
                ) : (
                  <Polygon
                    key={`other-h-${holeNum}-${h.id}`}
                    paths={[normalizePolygonPath(h.vertices)]}
                    options={{
                      fillColor: color,
                      fillOpacity: 0.1,
                      strokeColor: color,
                      strokeOpacity: 0.35,
                      strokeWeight: 1.5,
                      clickable: false,
                      zIndex: 2,
                    }}
                  />
                );
              })}
              {(override.trees ?? []).filter((t) => pointInBounds(t.center)).map((t) => (
                <Circle
                  key={`other-tree-${holeNum}-${t.id}`}
                  center={t.center}
                  radius={t.radiusMeters ?? 5}
                  options={{
                    fillColor: '#166534',
                    fillOpacity: 0.2,
                    strokeColor: '#14532d',
                    strokeOpacity: 0.5,
                    strokeWeight: 1.5,
                    clickable: false,
                    zIndex: 2,
                  }}
                />
              ))}
              {(override.treePatches ?? []).filter((p) => p.vertices.length >= 3 && pathInBounds(p.vertices)).map((p) => (
                <Polygon
                  key={`other-tp-${holeNum}-${p.id}`}
                  paths={[normalizePolygonPath(p.vertices)]}
                  options={{
                    fillColor: '#166534',
                    fillOpacity: 0.22,
                    strokeColor: '#14532d',
                    strokeOpacity: 0.5,
                    strokeWeight: 1.5,
                    clickable: false,
                    zIndex: 2,
                  }}
                />
              ))}
            </Fragment>
          ))}
          {showOverlays && (
          <Fragment key={`overlays-${courseName}-${holeNumber}`}>
          {(effectiveData.fairways ?? []).map((path, idx) => {
            const pathForDisplay = fairwayPathRef.current[idx] ?? path;
            const validPath = pathForDisplay.length >= 3 && pathForDisplay.every((p) => typeof p?.lat === 'number' && typeof p?.lng === 'number');
            return validPath ? (
              <Polygon
                key={`fairway-${idx}`}
                paths={[normalizePolygonPath(pathForDisplay)]}
                options={{
                  fillColor: '#22c55e',
                  fillOpacity: 0.35,
                  strokeColor: '#16a34a',
                  strokeWeight: 2,
                  clickable: true,
                  editable: true,
                  draggable: true,
                  zIndex: 3,
                }}
                onLoad={(polygon) => {
                  const p = polygon.getPath();
                  const sync = () => {
                    const arr = p.getArray();
                    const vertices = Array.from(arr).map((ll) => ({ lat: ll.lat(), lng: ll.lng() }));
                    if (vertices.length >= 3) {
                      fairwayPathRef.current[idx] = vertices;
                      updateFairway(courseName, holeNumber, idx, vertices);
                      refreshFromStore();
                    }
                  };
                  p.addListener('set_at', sync);
                  p.addListener('insert_at', sync);
                }}
              />
            ) : null;
          })}
          {(() => {
            const greenPath = greenBoundaryPathRef.current ?? effectiveData.greenBoundary ?? [];
            return greenPath.length >= 3 && (
            <Polygon
              key="greenBoundary"
              paths={[normalizePolygonPath(greenPath)]}
              options={{
                fillColor: '#dcfce7',
                fillOpacity: 0.5,
                strokeColor: '#0f766e',
                strokeWeight: 3,
                clickable: true,
                editable: true,
                draggable: true,
                zIndex: 5,
              }}
              onLoad={(polygon) => {
                const p = polygon.getPath();
                const sync = () => {
                  const arr = p.getArray();
                  const vertices = Array.from(arr).map((ll) => ({ lat: ll.lat(), lng: ll.lng() }));
                  if (vertices.length >= 3) {
                    greenBoundaryPathRef.current = vertices;
                    const data = getEffectiveHoleData(courseName, holeNumber, baseTeeGreen ?? null);
                    setGreenBoundary(courseName, holeNumber, vertices, data);
                    refreshFromStore();
                  }
                };
                p.addListener('set_at', sync);
                p.addListener('insert_at', sync);
              }}
            />
          );
          })()}
          <Fragment key={`hazards-${hazardOverlayRevision}-${(effectiveData.hazards ?? []).map((h) => h.id).join(',')}`}>
            {(effectiveData.hazards ?? []).map((h, hIdx) => {
              const stakeForColor = 'stake' in h ? h.stake : undefined;
              const color = getHazardDisplayColor(h.type, stakeForColor);
              const fillOpacity = h.type === 'water' ? 0.6 : h.type === 'out_of_bounds' ? 0.4 : 0.5;
              const hid = h.id;
              const hazardLabel =
                h.type === 'out_of_bounds' ? `OB${hIdx + 1}` : h.type === 'water' ? `W${hIdx + 1}` : `B${hIdx + 1}`;
              const hazardTitle =
                h.type === 'out_of_bounds'
                  ? `OB ${hIdx + 1} – drag to move, size/stake in panel`
                  : `${h.type} ${hIdx + 1} – drag to move, size in panel`;
              return h.shape === 'circle' ? (
                <Fragment key={hid}>
                  <Circle
                    center={h.center}
                    radius={h.radiusMeters}
                    options={{
                      fillColor: color,
                      fillOpacity,
                      strokeColor: color,
                      strokeWeight: 2,
                      clickable: true,
                      zIndex: 4,
                    }}
                    onLoad={(circle) => hazardOverlaysRef.current.set(hid, circle)}
                    onUnmount={(circle) => {
                      circle.setMap(null);
                      hazardOverlaysRef.current.delete(hid);
                    }}
                  />
                  <Marker
                    position={h.center}
                    zIndex={15}
                    draggable
                    cursor="move"
                    title={hazardTitle}
                    label={{
                      text: hazardLabel,
                      color: '#fff',
                      fontWeight: 'bold',
                      fontSize: '11px',
                    }}
                    icon={{
                      path: google.maps.SymbolPath.CIRCLE,
                      scale: 8,
                      fillColor: color,
                      fillOpacity: 0.95,
                      strokeColor: '#1f2937',
                      strokeWeight: 1.5,
                    }}
                    onDragEnd={(e) => {
                      if (e.latLng) {
                        updateHazardCenter(courseName, holeNumber, hid, { lat: e.latLng.lat(), lng: e.latLng.lng() });
                        refreshFromStore();
                      }
                    }}
                  />
                </Fragment>
              ) : (
                <Polygon
                  key={hid}
                  paths={[normalizePolygonPath(h.vertices)]}
                  options={{
                    fillColor: color,
                    fillOpacity,
                    strokeColor: color,
                    strokeWeight: 2,
                    clickable: true,
                    editable: true,
                    draggable: true,
                  }}
                  onLoad={(polygon) => {
                    hazardOverlaysRef.current.set(hid, polygon);
                    const path = polygon.getPath();
                    const sync = () => {
                      const arr = path.getArray();
                      const vertices = Array.from(arr).map((ll) => ({ lat: ll.lat(), lng: ll.lng() }));
                      if (vertices.length >= 3) updateHazardVertices(courseName, holeNumber, hid, vertices);
                      refreshFromStore();
                    };
                    path.addListener('set_at', sync);
                    path.addListener('insert_at', sync);
                  }}
                  onUnmount={(polygon) => {
                    polygon.setMap(null);
                    hazardOverlaysRef.current.delete(hid);
                  }}
                />
              );
            })}
          </Fragment>
          {(effectiveData.trees ?? []).filter((t) => typeof t.center?.lat === 'number' && typeof t.center?.lng === 'number').map((t, tIdx) => (
            <Fragment key={t.id}>
              <Circle
                center={t.center}
                radius={Math.max(2, Math.min(100, t.radiusMeters ?? 5))}
                options={{
                  fillColor: '#166534',
                  fillOpacity: 0.35,
                  strokeColor: '#14532d',
                  strokeWeight: 2,
                  clickable: true,
                  zIndex: 4,
                }}
                onLoad={(circle) => treeOverlaysRef.current.set(t.id, circle)}
                onUnmount={(circle) => {
                  circle.setMap(null);
                  treeOverlaysRef.current.delete(t.id);
                }}
              />
              <Marker
                position={t.center}
                zIndex={16}
                draggable={true}
                cursor="move"
                title={`Tree ${tIdx + 1} – drag to move, size in panel`}
                label={{
                  text: `T${tIdx + 1}`,
                  color: '#fff',
                  fontWeight: 'bold',
                  fontSize: '11px',
                }}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 8,
                  fillColor: '#166534',
                  fillOpacity: 0.95,
                  strokeColor: '#1f2937',
                  strokeWeight: 1.5,
                }}
                onDragEnd={(e) => {
                  if (e.latLng) {
                    updateTreePosition(courseName, holeNumber, t.id, {
                      lat: e.latLng.lat(),
                      lng: e.latLng.lng(),
                    });
                    refreshFromStore();
                  }
                }}
              />
            </Fragment>
          ))}
          {(effectiveData.treePatches ?? []).map((p) => (
            <Polygon
              key={p.id}
              paths={[normalizePolygonPath(p.vertices)]}
              options={{
                fillColor: '#166534',
                fillOpacity: 0.4,
                strokeColor: '#14532d',
                strokeWeight: 2,
                clickable: true,
                editable: true,
                draggable: true,
              }}
              onLoad={(polygon) => {
                treePatchOverlaysRef.current.set(p.id, polygon);
                const path = polygon.getPath();
                const sync = () => {
                  const arr = path.getArray();
                  const vertices = Array.from(arr).map((ll) => ({ lat: ll.lat(), lng: ll.lng() }));
                  if (vertices.length >= 3) updateTreePatchVertices(courseName, holeNumber, p.id, vertices);
                  refreshFromStore();
                };
                path.addListener('set_at', sync);
                path.addListener('insert_at', sync);
              }}
              onUnmount={(polygon) => {
                polygon.setMap(null);
                treePatchOverlaysRef.current.delete(p.id);
              }}
            />
          ))}
          {polygonPoints.length > 0 && (
            <>
              {tool === 'hazardPolygon' ? (
                <Polygon
                  paths={[polygonPoints]}
                  options={{
                    fillColor: getHazardDisplayColor(hazardType, hazardStake),
                    fillOpacity: hazardType === 'water' ? 0.6 : hazardType === 'out_of_bounds' ? 0.4 : 0.5,
                    strokeColor: getHazardDisplayColor(hazardType, hazardStake),
                    strokeWeight: 2,
                    clickable: false,
                  }}
                />
              ) : tool === 'treePatch' ? (
                <Polygon
                  paths={[polygonPoints]}
                  options={{
                    fillColor: '#166534',
                    fillOpacity: 0.4,
                    strokeColor: '#14532d',
                    strokeWeight: 2,
                    clickable: false,
                  }}
                />
              ) : polygonPoints.length >= 3 || polygonPoints.length > 0 ? (
                <Polygon
                  paths={[polygonPoints]}
                  options={{
                    fillColor: tool === 'fairway' ? '#22c55e' : tool === 'greenBoundary' ? '#dcfce7' : '#64748b',
                    fillOpacity: 0.35,
                    strokeColor: tool === 'fairway' ? '#16a34a' : tool === 'greenBoundary' ? '#0f766e' : '#475569',
                    strokeWeight: 2,
                    clickable: false,
                  }}
                />
              ) : null}
              {polygonPoints.map((p, i) => (
                <Marker
                  key={i}
                  position={p}
                  zIndex={100}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 6,
                    fillColor: '#fff',
                    fillOpacity: 1,
                    strokeColor: '#0f172a',
                    strokeWeight: 2,
                  }}
                />
              ))}
            </>
          )}
          <Marker
            position={tee}
            label={{ text: 'T', color: 'white', fontWeight: 'bold', fontSize: '12px' }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 14,
              fillColor: '#1e3a5f',
              fillOpacity: 1,
              strokeColor: '#fff',
              strokeWeight: 2,
            }}
            zIndex={1000}
            draggable={editMode}
            onDragEnd={handleTeeDragEnd}
          />
          <Marker
            position={green}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 12,
              fillColor: '#f0fdf4',
              fillOpacity: 1,
              strokeColor: '#0f766e',
              strokeWeight: 2,
            }}
            zIndex={1000}
            draggable={editMode}
            onDragEnd={handleGreenDragEnd}
          />
          {(effectiveData.pins ?? []).map((pin) => (
            <Marker
              key={pin.id}
              position={pinPositionsRef.current[pin.id] ?? pin.position}
              draggable
              onLoad={(marker) => {
                pinMarkerRefs.current[pin.id] = marker;
              }}
              onDragEnd={() => {
                const marker = pinMarkerRefs.current[pin.id];
                if (marker) {
                  const pos = marker.getPosition();
                  if (pos) {
                    const newPos = { lat: pos.lat(), lng: pos.lng() };
                    pinPositionsRef.current[pin.id] = newPos;
                    lastPinDragTimeRef.current[pin.id] = Date.now();
                    updatePinPosition(courseName, holeNumber, pin.id, newPos);
                    refreshFromStore();
                  }
                }
              }}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: '#fef08a',
                fillOpacity: 1,
                strokeColor: '#ca8a04',
                strokeWeight: 2,
              }}
              zIndex={1001}
              cursor="grab"
            />
          ))}
          </Fragment>
          )}
          {/* Test run shot tracers and landing circles are drawn imperatively in useEffect so previous run is cleared before new one */}
        </GoogleMap>
      </div>

      {/* Side panel: Edit, Start from scratch, Discard, Presets */}
      <div className="absolute right-2 top-14 bottom-2 w-56 z-[1000] flex flex-col overflow-hidden shadow-xl">
        <div className="bg-slate-900/95 backdrop-blur-sm rounded-xl border border-slate-700 flex-1 min-h-0 flex flex-col overflow-hidden">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-3 pt-3 pb-2 border-b border-slate-700 shrink-0">
            Hole editor
          </p>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            <label className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-800/50 cursor-pointer">
              <input
                type="checkbox"
                checked={showOtherHolesOverlay}
                onChange={(e) => setShowOtherHolesOverlay(e.target.checked)}
                className="rounded accent-green-500"
              />
              <span className="text-[10px] text-slate-300">Show other holes (in boundary)</span>
            </label>
            <button
              onClick={() => setEditMode((e) => !e)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition ${
                editMode
                  ? 'bg-green-600/30 border-green-500 text-white'
                  : 'bg-slate-800/80 border-slate-600 text-slate-300 hover:border-slate-500'
              }`}
            >
              <Pencil className="w-4 h-4" />
              {editMode ? 'Edit mode on — drag tee or green' : 'Edit tee & green'}
            </button>

            <button
              onClick={runTestRun}
              disabled={isTestRunning}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-600 bg-slate-800/80 text-slate-300 hover:border-slate-500 hover:bg-slate-700/80 text-sm font-medium transition disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              {isTestRunning ? 'Running…' : 'Test run (0 HCP)'}
            </button>

            <div className="border-t border-slate-700 pt-2 mt-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1 mb-1.5">Pins</p>
              <p className="text-[10px] text-slate-500 px-1 mb-1.5">Multiple hole positions. Add pins, then drag to reposition. Green center is the default.</p>
              <button
                onClick={() => setTool(tool === 'pin' ? 'none' : 'pin')}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition ${
                  tool === 'pin' ? 'bg-green-600/30 border-green-500 text-white' : 'bg-slate-800/80 border-slate-600 text-slate-300 hover:border-slate-500'
                }`}
              >
                <CircleDot className="w-4 h-4" />
                {tool === 'pin' ? 'Tap map to place pin' : 'Add pin'}
              </button>
              {(effectiveData.pins ?? []).length > 0 && (
                <div className="mt-1.5 space-y-1 max-h-24 overflow-y-auto">
                  {(effectiveData.pins ?? []).map((pin, idx) => (
                    <div key={pin.id} className="flex items-center justify-between gap-1 px-2 py-1.5 rounded bg-slate-800/50 text-[10px]">
                      <span className="text-slate-300">Pin {idx + 1}</span>
                      <button onClick={() => { removePin(courseName, holeNumber, pin.id); refreshFromStore(); }} className="text-red-400 hover:text-red-300 shrink-0">Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {testRunShots != null && testRunShots.length > 0 && (
              <div className="border-t border-slate-700 pt-2 mt-2 space-y-2">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1">Test run result</p>
                <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700">
                  <p className="text-sm font-semibold text-white">
                    Score: {testRunShots.length}{' '}
                    {(() => {
                      const diff = testRunShots.length - par;
                      const vsPar = diff === 0 ? 'E' : diff > 0 ? `+${diff}` : `${diff}`;
                      return `(${vsPar})`;
                    })()}
                  </p>
                  {(() => {
                    const treeHits = testRunShots.filter((s) => s.commentary?.weatherLie === 'Hit tree! Ball deflected.').length;
                    const waterPenalties = testRunShots.filter((s) => s.commentary?.weatherLie === 'Ball in water – penalty').length;
                    const obPenalties = testRunShots.filter((s) => s.commentary?.weatherLie === 'Out of bounds – penalty').length;
                    if (treeHits > 0 || waterPenalties > 0 || obPenalties > 0) {
                      return (
                        <p className="text-[10px] text-slate-500 mt-1">
                          {treeHits > 0 && `Tree hits: ${treeHits}`}
                          {(treeHits > 0 && (waterPenalties > 0 || obPenalties > 0)) && ' · '}
                          {waterPenalties > 0 && `Water (penalty): ${waterPenalties}`}
                          {waterPenalties > 0 && obPenalties > 0 && ' · '}
                          {obPenalties > 0 && `OB (penalty): ${obPenalties}`}
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {testRunShots.map((shot) =>
                    shot.commentary ? (
                      <div key={shot.shotNumber} className="text-xs bg-slate-800/80 rounded-lg p-2 border border-slate-700">
                        <p className="font-semibold text-white mb-1">Shot {shot.shotNumber}</p>
                        <p className="text-slate-300">
                          <span className="text-green-400 font-medium">{shot.commentary.distanceYards} yds</span>
                          {shot.commentary.club && ` · ${shot.commentary.club}`}
                        </p>
                        {(shot.commentary.shape || shot.commentary.height) && (
                          <p className="text-slate-400">{[shot.commentary.shape, shot.commentary.height].filter(Boolean).join(' · ')}</p>
                        )}
                        {shot.commentary.proximityToHole != null && shot.commentary.proximityToHole !== '' && (
                          <p className="text-slate-400">Proximity: {shot.commentary.proximityToHole}</p>
                        )}
                        {(shot.commentary.weatherLie != null && shot.commentary.weatherLie !== '') && (
                          <p className="text-slate-500 italic">{shot.commentary.weatherLie}</p>
                        )}
                      </div>
                    ) : (
                      <div key={shot.shotNumber} className="text-xs bg-slate-800/80 rounded-lg p-2 border border-slate-700">
                        <p className="font-semibold text-white">Shot {shot.shotNumber}</p>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            <div className="border-t border-slate-700 pt-2 mt-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1 mb-1.5">Add hazard</p>
              <div className="flex gap-1 flex-wrap mb-1.5">
                {(['water', 'out_of_bounds', 'bunker'] as HazardType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setHazardType(type);
                      if (type === 'out_of_bounds' && hazardStake == null) setHazardStake('yellow');
                      setTool('hazard');
                    }}
                    className={`px-2 py-1.5 rounded-lg text-xs font-medium capitalize transition ${
                      tool === 'hazard' && hazardType === type ? 'bg-green-600 text-white' : hazardType === type ? 'bg-slate-600 text-white' : 'bg-slate-700/80 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {type === 'out_of_bounds' ? 'Stakes' : type}
                  </button>
                ))}
              </div>
              {hazardType === 'out_of_bounds' && (
                <>
                  <p className="text-[10px] text-slate-400 mb-1 px-1">Stake color (penalty area):</p>
                  <div className="flex gap-1 flex-wrap items-center mb-1.5">
                    {(['yellow', 'red'] as HazardStake[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => { setHazardStake(s); if (tool !== 'hazardPolygon') setTool('hazard'); }}
                        className={`px-2 py-1 rounded text-xs font-medium transition ${
                          hazardStake === s ? (s === 'yellow' ? 'bg-amber-500 text-white' : 'bg-red-600 text-white') : 'bg-slate-700/80 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {s === 'yellow' ? 'Yellow' : 'Red'}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1 flex-wrap items-center mb-1.5">
                    <span className="text-[10px] text-slate-500 mr-1">Side:</span>
                    {(['left', 'right'] as OBSide[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => { setObSide(obSide === s ? null : s); setTool('hazard'); }}
                        className={`px-2 py-1 rounded text-xs font-medium transition ${obSide === s ? 'bg-slate-500 text-white' : 'bg-slate-700/80 text-slate-300 hover:bg-slate-600'}`}
                      >
                        {s === 'left' ? 'Left' : 'Right'}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {hazardType === 'water' && (
                <div className="flex gap-1 flex-wrap items-center mb-1.5">
                  <span className="text-[10px] text-slate-500 mr-1">Stake:</span>
                  {(['yellow', 'red'] as HazardStake[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setHazardStake(hazardStake === s ? null : s);
                        if (tool !== 'hazardPolygon') setTool('hazard');
                      }}
                      className={`px-2 py-1 rounded text-xs font-medium transition ${
                        hazardStake === s ? (s === 'yellow' ? 'bg-amber-500 text-white' : 'bg-red-600 text-white') : 'bg-slate-700/80 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {s === 'yellow' ? 'Yellow' : 'Red'}
                    </button>
                  ))}
                  {hazardStake != null && (
                    <button onClick={() => { setHazardStake(null); if (tool !== 'hazardPolygon') setTool('hazard'); }} className="text-[10px] text-slate-500 hover:text-slate-300">None</button>
                  )}
                </div>
              )}
              <div className="flex gap-1 flex-wrap mt-1.5">
                <button
                  onClick={() => {
                    if (tool === 'hazardPolygon') {
                      setPolygonPoints([]);
                      setUndoStack((s) => s.filter((a) => a.type !== 'popPolygonPoint'));
                      setTool('hazard');
                    } else setTool(tool === 'hazard' ? 'none' : 'hazard');
                  }}
                  className={`px-2 py-1.5 rounded-lg text-xs font-medium transition ${tool === 'hazard' ? 'bg-green-600 text-white' : 'bg-slate-700/80 text-slate-300 hover:bg-slate-600'}`}
                >
                  Place circle
                </button>
                <button
                  onClick={() => {
                    if (tool === 'hazard') { setPolygonPoints([]); setUndoStack((s) => s.filter((a) => a.type !== 'popPolygonPoint')); setTool('hazardPolygon'); }
                    else if (tool === 'hazardPolygon') clearPolygonTool();
                    else { setPolygonPoints([]); setUndoStack((s) => s.filter((a) => a.type !== 'popPolygonPoint')); setTool('hazardPolygon'); }
                  }}
                  className={`px-2 py-1.5 rounded-lg text-xs font-medium transition ${tool === 'hazardPolygon' ? 'bg-green-600 text-white' : 'bg-slate-700/80 text-slate-300 hover:bg-slate-600'}`}
                >
                  Draw polygon
                </button>
              </div>
              {tool === 'hazard' && <p className="text-[10px] text-slate-500 mt-1 px-1">Tap map to place. Listed below; adjust size or stake there.</p>}
              {tool === 'hazardPolygon' && (
                <div className="mt-1.5 flex gap-1 flex-wrap items-center">
                  <span className="text-[10px] text-slate-500">{polygonPoints.length} points.</span>
                  <button onClick={finishHazardPolygon} disabled={polygonPoints.length < 3} className="py-1.5 px-2 rounded-lg bg-green-600 disabled:opacity-50 text-white text-xs font-medium">Finish</button>
                  <button onClick={() => { setPolygonPoints([]); setUndoStack((s) => s.filter((a) => a.type !== 'popPolygonPoint')); }} className="py-1.5 px-2 rounded-lg bg-slate-600 text-slate-300 text-xs">Clear</button>
                </div>
              )}
              <div className="mt-1.5 space-y-2 max-h-40 overflow-y-auto">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1">Hazards</p>
                {(effectiveData.hazards ?? []).length === 0 ? (
                  <>
                    <p className="text-[10px] text-slate-500 px-1">No hazards yet.</p>
                    <p className="text-[10px] text-slate-500 px-1 italic">Dimmed shapes on the map may be from other holes (in boundary).</p>
                  </>
                ) : (
                  (effectiveData.hazards ?? []).map((h, idx) => (
                    <div key={h.id} className="px-2 py-1.5 rounded bg-slate-800/50 text-[10px] space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="capitalize text-slate-300 font-medium">
                          {h.type === 'out_of_bounds' && ('stake' in h && h.stake)
                            ? `${h.stake === 'yellow' ? 'Yellow' : 'Red'} stake ${idx + 1}`
                            : h.type === 'out_of_bounds'
                              ? `OB ${idx + 1}`
                              : `${h.type} ${idx + 1}`}
                          {h.type === 'out_of_bounds' && h.obSide && ` (${h.obSide})`}
                          {h.shape === 'circle' ? ` (${h.radiusMeters}m)` : ` (polygon, ${h.vertices.length} pts)`}
                          {h.type === 'water' && ('stake' in h && h.stake) && ` · ${h.stake} stake`}
                        </span>
                        <button onClick={() => { removeHazardOverlayById(h.id); removeHazard(courseName, holeNumber, h.id); setHazardOverlayRevision((r) => r + 1); setTestRunShots(null); refreshFromStore(); removeOrphanHazardOverlays(); setTimeout(removeOrphanHazardOverlays, 0); setTimeout(removeOrphanHazardOverlays, 50); }} className="text-red-400 hover:text-red-300 shrink-0">Remove</button>
                      </div>
                      {h.shape === 'circle' && (
                        <>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 shrink-0">Size</span>
                            <input
                              type="range"
                              min={1}
                              max={25}
                              step={0.5}
                              value={h.radiusMeters}
                              onChange={(e) => {
                                updateHazardRadius(courseName, holeNumber, h.id, Number(e.target.value));
                                refreshFromStore();
                              }}
                              className="flex-1 h-1.5 rounded accent-green-500"
                            />
                            <span className="text-slate-300 tabular-nums w-7">{h.radiusMeters}m</span>
                          </div>
                          {h.type === 'out_of_bounds' && (
                            <div className="flex gap-1 items-center flex-wrap mb-1">
                              <span className="text-slate-500 shrink-0">Side:</span>
                              {(['left', 'right'] as OBSide[]).map((s) => (
                                <button
                                  key={s}
                                  onClick={() => { updateHazardObSide(courseName, holeNumber, h.id, h.obSide === s ? undefined : s); refreshFromStore(); }}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${h.obSide === s ? 'bg-slate-500 text-white' : 'bg-slate-700/80 text-slate-400 hover:bg-slate-600'}`}
                                >
                                  {s === 'left' ? 'Left' : 'Right'}
                                </button>
                              ))}
                            </div>
                          )}
                          {(h.type === 'water' || h.type === 'out_of_bounds') && (
                            <div className="flex gap-1 items-center flex-wrap">
                              <span className="text-slate-500 shrink-0">Stake:</span>
                              {(['yellow', 'red'] as HazardStake[]).map((s) => (
                                <button
                                  key={s}
                                  onClick={() => { updateHazardStake(courseName, holeNumber, h.id, ('stake' in h && h.stake === s) ? undefined : s); refreshFromStore(); }}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${('stake' in h && h.stake === s) ? (s === 'yellow' ? 'bg-amber-500 text-white' : 'bg-red-600 text-white') : 'bg-slate-700/80 text-slate-400 hover:bg-slate-600'}`}
                                >
                                  {s === 'yellow' ? 'Yellow' : 'Red'}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                      {h.shape === 'polygon' && (h.type === 'water' || h.type === 'out_of_bounds') && (
                        <>
                          {h.type === 'out_of_bounds' && (
                            <div className="flex gap-1 items-center flex-wrap mb-1">
                              <span className="text-slate-500 shrink-0">Side:</span>
                              {(['left', 'right'] as OBSide[]).map((s) => (
                                <button
                                  key={s}
                                  onClick={() => { updateHazardObSide(courseName, holeNumber, h.id, h.obSide === s ? undefined : s); refreshFromStore(); }}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${h.obSide === s ? 'bg-slate-500 text-white' : 'bg-slate-700/80 text-slate-400 hover:bg-slate-600'}`}
                                >
                                  {s === 'left' ? 'Left' : 'Right'}
                                </button>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-1 items-center flex-wrap">
                            <span className="text-slate-500 shrink-0">Stake:</span>
                            {(['yellow', 'red'] as HazardStake[]).map((s) => (
                              <button
                                key={s}
                                onClick={() => { updateHazardStake(courseName, holeNumber, h.id, ('stake' in h && h.stake === s) ? undefined : s); refreshFromStore(); }}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${('stake' in h && h.stake === s) ? (s === 'yellow' ? 'bg-amber-500 text-white' : 'bg-red-600 text-white') : 'bg-slate-700/80 text-slate-400 hover:bg-slate-600'}`}
                              >
                                {s === 'yellow' ? 'Yellow' : 'Red'}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="border-t border-slate-700 pt-2 mt-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1 mb-1.5">Trees</p>
              <div className="flex gap-1 flex-wrap">
                <button
                  onClick={() => setTool(tool === 'tree' ? 'none' : 'tree')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                    tool === 'tree' ? 'bg-green-600 text-white' : 'bg-slate-700/80 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <TreeDeciduous className="w-3.5 h-3.5" />
                  Add tree
                </button>
                <button
                  onClick={() => {
                    if (tool === 'treePatch') clearPolygonTool();
                    else {
                      setPolygonPoints([]);
                      setUndoStack((s) => s.filter((a) => a.type !== 'popPolygonPoint'));
                      setTool('treePatch');
                    }
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                    tool === 'treePatch' ? 'bg-green-600 text-white' : 'bg-slate-700/80 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  Forest/patch
                </button>
              </div>
              {tool === 'tree' && <p className="text-[10px] text-slate-500 mt-1 px-1">Tap map to place. Adjust size below.</p>}
              {tool === 'treePatch' && (
                <div className="mt-1.5 flex gap-1 flex-wrap items-center">
                  <span className="text-[10px] text-slate-500">{polygonPoints.length} points.</span>
                  <button onClick={finishTreePatch} disabled={polygonPoints.length < 3} className="py-1.5 px-2 rounded-lg bg-green-600 disabled:opacity-50 text-white text-xs font-medium">Finish</button>
                  <button onClick={() => { setPolygonPoints([]); setUndoStack((s) => s.filter((a) => a.type !== 'popPolygonPoint')); }} className="py-1.5 px-2 rounded-lg bg-slate-600 text-slate-300 text-xs">Clear</button>
                </div>
              )}
              {(effectiveData.trees ?? []).length > 0 && (
                <div className="mt-1.5 space-y-2 max-h-32 overflow-y-auto">
                  <p className="text-[10px] text-slate-500 px-1">Single trees</p>
                  {(effectiveData.trees ?? []).map((t, idx) => (
                    <div key={t.id} className="px-2 py-1.5 rounded bg-slate-800/50 text-[10px] space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-slate-300 font-medium">Tree {idx + 1}</span>
                        <button onClick={() => { removeTree(courseName, holeNumber, t.id); refreshFromStore(); }} className="text-red-400 hover:text-red-300 shrink-0">Remove</button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 shrink-0">Size</span>
                        <input
                          type="range"
                          min={2}
                          max={15}
                          step={0.5}
                          value={t.radiusMeters ?? 5}
                          onChange={(e) => {
                            updateTreeRadius(courseName, holeNumber, t.id, Number(e.target.value));
                            refreshFromStore();
                          }}
                          className="flex-1 h-1.5 rounded accent-green-500"
                        />
                        <span className="text-slate-300 tabular-nums w-7">{t.radiusMeters ?? 5}m</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {(effectiveData.treePatches ?? []).length > 0 && (
                <div className="mt-1.5 space-y-1.5 max-h-24 overflow-y-auto">
                  <p className="text-[10px] text-slate-500 px-1">Forests/patches</p>
                  {(effectiveData.treePatches ?? []).map((p, idx) => (
                    <div key={p.id} className="flex items-center justify-between gap-1 px-2 py-1.5 rounded bg-slate-800/50 text-[10px]">
                      <span className="text-slate-300 font-medium">Forest {idx + 1} ({p.vertices.length} pts)</span>
                      <button onClick={() => { removeTreePatch(courseName, holeNumber, p.id); refreshFromStore(); }} className="text-red-400 hover:text-red-300 shrink-0">Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-slate-700 pt-2 mt-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1 mb-1.5">Draw fairway</p>
              <p className="text-[10px] text-slate-500 px-1 mb-1.5">Holes can have multiple fairways (e.g. split by cart path or hazard).</p>
              <button
                onClick={() => {
                  if (tool === 'fairway') clearPolygonTool();
                  else {
                    setPolygonPoints([]);
                    setUndoStack((s) => s.filter((a) => a.type !== 'popPolygonPoint'));
                    setTool('fairway');
                  }
                }}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition ${
                  tool === 'fairway' ? 'bg-green-600/30 border-green-500 text-white' : 'bg-slate-800/80 border-slate-600 text-slate-300 hover:border-slate-500'
                }`}
              >
                <Route className="w-4 h-4" />
                {tool === 'fairway' ? 'Tap map to add points · Finish to add' : (effectiveData.fairways ?? []).length > 0 ? 'Add another fairway' : 'Draw fairway'}
              </button>
              {tool === 'fairway' && (
                <div className="mt-1.5 flex gap-1">
                  <button onClick={() => finishPolygon('fairway')} disabled={polygonPoints.length < 3} className="flex-1 py-1.5 rounded-lg bg-green-600 disabled:opacity-50 text-white text-xs font-medium">Finish</button>
                  <button onClick={() => setPolygonPoints([])} className="py-1.5 px-2 rounded-lg bg-slate-600 text-slate-300 text-xs">Clear</button>
                </div>
              )}
              {(effectiveData.fairways ?? []).length > 0 && (
                <div className="mt-1.5 space-y-1 max-h-24 overflow-y-auto">
                  {(effectiveData.fairways ?? []).map((_, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-1 px-2 py-1 rounded bg-slate-800/50 text-[10px] text-slate-300">
                      <span>Fairway {idx + 1}</span>
                      <button onClick={() => { removeFairway(courseName, holeNumber, idx); refreshFromStore(); }} className="text-red-400 hover:text-red-300">Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {effectiveData.greenBoundary && effectiveData.greenBoundary.length >= 3 && (
              <div className="border-t border-slate-700 pt-2 mt-2">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1 mb-1.5">Boundaries</p>
                <div className="space-y-2">
                  {effectiveData.greenBoundary && effectiveData.greenBoundary.length >= 3 && (
                    <div className="flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700">
                      <span className="text-xs text-slate-300">Green boundary ({effectiveData.greenBoundary.length} points)</span>
                      <button
                        onClick={() => {
                          setGreenBoundary(courseName, holeNumber, [], effectiveData);
                          refreshFromStore();
                        }}
                        className="text-red-400 hover:text-red-300 shrink-0 text-xs"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="border-t border-slate-700 pt-2 mt-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1 mb-1.5">Green boundary</p>
              {effectiveData.greenBoundary && effectiveData.greenBoundary.length >= 3 ? (
                <p className="text-[10px] text-slate-500 px-1">One green per hole. Use Boundaries list above to remove and redraw.</p>
              ) : (
                <>
                  <button
                    onClick={() => {
                      if (tool === 'greenBoundary') clearPolygonTool();
                      else {
                        setPolygonPoints([]);
                        setUndoStack((s) => s.filter((a) => a.type !== 'popPolygonPoint'));
                        setTool('greenBoundary');
                      }
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition ${
                      tool === 'greenBoundary' ? 'bg-green-600/30 border-green-500 text-white' : 'bg-slate-800/80 border-slate-600 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <CircleDot className="w-4 h-4" />
                    {tool === 'greenBoundary' ? 'Tap map to add points' : 'Draw green boundary'}
                  </button>
                  {tool === 'greenBoundary' && (
                    <div className="mt-1.5 flex gap-1">
                      <button onClick={() => finishPolygon('greenBoundary')} disabled={polygonPoints.length < 3} className="flex-1 py-1.5 rounded-lg bg-green-600 disabled:opacity-50 text-white text-xs font-medium">Finish</button>
                      <button onClick={() => setPolygonPoints([])} className="py-1.5 px-2 rounded-lg bg-slate-600 text-slate-300 text-xs">Clear</button>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="border-t border-slate-700 pt-2 mt-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1 mb-1.5">AI mapping</p>
              <button
                onClick={handleAIMap}
                disabled={isAIMappingLoading}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-600/80 hover:bg-amber-600 border border-amber-500/50 text-white text-sm font-medium transition disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                {isAIMappingLoading ? 'Mapping…' : 'AI map this hole'}
              </button>
              <p className="text-[10px] text-slate-500 px-1 mt-1">Replaces hazards, fairway, green & trees with a fresh pass (OSM + heuristics). Run again to remap.</p>
            </div>

            <button
              onClick={handleStartFromScratch}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800/80 border border-slate-600 text-slate-300 hover:border-slate-500 text-sm font-medium transition mt-2"
            >
              <RotateCcw className="w-4 h-4" />
              Start from scratch
            </button>
            <p className="text-[10px] text-slate-500 px-1">Reset this hole to default layout.</p>

            <button
              onClick={handleDiscard}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800/80 border border-slate-600 text-slate-300 hover:border-slate-500 text-sm font-medium transition"
            >
              <Trash2 className="w-4 h-4" />
              Discard changes
            </button>
            <p className="text-[10px] text-slate-500 px-1">Revert this hole to last saved.</p>

            <div className="border-t border-slate-700 pt-2 mt-2">
              <button
                onClick={() => setShowPresets((p) => !p)}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800/80 border border-slate-600 text-slate-300 hover:border-slate-500 text-sm font-medium transition"
              >
                <List className="w-4 h-4" />
                Presets / saved versions
              </button>
              {showPresets && (
                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {presets.length === 0 ? (
                    <p className="text-xs text-slate-500 px-2">No presets saved yet.</p>
                  ) : (
                    presets.map((preset) => (
                      <div
                        key={preset.id}
                        className="flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700"
                      >
                        <span className="text-xs text-white truncate">{preset.name}</span>
                        <button
                          onClick={() => {
                            loadPreset(courseName, preset.id);
                            const tg = getEffectiveTeeGreen(courseName, holeNumber);
                            if (tg) {
                              setTee(tg.tee);
                              setGreen(tg.green);
                            }
                            setShowPresets(false);
                          }}
                          className="text-[10px] font-medium text-green-400 hover:text-green-300"
                        >
                          Load
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-slate-700 pt-2 mt-2">
              <p className="text-[10px] text-slate-400 mb-1.5">Save current layout as preset</p>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="e.g. Tournament"
                  className="flex-1 rounded-lg bg-slate-700 border border-slate-600 px-2 py-1.5 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
                <button
                  onClick={() => {
                    if (presetName.trim()) {
                      saveAsPreset(courseName, presetName.trim());
                      setPresetName('');
                    }
                  }}
                  disabled={!presetName.trim()}
                  className="p-1.5 rounded-lg bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:text-slate-500 text-white"
                >
                  <Save className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
