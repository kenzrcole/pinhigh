/**
 * AI calibration for course-rating alignment. Test runner recalibrates until verification passes
 * and writes calibration to public/calibration.json; app loads it at startup so gameplay uses it.
 */

export interface AICalibration {
  dispersionScale: number;
  chipMultScale: number;
}

const defaultCalibration: AICalibration = { dispersionScale: 1, chipMultScale: 1 };

let current: AICalibration = { ...defaultCalibration };

export function getCalibration(): AICalibration {
  return { ...current };
}

export function setCalibration(c: Partial<AICalibration>): void {
  current = { ...current, ...c };
}

/** Load calibration from /calibration.json (public/). Call from app startup. This is the baseline for all AI play until the next AI round test run (which may recalibrate and overwrite the file). */
export function initCalibrationFromNetwork(): void {
  fetch('/calibration.json')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('No calibration file'))))
    .then((c: AICalibration) => {
      if (typeof c?.dispersionScale === 'number' && typeof c?.chipMultScale === 'number') {
        setCalibration({ dispersionScale: c.dispersionScale, chipMultScale: c.chipMultScale });
      }
    })
    .catch(() => {});
}
