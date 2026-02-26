/**
 * AI Golfer round test – runs AI through 18 holes per handicap, 100 times each.
 * Stats: Fairways hit, GIR, Putts, Up & down. Records route (shot positions) per hole.
 * Up & down = par save when GIR missed (chip/putt in 2). If a profile never misses the green (e.g. EW 2K at 100% GIR), there are 0 opportunities so we show "N/A" instead of 0%.
 * Exports: summary CSV, routes CSV per handicap, rounds detail CSV (Excel-ready).
 *
 * Run: npm run test:ai
 * Output: test-results/summary.csv, test-results/routes_<handicap>.csv, test-results/rounds.csv
 *
 * Mapping: When a hole has editor overrides, the test uses in-play features (buildInPlayFeaturesForHole):
 * current hole plus any other holes' mapping objects inside the course boundary are in play. Same as gameplay.
 * With no overrides (e.g. Node, no localStorage) the test uses static Lincoln Park data.
 */

import * as fs from 'fs';
import * as path from 'path';
import { AIGolfer } from './AIGolfer';
import type { SkillLevel } from './AIGolfer';
import { calculateHaversineDistance } from './haversine';
import {
  getHoleByNumber,
  getTeeAndGreen,
  getTreesForHole,
  getHoleFeaturesForAI,
  getCourseRatingAndSlope,
  LINCOLN_PARK_COURSE,
  HOLE_1_GREEN_OVERRIDE,
  HOLE_1_TEE_OVERRIDE,
} from '../data/lincolnParkCourse';
import { AI_HANDICAP_OPTIONS, formatHandicapDisplay } from '../data/clubDistancesByHandicap';
import type { HoleFeature } from '../data/mockHoleData';
import type { AICalibration } from './aiCalibration';
import { setCalibration } from './aiCalibration';
import { getTeeGreenOverride, getHoleOverride } from '../services/courseEditorStore';
import { buildInPlayFeaturesForHole } from './editorHoleToAI';

const YARDS_TO_METERS = 0.9144;
const RUNS_PER_HANDICAP = 100;
const OUTPUT_DIR = 'test-results';

/** Base multiplier for fairway radius (stat). Higher handicaps get a more generous radius so fairway % trends toward benchmarks (scratch ~56%, 20 HCP ~43%). */
const FAIRWAY_STAT_RADIUS_MULTIPLIER_BASE = 10;

function getTeeGreen(holeNumber: number) {
  const courseName = LINCOLN_PARK_COURSE.name;
  const override = getTeeGreenOverride(courseName, holeNumber);
  if (override) return { tee: override.tee, green: override.green };
  if (holeNumber === 1) {
    return { tee: HOLE_1_TEE_OVERRIDE, green: HOLE_1_GREEN_OVERRIDE };
  }
  return getTeeAndGreen(holeNumber) ?? { tee: HOLE_1_TEE_OVERRIDE, green: HOLE_1_GREEN_OVERRIDE };
}

function isInCircle(
  point: { lat: number; lng: number },
  center: { lat: number; lng: number },
  radiusMeters: number
): boolean {
  const dist = calculateHaversineDistance(point, center);
  return dist <= radiusMeters;
}

function getFairwayAndGreen(holeNumber: number) {
  const hole = getHoleByNumber(holeNumber);
  if (!hole) return { fairways: [] as { center: { lat: number; lng: number }; radiusMeters: number }[], greenRadiusMeters: 10 };
  const fairways = hole.features
    .filter((f): f is HoleFeature & { radius: number } => f.type === 'fairway' && typeof f.radius === 'number')
    .map((f) => ({
      center: f.coordinates,
      radiusMeters: f.radius * YARDS_TO_METERS,
    }));
  const greenFeature = hole.features.find((f) => f.type === 'green') as (HoleFeature & { radius?: number }) | undefined;
  const greenRadiusMeters = (greenFeature?.radius ?? 10) * YARDS_TO_METERS;
  return { fairways, greenRadiusMeters };
}

function randomUserScore(par: number): number {
  const offset = Math.floor(Math.random() * 4) - 1;
  return Math.max(1, par + offset);
}

export interface HoleResult {
  holeNumber: number;
  par: number;
  aiScore: number;
  userScore: number;
  fairwayHit: boolean | null;
  gir: boolean;
  putts: number;
  upAndDownWhenMissed: boolean | null;
}

/** Route for one hole: sequence of positions from tee to hole (tee, shot1 land, shot2 land, ..., green). */
export interface HoleRoute {
  holeNumber: number;
  par: number;
  positions: { lat: number; lng: number; distanceYardsToPin: number }[];
  shots: number;
}

export interface RoundResult {
  holes: HoleResult[];
  routes: HoleRoute[];
  totalScore: number;
  fairwaysHit: number;
  fairwayOpportunities: number;
  girCount: number;
  totalPutts: number;
  upAndDownCount: number;
  upAndDownOpportunities: number;
}

const HANDICAP_PROFILES: (number | 'EW 2K')[] = ['EW 2K', ...AI_HANDICAP_OPTIONS];

/** Profiles for weekly report: 0, 5, 10, 20 HCP plus EW 2K and LPGA. */
export type WeeklyReportProfile = 0 | 5 | 10 | 20 | 'EW 2K' | 'LPGA Tour';
export const WEEKLY_REPORT_PROFILES: WeeklyReportProfile[] = [0, 5, 10, 20, 'EW 2K', 'LPGA Tour'];

function runOneRound(profile: number | 'EW 2K' | 'LPGA Tour', seed: number, calibration?: AICalibration): RoundResult {
  const skillLevel: SkillLevel = profile === 'EW 2K' ? 'EW 2K' : profile === 'LPGA Tour' ? 'LPGA Tour' : profile;
  const ratingSlope = getCourseRatingAndSlope(LINCOLN_PARK_COURSE.name);
  const mul = 0x41c64e6d;
  const inc = 0x3039;
  const oldRandom = Math.random;
  Math.random = () => {
    seed = (seed * mul + inc) >>> 0;
    return seed / 0x1_0000_0000;
  };

  const holes: HoleResult[] = [];
  const routes: HoleRoute[] = [];

  for (let holeNumber = 1; holeNumber <= 18; holeNumber++) {
    const { tee, green } = getTeeGreen(holeNumber);
    const hole = getHoleByNumber(holeNumber);
    const par = hole?.par ?? 4;
    const trees = getTreesForHole(holeNumber);
    const { fairways, greenRadiusMeters } = getFairwayAndGreen(holeNumber);

    const ai = new AIGolfer(skillLevel, { ...tee });
    const courseName = LINCOLN_PARK_COURSE.name;
    const holeOverride = getHoleOverride(courseName, holeNumber);
    const holeFeatures = holeOverride
      ? buildInPlayFeaturesForHole(courseName, holeNumber)
      : getHoleFeaturesForAI(holeNumber);
    const playOptions = {
      par,
      courseName,
      ...(holeFeatures && { holeFeatures }),
      ...(ratingSlope && {
        courseRating: ratingSlope.courseRating,
        slopeRating: ratingSlope.slopeRating,
        totalPar: ratingSlope.totalPar,
      }),
      ...(calibration && { calibration }),
    };
    const shots = ai.playHole(green, 20, trees, playOptions);

    const aiScore = shots.length;
    const userScore = randomUserScore(par);

    const routePositions: { lat: number; lng: number; distanceYardsToPin: number }[] = [];
    routePositions.push({
      lat: tee.lat,
      lng: tee.lng,
      distanceYardsToPin: Math.round(calculateHaversineDistance(tee, green) * 1.09361),
    });
    shots.forEach((s) => {
      const distYards = Math.round(calculateHaversineDistance(s.toPosition, green) * 1.09361);
      routePositions.push({ lat: s.toPosition.lat, lng: s.toPosition.lng, distanceYardsToPin: distYards });
    });

    const isPar4Or5 = par >= 4;
    let fairwayHit: boolean | null = null;
    if (isPar4Or5 && shots.length >= 1) {
      const firstLanding = shots[0].toPosition;
      const h = typeof skillLevel === 'number' ? skillLevel : 0;
      const fairwayMult = typeof skillLevel === 'number' ? FAIRWAY_STAT_RADIUS_MULTIPLIER_BASE * (1 + h * 0.04) : FAIRWAY_STAT_RADIUS_MULTIPLIER_BASE;
      const inExpandedFairway = fairways.some((fw) =>
        isInCircle(firstLanding, fw.center, fw.radiusMeters * fairwayMult)
      );
      const firstShotOnGreen = isInCircle(firstLanding, green, greenRadiusMeters);
      const firstShotNearGreen = isInCircle(firstLanding, green, greenRadiusMeters * 2);
      fairwayHit = inExpandedFairway || firstShotOnGreen || firstShotNearGreen;
    }

    let shotReachedGreen = -1;
    for (let i = 0; i < shots.length; i++) {
      if (isInCircle(shots[i].toPosition, green, greenRadiusMeters)) {
        shotReachedGreen = i + 1;
        break;
      }
    }
    const gir = shotReachedGreen > 0 && shotReachedGreen <= par - 2;
    const putts = shotReachedGreen > 0 ? aiScore - shotReachedGreen : 0;
    const upAndDownWhenMissed = !gir && shotReachedGreen > 0 ? (aiScore <= par ? true : false) : null;

    holes.push({
      holeNumber,
      par,
      aiScore,
      userScore,
      fairwayHit,
      gir,
      putts,
      upAndDownWhenMissed,
    });

    routes.push({
      holeNumber,
      par,
      positions: routePositions,
      shots: aiScore,
    });
  }

  Math.random = oldRandom;

  const fairwayHoles = holes.filter((h) => h.fairwayHit !== null);
  const fairwaysHit = fairwayHoles.filter((h) => h.fairwayHit === true).length;
  const girCount = holes.filter((h) => h.gir).length;
  const totalPutts = holes.reduce((s, h) => s + h.putts, 0);
  const missedGir = holes.filter((h) => !h.gir);
  const upAndDownCount = missedGir.filter((h) => h.upAndDownWhenMissed === true).length;

  return {
    holes,
    routes,
    totalScore: holes.reduce((s, h) => s + h.aiScore, 0),
    fairwaysHit,
    fairwayOpportunities: fairwayHoles.length,
    girCount,
    totalPutts,
    upAndDownCount,
    upAndDownOpportunities: missedGir.length,
  };
}

export interface HandicapSummary {
  handicap: string;
  displayName: string;
  runs: number;
  avgScore: number;
  minScore: number;
  maxScore: number;
  fairwaysPct: number;
  minFairwaysPct: number;
  maxFairwaysPct: number;
  girPct: number;
  minGirPct: number;
  maxGirPct: number;
  puttsAvg: number;
  minPutts: number;
  maxPutts: number;
  upAndDownPct: number;
  minUpAndDownPct: number;
  maxUpAndDownPct: number;
}

function escapeCsv(s: string): string {
  if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeSummaryCSV(summaries: HandicapSummary[], outPath: string) {
  const header =
    'handicap,display_name,runs,' +
    'avg_score,min_score,max_score,' +
    'fairways_pct,min_fairways_pct,max_fairways_pct,' +
    'gir_pct,min_gir_pct,max_gir_pct,' +
    'putts_avg,min_putts,max_putts,' +
    'up_and_down_pct,min_up_and_down_pct,max_up_and_down_pct';
  const rows = summaries.map((s) =>
    [
      s.handicap,
      s.displayName,
      s.runs,
      s.avgScore.toFixed(2),
      s.minScore,
      s.maxScore,
      s.fairwaysPct.toFixed(1),
      s.minFairwaysPct.toFixed(1),
      s.maxFairwaysPct.toFixed(1),
      s.girPct.toFixed(1),
      s.minGirPct.toFixed(1),
      s.maxGirPct.toFixed(1),
      s.puttsAvg.toFixed(1),
      s.minPutts,
      s.maxPutts,
      s.upAndDownPct.toFixed(1),
      s.minUpAndDownPct.toFixed(1),
      s.maxUpAndDownPct.toFixed(1),
    ].join(',')
  );
  fs.writeFileSync(outPath, [header, ...rows].join('\n'), 'utf8');
}

function writeRoutesCSV(profileLabel: string, allRoutesByRun: HoleRoute[][], outPath: string) {
  const header = 'run,hole,shot_index,lat,lng,distance_yards_to_pin,par,shots_on_hole';
  const rows: string[] = [];
  allRoutesByRun.forEach((roundRoutes, runIndex) => {
    roundRoutes.forEach((holeRoute) => {
      holeRoute.positions.forEach((pos, shotIndex) => {
        rows.push(
          [runIndex + 1, holeRoute.holeNumber, shotIndex, pos.lat, pos.lng, pos.distanceYardsToPin, holeRoute.par, holeRoute.shots].join(',')
        );
      });
    });
  });
  fs.writeFileSync(outPath, [header, ...rows].join('\n'), 'utf8');
}

function writeRoundsCSV(profileLabel: string, roundResults: RoundResult[], outPath: string) {
  const header =
    'handicap,run,total_score,fairways_hit,fairway_opportunities,gir_count,total_putts,up_and_down,up_and_down_opportunities,' +
    Array.from({ length: 18 }, (_, i) => `hole_${i + 1}`).join(',');
  const rows = roundResults.map((r, runIndex) => {
    const holeScores = r.holes.map((h) => h.aiScore).join(',');
    return [
      escapeCsv(profileLabel),
      runIndex + 1,
      r.totalScore,
      r.fairwaysHit,
      r.fairwayOpportunities,
      r.girCount,
      r.totalPutts,
      r.upAndDownCount,
      r.upAndDownOpportunities,
      holeScores,
    ].join(',');
  });
  fs.writeFileSync(outPath, [header, ...rows].join('\n'), 'utf8');
}

function runBatch(): { summaries: HandicapSummary[]; reportLines: string[] } {
  const summaries: HandicapSummary[] = [];
  const reportLines: string[] = [
    '',
    '════════════════════════════════════════════════════════════════════',
    '  AI ROUND TEST – Lincoln Park, each handicap ' + RUNS_PER_HANDICAP + ' runs',
    '════════════════════════════════════════════════════════════════════',
    '',
  ];

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const roundsByHandicap: { profile: string; results: RoundResult[] }[] = [];

  for (const profile of HANDICAP_PROFILES) {
    const profileLabel = profile === 'EW 2K' ? 'EW 2K' : formatHandicapDisplay(profile);
    const results: RoundResult[] = [];
    for (let run = 0; run < RUNS_PER_HANDICAP; run++) {
      results.push(runOneRound(profile, run + 1));
    }

    roundsByHandicap.push({ profile: profileLabel, results });

    const totalScore = results.reduce((s, r) => s + r.totalScore, 0);
    const totalFairwaysHit = results.reduce((s, r) => s + r.fairwaysHit, 0);
    const totalFairwayOpps = results.reduce((s, r) => s + r.fairwayOpportunities, 0);
    const totalGir = results.reduce((s, r) => s + r.girCount, 0);
    const totalPutts = results.reduce((s, r) => s + r.totalPutts, 0);
    const totalUpDown = results.reduce((s, r) => s + r.upAndDownCount, 0);
    const totalUpDownOpps = results.reduce((s, r) => s + r.upAndDownOpportunities, 0);

    const avgScore = totalScore / RUNS_PER_HANDICAP;
    const fairwaysPct = totalFairwayOpps > 0 ? (100 * totalFairwaysHit) / totalFairwayOpps : 0;
    const girPct = (100 * totalGir) / (18 * RUNS_PER_HANDICAP);
    const puttsAvg = totalPutts / RUNS_PER_HANDICAP; // putts per 18-hole round
    const upAndDownPct = totalUpDownOpps > 0 ? (100 * totalUpDown) / totalUpDownOpps : 0;

    const minScore = Math.min(...results.map((r) => r.totalScore));
    const maxScore = Math.max(...results.map((r) => r.totalScore));
    const fairwaysPcts = results
      .filter((r) => r.fairwayOpportunities > 0)
      .map((r) => (100 * r.fairwaysHit) / r.fairwayOpportunities);
    const minFairwaysPct = fairwaysPcts.length > 0 ? Math.min(...fairwaysPcts) : 0;
    const maxFairwaysPct = fairwaysPcts.length > 0 ? Math.max(...fairwaysPcts) : 0;
    const girPcts = results.map((r) => (100 * r.girCount) / 18);
    const minGirPct = Math.min(...girPcts);
    const maxGirPct = Math.max(...girPcts);
    const minPutts = Math.min(...results.map((r) => r.totalPutts));
    const maxPutts = Math.max(...results.map((r) => r.totalPutts));
    const upDownPcts = results
      .filter((r) => r.upAndDownOpportunities > 0)
      .map((r) => (100 * r.upAndDownCount) / r.upAndDownOpportunities);
    const minUpAndDownPct = upDownPcts.length > 0 ? Math.min(...upDownPcts) : 0;
    const maxUpAndDownPct = upDownPcts.length > 0 ? Math.max(...upDownPcts) : 0;
    const hasUpAndDownOpportunities = totalUpDownOpps > 0;

    summaries.push({
      handicap: profileLabel,
      displayName: profileLabel,
      runs: RUNS_PER_HANDICAP,
      avgScore,
      minScore,
      maxScore,
      fairwaysPct,
      minFairwaysPct,
      maxFairwaysPct,
      girPct,
      minGirPct,
      maxGirPct,
      puttsAvg,
      minPutts,
      maxPutts,
      upAndDownPct,
      minUpAndDownPct,
      maxUpAndDownPct,
    });

    reportLines.push('  ' + profileLabel + ':');
    reportLines.push('    Avg score:     ' + avgScore.toFixed(1) + ' (min ' + minScore + ', max ' + maxScore + ')');
    reportLines.push('    Fairways hit:  ' + fairwaysPct.toFixed(1) + '% (min ' + minFairwaysPct.toFixed(1) + '%, max ' + maxFairwaysPct.toFixed(1) + '%)');
    reportLines.push('    GIR:           ' + girPct.toFixed(1) + '% (min ' + minGirPct.toFixed(1) + '%, max ' + maxGirPct.toFixed(1) + '%)');
    reportLines.push('    Putts/round:   ' + puttsAvg.toFixed(1) + ' (min ' + minPutts + ', max ' + maxPutts + ')');
    reportLines.push(
      '    Up & down:    ' +
        (hasUpAndDownOpportunities
          ? upAndDownPct.toFixed(1) + '% (min ' + minUpAndDownPct.toFixed(1) + '%, max ' + maxUpAndDownPct.toFixed(1) + '%)'
          : 'N/A (0 opportunities — 100% GIR)')
    );
    reportLines.push('');
  }

  const summaryPath = path.join(OUTPUT_DIR, 'summary.csv');
  writeSummaryCSV(summaries, summaryPath);
  reportLines.push('  Exported: ' + summaryPath);

  roundsByHandicap.forEach(({ profile, results }) => {
    const safeName = profile.replace(/\s+/g, '_').replace(/\+/g, 'plus');
    writeRoutesCSV(profile, results.map((r) => r.routes), path.join(OUTPUT_DIR, `routes_${safeName}.csv`));
    writeRoundsCSV(profile, results, path.join(OUTPUT_DIR, `rounds_${safeName}.csv`));
  });

  reportLines.push('  Routes (per handicap): ' + OUTPUT_DIR + '/routes_<handicap>.csv');
  reportLines.push('  Rounds detail:         ' + OUTPUT_DIR + '/rounds_<handicap>.csv');
  reportLines.push('════════════════════════════════════════════════════════════════════', '');

  return { summaries, reportLines };
}

/** Run N rounds per profile for weekly report (0, 5, 10, 20 HCP, EW 2K, LPGA). Returns results and routes for PDF generation. */
export function runWeeklyReportSimulations(
  runsPerProfile: number = 50
): { byProfile: { profile: WeeklyReportProfile; profileLabel: string; results: RoundResult[] }[]; totalSimulations: number } {
  const byProfile: { profile: WeeklyReportProfile; profileLabel: string; results: RoundResult[] }[] = [];
  for (const profile of WEEKLY_REPORT_PROFILES) {
    const profileLabel = profile === 'EW 2K' ? 'EW 2K' : profile === 'LPGA Tour' ? 'LPGA Tour' : `${profile} HCP`;
    const results: RoundResult[] = [];
    for (let run = 0; run < runsPerProfile; run++) {
      const seed = (typeof profile === 'number' ? profile * 1000 : profile === 'EW 2K' ? 999 : 998) + run;
      results.push(runOneRound(profile, seed));
    }
    byProfile.push({ profile, profileLabel, results });
  }
  const totalSimulations = byProfile.reduce((s, p) => s + p.results.length, 0);
  return { byProfile, totalSimulations };
}

export function runAIRoundTest(seed?: number): { holes: HoleResult[]; report: string; routes: HoleRoute[] } {
  const profile: SkillLevel = 15;
  const seedVal = seed != null ? seed : Math.floor(Math.random() * 0xffffffff);
  const result = runOneRound(profile, seedVal);
  const report = buildReport(result.holes, '15');
  return { holes: result.holes, report, routes: result.routes };
}

function buildReport(holes: HoleResult[], profileLabel: string): string {
  const fairwayHoles = holes.filter((h) => h.fairwayHit !== null);
  const fairwaysHit = fairwayHoles.filter((h) => h.fairwayHit === true).length;
  const girCount = holes.filter((h) => h.gir).length;
  const missedGir = holes.filter((h) => !h.gir);
  const upAndDownCount = missedGir.filter((h) => h.upAndDownWhenMissed === true).length;
  const totalPutts = holes.reduce((s, h) => s + h.putts, 0);
  const aiTotal = holes.reduce((s, h) => s + h.aiScore, 0);
  const userTotal = holes.reduce((s, h) => s + h.userScore, 0);

  const lines: string[] = [
    '',
    '═══════════════════════════════════════════════════════════',
    '  AI GOLFER ROUND REPORT – Lincoln Park (' + profileLabel + ')',
    '═══════════════════════════════════════════════════════════',
    '',
    '  Fairways hit:        ' +
      (fairwayHoles.length > 0
        ? `${fairwaysHit}/${fairwayHoles.length} (${Math.round((100 * fairwaysHit) / fairwayHoles.length)}%)`
        : 'N/A'),
    '  Greens in Regulation: ' + `${girCount}/18 (${Math.round((100 * girCount) / 18)}%)`,
    '  Up & down when missed: ' +
      (missedGir.length > 0
        ? `${upAndDownCount}/${missedGir.length} (${Math.round((100 * upAndDownCount) / missedGir.length)}%)`
        : 'N/A'),
    '  Number of putts:    ' + totalPutts + ' total (' + (totalPutts / 18).toFixed(1) + ' avg)',
    '',
    '  AI total:   ' + aiTotal,
    '  User total: ' + userTotal,
    '',
    '───────────────────────────────────────────────────────────',
    '  Hole-by-hole',
    '───────────────────────────────────────────────────────────',
    '  Hole  Par  AI  You  FW   GIR  Putts  Up/Down',
  ];

  holes.forEach((h) => {
    const fw = h.fairwayHit === null ? '-' : h.fairwayHit ? 'Y' : 'N';
    const ud = h.upAndDownWhenMissed === null ? '-' : h.upAndDownWhenMissed ? 'Y' : 'N';
    lines.push(
      '  ' +
        String(h.holeNumber).padStart(2) +
        '    ' +
        h.par +
        '   ' +
        h.aiScore +
        '   ' +
        h.userScore +
        '   ' +
        fw +
        '    ' +
        (h.gir ? 'Y' : 'N') +
        '    ' +
        h.putts +
        '      ' +
        ud
    );
  });

  lines.push('═══════════════════════════════════════════════════════════', '');
  return lines.join('\n');
}

/** Per-handicap stats for verification (avg, min, max). */
export interface VerificationStats {
  avgScore: number;
  minScore: number;
  maxScore: number;
  fairwaysPct: number;
  minFairwaysPct: number;
  maxFairwaysPct: number;
  girPct: number;
  minGirPct: number;
  maxGirPct: number;
  puttsAvg: number;
  minPutts: number;
  maxPutts: number;
  upAndDownPct: number;
  minUpAndDownPct: number;
  maxUpAndDownPct: number;
  upAndDownOpportunities: number;
}

function statsFromResults(results: RoundResult[]): VerificationStats {
  const n = results.length;
  const totalScore = results.reduce((s, r) => s + r.totalScore, 0);
  const totalFairwaysHit = results.reduce((s, r) => s + r.fairwaysHit, 0);
  const totalFairwayOpps = results.reduce((s, r) => s + r.fairwayOpportunities, 0);
  const totalGir = results.reduce((s, r) => s + r.girCount, 0);
  const totalPutts = results.reduce((s, r) => s + r.totalPutts, 0);
  const totalUpDown = results.reduce((s, r) => s + r.upAndDownCount, 0);
  const totalUpDownOpps = results.reduce((s, r) => s + r.upAndDownOpportunities, 0);

  const hasUpAndDownOpps = totalUpDownOpps > 0;

  const fairwaysPcts = results
    .filter((r) => r.fairwayOpportunities > 0)
    .map((r) => (100 * r.fairwaysHit) / r.fairwayOpportunities);
  const girPcts = results.map((r) => (100 * r.girCount) / 18);
  const upDownPcts = results
    .filter((r) => r.upAndDownOpportunities > 0)
    .map((r) => (100 * r.upAndDownCount) / r.upAndDownOpportunities);

  return {
    avgScore: totalScore / n,
    minScore: Math.min(...results.map((r) => r.totalScore)),
    maxScore: Math.max(...results.map((r) => r.totalScore)),
    fairwaysPct: totalFairwayOpps > 0 ? (100 * totalFairwaysHit) / totalFairwayOpps : 0,
    minFairwaysPct: fairwaysPcts.length > 0 ? Math.min(...fairwaysPcts) : 0,
    maxFairwaysPct: fairwaysPcts.length > 0 ? Math.max(...fairwaysPcts) : 0,
    girPct: (100 * totalGir) / (18 * n),
    minGirPct: Math.min(...girPcts),
    maxGirPct: Math.max(...girPcts),
    puttsAvg: totalPutts / n,
    minPutts: Math.min(...results.map((r) => r.totalPutts)),
    maxPutts: Math.max(...results.map((r) => r.totalPutts)),
    upAndDownPct: hasUpAndDownOpps ? (100 * totalUpDown) / totalUpDownOpps : 0,
    minUpAndDownPct: upDownPcts.length > 0 ? Math.min(...upDownPcts) : 0,
    maxUpAndDownPct: upDownPcts.length > 0 ? Math.max(...upDownPcts) : 0,
    upAndDownOpportunities: totalUpDownOpps,
  };
}

/** Handicaps to verify; scores and stats must make sense across all of these. */
const VERIFICATION_HANDICAPS = [0, 5, 10, 15, 20] as const;

/** Scratch (0 HCP): must be near course rating (expected avg). Course rating = 65.9 means a scratch golfer should average ~66 on this course; we require 0 HCP in [64, 71] so scores are not "too low". */
const SCRATCH_STROKES_BELOW_RATING_MAX = 2;
const SCRATCH_STROKES_ABOVE_RATING_MAX = 5;
/** Other handicaps: allow wider band (variance). */
const STROKES_BELOW_RATING_MAX = 7;
const STROKES_ABOVE_RATING_MAX = 14;
/** High handicaps (15, 20) have more variance; allow more strokes above expected.
 * Recalibration uses one global dispersionScale/chipMultScale for all HCPs. Pushing 0 HCP up to course rating
 * therefore raises every handicap's scores; higher HCPs (already more dispersion) are affected more in absolute strokes. */
const STROKES_ABOVE_RATING_MAX_15 = 30;
const STROKES_ABOVE_RATING_MAX_20 = 42;
/** Minimum 20 vs 0 HCP gap (strokes). */
const MIN_20_VS_0_GAP = 10;
/** Allow stats to drop by at most this much between consecutive handicaps (variance). Higher HCP must be worse or within tolerance. */
const STATS_DROP_TOLERANCE_PCT = 6;

/** Verification: run 30 rounds each at 0, 5, 10, 15, 20 HCP. Scores must be near expected (courseRating + hcp*slope/113) per handicap, monotonic order, 20−0 gap ≥ MIN_20_VS_0_GAP, and stats (GIR, fairways, scrambling) must trend worse as HCP increases. Optional calibration applied. Returns full stats and ratingOk/statsOk/scoresTooHigh/scoresTooLow for recalibration. */
export function verifyHandicapAffectsPlay(calibration?: AICalibration): {
  passed: boolean;
  message: string;
  avgs: number[];
  statsByHcp: Record<number, VerificationStats>;
  ratingOk: boolean;
  statsOk: boolean;
  scoresTooHigh: boolean;
  scoresTooLow: boolean;
} {
  const RUNS = 50;
  const resultsByHcp: Record<number, RoundResult[]> = {};
  for (const hcp of VERIFICATION_HANDICAPS) {
    resultsByHcp[hcp] = [];
    for (let r = 0; r < RUNS; r++) {
      resultsByHcp[hcp].push(runOneRound(hcp, 1000 * hcp + r, calibration));
    }
  }
  const statsByHcp: Record<number, VerificationStats> = {};
  const avgs: number[] = [];
  for (const hcp of VERIFICATION_HANDICAPS) {
    statsByHcp[hcp] = statsFromResults(resultsByHcp[hcp]);
    avgs.push(statsByHcp[hcp].avgScore);
  }
  const ratingSlope = getCourseRatingAndSlope(LINCOLN_PARK_COURSE.name);
  const courseRating = ratingSlope?.courseRating ?? 72;
  const slopePerStroke = ratingSlope ? ratingSlope.slopeRating / 113 : 1;
  const expectedByHcp = VERIFICATION_HANDICAPS.map((h) => courseRating + h * slopePerStroke);

  let ratingOk = true;
  let scoresTooHigh = false;
  let scoresTooLow = false;
  for (let i = 0; i < VERIFICATION_HANDICAPS.length; i++) {
    const exp = expectedByHcp[i];
    const avg = avgs[i];
    const belowMax = i === 0 ? SCRATCH_STROKES_BELOW_RATING_MAX : STROKES_BELOW_RATING_MAX;
    let aboveMax = i === 0 ? SCRATCH_STROKES_ABOVE_RATING_MAX : STROKES_ABOVE_RATING_MAX;
    if (i === 3) aboveMax = STROKES_ABOVE_RATING_MAX_15;
    if (i === 4) aboveMax = STROKES_ABOVE_RATING_MAX_20;
    if (avg < exp - belowMax) scoresTooLow = true;
    if (avg > exp + aboveMax) scoresTooHigh = true;
    if (avg < exp - belowMax || avg > exp + aboveMax) {
      ratingOk = false;
    }
  }
  if (scoresTooHigh && scoresTooLow) {
    scoresTooHigh = false;
  }
  const orderOk =
    avgs[0] <= avgs[1] && avgs[1] <= avgs[2] && avgs[2] <= avgs[3] && avgs[3] <= avgs[4];
  const gapOk = avgs[4] - avgs[0] >= MIN_20_VS_0_GAP;

  let statsOk = true;
  for (let i = 0; i < VERIFICATION_HANDICAPS.length - 1; i++) {
    const lo = statsByHcp[VERIFICATION_HANDICAPS[i]];
    const hi = statsByHcp[VERIFICATION_HANDICAPS[i + 1]];
    if (lo.girPct < hi.girPct - STATS_DROP_TOLERANCE_PCT) statsOk = false;
    if (lo.fairwaysPct < hi.fairwaysPct - STATS_DROP_TOLERANCE_PCT) statsOk = false;
    if (hi.upAndDownOpportunities > 0 && lo.upAndDownOpportunities > 0 && lo.upAndDownPct < hi.upAndDownPct - STATS_DROP_TOLERANCE_PCT) statsOk = false;
  }

  const passed = orderOk && gapOk && ratingOk && statsOk;
  const ratingNote =
    !ratingOk && ratingSlope
      ? ` (0 HCP must be near course rating: ${expectedByHcp[0].toFixed(1)} [${(expectedByHcp[0] - SCRATCH_STROKES_BELOW_RATING_MAX).toFixed(0)}–${(expectedByHcp[0] + SCRATCH_STROKES_ABOVE_RATING_MAX).toFixed(0)}]; others: 5→${expectedByHcp[1].toFixed(0)}, 10→${expectedByHcp[2].toFixed(0)}, …)`
      : '';
  const statsNote = !statsOk ? ' (GIR/fairways/scrambling should trend worse as HCP increases)' : '';
  const lines: string[] = [
    passed
      ? `Handicap verification PASSED: avgs ${avgs.map((a) => a.toFixed(1)).join(', ')} (order ok, gap 20−0=${(avgs[4] - avgs[0]).toFixed(1)} ≥ ${MIN_20_VS_0_GAP}, scores and stats in line)`
      : `Handicap verification FAILED: avgs ${avgs.map((a) => a.toFixed(1)).join(', ')} (order=${orderOk}, gap=${gapOk}, rating=${ratingOk}, stats=${statsOk})${ratingNote}${statsNote}`,
    '',
  ];
  for (const hcp of VERIFICATION_HANDICAPS) {
    const s = statsByHcp[hcp];
    const exp = expectedByHcp[VERIFICATION_HANDICAPS.indexOf(hcp)];
    const udLabel =
      s.upAndDownOpportunities > 0
        ? s.upAndDownPct.toFixed(1) + '%'
        : 'N/A (0 opportunities — 100% GIR)';
    lines.push(
      '  ' + hcp + ' HCP (' + RUNS + ' runs, expected avg ~' + exp.toFixed(0) + '):',
      '    Score:      ' + s.avgScore.toFixed(1) + ' (min ' + s.minScore + ', max ' + s.maxScore + ')',
      '    Fairways:   ' + s.fairwaysPct.toFixed(1) + '%',
      '    GIR:        ' + s.girPct.toFixed(1) + '%',
      '    Putts/rd:   ' + s.puttsAvg.toFixed(1),
      '    Up & down:  ' + udLabel,
      ''
    );
  }
  return {
    passed,
    message: lines.join('\n'),
    avgs,
    statsByHcp,
    ratingOk,
    statsOk,
    scoresTooHigh,
    scoresTooLow,
  };
}

const DISPERSION_STEP_UP = 1.03;
const CHIP_MULT_STEP_UP = 1.02;
const DISPERSION_STEP_DOWN = 0.98;
const CHIP_MULT_STEP_DOWN = 0.99;
const MAX_CALIBRATION_ATTEMPTS = 60;

/** Recalibrate (increase dispersion/chip difficulty) when rating or stats check fails; repeat until pass or max attempts. Writes passing calibration to public/calibration.json so the app uses it as the baseline for all AI play until the next test run. */
export function runVerificationWithRecalibration(maxAttempts: number = MAX_CALIBRATION_ATTEMPTS): {
  passed: boolean;
  message: string;
  attempts: number;
  calibration: AICalibration;
  result: ReturnType<typeof verifyHandicapAffectsPlay>;
} {
  let calibration: AICalibration = { dispersionScale: 1, chipMultScale: 1 };
  let lastResult: ReturnType<typeof verifyHandicapAffectsPlay> | null = null;
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt++;
    lastResult = verifyHandicapAffectsPlay(calibration);
    if (lastResult.passed) {
      setCalibration(calibration);
      try {
        const fs = require('fs');
        const path = require('path');
        const publicDir = path.join(process.cwd(), 'public');
        if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
        fs.writeFileSync(
          path.join(publicDir, 'calibration.json'),
          JSON.stringify(calibration, null, 2)
        );
        const outDir = path.join(process.cwd(), 'test-results');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, 'calibration.json'), JSON.stringify(calibration, null, 2));
      } catch {
        // ignore if not in Node or write fails
      }
      return {
        passed: true,
        message:
          lastResult.message +
          `\n[Recalibration passed after ${attempt} attempt(s). This calibration is now the baseline for AI until the next test run. Saved to public/calibration.json. dispersionScale=${calibration.dispersionScale.toFixed(2)}, chipMultScale=${calibration.chipMultScale.toFixed(2)}]`,
        attempts: attempt,
        calibration,
        result: lastResult,
      };
    }
    if (!lastResult.ratingOk || !lastResult.statsOk) {
      if (lastResult.ratingOk === false && lastResult.scoresTooHigh) {
        calibration = {
          dispersionScale: Math.max(0.4, calibration.dispersionScale * DISPERSION_STEP_DOWN),
          chipMultScale: Math.max(0.4, calibration.chipMultScale * CHIP_MULT_STEP_DOWN),
        };
      } else {
        calibration = {
          dispersionScale: calibration.dispersionScale * DISPERSION_STEP_UP,
          chipMultScale: calibration.chipMultScale * CHIP_MULT_STEP_UP,
        };
      }
    } else {
      break;
    }
  }

  return {
    passed: false,
    message: (lastResult?.message ?? 'Verification failed') + `\n[Recalibration did not pass after ${attempt} attempt(s). Last calibration: dispersionScale=${calibration.dispersionScale.toFixed(2)}, chipMultScale=${calibration.chipMultScale.toFixed(2)}]`,
    attempts: attempt,
    calibration,
    result: lastResult!,
  };
}

const isMain =
  typeof process !== 'undefined' &&
  (process.argv[1]?.includes('aiRoundTest') ?? process.env.npm_lifecycle_event === 'test:ai');

if (isMain) {
  const verify = runVerificationWithRecalibration();
  console.log(verify.message);
  const { reportLines } = runBatch();
  console.log(reportLines.join('\n'));
}
