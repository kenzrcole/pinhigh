import { GeoCoordinate } from '../types/courseData';

const WGS84_A = 6378137.0;
const WGS84_B = 6356752.314245;
const WGS84_F = 1 / 298.257223563;

export interface GeodesicResult {
  distance: number;
  initialBearing: number;
  finalBearing: number;
}

/**
 * Vincenty's Inverse Formula - Calculates geodesic distance between two points
 * on WGS-84 ellipsoid with sub-millimeter precision.
 *
 * @param coord1 - Starting coordinate {lat, lng} in decimal degrees
 * @param coord2 - Ending coordinate {lat, lng} in decimal degrees
 * @returns Object containing distance (meters), initial bearing (degrees), final bearing (degrees)
 *
 * Reference: Vincenty, T. (1975). "Direct and Inverse Solutions of Geodesics on the Ellipsoid"
 */
export function vincentyInverse(coord1: GeoCoordinate, coord2: GeoCoordinate): GeodesicResult {
  const lat1 = (coord1.lat * Math.PI) / 180;
  const lat2 = (coord2.lat * Math.PI) / 180;
  const lon1 = (coord1.lng * Math.PI) / 180;
  const lon2 = (coord2.lng * Math.PI) / 180;

  const L = lon2 - lon1;
  const U1 = Math.atan((1 - WGS84_F) * Math.tan(lat1));
  const U2 = Math.atan((1 - WGS84_F) * Math.tan(lat2));
  const sinU1 = Math.sin(U1);
  const cosU1 = Math.cos(U1);
  const sinU2 = Math.sin(U2);
  const cosU2 = Math.cos(U2);

  let lambda = L;
  let lambdaP = 2 * Math.PI;
  let iterLimit = 100;
  let sinLambda, cosLambda, sinSigma, cosSigma, sigma, sinAlpha, cosSqAlpha, cos2SigmaM;

  while (Math.abs(lambda - lambdaP) > 1e-12 && --iterLimit > 0) {
    sinLambda = Math.sin(lambda);
    cosLambda = Math.cos(lambda);
    sinSigma = Math.sqrt(
      (cosU2 * sinLambda) * (cosU2 * sinLambda) +
      (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) * (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda)
    );

    if (sinSigma === 0) {
      return { distance: 0, initialBearing: 0, finalBearing: 0 };
    }

    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
    sigma = Math.atan2(sinSigma, cosSigma);
    sinAlpha = (cosU1 * cosU2 * sinLambda) / sinSigma;
    cosSqAlpha = 1 - sinAlpha * sinAlpha;
    cos2SigmaM = cosSigma - (2 * sinU1 * sinU2) / cosSqAlpha;

    if (isNaN(cos2SigmaM)) {
      cos2SigmaM = 0;
    }

    const C = (WGS84_F / 16) * cosSqAlpha * (4 + WGS84_F * (4 - 3 * cosSqAlpha));
    lambdaP = lambda;
    lambda = L + (1 - C) * WGS84_F * sinAlpha * (
      sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM))
    );
  }

  if (iterLimit === 0) {
    return { distance: 0, initialBearing: 0, finalBearing: 0 };
  }

  const uSq = cosSqAlpha! * (WGS84_A * WGS84_A - WGS84_B * WGS84_B) / (WGS84_B * WGS84_B);
  const A = 1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const B = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  const deltaSigma = B * sinSigma! * (
    cos2SigmaM! + (B / 4) * (
      cosSigma! * (-1 + 2 * cos2SigmaM! * cos2SigmaM!) -
      (B / 6) * cos2SigmaM! * (-3 + 4 * sinSigma! * sinSigma!) * (-3 + 4 * cos2SigmaM! * cos2SigmaM!)
    )
  );

  const distance = WGS84_B * A * (sigma! - deltaSigma);

  const initialBearing = Math.atan2(
    cosU2 * sinLambda!,
    cosU1 * sinU2 - sinU1 * cosU2 * cosLambda!
  );

  const finalBearing = Math.atan2(
    cosU1 * sinLambda!,
    -sinU1 * cosU2 + cosU1 * sinU2 * cosLambda!
  );

  return {
    distance,
    initialBearing: ((initialBearing * 180) / Math.PI + 360) % 360,
    finalBearing: ((finalBearing * 180) / Math.PI + 360) % 360,
  };
}

/**
 * Vincenty's Direct Formula - Calculates destination point given start point,
 * bearing, and distance on WGS-84 ellipsoid.
 *
 * @param start - Starting coordinate {lat, lng} in decimal degrees
 * @param bearing - Initial bearing in degrees (0-360, clockwise from North)
 * @param distance - Distance to travel in meters
 * @returns Destination coordinate {lat, lng} in decimal degrees
 *
 * Reference: Vincenty, T. (1975). "Direct and Inverse Solutions of Geodesics on the Ellipsoid"
 */
export function vincentyDirect(start: GeoCoordinate, bearing: number, distance: number): GeoCoordinate {
  const lat1 = (start.lat * Math.PI) / 180;
  const lon1 = (start.lng * Math.PI) / 180;
  const alpha1 = (bearing * Math.PI) / 180;
  const s = distance;

  const sinAlpha1 = Math.sin(alpha1);
  const cosAlpha1 = Math.cos(alpha1);

  const tanU1 = (1 - WGS84_F) * Math.tan(lat1);
  const cosU1 = 1 / Math.sqrt(1 + tanU1 * tanU1);
  const sinU1 = tanU1 * cosU1;

  const sigma1 = Math.atan2(tanU1, cosAlpha1);
  const sinAlpha = cosU1 * sinAlpha1;
  const cosSqAlpha = 1 - sinAlpha * sinAlpha;
  const uSq = cosSqAlpha * (WGS84_A * WGS84_A - WGS84_B * WGS84_B) / (WGS84_B * WGS84_B);
  const A = 1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const B = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));

  let sigma = s / (WGS84_B * A);
  let sigmaP = 2 * Math.PI;
  let cos2SigmaM, sinSigma, cosSigma;
  let iterLimit = 100;

  while (Math.abs(sigma - sigmaP) > 1e-12 && --iterLimit > 0) {
    cos2SigmaM = Math.cos(2 * sigma1 + sigma);
    sinSigma = Math.sin(sigma);
    cosSigma = Math.cos(sigma);
    const deltaSigma = B * sinSigma * (
      cos2SigmaM + (B / 4) * (
        cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
        (B / 6) * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM)
      )
    );
    sigmaP = sigma;
    sigma = s / (WGS84_B * A) + deltaSigma;
  }

  if (iterLimit === 0) {
    return start;
  }

  const tmp = sinU1 * sinSigma! - cosU1 * cosSigma! * cosAlpha1;
  const lat2 = Math.atan2(
    sinU1 * cosSigma! + cosU1 * sinSigma! * cosAlpha1,
    (1 - WGS84_F) * Math.sqrt(sinAlpha * sinAlpha + tmp * tmp)
  );

  const lambda = Math.atan2(
    sinSigma! * sinAlpha1,
    cosU1 * cosSigma! - sinU1 * sinSigma! * cosAlpha1
  );

  const C = (WGS84_F / 16) * cosSqAlpha * (4 + WGS84_F * (4 - 3 * cosSqAlpha));
  const L = lambda - (1 - C) * WGS84_F * sinAlpha * (
    sigma! + C * sinSigma! * (cos2SigmaM! + C * cosSigma! * (-1 + 2 * cos2SigmaM! * cos2SigmaM!))
  );

  const lon2 = lon1 + L;

  return {
    lat: (lat2 * 180) / Math.PI,
    lng: (lon2 * 180) / Math.PI,
  };
}

/**
 * Box-Muller Transform - Generates normally distributed random numbers
 * from uniform random variables.
 *
 * @returns A random number from standard normal distribution (mean=0, std=1)
 *
 * Reference: Box, G.E.P., Muller, M.E. (1958). "A Note on the Generation of Random Normal Deviates"
 */
export function boxMullerTransform(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

/**
 * Generates a pair of independent standard normal random variables
 * using the Box-Muller transform.
 *
 * @returns Tuple of two independent N(0,1) random variables
 */
export function boxMullerPair(): [number, number] {
  const u1 = Math.random();
  const u2 = Math.random();
  const r = Math.sqrt(-2.0 * Math.log(u1));
  const theta = 2.0 * Math.PI * u2;
  return [r * Math.cos(theta), r * Math.sin(theta)];
}
