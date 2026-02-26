#!/usr/bin/env npx tsx
/**
 * Weekly report: overview from docs/WEEKLY_OVERVIEW.md (or recently modified files), AI simulation
 * stats (fairways, GIR, putts, up&down), trends/anomalies, and PDFs per profile with map images.
 *
 * Schedule: Mondays 9:00 AM (cron: 0 9 * * 1 cd /path && npm run weekly-report)
 *
 * Usage:
 *   npm run weekly-report           # Generate report and PDFs to weekly-reports/
 *   npm run weekly-report -- --send # Also email (requires .env GMAIL_USER, GMAIL_APP_PASSWORD)
 *
 * Overview: Add a section to docs/WEEKLY_OVERVIEW.md for the week (or paste from Cursor/Agent).
 * If missing, the report uses recently modified files (last 7 days) under src/, scripts/, docs/.
 *
 * Map images: set VITE_GOOGLE_MAPS_API_KEY in .env and enable Maps Static API in Google Cloud.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  runWeeklyReportSimulations,
  type RoundResult,
  type HoleRoute,
  type WeeklyReportProfile,
} from '../src/utils/aiRoundTest';
import { getTeeAndGreen } from '../src/data/lincolnParkCourse';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const REPORTS_DIR = path.join(projectRoot, 'weekly-reports');
const PDF_DIR = path.join(REPORTS_DIR, 'pdfs');
const RUNS_PER_PROFILE = 40;

function loadEnv(): void {
  const envPath = path.join(projectRoot, '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

/** Monday that started the week we're reporting (when run Monday 9am, this is 7 days ago). */
function getLastMondayDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function getWeekLabel(): string {
  const lastMon = getLastMondayDateString();
  const [y, m, d] = lastMon.split('-').map(Number);
  const nextSun = new Date(y, m - 1, d + 6);
  const ns = `${nextSun.getFullYear()}-${String(nextSun.getMonth() + 1).padStart(2, '0')}-${String(nextSun.getDate()).padStart(2, '0')}`;
  return `Week of ${lastMon} – ${ns}`;
}

const OVERVIEW_FILE = path.join(projectRoot, 'docs', 'WEEKLY_OVERVIEW.md');
const OVERVIEW_MS = 7 * 24 * 60 * 60 * 1000;

/** High-level overview from docs/WEEKLY_OVERVIEW.md (section for this week). */
function getOverviewFromFile(): string {
  if (!fs.existsSync(OVERVIEW_FILE)) return '';
  const content = fs.readFileSync(OVERVIEW_FILE, 'utf8');
  const weekLabel = getWeekLabel();
  const heading = `## ${weekLabel}`;
  const lines = content.split(/\n/);
  let inSection = false;
  const body: string[] = [];
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (line.trim() === heading) {
        inSection = true;
        body.length = 0;
        continue;
      }
      if (inSection) break;
      continue;
    }
    if (inSection) body.push(line);
  }
  return body.join('\n').trim();
}

/** List files under dir with mtime within the last ms, relative to project root. */
function listRecentFiles(dir: string, ms: number, base = dir): string[] {
  const out: string[] = [];
  const cut = Date.now() - ms;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      const rel = path.relative(projectRoot, full);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.git') continue;
        out.push(...listRecentFiles(full, ms, base));
      } else if (e.isFile()) {
        try {
          const stat = fs.statSync(full);
          if (stat.mtimeMs >= cut) out.push(rel);
        } catch {
          // skip
        }
      }
    }
  } catch {
    // skip
  }
  return out;
}

/** High-level overview from recently modified files (last 7 days) under src/, scripts/, docs/. */
function getOverviewFromRecentFiles(): string {
  const dirs = ['src', 'scripts', 'docs'].map((d) => path.join(projectRoot, d)).filter((d) => fs.existsSync(d));
  const all: string[] = [];
  for (const d of dirs) {
    all.push(...listRecentFiles(d, OVERVIEW_MS));
  }
  const unique = [...new Set(all)].sort();
  if (unique.length === 0) return '(No files modified in the last 7 days under src/, scripts/, docs/.)';
  const byArea = new Map<string, string[]>();
  for (const f of unique) {
    const top = f.split(path.sep)[0] || f;
    const area = top === 'src' ? (f.split(path.sep)[1] || 'src') : top;
    if (!byArea.has(area)) byArea.set(area, []);
    byArea.get(area)!.push(f);
  }
  const lines: string[] = ['Recently modified (last 7 days):', ''];
  for (const [area, files] of [...byArea.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`${area}/ (${files.length}):`);
    files.slice(0, 20).forEach((f) => lines.push('  • ' + f));
    if (files.length > 20) lines.push('  … and ' + (files.length - 20) + ' more');
    lines.push('');
  }
  return lines.join('\n').trim();
}

/** High-level overview: WEEKLY_OVERVIEW.md section first, else recently modified files. */
function getOverview(): string {
  const fromFile = getOverviewFromFile();
  if (fromFile) return fromFile;
  return getOverviewFromRecentFiles();
}

/** Simplify path to at most maxPoints for URL length. */
function simplifyPath(
  positions: { lat: number; lng: number }[],
  maxPoints: number
): { lat: number; lng: number }[] {
  if (positions.length <= maxPoints) return positions;
  const step = (positions.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, i) => {
    const idx = Math.round(i * step);
    return positions[Math.min(idx, positions.length - 1)];
  });
}

/** Average path: per hole, per shot index, average lat/lng/dist across rounds. */
function computeAveragePath(routesByRound: HoleRoute[][]): Map<number, { shotIndex: number; lat: number; lng: number; distYards: number }[]> {
  const byHole = new Map<number, { shotIndex: number; lat: number; lng: number; distYards: number }[]>();
  for (const roundRoutes of routesByRound) {
    for (const hr of roundRoutes) {
      const h = hr.holeNumber;
      if (!byHole.has(h)) byHole.set(h, []);
      hr.positions.forEach((pos, shotIndex) => {
        const list = byHole.get(h)!;
        while (list.length <= shotIndex) list.push({ shotIndex: list.length, lat: 0, lng: 0, distYards: 0 });
        list[shotIndex].lat += pos.lat;
        list[shotIndex].lng += pos.lng;
        list[shotIndex].distYards += pos.distanceYardsToPin;
      });
    }
  }
  const counts = new Map<string, number>();
  byHole.forEach((list, h) => {
    list.forEach((_, i) => {
      const k = `${h}-${i}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    });
  });
  const out = new Map<number, { shotIndex: number; lat: number; lng: number; distYards: number }[]>();
  byHole.forEach((list, h) => {
    const averaged = list.map((p, i) => {
      const n = counts.get(`${h}-${i}`) ?? 1;
      return {
        shotIndex: i,
        lat: p.lat / n,
        lng: p.lng / n,
        distYards: Math.round(p.distYards / n),
      };
    });
    out.set(h, averaged);
  });
  return out;
}

const MAX_PATH_POINTS = 20;
const STATIC_MAP_SIZE = '640x480';

/** Google polyline encoding (precision 5) to keep Static Map URL under limit. */
function encodePolyline(points: { lat: number; lng: number }[]): string {
  if (points.length === 0) return '';
  let out = '';
  let prevLat = 0;
  let prevLng = 0;
  const enc = (v: number) => {
    v = Math.round(v * 1e5);
    v = v < 0 ? (v << 1) ^ -1 : v << 1;
    const chunks: number[] = [];
    while (v >= 0x20) {
      chunks.push((0x20 | (v & 0x1f)) + 63);
      v = v >> 5;
    }
    chunks.push(v + 63);
    return String.fromCharCode(...chunks);
  };
  for (const p of points) {
    const lat = p.lat;
    const lng = p.lng;
    out += enc(lat - prevLat);
    out += enc(lng - prevLng);
    prevLat = lat;
    prevLng = lng;
  }
  return out;
}

function buildStaticMapUrl(
  holeNumber: number,
  avgPositions: { lat: number; lng: number }[],
  minPositions: { lat: number; lng: number }[],
  maxPositions: { lat: number; lng: number }[],
  apiKey: string
): string {
  const tg = getTeeAndGreen(holeNumber);
  const avg = simplifyPath(avgPositions, MAX_PATH_POINTS);
  const min = simplifyPath(minPositions, MAX_PATH_POINTS);
  const max = simplifyPath(maxPositions, MAX_PATH_POINTS);

  // Center map on the hole (tee–green) so we always show Lincoln Park for this hole
  let centerLat: number;
  let centerLng: number;
  if (tg) {
    centerLat = (tg.tee.lat + tg.green.lat) / 2;
    centerLng = (tg.tee.lng + tg.green.lng) / 2;
  } else {
    const allPoints = [...avg, ...min, ...max];
    const pad = 0.00012;
    const lats = allPoints.length ? allPoints.map((p) => p.lat) : [37.784];
    const lngs = allPoints.length ? allPoints.map((p) => p.lng) : [-122.5];
    const minLat = Math.min(...lats) - pad;
    const maxLat = Math.max(...lats) + pad;
    const minLng = Math.min(...lngs) - pad;
    const maxLng = Math.max(...lngs) + pad;
    centerLat = (minLat + maxLat) / 2;
    centerLng = (minLng + maxLng) / 2;
  }
  const zoom = 17; // hole-level view; if "no imagery" we fall back to roadmap

  const pathPart = (points: { lat: number; lng: number }[], color: string) =>
    points.length >= 2
      ? `path=color:${color}|weight:5|enc:${encodeURIComponent(encodePolyline(points))}`
      : '';
  const paths = [
    pathPart(avg, '0x2196F3'),
    pathPart(min, '0x4CAF50'),
    pathPart(max, '0xF44336'),
  ].filter(Boolean);

  const markerPoints = avg.slice(0, 15);
  const markersPart =
    markerPoints.length > 0
      ? 'markers=size:small|color:0xFFFFFF|' + markerPoints.map((p) => `${p.lat},${p.lng}`).join('|')
      : '';
  const params = new URLSearchParams({
    center: `${centerLat},${centerLng}`,
    zoom: String(zoom),
    size: STATIC_MAP_SIZE,
    maptype: 'hybrid', // hybrid = satellite + labels; avoids "no imagery" where pure satellite has no tile
    key: apiKey,
  });
  const extra = [...paths];
  if (markersPart) extra.push(markersPart);
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}&${extra.join('&')}`;
}

/** Same as buildStaticMapUrl but with maptype=roadmap (always has imagery). */
function buildStaticMapUrlRoadmap(
  holeNumber: number,
  avgPositions: { lat: number; lng: number }[],
  minPositions: { lat: number; lng: number }[],
  maxPositions: { lat: number; lng: number }[],
  apiKey: string
): string {
  const url = buildStaticMapUrl(holeNumber, avgPositions, minPositions, maxPositions, apiKey);
  return url.replace('maptype=hybrid', 'maptype=roadmap');
}

function isPNG(buf: Buffer): boolean {
  return buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
}
function isJPEG(buf: Buffer): boolean {
  return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

async function fetchStaticMapImage(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    const buf = Buffer.from(ab);
    if (!isPNG(buf) && !isJPEG(buf)) return null;
    return buf;
  } catch {
    return null;
  }
}

async function generateProfilePDF(
  profileLabel: string,
  results: RoundResult[],
  outPath: string,
  apiKey: string | undefined
): Promise<void> {
  const mod = await import('pdfkit');
  const PDFDocument = ((mod as { default?: unknown }).default ?? mod) as new (opts?: object) => {
    pipe: (s: NodeJS.WritableStream) => void;
    end: () => void;
    fontSize: (n: number) => { text: (t: string, opts?: object) => void; moveDown: (n?: number) => void };
    text: (t: string, opts?: object) => void;
    moveDown: (n?: number) => void;
    addPage: (opts?: object) => void;
    image: (buf: Buffer, x?: number, y?: number, opts?: { width?: number }) => void;
  };
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  const weekLabel = getWeekLabel();
  doc.fontSize(16).text(`Weekly Report — ${profileLabel}`, { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).text(weekLabel, { align: 'center' });
  doc.moveDown(1);

  const stats = aggregateProfileStats(results);
  doc.fontSize(11).text('Stats (this run)', { continued: false });
  doc.fontSize(9);
  doc.text(`Score: ${stats.avgScore.toFixed(1)} avg (${stats.minScore}–${stats.maxScore})`);
  doc.text(`Fairways: ${stats.fairwaysHit}/${stats.fairwayOpportunities} (${stats.fairwaysPct.toFixed(1)}%)`);
  doc.text(`GIR: ${stats.girPct.toFixed(1)}%  |  Putts/round: ${stats.puttsAvg.toFixed(1)}  |  Up & down: ${stats.upAndDownPct.toFixed(1)}%`);
  doc.moveDown(0.5);
  doc.fontSize(9).text('Shot patterns: Blue = average path, Green = min-shots round, Red = max-shots round. White circles = shot positions (tee and each landing).', { continued: false });
  doc.moveDown(1);

  const routesByRound = results.map((r) => r.routes);
  const avgPath = computeAveragePath(routesByRound);
  const minRound = results.reduce((best, r) => (r.totalScore < best.totalScore ? r : best), results[0]);
  const maxRound = results.reduce((best, r) => (r.totalScore > best.totalScore ? r : best), results[0]);

  const holeNumbers = Array.from({ length: 18 }, (_, i) => i + 1);
  const tempFiles: string[] = [];
  for (const holeNum of holeNumbers) {
    const avgPositions = (avgPath.get(holeNum) ?? []).map((p) => ({ lat: p.lat, lng: p.lng }));
    const minHoleRoute = minRound.routes.find((r) => r.holeNumber === holeNum);
    const maxHoleRoute = maxRound.routes.find((r) => r.holeNumber === holeNum);
    const minPositions = minHoleRoute ? minHoleRoute.positions.map((p) => ({ lat: p.lat, lng: p.lng })) : [];
    const maxPositions = maxHoleRoute ? maxHoleRoute.positions.map((p) => ({ lat: p.lat, lng: p.lng })) : [];

    if (apiKey) {
      let url = buildStaticMapUrl(holeNum, avgPositions, minPositions, maxPositions, apiKey);
      let imgBuf = await fetchStaticMapImage(url);
      if (imgBuf && imgBuf.length < 20000) {
        url = buildStaticMapUrlRoadmap(holeNum, avgPositions, minPositions, maxPositions, apiKey);
        imgBuf = await fetchStaticMapImage(url);
      }
      if (imgBuf) {
        doc.addPage();
        doc.fontSize(12).text(`Hole ${holeNum}`, { continued: false });
        doc.moveDown(0.3);
        const bufCopy = Buffer.from(imgBuf);
        let embedded = false;
        try {
          doc.image(bufCopy, 50, doc.y, { width: 495 });
          embedded = true;
        } catch {
          const imgPath = path.resolve(
            PDF_DIR,
            'tmp',
            `hole_${holeNum}_${profileLabel.replace(/\s+/g, '_').replace(/\+/g, 'plus')}${isPNG(imgBuf) ? '.png' : '.jpg'}`
          );
          try {
            const dir = path.dirname(imgPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(imgPath, bufCopy);
            tempFiles.push(imgPath);
            doc.image(imgPath, 50, doc.y, { width: 495 });
            embedded = true;
          } catch {
            doc.fontSize(9).text('(Image could not be embedded)', { continued: false });
          }
        }
        if (embedded) {
          doc.y += 480 * (495 / 640);
          doc.fontSize(9).text(`Hole ${holeNum} — Lincoln Park Golf Course, San Francisco`, { align: 'center' });
          doc.moveDown(0.5);
        }
      }
    }
  }

  if (!apiKey) {
    doc.addPage();
    doc.fontSize(10)
      .text('Map images skipped: set VITE_GOOGLE_MAPS_API_KEY in .env and enable Maps Static API.', { align: 'center' });
  }

  doc.end();
  await new Promise<void>((resolve, reject) => {
    stream.on('finish', () => {
      for (const f of tempFiles) {
        try {
          fs.unlinkSync(f);
        } catch {
          // ignore
        }
      }
      resolve();
    });
    stream.on('error', reject);
  });
}

function computeTrendsAndAnomalies(
  byProfile: { profile: WeeklyReportProfile; profileLabel: string; results: RoundResult[] }[]
): { trends: string[]; anomalies: string[] } {
  const trends: string[] = [];
  const anomalies: string[] = [];
  const avgScores = byProfile.map((p) => {
    const avg = p.results.reduce((s, r) => s + r.totalScore, 0) / p.results.length;
    return { label: p.profileLabel, profile: p.profile, avg, min: Math.min(...p.results.map((r) => r.totalScore)), max: Math.max(...p.results.map((r) => r.totalScore)) };
  });
  const numericOrder = [0, 5, 10, 20];
  for (let i = 0; i < numericOrder.length - 1; i++) {
    const a = avgScores.find((s) => s.profile === numericOrder[i]);
    const b = avgScores.find((s) => s.profile === numericOrder[i + 1]);
    if (!a || !b) continue;
    if (a.avg > b.avg) {
      anomalies.push(`Score order: ${a.label} (${a.avg.toFixed(1)}) > ${b.label} (${b.avg.toFixed(1)}); expected higher HCP = higher score.`);
    } else {
      trends.push(`${a.label} avg ${a.avg.toFixed(1)} → ${b.label} avg ${b.avg.toFixed(1)} (monotonic).`);
    }
  }
  avgScores.forEach(({ label, avg, min, max }) => {
    const spread = max - min;
    if (spread > 25) anomalies.push(`${label}: large score spread (${min}–${max}, spread ${spread}).`);
    else trends.push(`${label}: score range ${min}–${max}, avg ${avg.toFixed(1)}.`);
  });
  return { trends, anomalies };
}

export interface ProfileStats {
  runs: number;
  avgScore: number;
  minScore: number;
  maxScore: number;
  fairwaysPct: number;
  fairwaysHit: number;
  fairwayOpportunities: number;
  girPct: number;
  girCount: number;
  puttsAvg: number;
  puttsMin: number;
  puttsMax: number;
  upAndDownPct: number;
  upAndDownCount: number;
  upAndDownOpportunities: number;
}

function aggregateProfileStats(results: RoundResult[]): ProfileStats {
  const n = results.length;
  const totalScore = results.reduce((s, r) => s + r.totalScore, 0);
  const fh = results.reduce((s, r) => s + r.fairwaysHit, 0);
  const fo = results.reduce((s, r) => s + r.fairwayOpportunities, 0);
  const gir = results.reduce((s, r) => s + r.girCount, 0);
  const putts = results.reduce((s, r) => s + r.totalPutts, 0);
  const ud = results.reduce((s, r) => s + r.upAndDownCount, 0);
  const udo = results.reduce((s, r) => s + r.upAndDownOpportunities, 0);
  return {
    runs: n,
    avgScore: totalScore / n,
    minScore: Math.min(...results.map((r) => r.totalScore)),
    maxScore: Math.max(...results.map((r) => r.totalScore)),
    fairwaysHit: fh,
    fairwayOpportunities: fo,
    fairwaysPct: fo > 0 ? (100 * fh) / fo : 0,
    girCount: gir,
    girPct: (100 * gir) / (18 * n),
    puttsAvg: putts / n,
    puttsMin: Math.min(...results.map((r) => r.totalPutts)),
    puttsMax: Math.max(...results.map((r) => r.totalPutts)),
    upAndDownCount: ud,
    upAndDownOpportunities: udo,
    upAndDownPct: udo > 0 ? (100 * ud) / udo : 0,
  };
}

async function main() {
  loadEnv();
  const doSend = process.argv.includes('--send');
  const weekLabel = getWeekLabel();
  const overview = getOverview();

  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });

  console.log('Running AI simulations for weekly report (6 profiles × ' + RUNS_PER_PROFILE + ' runs)...');
  const { byProfile, totalSimulations } = runWeeklyReportSimulations(RUNS_PER_PROFILE);
  console.log('Total AI competitor simulations:', totalSimulations);

  const { trends, anomalies } = computeTrendsAndAnomalies(byProfile);
  const profileStatsList = byProfile.map((p) => ({ profileLabel: p.profileLabel, stats: aggregateProfileStats(p.results) }));

  const reportLines: string[] = [
    '',
    '════════════════════════════════════════════════════════════════════',
    '  WEEKLY REPORT — ' + weekLabel,
    '════════════════════════════════════════════════════════════════════',
    '',
    '--- High-level overview (created, built, updated, tested) ---',
    '',
    overview,
    '',
    '--- AI competitor simulations ---',
    '',
    `Total simulations this run: ${totalSimulations}`,
    `(Profiles: 0 HCP, 5 HCP, 10 HCP, 20 HCP, EW 2K, LPGA × ${RUNS_PER_PROFILE} runs each.)`,
    '',
    '--- Stats per profile (fairways, GIR, putts, up & down) ---',
    '',
  ];
  profileStatsList.forEach(({ profileLabel, stats }) => {
    reportLines.push(`  ${profileLabel}:`);
    reportLines.push(`    Score: ${stats.avgScore.toFixed(1)} avg (${stats.minScore}–${stats.maxScore})`);
    reportLines.push(`    Fairways: ${stats.fairwaysHit}/${stats.fairwayOpportunities} (${stats.fairwaysPct.toFixed(1)}%)`);
    reportLines.push(`    GIR: ${stats.girCount}/${18 * stats.runs} (${stats.girPct.toFixed(1)}%)`);
    reportLines.push(`    Putts/round: ${stats.puttsAvg.toFixed(1)} avg (${stats.puttsMin}–${stats.puttsMax})`);
    reportLines.push(
      `    Up & down: ${stats.upAndDownCount}/${stats.upAndDownOpportunities} (${stats.upAndDownPct.toFixed(1)}%)`
    );
    reportLines.push('');
  });
  reportLines.push('--- Trends ---', '', ...trends.map((t) => '  • ' + t), '', '--- Anomalies ---', '');
  reportLines.push(...(anomalies.length > 0 ? anomalies.map((a) => '  ⚠ ' + a) : ['  None detected.']), '', '--- PDFs generated ---', '');

  const mapsApiKey = process.env.VITE_GOOGLE_MAPS_API_KEY ?? '';
  for (const { profileLabel, results } of byProfile) {
    const safeName = profileLabel.replace(/\s+/g, '_').replace(/\+/g, 'plus');
    const pdfPath = path.join(PDF_DIR, `weekly_${safeName}.pdf`);
    await generateProfilePDF(profileLabel, results, pdfPath, mapsApiKey || undefined);
    reportLines.push('  ' + pdfPath);
  }

  reportLines.push('', '════════════════════════════════════════════════════════════════════', '');

  const reportPath = path.join(REPORTS_DIR, `report_${getLastMondayDateString()}.txt`);
  fs.writeFileSync(reportPath, reportLines.join('\n'), 'utf8');
  console.log('\n' + reportLines.join('\n'));
  console.log('\nSaved to ' + reportPath);

  if (doSend) {
    const nodemailer = (await import('nodemailer')).default;
    const user = process.env.SMTP_USER ?? process.env.GMAIL_USER;
    const pass = process.env.SMTP_PASS ?? process.env.GMAIL_APP_PASSWORD;
    if (!user || !pass) {
      console.error('Set GMAIL_USER and GMAIL_APP_PASSWORD (or SMTP_*) in .env to send email.');
      process.exit(1);
    }
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: { user, pass },
    });
    const RECIPIENT = process.env.WEEKLY_REPORT_RECIPIENT ?? 'kenzcole96@gmail.com';
    const attachments = byProfile.map(({ profileLabel, results }) => {
      const safeName = profileLabel.replace(/\s+/g, '_').replace(/\+/g, 'plus');
      return { filename: `weekly_${safeName}.pdf`, path: path.join(PDF_DIR, `weekly_${safeName}.pdf`) };
    });
    await transporter.sendMail({
      from: user,
      to: RECIPIENT,
      subject: `PinHigh weekly report — ${weekLabel}`,
      text: reportLines.join('\n'),
      attachments,
    });
    console.log('Email sent to ' + RECIPIENT);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
