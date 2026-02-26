/**
 * Dispersion Calculator — Patent-aligned mapping from benchmark stats to Gaussian parameters.
 * GIR scaling: higher GIR → tighter dispersion. Scrambling multiplier for chip shots.
 */

import { getBenchmarkForHandicap, type HandicapBenchmark } from './BenchmarkSystem';

/** Reference GIR used for scaling (e.g. 37%). Better players have GIR ≥ this → scale ≤ 1. */
const REFERENCE_GIR_PERCENT = 37;
const GIR_SCALE_MIN = 1.0;
const GIR_SCALE_MAX = 1.4;

/** Full-shot dispersion: base as function of handicap, then scaled by GIR. */
const DISTANCE_BASE_MIN = 0.02;
const DISTANCE_BASE_MAX = 0.28;
const DISTANCE_BASE_PER_HCP = 0.006;

const ANGULAR_BASE_MIN = 1.0;
const ANGULAR_BASE_MAX = 9;
const ANGULAR_BASE_PER_HCP = 0.25;

/** Scrambling multiplier for chips: 7.5 + (50 - scramblingPercent)/4. Higher scrambling → smaller multiplier. */
const SCRAMBLE_REFERENCE = 50;
const CHIP_MULTIPLIER_OFFSET = 7.5;
const CHIP_MULTIPLIER_DIVISOR = 4;

export interface DispersionParams {
  /** Distance std dev as fraction of intended distance (e.g. 0.08 = 8%). */
  distanceStdDevPercent: number;
  /** Angular std dev in degrees. */
  angularStdDevDegrees: number;
}

export class DispersionCalculator {
  private benchmark: HandicapBenchmark;
  private handicap: number;

  constructor(handicap: number) {
    this.handicap = Math.max(0, Math.min(25, handicap));
    this.benchmark = getBenchmarkForHandicap(this.handicap);
  }

  /** GIR scaling factor: 37 / girPercent, clamped to [1.0, 1.4]. Higher GIR → lower scale → tighter dispersion. */
  getGIRScaleFactor(): number {
    const { girPercent } = this.benchmark;
    return Math.max(GIR_SCALE_MIN, Math.min(GIR_SCALE_MAX, REFERENCE_GIR_PERCENT / girPercent));
  }

  /**
   * Full-shot distance dispersion (std dev as fraction of intended distance).
   * Base from handicap, then multiplied by GIR scale (higher GIR = tighter).
   */
  getDistanceStdDevPercent(): number {
    const base = Math.min(
      DISTANCE_BASE_MAX,
      Math.max(DISTANCE_BASE_MIN, 0.01 + this.handicap * DISTANCE_BASE_PER_HCP)
    );
    return Math.min(DISTANCE_BASE_MAX, base * this.getGIRScaleFactor());
  }

  /**
   * Full-shot angular dispersion (std dev in degrees).
   * Base from handicap, then multiplied by GIR scale.
   */
  getAngularStdDevDegrees(): number {
    const base = Math.min(
      ANGULAR_BASE_MAX,
      Math.max(ANGULAR_BASE_MIN, 0.5 + this.handicap * ANGULAR_BASE_PER_HCP)
    );
    return Math.min(ANGULAR_BASE_MAX, base * this.getGIRScaleFactor());
  }

  /**
   * Full-shot dispersion params (for fairway/rough full shots).
   */
  getFullShotDispersion(): DispersionParams {
    return {
      distanceStdDevPercent: this.getDistanceStdDevPercent(),
      angularStdDevDegrees: this.getAngularStdDevDegrees(),
    };
  }

  /**
   * Scrambling-derived multiplier for chip shots (off-green, &lt;20m).
   * Higher scrambling % → smaller multiplier → tighter chip dispersion.
   * Formula: 7.5 + (50 - scramblingPercent)/4.
   */
  getChipScramblingMultiplier(): number {
    return CHIP_MULTIPLIER_OFFSET + (SCRAMBLE_REFERENCE - this.benchmark.scramblingPercent) / CHIP_MULTIPLIER_DIVISOR;
  }

  /**
   * Chip shot dispersion: full-shot dispersion × scrambling multiplier.
   * Better short game (higher scrambling) → smaller multiplier → tighter chips.
   */
  getChipDispersion(): DispersionParams {
    const full = this.getFullShotDispersion();
    const mult = this.getChipScramblingMultiplier();
    return {
      distanceStdDevPercent: full.distanceStdDevPercent * mult,
      angularStdDevDegrees: full.angularStdDevDegrees * mult,
    };
  }

  /** Bunker override: higher dispersion (e.g. 25% distance, 12° angle). */
  getBunkerDispersion(): DispersionParams {
    return {
      distanceStdDevPercent: 25,
      angularStdDevDegrees: 12,
    };
  }
}
