import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useJsApiLoader, GoogleMap, Marker } from '@react-google-maps/api';
import { calculateHaversineDistance } from '../utils/haversine';
import {
  adjustYardageForConditions,
  bearingDeg,
  windDirectionLabel,
} from '../utils/yardageConditions';
import { AIGolfer, ShotHistory } from '../utils/AIGolfer';
import {
  getTeeAndGreen,
  getTreesForHole,
  getHoleFeaturesForAI,
  getCourseRatingAndSlope,
  HOLE_1_GREEN_OVERRIDE,
  HOLE_1_TEE_OVERRIDE,
} from '../data/lincolnParkCourse';
import type { HoleFeaturesForAI } from '../data/lincolnParkCourse';
import { LINCOLN_PARK_COURSE } from '../data/courses';
import { getTeeGreenOverride, getHoleOverride } from '../services/courseEditorStore';
import { getTeeAndGreenForCourse, getHoleInfoForCourse, getCourseHoleCount } from '../services/courseBounds';
import { buildInPlayFeaturesForHole } from '../utils/editorHoleToAI';
import { useCurrentRound } from '../context/CurrentRoundContext';
import { useGolfGame } from '../context/GolfGameContext';
import { formatHandicapDisplay } from '../data/clubDistancesByHandicap';
import type { UserHoleStats, MissDirection } from '../types/holeStats';
import { deriveAIHoleStats } from '../utils/deriveAIHoleStats';

type LatLng = { lat: number; lng: number };

/** Point at fraction (0–1) along the line from `from` to `to`. */
function pointAlongLine(from: LatLng, to: LatLng, fraction: number): LatLng {
  return {
    lat: from.lat + fraction * (to.lat - from.lat),
    lng: from.lng + fraction * (to.lng - from.lng),
  };
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

/** Approx meters to degrees at given latitude (1 deg lat ≈ 111320 m; 1 deg lng ≈ 111320*cos(lat) m). */
function metersToDegrees(meters: number, centerLat: number): { lat: number; lng: number } {
  const degLat = meters / 111320;
  const degLng = meters / (111320 * Math.cos((centerLat * Math.PI) / 180));
  return { lat: degLat, lng: degLng };
}

/** Return a closed path of points approximating a circle (for dotted outline). */
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

const defaultMapOptions: google.maps.MapOptions = {
  zoomControl: false,
  scrollwheel: false,
  disableDoubleClickZoom: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  minZoom: 14,
  maxZoom: 20,
  mapTypeId: 'satellite',
  tilt: 0,
};

declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}

const DEFAULT_TEE_GREEN = { tee: HOLE_1_TEE_OVERRIDE, green: HOLE_1_GREEN_OVERRIDE };

const MISS_OPTIONS: { value: MissDirection; label: string }[] = [
  { value: 'left', label: '←' },
  { value: 'right', label: '→' },
  { value: 'short', label: '↓' },
  { value: 'long', label: '↑' },
  { value: 'ob', label: 'OB' },
];

function StatRow({
  label,
  yesNo,
  onYesNo,
  miss,
  onMiss,
}: {
  label: string;
  yesNo: boolean;
  onYesNo: (v: boolean) => void;
  miss: MissDirection | undefined;
  onMiss: (v: MissDirection) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-300">{label}</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onYesNo(true)} className={`px-2 py-1 rounded text-xs font-medium ${yesNo ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400'}`}>Yes</button>
          <button type="button" onClick={() => onYesNo(false)} className={`px-2 py-1 rounded text-xs font-medium ${!yesNo ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400'}`}>No</button>
        </div>
      </div>
      {!yesNo && (
        <div className="flex flex-wrap gap-1">
          {MISS_OPTIONS.map(({ value, label: l }) => (
            <button key={value} type="button" onClick={() => onMiss(value)} className={`px-2 py-1 rounded text-xs font-medium ${miss === value ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400'}`} title={value}>{l}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export function HoleMapView() {
  const [currentHoleNumber, setCurrentHoleNumber] = useState(1);
  /** User's current position from GPS when on course; null if unavailable → fall back to tee for yardage. */
  const [ballPosition, setBallPosition] = useState<LatLng | null>(null);
  const [distanceToHole, setDistanceToHole] = useState<number | null>(null);
  const [landingZone, setLandingZone] = useState<LatLng | null>(null);
  const [aiShots, setAiShots] = useState<ShotHistory[]>([]);
  const [isAiPlaying, setIsAiPlaying] = useState(false);
  const [mapInitError, setMapInitError] = useState<string | null>(null);
  const [userScore, setUserScore] = useState<number | ''>('');
  const [scoreSubmitted, setScoreSubmitted] = useState(false);
  const [aiScoresByHole, setAiScoresByHole] = useState<(number | undefined)[]>(() => Array(18));
  const [userScoresByHole, setUserScoresByHole] = useState<(number | undefined)[]>(() => Array(18));
  const [showStatsForm, setShowStatsForm] = useState(false);
  const [statFairway, setStatFairway] = useState<boolean>(true);
  const [statFairwayMiss, setStatFairwayMiss] = useState<MissDirection | undefined>(undefined);
  const [statGir, setStatGir] = useState<boolean>(true);
  const [statGirMiss, setStatGirMiss] = useState<MissDirection | undefined>(undefined);
  const [statScrambling, setStatScrambling] = useState<boolean>(true);
  const [statScrambleSand, setStatScrambleSand] = useState<boolean>(false);
  const [statPutts, setStatPutts] = useState<number>(2);
  const { round, setRound } = useCurrentRound();
  const roundRef = useRef(round);
  roundRef.current = round;
  const { gameState } = useGolfGame();
  // AI plays as the handicap selected in Settings (gameState.aiProfile); this is the value used for AIGolfer.
  const aiProfile = gameState.aiProfile ?? 15;
  const aiLabel =
    typeof aiProfile === 'string'
      ? aiProfile
      : `HCP ${formatHandicapDisplay(aiProfile)}`;

  // Sync map round to context (current hole and scores) so scorecard stays in sync; only update these fields so course/tee set from selection are preserved
  useEffect(() => {
    setRound({
      currentHoleNumber,
      aiScoresByHole,
      userScoresByHole,
    });
  }, [currentHoleNumber, aiScoresByHole, userScoresByHole, setRound]);

  // Default landing zone to 60% of hole distance (tee → green) so yardage loads first with a target
  useEffect(() => {
    setLandingZone(pointAlongLine(teeGreen.tee, teeGreen.green, 0.6));
  }, [currentHoleNumber]);

  // On course: use device GPS for your position so yardage is from you to pin / to marked target
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setBallPosition({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        setBallPosition(null);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const aiGolferRef = useRef<AIGolfer | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const fairwayPolylineRef = useRef<google.maps.Polyline | null>(null);
  const landingZonePolylinesRef = useRef<google.maps.Polyline[]>([]);
  const aiPolylinesRef = useRef<google.maps.Polyline[]>([]);
  const aiShotSpotOverlaysRef = useRef<(google.maps.Circle | google.maps.Polyline)[]>([]);
  const treeCirclesRef = useRef<google.maps.Circle[]>([]);
  const aiPlannedShotsRef = useRef<ShotHistory[]>([]);
  const aiLandingZoneCircleRef = useRef<google.maps.Circle | null>(null);
  const mappedOverlaysRef = useRef<(google.maps.Polygon | google.maps.Circle)[]>([]);

  const courseName = round?.courseName ?? LINCOLN_PARK_COURSE.name;
  const teeGreenOverride = getTeeGreenOverride(courseName, currentHoleNumber);
  const teeSet = round?.selectedTeeSet;
  const teeGreen =
    teeGreenOverride ??
    (currentHoleNumber === 1 && courseName === LINCOLN_PARK_COURSE.name
      ? DEFAULT_TEE_GREEN
      : getTeeAndGreenForCourse(courseName, currentHoleNumber, teeSet) ??
        (courseName === LINCOLN_PARK_COURSE.name ? getTeeAndGreen(currentHoleNumber) : null) ??
        DEFAULT_TEE_GREEN);
  const mapCenter = {
    lat: (teeGreen.tee.lat + teeGreen.green.lat) / 2,
    lng: (teeGreen.tee.lng + teeGreen.green.lng) / 2,
  };
  const holeCount = getCourseHoleCount(courseName) || 18;
  const holeInfo = getHoleInfoForCourse(courseName, currentHoleNumber, round?.selectedTeeSet);
  const currentHole = {
    number: currentHoleNumber,
    par: holeInfo.par,
    yardage: holeInfo.yardage ?? 300,
    strokeIndex: undefined as number | undefined,
    features: [] as unknown[],
  };

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    id: 'google-map-script',
    preventGoogleFontsLoading: true,
  });

  // Catch ApiNotActivatedMapError (and gm_authFailure) so we show our message instead of Google's
  useEffect(() => {
    window.gm_authFailure = () => {
      setMapInitError('ApiNotActivatedMapError');
    };
    const onError = (e: ErrorEvent) => {
      if (e.message?.includes('ApiNotActivatedMapError') || e.message?.includes('Google Maps JavaScript API error')) {
        setMapInitError('ApiNotActivatedMapError');
      }
    };
    window.addEventListener('error', onError);
    return () => {
      delete window.gm_authFailure;
      window.removeEventListener('error', onError);
    };
  }, []);

  const teeGreenRef = useRef(teeGreen);
  teeGreenRef.current = teeGreen;

  useEffect(() => {
    aiGolferRef.current = new AIGolfer(aiProfile, teeGreen.tee);
  }, [currentHoleNumber, aiProfile]);

  const applyMapForTeeGreen = useCallback((tg: typeof teeGreen, map: google.maps.Map) => {
    const center = { lat: (tg.tee.lat + tg.green.lat) / 2, lng: (tg.tee.lng + tg.green.lng) / 2 };
    map.setCenter(center);
    map.setHeading((calculateBearing(tg.tee, tg.green) + 180) % 360);
    map.setTilt(0);
    map.setZoom(17);
    if (fairwayPolylineRef.current) fairwayPolylineRef.current.setMap(null);
    fairwayPolylineRef.current = new google.maps.Polyline({
      path: [tg.tee, tg.green],
      geodesic: true,
      strokeColor: '#3b82f6',
      strokeOpacity: 0.8,
      strokeWeight: 4,
    });
    fairwayPolylineRef.current.setMap(map);
  }, []);

  const onMapLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      applyMapForTeeGreen(teeGreenRef.current, map);
    },
    [applyMapForTeeGreen]
  );

  useEffect(() => {
    if (!mapRef.current) return;
    applyMapForTeeGreen(teeGreen, mapRef.current);
  }, [currentHoleNumber, teeGreen.tee.lat, teeGreen.tee.lng, teeGreen.green.lat, teeGreen.green.lng, applyMapForTeeGreen]);

  useEffect(() => {
    setLandingZone(null);
    setAiShots([]);
    setUserScore('');
    setScoreSubmitted(false);
    aiPlannedShotsRef.current = [];
    aiShotSpotOverlaysRef.current.forEach((o) => o.setMap(null));
    aiShotSpotOverlaysRef.current = [];
    if (aiLandingZoneCircleRef.current) {
      aiLandingZoneCircleRef.current.setMap(null);
      aiLandingZoneCircleRef.current = null;
    }
  }, [currentHoleNumber]);

  // In play mode do not draw tree circles so the user does not see obstacle overlays.
  useEffect(() => {
    if (!mapRef.current) return;
    treeCirclesRef.current.forEach((c) => c.setMap(null));
    treeCirclesRef.current = [];
    return () => {
      treeCirclesRef.current.forEach((c) => c.setMap(null));
      treeCirclesRef.current = [];
    };
  }, [courseName, currentHoleNumber]);

  // In play mode do not draw course boundaries, fairways, hazards, or green overlays so the user only sees the map and play UI (tee, pin, distance).
  useEffect(() => {
    if (!mapRef.current) return;
    mappedOverlaysRef.current.forEach((o) => o.setMap(null));
    mappedOverlaysRef.current = [];
    return () => {
      mappedOverlaysRef.current.forEach((o) => o.setMap(null));
      mappedOverlaysRef.current = [];
    };
  }, [courseName, currentHoleNumber]);

  // Landing zone: draw lines from tee → landing zone and landing zone → green
  useEffect(() => {
    if (!mapRef.current) return;
    landingZonePolylinesRef.current.forEach((p) => p.setMap(null));
    landingZonePolylinesRef.current = [];
    if (landingZone) {
      const tee = teeGreen.tee;
      const green = teeGreen.green;
      const lineOpts = {
        geodesic: true,
        strokeColor: '#ffffff',
        strokeOpacity: 0.9,
        strokeWeight: 2,
      };
      const toLZ = new google.maps.Polyline({ path: [tee, landingZone], ...lineOpts });
      const toPin = new google.maps.Polyline({ path: [landingZone, green], ...lineOpts });
      toLZ.setMap(mapRef.current);
      toPin.setMap(mapRef.current);
      landingZonePolylinesRef.current = [toLZ, toPin];
    }
    return () => {
      landingZonePolylinesRef.current.forEach((p) => p.setMap(null));
      landingZonePolylinesRef.current = [];
    };
  }, [
    landingZone,
    teeGreen.tee.lat,
    teeGreen.tee.lng,
    teeGreen.green.lat,
    teeGreen.green.lng,
  ]);

  // Shot tracer: thin white line; if deflected off tree, remainder is smaller dotted-dash
  useEffect(() => {
    if (!mapRef.current) return;
    aiPolylinesRef.current.forEach((p) => p.setMap(null));
    aiPolylinesRef.current = [];
    aiShots.forEach((shot) => {
      const impact = shot.treeImpactPosition;
      const solidPath = impact ? [shot.fromPosition, impact] : [shot.fromPosition, shot.toPosition];
      const solid = new google.maps.Polyline({
        path: solidPath,
        geodesic: true,
        strokeColor: '#ffffff',
        strokeOpacity: 0.95,
        strokeWeight: 2,
        map: mapRef.current!,
      });
      aiPolylinesRef.current.push(solid);
      if (impact) {
        const dashed = new google.maps.Polyline({
          path: [impact, shot.toPosition],
          geodesic: true,
          strokeColor: '#ffffff',
          strokeOpacity: 0,
          strokeWeight: 0,
          icons: [{
            icon: { path: 'M 0,-1 0,1', strokeColor: '#ffffff', strokeOpacity: 0.9, scale: 1.2 },
            offset: '0',
            repeat: '6px',
          }],
          map: mapRef.current!,
        });
        aiPolylinesRef.current.push(dashed);
      }
    });
    return () => {
      aiPolylinesRef.current.forEach((p) => p.setMap(null));
      aiPolylinesRef.current = [];
    };
  }, [aiShots]);

  // AI shot spots: at each shot landing position, a small circle lightly shaded red with dotted border
  const AI_SHOT_SPOT_RADIUS_M = 4;
  useEffect(() => {
    if (!mapRef.current) return;
    aiShotSpotOverlaysRef.current.forEach((o) => o.setMap(null));
    aiShotSpotOverlaysRef.current = [];
    aiShots.forEach((shot) => {
      const center = shot.toPosition;
      const fillCircle = new google.maps.Circle({
        center,
        radius: AI_SHOT_SPOT_RADIUS_M,
        fillColor: '#fecaca',
        fillOpacity: 0.35,
        strokeColor: 'transparent',
        strokeWeight: 0,
        map: mapRef.current!,
      });
      aiShotSpotOverlaysRef.current.push(fillCircle);
      const path = circlePath(center, AI_SHOT_SPOT_RADIUS_M);
      const dottedCircle = new google.maps.Polyline({
        path,
        geodesic: false,
        strokeColor: '#ef4444',
        strokeOpacity: 0,
        strokeWeight: 0,
        icons: [
          {
            icon: { path: 'M 0,-1 0,1', strokeColor: '#ef4444', strokeOpacity: 0.9, scale: 2 },
            offset: '0',
            repeat: '8px',
          },
        ],
        map: mapRef.current!,
      });
      aiShotSpotOverlaysRef.current.push(dottedCircle);
    });
    return () => {
      aiShotSpotOverlaysRef.current.forEach((o) => o.setMap(null));
      aiShotSpotOverlaysRef.current = [];
    };
  }, [aiShots]);

  // AI landing zone: red circle at the next shot's target (where the ball is about to land)
  useEffect(() => {
    if (!mapRef.current) return;
    if (aiLandingZoneCircleRef.current) {
      aiLandingZoneCircleRef.current.setMap(null);
      aiLandingZoneCircleRef.current = null;
    }
    const planned = aiPlannedShotsRef.current;
    const nextIndex = aiShots.length;
    if (planned.length > 0 && nextIndex < planned.length) {
      const nextLanding = planned[nextIndex].toPosition;
      const circle = new google.maps.Circle({
        center: nextLanding,
        radius: 8,
        fillColor: '#ef4444',
        fillOpacity: 0.4,
        strokeColor: '#b91c1c',
        strokeWeight: 2,
        map: mapRef.current,
      });
      aiLandingZoneCircleRef.current = circle;
    }
    return () => {
      if (aiLandingZoneCircleRef.current) {
        aiLandingZoneCircleRef.current.setMap(null);
        aiLandingZoneCircleRef.current = null;
      }
    };
  }, [aiShots]);

  useEffect(() => {
    const fromPosition = ballPosition ?? teeGreen.tee;
    const toPosition = teeGreen.green;
    setDistanceToHole(calculateHaversineDistance(fromPosition, toPosition));
  }, [
    ballPosition,
    teeGreen.tee.lat,
    teeGreen.tee.lng,
    teeGreen.green.lat,
    teeGreen.green.lng,
  ]);

  const fromPosition = ballPosition ?? teeGreen.tee;
  const rawYards = distanceToHole !== null ? distanceToHole * 1.09361 : null;
  const shotBearing = useMemo(
    () => bearingDeg(fromPosition, teeGreen.green),
    [fromPosition.lat, fromPosition.lng, teeGreen.green.lat, teeGreen.green.lng]
  );
  const { settings } = gameState;
  const yardageAdjustment = useMemo(() => {
    if (rawYards === null || rawYards <= 0) return null;
    return adjustYardageForConditions(
      rawYards,
      settings.windSpeed,
      settings.windDirection,
      shotBearing,
      settings.slope
    );
  }, [rawYards, settings.windSpeed, settings.windDirection, shotBearing, settings.slope]);
  const windFromLabel = windDirectionLabel(settings.windDirection);

  const handleAIPlay = () => {
    if (!aiGolferRef.current || isAiPlaying) return;
    setIsAiPlaying(true);
    setAiShots([]);
    setUserScore('');
    setScoreSubmitted(false);
    setLandingZone(null);
    aiGolferRef.current.reset(teeGreen.tee);
    const holeOverride = getHoleOverride(courseName, currentHoleNumber);
    const holeFeatures = holeOverride
      ? buildInPlayFeaturesForHole(courseName, currentHoleNumber)
      : getHoleFeaturesForAI(currentHoleNumber);
    const par = getHoleInfoForCourse(courseName, currentHoleNumber, round?.selectedTeeSet).par;
    const conditions = gameState.settings.isProMode
      ? {
          windSpeedMph: gameState.settings.windSpeed,
          windDirectionDeg: gameState.settings.windDirection,
          slopeDegrees: gameState.settings.slope,
        }
      : undefined;
    const ratingSlope = getCourseRatingAndSlope(courseName);
    const playOptions: {
      par: number;
      holeFeatures?: HoleFeaturesForAI;
      conditions?: typeof conditions;
      courseRating?: number;
      slopeRating?: number;
      totalPar?: number;
      courseName?: string;
    } = { par, courseName };
    if (holeFeatures != null) {
      playOptions.holeFeatures = holeFeatures;
      playOptions.conditions = conditions;
    }
    if (ratingSlope) {
      playOptions.courseRating = ratingSlope.courseRating;
      playOptions.slopeRating = ratingSlope.slopeRating;
      playOptions.totalPar = ratingSlope.totalPar;
    }
    // Par, yardage, course rating, and stroke index (hole difficulty) inform AI so competitor can plan accordingly.
    const shots = aiGolferRef.current.playHole(
      teeGreen.green,
      20,
      getTreesForHole(currentHoleNumber),
      playOptions
    );
    aiPlannedShotsRef.current = shots;
    let shotIndex = 0;
    const animateShots = () => {
      if (shotIndex < shots.length) {
        setAiShots(shots.slice(0, shotIndex + 1));
        shotIndex++;
        setTimeout(animateShots, 1000);
      } else {
        const aiStats = deriveAIHoleStats(shots, par);
        setAiScoresByHole((prev) => {
          const next = [...prev];
          next[currentHoleNumber - 1] = shots.length;
          const r = roundRef.current;
          const existing = r.aiStatsByHole ?? [];
          const len = getCourseHoleCount(courseName) || 18;
          const nextAi =
            existing.length >= len
              ? [...existing]
              : [...existing, ...Array(len - existing.length).fill(undefined)];
          nextAi[currentHoleNumber - 1] = aiStats;
          setRound({ aiScoresByHole: next, aiStatsByHole: nextAi });
          return next;
        });
        aiPlannedShotsRef.current = [];
        setIsAiPlaying(false);
      }
    };
    animateShots();
  };

  const showScoreEntry = !isAiPlaying && aiShots.length > 0;
  const aiScore = aiShots.length;
  const currentHoleUser = userScoresByHole[currentHoleNumber - 1] ?? (scoreSubmitted && userScore !== '' ? (typeof userScore === 'number' ? userScore : parseInt(String(userScore), 10)) : undefined);

  // Running round: holes completed = consecutive holes from 1 with user score
  let holesCompleted = 0;
  for (let n = 1; n <= holeCount; n++) {
    if (userScoresByHole[n - 1] === undefined) break;
    holesCompleted = n;
  }
  const aiRunningTotal =
    holesCompleted > 0
      ? aiScoresByHole.slice(0, holesCompleted).reduce<number>((sum, s) => sum + (s ?? 0), 0)
      : 0;
  const userRunningTotal =
    holesCompleted > 0
      ? userScoresByHole.slice(0, holesCompleted).reduce<number>((sum, s) => sum + (s ?? 0), 0)
      : 0;
  const parThroughHoles =
    holesCompleted > 0
      ? Array.from({ length: holesCompleted }, (_, i) =>
          getHoleInfoForCourse(courseName, i + 1, round?.selectedTeeSet).par
        ).reduce((a, b) => a + b, 0)
      : 0;
  const formatVsPar = (strokes: number) => {
    const diff = strokes - parThroughHoles;
    if (diff === 0) return 'E';
    return diff > 0 ? `+${diff}` : String(diff);
  };
  const forScoreLabel = (strokesSoFar: number, par: number) => {
    const scoreIfSink = strokesSoFar + 1;
    const vsPar = scoreIfSink - par;
    if (vsPar <= -2) return 'FOR EAGLE';
    if (vsPar === -1) return 'FOR BIRDIE';
    if (vsPar === 0) return 'FOR PAR';
    if (vsPar === 1) return 'FOR BOGEY';
    return 'FOR DOUBLE';
  };
  const aiVsParDisplay = holesCompleted > 0 ? formatVsPar(aiRunningTotal) : '—';
  const userVsParDisplay = holesCompleted > 0 ? formatVsPar(userRunningTotal) : '—';
  const isCurrentHoleCompleted = userScoresByHole[currentHoleNumber - 1] !== undefined;
  const scoreBugDarkBg = isCurrentHoleCompleted ? 'bg-green-800' : 'bg-black';
  const scoreBugDarkBgMiddle = isCurrentHoleCompleted ? 'bg-green-700' : 'bg-[#0f172a]';
  const statusLine =
    showScoreEntry
      ? 'HOLE COMPLETE'
      : isAiPlaying && aiShots.length > 0
        ? forScoreLabel(aiShots.length, currentHole.par)
        : currentHoleUser !== undefined
          ? forScoreLabel(currentHoleUser, currentHole.par)
          : `PAR ${currentHole.par} · ${currentHole.yardage} YDS`;

  const handleSubmitScore = () => {
    if (userScore === '' || userScore < 1 || userScore > 15) return;
    const score = typeof userScore === 'number' ? userScore : parseInt(String(userScore), 10);
    setUserScoresByHole((prev) => {
      const next = [...prev];
      next[currentHoleNumber - 1] = score;
      return next;
    });
    setScoreSubmitted(true);
    setShowStatsForm(true);
  };

  const handleNextHole = () => {
    const stats: UserHoleStats = {
      fairway: statFairway,
      ...(statFairway ? {} : { fairwayMiss: statFairwayMiss }),
      gir: statGir,
      ...(statGir ? {} : { girMiss: statGirMiss }),
      scrambling: statScrambling,
      ...(!statScrambling && statScrambleSand ? { scrambleSand: true } : {}),
      putts: statPutts,
    };
    const existing = round.userStatsByHole ?? [];
    const nextStats =
      existing.length >= holeCount
        ? [...existing]
        : [...existing, ...Array(holeCount - existing.length).fill(undefined)];
    nextStats[currentHoleNumber - 1] = stats;
    const nextHole = currentHoleNumber === holeCount ? 1 : currentHoleNumber + 1;
    setRound({ userStatsByHole: nextStats, currentHoleNumber: nextHole });
    setCurrentHoleNumber(nextHole);
    setShowStatsForm(false);
    setUserScore('');
    setScoreSubmitted(false);
    setStatFairway(true);
    setStatFairwayMiss(undefined);
    setStatGir(true);
    setStatGirMiss(undefined);
    setStatScrambling(true);
    setStatScrambleSand(false);
    setStatPutts(2);
  };

  /** Advance to next hole without saving stats (stats are optional). */
  const handleSkipStats = () => {
    const nextHole = currentHoleNumber === holeCount ? 1 : currentHoleNumber + 1;
    setRound({ currentHoleNumber: nextHole });
    setCurrentHoleNumber(nextHole);
    setShowStatsForm(false);
    setUserScore('');
    setScoreSubmitted(false);
    setStatFairway(true);
    setStatFairwayMiss(undefined);
    setStatGir(true);
    setStatGirMiss(undefined);
    setStatScrambling(true);
    setStatScrambleSand(false);
    setStatPutts(2);
  };

  if (!apiKey) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-red-400 p-4 text-center">
        <span className="text-4xl mb-2">⚠️</span>
        <p className="font-semibold">Missing Google Maps API key</p>
        <p className="text-sm text-slate-400 mt-1">Set VITE_GOOGLE_MAPS_API_KEY in .env</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-red-400 p-4 text-center">
        <span className="text-4xl mb-2">⚠️</span>
        <p className="font-semibold">Failed to load Google Maps</p>
        <p className="text-sm text-slate-400 mt-1">
          Enable &quot;Maps JavaScript API&quot; for your key at console.cloud.google.com
        </p>
        {loadError.message && (
          <p className="text-xs mt-2 text-red-300 break-all max-w-full">{loadError.message}</p>
        )}
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-slate-900 text-slate-400">
        Loading map...
      </div>
    );
  }

  if (mapInitError === 'ApiNotActivatedMapError') {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center max-w-md">
        <span className="text-4xl mb-3">⚠️</span>
        <p className="font-semibold text-lg">Maps JavaScript API not enabled</p>
        <p className="text-slate-400 mt-2 text-sm">
          Your API key is valid but the map API is off. Turn it on and ensure billing is enabled:
        </p>
        <ol className="text-left mt-4 space-y-2 text-sm text-slate-300">
          <li>1. Open <a href="https://console.cloud.google.com/apis/library" target="_blank" rel="noopener noreferrer" className="text-green-400 underline">Google Cloud Console → APIs &amp; Services → Library</a></li>
          <li>2. Search for <strong>Maps JavaScript API</strong> and enable it</li>
          <li>3. Ensure your project has <strong>billing</strong> enabled (required for Maps)</li>
          <li>4. Reload this page</li>
        </ol>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col" style={{ overflow: 'hidden' }}>
      <div className="flex-1 min-h-0 relative">
        <GoogleMap
          mapContainerStyle={{ ...mapContainerStyle, position: 'absolute', inset: 0 }}
        center={mapCenter}
        zoom={17}
        options={{
          ...defaultMapOptions,
          // Heading set only in onMapLoad so it isn't reset when the component re-renders (e.g. distance update)
        }}
        onLoad={onMapLoad}
        onClick={(e) => {
          if (e.latLng) setLandingZone({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        }}
      >
        <Marker
          position={teeGreen.tee}
          label={{ text: 'T', color: 'white', fontWeight: 'bold', fontSize: '12px' }}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            scale: 14,
            fillColor: '#1e3a5f',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          }}
          zIndex={1000}
        />
        <Marker
          position={teeGreen.green}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: '#ffffff',
            fillOpacity: 1,
            strokeColor: '#0f766e',
            strokeWeight: 2,
          }}
          zIndex={1000}
        />
        {ballPosition && (
          <Marker
            position={ballPosition}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: '#ffff00',
              fillOpacity: 1,
              strokeColor: '#000000',
              strokeWeight: 2,
            }}
            zIndex={1001}
          />
        )}
        {landingZone && (
          <Marker
            position={landingZone}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 16,
              fillColor: '#ffffff',
              fillOpacity: 1,
              strokeColor: '#1e293b',
              strokeWeight: 2,
            }}
            zIndex={1002}
            cursor="pointer"
          />
        )}
      </GoogleMap>
      </div>

      {/* Wind: direction arrow + mph (top left) */}
      <div className="absolute top-2 left-2 z-[1001] flex items-center gap-2 bg-slate-900/90 backdrop-blur-sm rounded-lg px-2.5 py-1.5 border border-slate-700 shadow-lg">
        {settings.windSpeed > 0 ? (
          <>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-slate-300 shrink-0"
              style={{
                transform: `rotate(${(settings.windDirection + 90) % 360}deg)`,
              }}
              aria-hidden
            >
              <path d="M12 2v20M12 2l4 4M12 2L8 6" />
            </svg>
            <span className="text-sm font-semibold text-white tabular-nums">
              {windFromLabel} {settings.windSpeed} mph
            </span>
          </>
        ) : (
          <span className="text-sm text-slate-400">Calm</span>
        )}
      </div>

      {/* AI commentary – distance, club, shape, height, proximity, weather/lie; summary of tree hits and water */}
      {aiShots.length > 0 && (
        <div className="absolute left-3 top-14 bottom-24 w-56 z-[1000] flex flex-col overflow-hidden">
          <div className="bg-slate-900/95 backdrop-blur-sm rounded-xl border border-slate-700 shadow-lg flex-1 min-h-0 flex flex-col">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-3 pt-2.5 pb-1 border-b border-slate-700">
              AI commentary
            </p>
            {(() => {
              const treeHits = aiShots.filter((s) => s.commentary?.weatherLie === 'Hit tree! Ball deflected.').length;
              const waterPenalties = aiShots.filter((s) => s.commentary?.weatherLie === 'Ball in water – penalty').length;
              const obPenalties = aiShots.filter((s) => s.commentary?.weatherLie === 'Out of bounds – penalty').length;
              if (treeHits > 0 || waterPenalties > 0 || obPenalties > 0) {
                return (
                  <p className="text-[10px] text-slate-500 px-3 py-1 border-b border-slate-700/50">
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
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {aiShots.map((shot) =>
                shot.commentary ? (
                  <div
                    key={shot.shotNumber}
                    className="text-xs bg-slate-800/80 rounded-lg p-2.5 border border-slate-700"
                  >
                    <p className="font-semibold text-white mb-1">Shot {shot.shotNumber}</p>
                    <p className="text-slate-300">
                      <span className="text-green-400 font-medium">{shot.commentary.distanceYards} yds</span>
                      {shot.commentary.club ? ` · ${shot.commentary.club}` : ''}
                    </p>
                    {(shot.commentary.shotShape || shot.commentary.shotHeight) && (
                      <p className="text-slate-400 mt-0.5">
                        {[shot.commentary.shotShape, shot.commentary.shotHeight].filter(Boolean).join(', ')}
                      </p>
                    )}
                    {shot.commentary.proximityToHole != null && shot.commentary.proximityToHole !== '' && (
                      <p className="text-slate-400 mt-0.5">
                        {(shot.commentary.proximityToHole.endsWith(' ft') || shot.commentary.proximityToHole.endsWith(' in'))
                          ? `On green — ${shot.commentary.proximityToHole} from pin`
                          : `Proximity: ${shot.commentary.proximityToHole}`}
                      </p>
                    )}
                    {shot.commentary.weatherLie != null && shot.commentary.weatherLie !== '' && (
                      <p className="text-slate-500 mt-0.5 italic">
                        {shot.commentary.weatherLie}
                      </p>
                    )}
                  </div>
                ) : (
                  <div key={shot.shotNumber} className="text-xs bg-slate-800/80 rounded-lg p-2.5 border border-slate-700">
                    <p className="font-semibold text-white">Shot {shot.shotNumber}</p>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Score bug – upper right; labels stay on one row */}
      <div className="absolute top-2 right-2 z-[1001] w-52 min-w-0 overflow-hidden rounded shadow-xl font-sans">
        {/* Top row: AI and YOU with score vs par (dark bar + blue score box) */}
        <div className={`flex ${scoreBugDarkBg} text-white`}>
          <div className="flex min-w-0 flex-1 items-center justify-between gap-1 pr-1">
            <span className="shrink-0 whitespace-nowrap px-1.5 py-1 text-[10px] font-bold uppercase tracking-wide">
              {aiLabel}
            </span>
            <span className="min-w-[2rem] shrink-0 bg-[#1e40af] px-1.5 py-0.5 text-right text-sm font-bold tabular-nums">
              {aiVsParDisplay}
            </span>
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-between gap-1 pl-1">
            <span className="shrink-0 whitespace-nowrap px-1.5 py-1 text-[10px] font-bold uppercase tracking-wide">
              You
            </span>
            <span className="min-w-[2rem] shrink-0 bg-[#1e40af] px-1.5 py-0.5 text-right text-sm font-bold tabular-nums">
              {userVsParDisplay}
            </span>
          </div>
        </div>
        {/* Middle: shot progression (1..par, or 1..strokes if over par), yardage only */}
        <div className={`flex items-center gap-1 ${scoreBugDarkBgMiddle} px-2 py-1.5 text-white`}>
          <div className="flex items-center gap-0.5">
            {(() => {
              const shotsTaken = isAiPlaying ? aiShots.length : (currentHoleUser ?? 0);
              const nextShot = shotsTaken + 1;
              const par = currentHole.par;
              const maxSlots = Math.max(par, nextShot);
              return Array.from({ length: maxSlots }, (_, i) => i + 1).map((i) => {
                const filled = i <= shotsTaken;
                const isCurrent = i === nextShot;
                return (
                  <span
                    key={i}
                    className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold tabular-nums ${
                      filled ? 'bg-[#1e40af] text-white' : 'bg-white/10 text-white/60'
                    } ${isCurrent ? `ring-1 ring-white ring-offset-1 ${isCurrentHoleCompleted ? 'ring-offset-green-700' : 'ring-offset-[#0f172a]'}` : ''}`}
                  >
                    {i}
                  </span>
                );
              });
            })()}
          </div>
          <div className="ml-1 flex items-center gap-1">
            <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
              {currentHole.yardage} YDS
            </span>
            {currentHole.strokeIndex != null && (
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/80" title="Stroke index">
                HCP {currentHole.strokeIndex}
              </span>
            )}
          </div>
        </div>
        {/* Bottom bar: FOR BIRDIE / FOR PAR / etc. (hidden when hole complete; green logic unchanged) */}
        {statusLine !== 'HOLE COMPLETE' && (
          <div className="bg-[#1e40af] px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wider text-white">
            {statusLine}
          </div>
        )}
        {/* Current hole – rectangular box with prev/next arrows */}
        <div className={`flex items-center justify-between border-t border-white/10 ${scoreBugDarkBg} px-2 py-1.5`}>
          <button
            type="button"
            disabled={showStatsForm}
            className="p-1 text-white/80 hover:text-white disabled:opacity-50 disabled:pointer-events-none"
            aria-label="Previous hole"
            onClick={() => setCurrentHoleNumber((n) => (n === 1 ? holeCount : n - 1))}
          >
            ‹
          </button>
          <span className="text-xs font-bold tabular-nums text-white">Hole {currentHoleNumber}</span>
          <button
            type="button"
            disabled={showStatsForm}
            className="p-1 text-white/80 hover:text-white disabled:opacity-50 disabled:pointer-events-none"
            aria-label="Next hole"
            onClick={() => setCurrentHoleNumber((n) => (n === holeCount ? 1 : n + 1))}
          >
            ›
          </button>
        </div>
      </div>

      <div className="absolute bottom-3 left-12 right-12 z-[1000] space-y-2 max-w-md mx-auto">
        {/* Yardage / distance first so it always loads first */}
        <div className="bg-slate-900/95 backdrop-blur-sm rounded-xl p-3 border border-slate-700">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-green-500/20 rounded-lg">
              <svg
                className="w-4 h-4 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">
                Distance to hole{ballPosition ? ' (from your location)' : ''}
              </p>
              <p className="text-lg font-bold text-white">
                {rawYards !== null ? `${Math.round(rawYards)} yds` : '---'}
              </p>
              {gameState.settings.isProMode && yardageAdjustment && rawYards !== null && (
                <p className="text-xs text-slate-400 mt-0.5">
                  Plays as <span className="text-green-400 font-semibold">{yardageAdjustment.adjustedYards} yds</span>
                  {(yardageAdjustment.windEffectYards !== 0 || yardageAdjustment.slopeEffectYards !== 0) && (
                    <span className="text-slate-500">
                      {' '}(wind {yardageAdjustment.windEffectYards >= 0 ? '+' : ''}{yardageAdjustment.windEffectYards.toFixed(1)},{' '}
                      slope {yardageAdjustment.slopeEffectYards >= 0 ? '+' : ''}{yardageAdjustment.slopeEffectYards.toFixed(1)})
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
        </div>

        {landingZone && (() => {
          const fromPos = ballPosition ?? teeGreen.tee;
          const toTargetRaw = Math.round(calculateHaversineDistance(fromPos, landingZone) * 1.09361);
          const toPinFromTargetRaw = Math.round(calculateHaversineDistance(landingZone, teeGreen.green) * 1.09361);
          const slopeFactor = 1 + settings.slope * 0.01;
          const toTargetAdj = Math.round(toTargetRaw * slopeFactor);
          const toPinFromTargetAdj = Math.round(toPinFromTargetRaw * slopeFactor);
          return (
            <div className="bg-slate-900/95 backdrop-blur-sm rounded-xl p-3 border border-slate-600">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase">To target</p>
                  <p className="font-bold text-white tabular-nums">{toTargetRaw} yds</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase">To target slope adj.</p>
                  <p className="font-bold text-green-400 tabular-nums">{toTargetAdj} yds</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase">Target to pin</p>
                  <p className="font-bold text-white tabular-nums">{toPinFromTargetRaw} yds</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase">Target to pin slope adj.</p>
                  <p className="font-bold text-green-400 tabular-nums">{toPinFromTargetAdj} yds</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLandingZone(null)}
                className="text-xs font-medium text-slate-400 hover:text-white whitespace-nowrap mt-2"
              >
                Clear target
              </button>
            </div>
          );
        })()}
        {!landingZone && (
          <p className="text-[10px] text-slate-500 text-center">Tap map to set landing zone</p>
        )}
        {showScoreEntry && (
          <div className="bg-slate-800/98 backdrop-blur-sm rounded-xl p-4 border border-slate-600 shadow-xl space-y-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Hole complete</p>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] text-slate-500 uppercase">AI score</p>
                <p className="text-xl font-bold text-white">{aiScore}</p>
                {(() => {
                  const s = round.aiStatsByHole?.[currentHoleNumber - 1];
                  return s ? (
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      FW {s.fairwayHit ? '✓' : '✗'} · GIR {s.girHit ? '✓' : '✗'} · Putts {s.putts}
                    </p>
                  ) : null;
                })()}
              </div>
              {!showStatsForm ? (
                <div className="flex-1 flex flex-col gap-1.5">
                  <label htmlFor="user-score" className="text-[10px] text-slate-500 uppercase">Your score</label>
                  <div className="flex gap-2">
                    <input
                      id="user-score"
                      type="number"
                      min={1}
                      max={15}
                      value={userScore === '' ? '' : userScore}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '') setUserScore('');
                        else {
                          const n = parseInt(v, 10);
                          if (!Number.isNaN(n)) setUserScore(Math.max(1, Math.min(15, n)));
                        }
                      }}
                      placeholder="Strokes"
                      className="flex-1 rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <button
                      type="button"
                      onClick={handleSubmitScore}
                      disabled={userScore === '' || userScore < 1}
                      className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:text-slate-500 text-white font-semibold text-sm transition"
                    >
                      Submit
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1">
                  <p className="text-[10px] text-slate-500 uppercase">Your score</p>
                  <p className="text-xl font-bold text-white">{userScoresByHole[currentHoleNumber - 1] ?? '—'}</p>
                </div>
              )}
            </div>
            {showStatsForm && (
              <div className="border-t border-slate-700 pt-3 space-y-3">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Stats</p>
                <StatRow
                  label="Fairway"
                  yesNo={statFairway}
                  onYesNo={setStatFairway}
                  miss={statFairwayMiss}
                  onMiss={setStatFairwayMiss}
                />
                <StatRow
                  label="GIR"
                  yesNo={statGir}
                  onYesNo={setStatGir}
                  miss={statGirMiss}
                  onMiss={setStatGirMiss}
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-300">Scrambling</span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setStatScrambling(true)} className={`px-2 py-1 rounded text-xs font-medium ${statScrambling ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400'}`}>Yes</button>
                    <button type="button" onClick={() => setStatScrambling(false)} className={`px-2 py-1 rounded text-xs font-medium ${!statScrambling ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400'}`}>No</button>
                    {!statScrambling && (
                      <button type="button" onClick={() => setStatScrambleSand((s) => !s)} className={`px-2 py-1 rounded text-xs font-medium ${statScrambleSand ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-400'}`}>Sand</button>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-300">Putts</span>
                  <input type="number" min={0} max={10} value={statPutts} onChange={(e) => { const n = parseInt(e.target.value, 10); setStatPutts(Number.isNaN(n) ? 0 : Math.max(0, Math.min(10, n))); }} className="w-16 rounded bg-slate-700 border border-slate-600 px-2 py-1 text-white text-sm text-center" />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={handleSkipStats} className="flex-1 py-2.5 rounded-lg bg-slate-600 hover:bg-slate-500 text-slate-200 font-semibold text-sm transition">
                    Skip stats
                  </button>
                  <button type="button" onClick={handleNextHole} className="flex-1 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-semibold text-sm transition">
                    Next hole
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={handleAIPlay}
            disabled={isAiPlaying}
            className={`flex-1 font-semibold py-2.5 px-4 rounded-lg text-sm transition transform active:scale-95 flex items-center justify-center gap-1.5 ${
              isAiPlaying
                ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white shadow-lg'
            }`}
          >
            {isAiPlaying ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                AI Playing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                AI Play
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
