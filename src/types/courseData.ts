export interface GeoCoordinate {
  lat: number;
  lng: number;
}

export interface CourseFeature {
  type: 'tee' | 'green' | 'bunker';
  coordinates: GeoCoordinate;
  name?: string;
}

export interface HoleData {
  holeNumber: number;
  par: number;
  tee: GeoCoordinate;
  green: GeoCoordinate;
  bunkers: GeoCoordinate[];
}
