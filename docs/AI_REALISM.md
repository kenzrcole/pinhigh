# Making AI Gameplay More Realistic

This doc explains why the test data looked the way it did, what was fixed, and what you can provide to make the AI play even more like real golfers.

---

## Why EW 2K Didn’t Have the Best Stats (Fixed)

In your PDF/summary, **EW 2K had a higher average score (48.4) and more putts (1.3) than scratch (0, +1, +3) (44.6, 1.0)**. That was a bug in the putting model:

- **Scratch (0, +1, +3)** used a **physics-style putt**: 2% dispersion + 6-inch gimme. The ball almost always finished within 6 inches, so they effectively **1-putted every green**.
- **EW 2K** used a **realistic probability** model (Tiger 2000 make % by distance). From 15–20 ft they only make ~22%, so they often **2-putted**.

So scratch had unrealistically perfect putting, which made them beat EW 2K on paper.

**Fix:** All numeric handicaps now use **distance-based make probabilities** that are slightly worse than EW 2K at every distance. EW 2K (Tiger curve) has the best make rates, so EW 2K now has the **best average score and best putting** among all profiles.

---

## What You Can Provide for More Realistic AI

Data and design choices that would make the AI feel more like real rounds:

### 1. **Course / hole data**
- **Exact tee and pin positions** (or front/back of green) so approach distances match the scorecard.
- **Fairway widths** (or polygons) so “fairway hit” matches real definition (e.g. ball in fairway at landing).
- **Green depth and typical pin zones** so make % and “leave” distance can vary by pin position.

### 2. **Real make percentages by handicap**
- **PGA Tour / scratch**: e.g. 4–5 ft, 6–9 ft, 10–15 ft make % (we use Tiger 2000 for EW 2K; you could plug in ShotLink-style data).
- **Amateur / high handicap**: make % by distance band (e.g. 5 HCP vs 20 HCP from 8 ft). That would tune `getNumericHandicapPuttMakeProbability` and EW 2K’s curve.

### 3. **Dispersion by situation**
- **Driving**: typical lateral and distance dispersion by handicap (e.g. from TrackMan or similar).
- **Approach**: dispersion by distance (e.g. 50 yd vs 150 yd) and lie (fairway vs rough vs bunker).
- **Recovery**: up-and-down % from greenside rough vs bunker by handicap.

### 4. **Club distances**
- **Your own (or target) yardages** by club and handicap tier so the AI’s club choice and max shot length match real players (we use HackMotion + Tiger 2000; you could replace with PinHigh or custom tables).

### 5. **Wind and slope**
- If you use **wind** and **slope** in the sim: effect on carry, lateral drift, and putt speed. We have settings for wind/slope; the AI could adjust aim and club based on them.

### 6. **Round / course context**
- **Typical scores** for a given course and handicap (e.g. “20 HCP averages 92 at Lincoln Park”). We can compare `test-results/summary.csv` to those benchmarks and tune dispersion/putting until averages match.

---

## Handicap Benchmark Statistics (Implemented)

The AI uses **published benchmark stats by handicap** to calibrate putting and approach dispersion. Data sources (via [golfexpectations.com](https://golfexpectations.com/category/goals/golf-statistics-goals/)):

- **GIR %**: BreakXGolf / TheGrint (scratch 56.8%, 5→46.1%, 10→37.3%); 15/20 from blog targets (e.g. 15 HCP ~4.86 GIR/round).
- **Putts per round**: MyGolfSpy / Pitchmarks (scratch ~29.6, 10 ~31.1, 15 ~32, 20 ~32.8).
- **3-putt %**: Lou Stagner / Arccos (e.g. 15 HCP ~2.5–3.3 per round; scratch ~6% of holes).
- **GIR+1**: Lou Stagner (scratch 16–17 chances/round, 20 HCP 11–12).
- **Double bogey or worse**: Lou Stagner / Arccos (for blow-up hole expectations).

These are stored in **`src/data/handicapBenchmarkStats.ts`** and used in `AIGolfer.ts` to:

1. **Putting**: Scale long-putt make probability by benchmark 3-putt % so higher handicaps 3-putt more often.
2. **Dispersion**: Scale distance and angle std dev by benchmark GIR % so scratch has tighter dispersion (higher GIR) and high handicaps wider (lower GIR).

Simulated putts/round and GIR will still depend on course length and green size; the benchmarks are targets the model aims toward.

---

## Where It's Used in Code

| What | Where |
|------|--------|
| Benchmark stats (GIR, putts, 3-putt, GIR+1, double+) | `handicapBenchmarkStats.ts`: `HANDICAP_BENCHMARK_STATS`, `getBenchmarkStatsForHandicap` |
| Putting make % (EW 2K) | `AIGolfer.ts`: `getTigerPuttMakeProbability`, `executeTigerPutt` |
| Putting make % (numeric HCP) | `AIGolfer.ts`: `getNumericHandicapPuttMakeProbability`, `executeNumericPutt` (uses benchmark 3-putt %) |
| Shot dispersion | `AIGolfer.ts`: `getStandardDeviationPercent`, `getAngleStdDevDegrees` (scaled by benchmark GIR %) |
| Club distances / max shot | `clubDistancesByHandicap.ts`: `HACKMOTION_*`, `TIGER_2000_YARDAGES`, `getMaxShotDistanceYards*` |
| Fairway / green / lie | `lincolnParkCourse.ts`: `getHoleFeaturesForAI`, `getLieFromPosition` |

If you have CSV or tables (e.g. make % by distance and HCP, or dispersion by situation), we can wire them into these functions so the AI rounds match your data.
