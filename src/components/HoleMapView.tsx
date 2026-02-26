import { useEffect, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Popup, Polyline, useMap } from 'react-leaflet';
import { Icon, LatLngExpression, Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { HoleFeature, Hole, LINCOLN_PARK_COURSE, getHoleByNumber } from '../data/mockHoleData';
import { calculateHaversineDistance } from '../utils/haversine';
import { VirtualGolfer, ShotHistoryEntry } from '../VirtualGolfer';
import { useGolfGame } from '../context/GolfGameContext';
import { Navigation, Target, Wind, TrendingUp, Edit3, Save, Play, Crosshair } from 'lucide-react';
import { DraggableMarker } from './DraggableMarker';
import { DraggableCircle } from './DraggableCircle';
import { MapOverlay } from './MapOverlay';
import { saveHoleLayout, getHoleLayout } from '../services/holeLayoutService';
import { ShotFeed } from './ShotFeed';
import { SmartCaddieOverlay, SmartCaddieSummaryCard } from './SmartCaddieOverlay';
import { useShotPlanningFSM } from '../hooks/useShotPlanningFSM';
import { CLUB_DATABASE, recommendClub } from '../data/clubData';
import { vincentyInverse } from '../utils/geodesic';
import { HazardRisk } from '../types/smartCaddie';
import { HoleSelector } from './HoleSelector';

const teeIcon = new Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 60" width="40" height="60">
      <path d="M20 0 C9 0 0 9 0 20 C0 35 20 60 20 60 S40 35 40 20 C40 9 31 0 20 0 Z" fill="#3b82f6" stroke="#1e40af" stroke-width="2"/>
      <text x="20" y="28" font-size="24" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial">T</text>
    </svg>
  `),
  iconSize: [40, 60],
  iconAnchor: [20, 60],
  popupAnchor: [0, -60],
});

const greenIcon = new Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 60" width="40" height="60">
      <path d="M20 0 C9 0 0 9 0 20 C0 35 20 60 20 60 S40 35 40 20 C40 9 31 0 20 0 Z" fill="#10b981" stroke="#059669" stroke-width="2"/>
      <text x="20" y="28" font-size="24" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial">G</text>
    </svg>
  `),
  iconSize: [40, 60],
  iconAnchor: [20, 60],
  popupAnchor: [0, -60],
});

const userIcon = new Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const aiIcon = new Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function MapViewController({ center }: { center: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, 17, { animate: true });
  }, [center, map]);

  return null;
}

export function HoleMapView() {
  const { gameState, addShotCommentary, clearCommentary } = useGolfGame();
  const [currentHoleNumber, setCurrentHoleNumber] = useState(1);
  const [userPosition, setUserPosition] = useState({ lat: 37.7834, lng: -122.4935 });
  const [distanceToGreen, setDistanceToGreen] = useState<number | null>(null);
  const [aiPosition, setAiPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [shotHistory, setShotHistory] = useState<ShotHistoryEntry[]>([]);
  const [currentShotIndex, setCurrentShotIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [smartCaddieRisk, setSmartCaddieRisk] = useState<HazardRisk | null>(null);
  const [showScoreEntry, setShowScoreEntry] = useState(false);
  const [playerStrokes, setPlayerStrokes] = useState(0);

  const currentHoleData = getHoleByNumber(currentHoleNumber) || LINCOLN_PARK_COURSE.holes[0];
  const [holeFeatures, setHoleFeatures] = useState<HoleFeature[]>(currentHoleData.features);

  const {
    state: planningState,
    context: planningContext,
    startPlanning,
    setTarget,
    updateRisk,
    cancelPlanning,
  } = useShotPlanningFSM();

  const greenFeature = holeFeatures.find((f) => f.type === 'green');
  const teeFeature = holeFeatures.find((f) => f.type === 'tee');
  const landingZones = holeFeatures.filter((f) => f.type === 'fairway');

  console.log('HoleMapView Debug:', {
    currentHoleNumber,
    holeFeatures,
    teeFeature,
    greenFeature,
    editMode
  });

  useEffect(() => {
    const loadHole = async () => {
      const hole = getHoleByNumber(currentHoleNumber);
      if (hole) {
        const savedLayout = await getHoleLayout(currentHoleNumber, LINCOLN_PARK_COURSE.name);

        const features = savedLayout.success && savedLayout.data
          ? savedLayout.data.features
          : hole.features;

        setHoleFeatures(features);
        const tee = features.find((f) => f.type === 'tee');
        if (tee) {
          setUserPosition(tee.coordinates);
        }
        clearCommentary();
        setShotHistory([]);
        setCurrentShotIndex(-1);
        setAiPosition(null);
        setIsPlaying(false);
        cancelPlanning();
        setSmartCaddieRisk(null);
        setShowScoreEntry(false);
        setPlayerStrokes(0);
      }
    };

    loadHole();
  }, [currentHoleNumber]);

  useEffect(() => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setUserPosition({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          if (teeFeature) {
            setUserPosition(teeFeature.coordinates);
          }
        },
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [teeFeature]);

  useEffect(() => {
    if (greenFeature) {
      const distance = calculateHaversineDistance(userPosition, greenFeature.coordinates);
      setDistanceToGreen(distance);
    }
  }, [userPosition, greenFeature]);

  const simulateAIShot = async () => {
    if (!greenFeature || !teeFeature || isPlaying) return;

    clearCommentary();
    setShotHistory([]);
    setCurrentShotIndex(-1);
    setAiPosition(null);
    cancelPlanning();
    setSmartCaddieRisk(null);

    const aiName = gameState.settings.isProMode ? 'Tiger 2000' : 'Average Joe';
    const golfer = new VirtualGolfer(gameState.aiHandicap, 'tee', aiName);
    const result = golfer.playHole(teeFeature.coordinates, greenFeature.coordinates);

    setShotHistory(result.shotHistory);
    setIsPlaying(true);

    for (let i = 0; i < result.shotHistory.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setCurrentShotIndex(i);
      setAiPosition(result.shotHistory[i].end);
      addShotCommentary(result.shotHistory[i].commentary);
    }

    setIsPlaying(false);
    setShowScoreEntry(true);
  };

  const updateFeaturePosition = async (index: number, lat: number, lng: number) => {
    const updated = [...holeFeatures];
    updated[index] = {
      ...updated[index],
      coordinates: { lat, lng },
    };
    setHoleFeatures(updated);

    await saveHoleLayout(currentHoleNumber, LINCOLN_PARK_COURSE.name, updated);
  };

  const toggleEditMode = () => {
    setEditMode(!editMode);
  };

  const handleSmartCaddieToggle = () => {
    if (planningState.type === 'WALKING' && greenFeature) {
      const distanceToTarget = vincentyInverse(userPosition, greenFeature.coordinates).distance;
      const recommendedClub = recommendClub(distanceToTarget);
      startPlanning(recommendedClub);
      setTarget(greenFeature.coordinates);
    } else {
      cancelPlanning();
      setSmartCaddieRisk(null);
    }
  };

  const handleRiskUpdate = (risk: HazardRisk) => {
    setSmartCaddieRisk(risk);
    updateRisk(risk);
  };

  useEffect(() => {
    const loadLayout = async () => {
      const result = await getHoleLayout(currentHoleNumber, LINCOLN_PARK_COURSE.name);

      if (result.success && result.data) {
        setHoleFeatures(result.data.features);
      }
    };

    loadLayout();
  }, [currentHoleNumber]);

  const mapCenter: [number, number] = teeFeature
    ? [teeFeature.coordinates.lat, teeFeature.coordinates.lng]
    : [37.7834, -122.4935];

  return (
    <div className="h-full w-full relative">
      <MapContainer
        center={mapCenter}
        zoom={17}
        className="h-full w-full"
        zoomControl={false}
      >
        <MapViewController center={mapCenter} />
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution='&copy; Esri'
        />

        {holeFeatures.map((feature, idx) => {
          if (feature.type === 'tee') {
            return (
              <DraggableMarker
                key={idx}
                position={[feature.coordinates.lat, feature.coordinates.lng]}
                icon={teeIcon}
                name={feature.name}
                draggable={editMode}
                onDragEnd={(lat, lng) => updateFeaturePosition(idx, lat, lng)}
              />
            );
          }

          if (feature.type === 'green') {
            return (
              <div key={idx}>
                <DraggableMarker
                  position={[feature.coordinates.lat, feature.coordinates.lng]}
                  icon={greenIcon}
                  name={feature.name}
                  draggable={editMode}
                  onDragEnd={(lat, lng) => updateFeaturePosition(idx, lat, lng)}
                />
                <Circle
                  center={[feature.coordinates.lat, feature.coordinates.lng]}
                  radius={feature.radius || 15}
                  pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.3 }}
                />
              </div>
            );
          }

          if (feature.type === 'bunker') {
            return (
              <DraggableCircle
                key={idx}
                position={[feature.coordinates.lat, feature.coordinates.lng]}
                radius={feature.radius || 8}
                name={feature.name}
                draggable={editMode}
                pathOptions={{ color: '#f59e0b', fillColor: '#fbbf24', fillOpacity: 0.5 }}
                onDragEnd={(lat, lng) => updateFeaturePosition(idx, lat, lng)}
              />
            );
          }

          if (feature.type === 'water') {
            return (
              <DraggableCircle
                key={idx}
                position={[feature.coordinates.lat, feature.coordinates.lng]}
                radius={feature.radius || 10}
                name={feature.name}
                draggable={editMode}
                pathOptions={{ color: '#3b82f6', fillColor: '#60a5fa', fillOpacity: 0.6 }}
                onDragEnd={(lat, lng) => updateFeaturePosition(idx, lat, lng)}
              />
            );
          }

          if (feature.type === 'fairway') {
            const teeDistance = teeFeature
              ? calculateHaversineDistance(teeFeature.coordinates, feature.coordinates)
              : 0;
            const greenDistance = greenFeature
              ? calculateHaversineDistance(feature.coordinates, greenFeature.coordinates)
              : 0;

            return (
              <div key={idx}>
                {!editMode ? (
                  <Circle
                    center={[feature.coordinates.lat, feature.coordinates.lng]}
                    radius={feature.radius || 20}
                    pathOptions={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.25 }}
                  />
                ) : (
                  <DraggableCircle
                    position={[feature.coordinates.lat, feature.coordinates.lng]}
                    radius={feature.radius || 20}
                    name={feature.name}
                    draggable={true}
                    pathOptions={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.25 }}
                    onDragEnd={(lat, lng) => updateFeaturePosition(idx, lat, lng)}
                    hideMarker={false}
                  />
                )}
                <MapOverlay
                  position={[feature.coordinates.lat, feature.coordinates.lng]}
                  teeDistance={teeDistance}
                  greenDistance={greenDistance}
                />
              </div>
            );
          }

          return null;
        })}

        <Marker position={[userPosition.lat, userPosition.lng]} icon={userIcon}>
          <Popup>Your Position</Popup>
        </Marker>

        {shotHistory.length > 0 && shotHistory.slice(0, currentShotIndex + 1).map((shot, idx) => (
          <Polyline
            key={`shot-${idx}`}
            positions={[
              [shot.start.lat, shot.start.lng],
              [shot.end.lat, shot.end.lng]
            ]}
            pathOptions={{
              color: '#8b5cf6',
              weight: 3,
              opacity: 0.7,
              dashArray: '5, 10'
            }}
          />
        ))}

        {aiPosition && (
          <Marker position={[aiPosition.lat, aiPosition.lng]} icon={aiIcon}>
            <Popup>
              AI Position
              {currentShotIndex >= 0 && shotHistory[currentShotIndex] && (
                <div className="text-xs mt-1">
                  Shot {currentShotIndex + 1}: {shotHistory[currentShotIndex].club}
                </div>
              )}
            </Popup>
          </Marker>
        )}

        {(planningState.type === 'PLANNING_SHOT' || planningState.type === 'AIMING') &&
          planningContext.selectedClub &&
          planningContext.targetPoint && (
            <SmartCaddieOverlay
              currentPosition={userPosition}
              selectedClub={planningContext.selectedClub}
              initialTarget={planningContext.targetPoint}
              onTargetChange={(target) => setTarget(target)}
              onRiskUpdate={handleRiskUpdate}
              enabled={true}
            />
          )}
      </MapContainer>

      <div className="absolute top-4 left-4 right-4 z-[1000] space-y-3">
        <HoleSelector
          holes={LINCOLN_PARK_COURSE.holes}
          currentHole={currentHoleNumber}
          onHoleSelect={setCurrentHoleNumber}
          courseName={LINCOLN_PARK_COURSE.name}
        />

        {editMode && (
          <div className="bg-amber-600/95 backdrop-blur-sm rounded-2xl p-3 border border-amber-500">
            <div className="flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-white" />
              <p className="text-sm font-semibold text-white">Edit Mode Active - Drag markers to reposition</p>
            </div>
          </div>
        )}
        <div className="bg-slate-900/95 backdrop-blur-sm rounded-2xl p-4 border border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Navigation className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Your Distance to Green</p>
              <p className="text-2xl font-bold text-white">
                {distanceToGreen !== null
                  ? `${Math.round(distanceToGreen * 1.09361)} yds`
                  : '---'}
              </p>
            </div>
          </div>

          {gameState.settings.isProMode && (
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-700">
              <div className="flex items-center gap-2">
                <Wind className="w-4 h-4 text-blue-400" />
                <div>
                  <p className="text-xs text-slate-400">Wind</p>
                  <p className="text-sm font-semibold text-white">
                    {gameState.settings.windSpeed} mph
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-400" />
                <div>
                  <p className="text-xs text-slate-400">Slope</p>
                  <p className="text-sm font-semibold text-white">
                    {gameState.settings.slope}°
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {gameState.shotCommentary.length > 0 && (
          <div className="mt-3">
            <ShotFeed commentary={gameState.shotCommentary} />
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={toggleEditMode}
            className={`flex-1 font-semibold py-3 px-4 rounded-xl transition transform active:scale-95 flex items-center justify-center gap-2 min-h-[44px] ${
              editMode
                ? 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white'
                : 'bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white'
            }`}
          >
            {editMode ? <Save className="w-5 h-5" /> : <Edit3 className="w-5 h-5" />}
            {editMode ? 'Done' : 'Edit'}
          </button>
          <button
            onClick={handleSmartCaddieToggle}
            disabled={editMode || isPlaying}
            className={`flex-1 font-semibold py-3 px-4 rounded-xl transition transform active:scale-95 flex items-center justify-center gap-2 min-h-[44px] ${
              planningState.type === 'PLANNING_SHOT' || planningState.type === 'AIMING'
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white'
                : editMode || isPlaying
                ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white'
            }`}
          >
            <Crosshair className="w-5 h-5" />
            Caddie
          </button>
          <button
            onClick={simulateAIShot}
            disabled={editMode || isPlaying}
            className={`flex-1 font-semibold py-3 px-4 rounded-xl transition transform active:scale-95 flex items-center justify-center gap-2 min-h-[44px] ${
              editMode || isPlaying
                ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white'
            }`}
          >
            {isPlaying ? (
              <>
                <Play className="w-5 h-5 animate-pulse" />
                Playing...
              </>
            ) : (
              <>
                <Target className="w-5 h-5" />
                Simulate
              </>
            )}
          </button>
        </div>

        {(planningState.type === 'PLANNING_SHOT' || planningState.type === 'AIMING') &&
          planningContext.selectedClub &&
          greenFeature && (
            <div className="mt-3">
              <SmartCaddieSummaryCard
                selectedClub={planningContext.selectedClub}
                riskAssessment={smartCaddieRisk}
                distanceToTarget={
                  vincentyInverse(userPosition, greenFeature.coordinates).distance
                }
              />
            </div>
          )}
      </div>

      {showScoreEntry && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[2000]">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Hole {currentHoleNumber} Complete</h2>
            <p className="text-gray-600 mb-4">AI Score: {shotHistory.length} strokes</p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Score:
              </label>
              <input
                type="number"
                min="1"
                max="15"
                value={playerStrokes || ''}
                onChange={(e) => setPlayerStrokes(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-lg"
                placeholder="Enter strokes"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (playerStrokes > 0) {
                    addShotCommentary(`You completed hole ${currentHoleNumber} in ${playerStrokes} strokes!`);
                    setShowScoreEntry(false);
                    setPlayerStrokes(0);
                  }
                }}
                disabled={playerStrokes === 0}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
              >
                Submit Score
              </button>
              <button
                onClick={() => {
                  setShowScoreEntry(false);
                  setPlayerStrokes(0);
                }}
                className="px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-semibold transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
