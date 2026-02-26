import { useState, useEffect, useCallback } from 'react';
import { Polygon, Marker, useMapEvents } from 'react-leaflet';
import { Icon, LatLngExpression, DragEndEvent, LeafletMouseEvent } from 'leaflet';
import { Target, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';
import { GeoCoordinate } from '../types/courseData';
import { ClubStats, HazardRisk, Hazard } from '../types/smartCaddie';
import { useDispersion, useMonteCarloDispersion } from '../hooks/useDispersion';
import { HazardService } from '../services/hazardService';

interface SmartCaddieOverlayProps {
  currentPosition: GeoCoordinate;
  selectedClub: ClubStats;
  initialTarget?: GeoCoordinate;
  onTargetChange?: (target: GeoCoordinate) => void;
  onRiskUpdate?: (risk: HazardRisk) => void;
  enabled: boolean;
}

const targetIcon = new Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

/**
 * SmartCaddieOverlay - Renders probabilistic shot dispersion visualization with
 * real-time hazard risk assessment.
 *
 * Features:
 * - 2σ confidence ellipse visualization
 * - Draggable target marker
 * - Real-time risk calculation via OSM hazard data
 * - Color-coded risk visualization (Green = Low, Orange = Medium, Red = High)
 * - Pulse animation for high-risk shots
 */
export function SmartCaddieOverlay({
  currentPosition,
  selectedClub,
  initialTarget,
  onTargetChange,
  onRiskUpdate,
  enabled,
}: SmartCaddieOverlayProps) {
  const [targetPoint, setTargetPoint] = useState<GeoCoordinate>(
    initialTarget || currentPosition
  );
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [riskAssessment, setRiskAssessment] = useState<HazardRisk | null>(null);
  const [isLoadingHazards, setIsLoadingHazards] = useState(false);

  const dispersionData = useDispersion(selectedClub, currentPosition, targetPoint);
  const monteCarloPoints = useMonteCarloDispersion(
    selectedClub,
    currentPosition,
    targetPoint,
    100
  );

  useEffect(() => {
    if (!enabled) return;

    const fetchHazardsData = async () => {
      setIsLoadingHazards(true);
      const bbox = HazardService.createBoundingBox(currentPosition, 500);
      const fetchedHazards = await HazardService.fetchHazards(bbox);
      setHazards(fetchedHazards);
      setIsLoadingHazards(false);
    };

    fetchHazardsData();
  }, [currentPosition, enabled]);

  useEffect(() => {
    if (!dispersionData || !enabled) return;

    const risk = HazardService.assessRisk(
      dispersionData.polygon,
      hazards,
      monteCarloPoints
    );
    setRiskAssessment(risk);

    if (onRiskUpdate) {
      onRiskUpdate(risk);
    }
  }, [dispersionData, hazards, monteCarloPoints, enabled, onRiskUpdate]);

  const handleTargetDragEnd = useCallback(
    (event: DragEndEvent) => {
      const newLatLng = event.target.getLatLng();
      const newTarget: GeoCoordinate = {
        lat: newLatLng.lat,
        lng: newLatLng.lng,
      };
      setTargetPoint(newTarget);

      if (onTargetChange) {
        onTargetChange(newTarget);
      }
    },
    [onTargetChange]
  );

  useMapEvents({
    click: (e: LeafletMouseEvent) => {
      if (enabled && e.originalEvent.shiftKey) {
        const newTarget: GeoCoordinate = {
          lat: e.latlng.lat,
          lng: e.latlng.lng,
        };
        setTargetPoint(newTarget);

        if (onTargetChange) {
          onTargetChange(newTarget);
        }
      }
    },
  });

  if (!enabled || !dispersionData) {
    return null;
  }

  const polygonPositions: LatLngExpression[] = dispersionData.confidencePoints.map((point) => [
    point.lat,
    point.lng,
  ]);

  const getRiskColor = (): { fill: string; stroke: string; opacity: number } => {
    if (!riskAssessment) {
      return { fill: '#10b981', stroke: '#059669', opacity: 0.2 };
    }

    switch (riskAssessment.riskLevel) {
      case 'Low':
        return { fill: '#10b981', stroke: '#059669', opacity: 0.2 };
      case 'Medium':
        return { fill: '#f59e0b', stroke: '#d97706', opacity: 0.3 };
      case 'High':
        return { fill: '#ef4444', stroke: '#dc2626', opacity: 0.4 };
    }
  };

  const { fill, stroke, opacity } = getRiskColor();

  return (
    <>
      <Polygon
        positions={polygonPositions}
        pathOptions={{
          color: stroke,
          fillColor: fill,
          fillOpacity: opacity,
          weight: 3,
          className: riskAssessment?.riskLevel === 'High' ? 'pulse-animation' : '',
        }}
      />

      <Marker
        position={[targetPoint.lat, targetPoint.lng]}
        icon={targetIcon}
        draggable={true}
        eventHandlers={{
          dragend: handleTargetDragEnd,
        }}
      />

      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 0.4;
          }
          50% {
            opacity: 0.7;
          }
        }

        .pulse-animation {
          animation: pulse 2s ease-in-out infinite;
        }
      `}</style>
    </>
  );
}

interface SmartCaddieSummaryCardProps {
  selectedClub: ClubStats;
  riskAssessment: HazardRisk | null;
  distanceToTarget: number;
  isLoading?: boolean;
}

/**
 * Summary card displaying shot information and risk assessment.
 * Positioned at bottom of screen as "Heads Up Display".
 */
export function SmartCaddieSummaryCard({
  selectedClub,
  riskAssessment,
  distanceToTarget,
  isLoading,
}: SmartCaddieSummaryCardProps) {
  const getRiskIcon = () => {
    if (!riskAssessment) return <CheckCircle className="w-5 h-5 text-green-400" />;

    switch (riskAssessment.riskLevel) {
      case 'Low':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'Medium':
        return <TrendingUp className="w-5 h-5 text-amber-400" />;
      case 'High':
        return <AlertTriangle className="w-5 h-5 text-red-400" />;
    }
  };

  const getRiskColorClass = () => {
    if (!riskAssessment) return 'from-green-600/20 to-green-700/20 border-green-500/30';

    switch (riskAssessment.riskLevel) {
      case 'Low':
        return 'from-green-600/20 to-green-700/20 border-green-500/30';
      case 'Medium':
        return 'from-amber-600/20 to-amber-700/20 border-amber-500/30';
      case 'High':
        return 'from-red-600/20 to-red-700/20 border-red-500/30';
    }
  };

  return (
    <div
      className={`bg-gradient-to-r ${getRiskColorClass()} backdrop-blur-sm rounded-2xl p-4 border`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-slate-300" />
          <div>
            <p className="text-sm font-semibold text-white">{selectedClub.name}</p>
            <p className="text-xs text-slate-400">
              {Math.round(selectedClub.meanDistance * 1.09361)}y carry • ±
              {Math.round(selectedClub.standardDeviation * 1.09361)}y
            </p>
          </div>
        </div>
        {getRiskIcon()}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-slate-400"></div>
          <span>Analyzing hazards...</span>
        </div>
      ) : riskAssessment ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300">Risk Level:</span>
            <span
              className={`font-semibold ${
                riskAssessment.riskLevel === 'Low'
                  ? 'text-green-400'
                  : riskAssessment.riskLevel === 'Medium'
                  ? 'text-amber-400'
                  : 'text-red-400'
              }`}
            >
              {riskAssessment.riskLevel}
            </span>
          </div>

          {riskAssessment.bunkerProbability > 0 && (
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Bunker Risk:</span>
              <span>{Math.round(riskAssessment.bunkerProbability * 100)}%</span>
            </div>
          )}

          {riskAssessment.waterProbability > 0 && (
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Water Risk:</span>
              <span>{Math.round(riskAssessment.waterProbability * 100)}%</span>
            </div>
          )}

          <p className="text-xs text-slate-300 mt-2 italic">{riskAssessment.details}</p>
        </div>
      ) : (
        <p className="text-xs text-slate-400">No hazard data available</p>
      )}

      <div className="mt-3 pt-3 border-t border-slate-700">
        <p className="text-xs text-slate-500">
          💡 Shift+Click map or drag target to adjust aim
        </p>
      </div>
    </div>
  );
}
