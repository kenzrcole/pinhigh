/**
 * Batch-Testing Calibration — Patent validation: run recursive shot loop N times,
 * aggregate stats, compare to benchmark. Uses Lincoln Park Hole 8 (already mapped).
 *
 * Run: npx tsx scripts/runCalibrationTest.ts
 */

import { runHoleSimulation } from '../src/engine/runHoleSimulation';
import { holeFeaturesToGeoJSON, detectLie } from '../src/engine/LieDetector';
import { getBenchmarkForHandicap } from '../src/engine/BenchmarkSystem';
import { getTeeAndGreen, getHoleFeaturesForAI, getHoleByNumber } from '../src/data/lincolnParkCourse';

const HOLE_NUMBER = 8;
const HANDICAP = 15;
const NUM_ROUNDS = 100;

const TOLERANCE_SCORE = 1.5;   // allow ±1.5 strokes vs expected
const TOLERANCE_GIR = 8;       // allow ±8% GIR
const TOLERANCE_PUTTS = 2;     // allow ±2 putts per round

function main() {
  const teeGreen = getTeeAndGreen(HOLE_NUMBER);
  const features = getHoleFeaturesForAI(HOLE_NUMBER);
  const hole = getHoleByNumber(HOLE_NUMBER);

  if (!teeGreen || !features || !hole) {
    console.error(`Lincoln Park Hole ${HOLE_NUMBER} not found or missing features.`);
    process.exit(1);
  }

  const holeGeoJSON = holeFeaturesToGeoJSON({
    water: features.water,
    green: features.green,
    bunkers: features.bunkers,
    fairways: features.fairways,
  });

  const teePosition = teeGreen.tee;
  const pinPosition = teeGreen.green;
  const par = hole.par;
  const fairwayCenter = features.fairways.length > 0 ? features.fairways[0].center : null;

  const scores: number[] = [];
  const girHits: boolean[] = [];
  const puttsPerHole: number[] = [];

  for (let i = 0; i < NUM_ROUNDS; i++) {
    const result = runHoleSimulation({
      teePosition,
      pinPosition,
      holeGeoJSON,
      par,
      handicap: HANDICAP,
      fairwayCenter,
      maxShots: 20,
    });

    scores.push(result.shotCount);
    puttsPerHole.push(result.shots.filter((s) => s.lie === 'LIE_GREEN').length);

    const shotsForGIR = par - 2;
    const hasGIR =
      result.shots.length >= shotsForGIR &&
      detectLie(result.shots[shotsForGIR - 1].to, holeGeoJSON) === 'LIE_GREEN';
    girHits.push(hasGIR);
  }

  const avgScore = scores.reduce((a, b) => a + b, 0) / NUM_ROUNDS;
  const girPercent = (girHits.filter(Boolean).length / NUM_ROUNDS) * 100;
  const avgPuttsPerHole = puttsPerHole.reduce((a, b) => a + b, 0) / NUM_ROUNDS;
  const puttsPerRound = avgPuttsPerHole * 18;

  const benchmark = getBenchmarkForHandicap(HANDICAP);
  const targetGIR = benchmark.girPercent;
  const targetPutts = benchmark.puttsPerRound;
  const targetScoreApprox = par + (100 - targetGIR) / 100 * (18 - (par - 2)); // rough: expect ~par + some
  const expectedScore = par + 2; // 15 HCP typically ~2 over par per hole on average

  console.log('\n--- PinHigh Calibration Test (Batch-Testing) ---');
  console.log(`Hole: Lincoln Park #${HOLE_NUMBER} (Par ${par})`);
  console.log(`Handicap: ${HANDICAP}`);
  console.log(`Rounds: ${NUM_ROUNDS}\n`);

  console.log('Simulated vs Benchmark\n');

  const scoreOk = Math.abs(avgScore - expectedScore) <= TOLERANCE_SCORE;
  console.log(
    `Average Score:    Simulated ${avgScore.toFixed(2)}. Target (approx): ${expectedScore}. Status: ${scoreOk ? 'PASS' : 'FAIL'}.`
  );

  const girOk = Math.abs(girPercent - targetGIR) <= TOLERANCE_GIR;
  console.log(
    `Simulated GIR:    ${girPercent.toFixed(1)}%. Target Benchmark: ${targetGIR}%. Status: ${girOk ? 'PASS' : 'FAIL'}.`
  );

  const puttsOk = Math.abs(puttsPerRound - targetPutts) <= TOLERANCE_PUTTS;
  console.log(
    `Putts Per Round:  Simulated ${puttsPerRound.toFixed(1)} (from ${avgPuttsPerHole.toFixed(2)}/hole × 18). Target Benchmark: ${targetPutts}. Status: ${puttsOk ? 'PASS' : 'FAIL'}.`
  );

  const allPass = scoreOk && girOk && puttsOk;
  console.log(`\nOverall: ${allPass ? 'PASS' : 'FAIL'}\n`);
  process.exit(allPass ? 0 : 1);
}

main();
