import { HoleData } from '../types/courseData';

export function fetchCourseData(): HoleData {
  return {
    holeNumber: 1,
    par: 4,
    tee: {
      lat: 34.0522,
      lng: -118.2437,
    },
    green: {
      lat: 34.0542,
      lng: -118.2417,
    },
    bunkers: [
      {
        lat: 34.0532,
        lng: -118.2427,
      },
      {
        lat: 34.0538,
        lng: -118.2420,
      },
      {
        lat: 34.0540,
        lng: -118.2415,
      },
    ],
  };
}
