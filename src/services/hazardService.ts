import { GeoCoordinate } from '../types/courseData';
import { Hazard, HazardRisk, RiskLevel, DispersionPolygon } from '../types/smartCaddie';

interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

/**
 * Service for fetching hazard data from OpenStreetMap and performing
 * geometric intersection analysis.
 */
export class HazardService {
  private static readonly OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';
  private static readonly CACHE_DURATION_MS = 5 * 60 * 1000;
  private static hazardCache = new Map<string, { data: Hazard[]; timestamp: number }>();

  /**
   * Fetches golf hazards (bunkers, water hazards) from OpenStreetMap
   * using the Overpass API.
   *
   * @param bbox - Bounding box defining the search area
   * @returns Array of hazard polygons with GeoJSON geometry
   */
  static async fetchHazards(bbox: BoundingBox): Promise<Hazard[]> {
    const cacheKey = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
    const cached = this.hazardCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION_MS) {
      return cached.data;
    }

    const query = `
      [out:json][timeout:25];
      (
        way["golf"="bunker"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
        way["golf"="water_hazard"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
        way["natural"="water"]["golf"="yes"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
        way["landuse"="grass"]["golf"="rough"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      );
      out body;
      >;
      out skel qt;
    `;

    try {
      const response = await fetch(this.OVERPASS_API_URL, {
        method: 'POST',
        body: query,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (!response.ok) {
        throw new Error(`Overpass API error: ${response.status}`);
      }

      const data = await response.json();
      const hazards = this.parseOverpassResponse(data);

      this.hazardCache.set(cacheKey, {
        data: hazards,
        timestamp: Date.now(),
      });

      return hazards;
    } catch (error) {
      console.error('Failed to fetch hazards from OSM:', error);
      return [];
    }
  }

  /**
   * Parses Overpass API response and converts OSM ways to GeoJSON hazard objects.
   *
   * @param osmData - Raw OSM data from Overpass API
   * @returns Array of parsed hazards
   */
  private static parseOverpassResponse(osmData: any): Hazard[] {
    const hazards: Hazard[] = [];
    const nodeMap = new Map<number, { lat: number; lon: number }>();

    for (const element of osmData.elements) {
      if (element.type === 'node') {
        nodeMap.set(element.id, { lat: element.lat, lon: element.lon });
      }
    }

    for (const element of osmData.elements) {
      if (element.type === 'way' && element.nodes && element.tags) {
        const coordinates: number[][] = [];

        for (const nodeId of element.nodes) {
          const node = nodeMap.get(nodeId);
          if (node) {
            coordinates.push([node.lon, node.lat]);
          }
        }

        if (coordinates.length < 3) continue;

        if (
          coordinates[0][0] !== coordinates[coordinates.length - 1][0] ||
          coordinates[0][1] !== coordinates[coordinates.length - 1][1]
        ) {
          coordinates.push([...coordinates[0]]);
        }

        let hazardType: 'bunker' | 'water_hazard' | 'rough' = 'rough';
        if (element.tags.golf === 'bunker') {
          hazardType = 'bunker';
        } else if (
          element.tags.golf === 'water_hazard' ||
          (element.tags.natural === 'water' && element.tags.golf === 'yes')
        ) {
          hazardType = 'water_hazard';
        } else if (element.tags.golf === 'rough') {
          hazardType = 'rough';
        }

        hazards.push({
          type: hazardType,
          geometry: {
            type: 'Polygon',
            coordinates: [coordinates],
          },
          properties: {
            name: element.tags.name || `${hazardType}_${element.id}`,
            id: String(element.id),
          },
        });
      }
    }

    return hazards;
  }

  /**
   * Calculates risk assessment by detecting intersections between the dispersion
   * polygon and hazard polygons using ray casting algorithm.
   *
   * @param dispersionPolygon - 2σ confidence ellipse from useDispersion
   * @param hazards - Array of hazard polygons from OSM
   * @param monteCarloPoints - Optional simulated shot points for probabilistic analysis
   * @returns Risk assessment with probability breakdowns
   */
  static assessRisk(
    dispersionPolygon: DispersionPolygon,
    hazards: Hazard[],
    monteCarloPoints?: GeoCoordinate[]
  ): HazardRisk {
    if (hazards.length === 0) {
      return {
        riskLevel: 'Low',
        bunkerProbability: 0,
        waterProbability: 0,
        roughProbability: 0,
        details: 'No hazards detected in area.',
      };
    }

    let bunkerIntersections = 0;
    let waterIntersections = 0;
    let roughIntersections = 0;

    if (monteCarloPoints && monteCarloPoints.length > 0) {
      for (const point of monteCarloPoints) {
        for (const hazard of hazards) {
          if (this.isPointInPolygon(point, hazard.geometry.coordinates[0])) {
            if (hazard.type === 'bunker') bunkerIntersections++;
            else if (hazard.type === 'water_hazard') waterIntersections++;
            else if (hazard.type === 'rough') roughIntersections++;
            break;
          }
        }
      }

      const total = monteCarloPoints.length;
      const bunkerProb = bunkerIntersections / total;
      const waterProb = waterIntersections / total;
      const roughProb = roughIntersections / total;

      return this.determineRiskLevel(bunkerProb, waterProb, roughProb);
    }

    const dispersionPoints = dispersionPolygon.coordinates[0].map(coord => ({
      lat: coord[1],
      lng: coord[0],
    }));

    for (const point of dispersionPoints) {
      for (const hazard of hazards) {
        if (this.isPointInPolygon(point, hazard.geometry.coordinates[0])) {
          if (hazard.type === 'bunker') bunkerIntersections++;
          else if (hazard.type === 'water_hazard') waterIntersections++;
          else if (hazard.type === 'rough') roughIntersections++;
          break;
        }
      }
    }

    const checkPolygonIntersection = this.doPolygonsIntersect(
      dispersionPolygon.coordinates[0],
      hazards
    );

    if (checkPolygonIntersection.intersects) {
      const total = dispersionPoints.length;
      const bunkerProb = (bunkerIntersections / total) * 0.7;
      const waterProb = (waterIntersections / total) * 0.7;
      const roughProb = (roughIntersections / total) * 0.5;

      return this.determineRiskLevel(bunkerProb, waterProb, roughProb);
    }

    return {
      riskLevel: 'Low',
      bunkerProbability: 0,
      waterProbability: 0,
      roughProbability: 0,
      details: 'Clear shot - no hazard risk.',
    };
  }

  /**
   * Ray Casting Algorithm - Determines if a point is inside a polygon.
   * Casts a ray from the point to infinity and counts edge crossings.
   *
   * @param point - Test point {lat, lng}
   * @param polygonCoords - Polygon coordinates as [lng, lat][] array
   * @returns true if point is inside polygon
   */
  private static isPointInPolygon(point: GeoCoordinate, polygonCoords: number[][]): boolean {
    let inside = false;
    const x = point.lng;
    const y = point.lat;

    for (let i = 0, j = polygonCoords.length - 1; i < polygonCoords.length; j = i++) {
      const xi = polygonCoords[i][0];
      const yi = polygonCoords[i][1];
      const xj = polygonCoords[j][0];
      const yj = polygonCoords[j][1];

      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

      if (intersect) inside = !inside;
    }

    return inside;
  }

  /**
   * Detects if dispersion polygon intersects with any hazard polygons.
   * Uses edge-crossing and vertex-containment checks.
   *
   * @param dispersionCoords - Dispersion polygon coordinates [lng, lat][]
   * @param hazards - Array of hazards to check
   * @returns Intersection result with details
   */
  private static doPolygonsIntersect(
    dispersionCoords: number[][],
    hazards: Hazard[]
  ): { intersects: boolean; hazardTypes: Set<string> } {
    const hazardTypes = new Set<string>();

    for (const hazard of hazards) {
      const hazardCoords = hazard.geometry.coordinates[0];

      for (const dispPoint of dispersionCoords) {
        if (this.isPointInPolygon({ lat: dispPoint[1], lng: dispPoint[0] }, hazardCoords)) {
          hazardTypes.add(hazard.type);
          return { intersects: true, hazardTypes };
        }
      }

      for (const hazardPoint of hazardCoords) {
        if (
          this.isPointInPolygon(
            { lat: hazardPoint[1], lng: hazardPoint[0] },
            dispersionCoords
          )
        ) {
          hazardTypes.add(hazard.type);
          return { intersects: true, hazardTypes };
        }
      }
    }

    return { intersects: false, hazardTypes };
  }

  /**
   * Determines overall risk level based on hazard probabilities.
   *
   * @param bunkerProb - Probability of landing in bunker (0-1)
   * @param waterProb - Probability of landing in water (0-1)
   * @param roughProb - Probability of landing in rough (0-1)
   * @returns Risk assessment object
   */
  private static determineRiskLevel(
    bunkerProb: number,
    waterProb: number,
    roughProb: number
  ): HazardRisk {
    const totalRisk = bunkerProb + waterProb * 2 + roughProb * 0.5;

    let riskLevel: RiskLevel;
    let details: string;

    if (totalRisk > 0.3 || waterProb > 0.15) {
      riskLevel = 'High';
      details = 'High hazard risk - consider club down or aim away.';
    } else if (totalRisk > 0.15 || bunkerProb > 0.2) {
      riskLevel = 'Medium';
      details = 'Moderate hazard risk - play with caution.';
    } else {
      riskLevel = 'Low';
      details = 'Low hazard risk - favorable conditions.';
    }

    return {
      riskLevel,
      bunkerProbability: Math.round(bunkerProb * 100) / 100,
      waterProbability: Math.round(waterProb * 100) / 100,
      roughProbability: Math.round(roughProb * 100) / 100,
      details,
    };
  }

  /**
   * Creates a bounding box around a center point with specified radius.
   *
   * @param center - Center coordinate
   * @param radiusMeters - Radius in meters
   * @returns Bounding box for Overpass API query
   */
  static createBoundingBox(center: GeoCoordinate, radiusMeters: number): BoundingBox {
    const latDelta = (radiusMeters / 111320);
    const lngDelta = radiusMeters / (111320 * Math.cos((center.lat * Math.PI) / 180));

    return {
      south: center.lat - latDelta,
      west: center.lng - lngDelta,
      north: center.lat + latDelta,
      east: center.lng + lngDelta,
    };
  }
}
