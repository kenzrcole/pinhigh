export interface HoleFeature {
  type: 'tee' | 'fairway' | 'green' | 'bunker' | 'water' | 'rough' | 'tree';
  name: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  radius?: number;
  /** Tree height in meters (for tree features); used for "hit over" logic. */
  heightMeters?: number;
}

export interface Hole {
  number: number;
  par: number;
  yardage: number;
  /** Stroke index 1–18 (1 = hardest, 18 = easiest). Used for handicap strokes and net score. */
  strokeIndex?: number;
  features: HoleFeature[];
}

export const HOLE_1_DATA: Hole = {
  number: 9,
  par: 4,
  yardage: 478,
  features: [
    {
      type: 'tee',
      name: 'Championship Tee',
      coordinates: {
        lat: 37.7234,
        lng: -122.4965,
      },
    },
    {
      type: 'fairway',
      name: 'Landing Zone',
      coordinates: {
        lat: 37.7245,
        lng: -122.4955,
      },
      radius: 25,
    },
    {
      type: 'bunker',
      name: 'Left Fairway Bunker',
      coordinates: {
        lat: 37.7243,
        lng: -122.4958,
      },
      radius: 6,
    },
    {
      type: 'bunker',
      name: 'Right Fairway Bunker',
      coordinates: {
        lat: 37.7247,
        lng: -122.4953,
      },
      radius: 6,
    },
    {
      type: 'water',
      name: 'Lake',
      coordinates: {
        lat: 37.7252,
        lng: -122.4947,
      },
      radius: 18,
    },
    {
      type: 'bunker',
      name: 'Greenside Bunker Left',
      coordinates: {
        lat: 37.7255,
        lng: -122.4946,
      },
      radius: 5,
    },
    {
      type: 'bunker',
      name: 'Greenside Bunker Right',
      coordinates: {
        lat: 37.7257,
        lng: -122.4943,
      },
      radius: 5,
    },
    {
      type: 'green',
      name: 'Hole 9 Green',
      coordinates: {
        lat: 37.7256,
        lng: -122.4945,
      },
      radius: 12,
    },
  ],
};

export const MOCK_COURSE_DATA = {
  name: 'TPC Harding Park',
  location: 'San Francisco, CA',
  holes: [HOLE_1_DATA],
};

export { LINCOLN_PARK_COURSE, LINCOLN_PARK_HOLES, getHoleByNumber } from './lincolnParkCourse';
