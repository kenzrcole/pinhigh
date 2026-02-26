/**
 * PinHigh AI Engine — Patent-aligned Benchmark-to-Dispersion and ballistics.
 */

export {
  getBenchmarkForHandicap,
  BENCHMARK_TABLE,
  type HandicapBenchmark,
  type HandicapTier,
} from './BenchmarkSystem';

export {
  DispersionCalculator,
  type DispersionParams,
} from './DispersionCalculator';

export {
  BallisticsEngine,
  type LatLng,
  type ExecuteShotResult,
  type TrajectoryPoint,
} from './BallisticsEngine';

export {
  detectLie,
  holeFeaturesToGeoJSON,
  type LieType,
  type HoleGeoJSON,
  type LatLng as LieDetectorLatLng,
  type CircleRegion,
  type PolygonRegion,
  type Region,
} from './LieDetector';

export { executePutt, type PuttResult } from './PuttingModule';
