import { GeoCoordinate } from './courseData';

export interface ClubStats {
  name: string;
  meanDistance: number;
  standardDeviation: number;
  dispersionAngle: number;
}

export interface DispersionPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface DispersionResult {
  polygon: DispersionPolygon;
  confidencePoints: GeoCoordinate[];
  centerPoint: GeoCoordinate;
}

export type RiskLevel = 'Low' | 'Medium' | 'High';

export interface HazardRisk {
  riskLevel: RiskLevel;
  bunkerProbability: number;
  waterProbability: number;
  roughProbability: number;
  details: string;
}

export interface Hazard {
  type: 'bunker' | 'water_hazard' | 'rough';
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: {
    name?: string;
    id: string;
  };
}

export type ShotPlanningState =
  | { type: 'WALKING' }
  | { type: 'PLANNING_SHOT'; clubSelected: string }
  | { type: 'AIMING'; target: GeoCoordinate; club: ClubStats }
  | { type: 'SHOT_COMPLETE' };

export interface ShotPlanningContext {
  selectedClub: ClubStats | null;
  targetPoint: GeoCoordinate | null;
  dispersionData: DispersionResult | null;
  riskAssessment: HazardRisk | null;
}
