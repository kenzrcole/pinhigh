# Executive Summary — PinHigh Golf GPS & AI Rounds

**For patent meeting — Wednesday**

**PinHigh** is a golf GPS and AI opponent app that lets you play a round while a simulated AI golfer plays the same course. The app combines **benchmark-calibrated shot simulation**, **condition-aware yardage** (wind and slope), and **multiple competition formats** with a mobile-first experience (React, TypeScript, Capacitor for iOS). The **provisional patent** covers the AI engine: **benchmark-to-dispersion mapping**, **recursive shot/lie system**, and **batch validation and calibration**.

---

## Current App Features & Capabilities

### 1. **Play flow**
- **Home** → **Course selection** → **Competition format** → **AI competitor selection** → **Round** (map, scorecard, settings).
- **Explore**: Browse courses; view full course map or hole-by-hole without starting a round.
- **Settings**: App settings, course editor (when enabled), and round settings (end round, etc.).

### 2. **Course & map**
- **Lincoln Park Golf Course** (San Francisco) modeled with per-hole features: tee, fairway, green, bunkers, water, trees.
- **Google Maps** hole view: satellite imagery, tee/green markers, tap-to-set **landing zone** (default 60% of hole distance).
- **Yardage first**: Distance-to-hole card loads first; when a target is set, four numbers: **To target**, **To target slope adjusted**, **To pin**, **To pin slope adjusted** (no separate slope-in-degrees display).
- **Wind**: Shown as direction arrow + speed (e.g. “W 8 mph”) in the top-left; used in “plays as” yardage when Pro Mode is on.
- **Score bug**: Hole number, par, yardage, shot progression, AI vs You scores, and status (e.g. “For birdie”).

### 3. **Competition format** (before AI selection)
- **Stroke play** — total strokes for 18 holes.
- **Match play** — win holes, not total score.
- **Team best ball scramble** — partner (friend or AI); opponents (1 or 2, chosen as real or AI on next screen).
- **Tournament mode** — field customized on AI screen: **field size** (20, 25, 30, 40, 50, 60, 100, 120), **play style** (net or gross stroke play), **field handicap range** (same 10% worse to 10% better bar).

### 4. **AI competitor**
- **Profiles**: **EW 2K** (Tiger 2000–era, GOAT) or numeric handicap (**0–20**, with plus handicaps in engine).
- **Variance** (when not free tier): AI can play 10% worse to 10% better (slider); affects driving, approach, short game, putting.
- **Tournament customization** (when format = tournament): field size, net/gross, field handicap variance.
- **Team scramble**: When format is team scramble, user selects 1 or 2 opponents (real or AI) on this screen.

### 5. **Pro Mode (conditions)**
- **Wind & slope** (stored in app state; currently default values, no live API): used for “plays as” yardage and **slope-adjusted** to-target and to-pin distances.
- **AI uses conditions**: When Pro Mode is on, the AI receives wind and slope and uses **effective (adjusted) yardage** for club choice and targeting, so the AI “plays in the same conditions” as the displayed yardage.

### 6. **Round experience**
- **Map view**: Hole map, landing zone, distance cards, wind indicator, AI Play button; after hole complete, score entry (AI score + your score) then advance.
- **Scorecard view**: Running scores and vs par for you and the AI.
- **Settings view**: Pro Mode toggle, wind/slope display (read-only), AI opponent handicap selection, end round.

### 7. **Technical & validation**
- **Stack**: React 18, TypeScript, Vite, Tailwind; `@react-google-maps/api`; Capacitor 8 (iOS).
- **State**: React Context (game, round); settings and AI profile persisted to `localStorage`.
- **Batch testing**: Run AI many rounds per profile; **CSV export** (summary stats, round details, shot routes) for validation and tuning.
- **Benchmark system**: Fairways, GIR, putts, scrambling, etc., tied to published stats (Arccos, TheGrint, SwingU, Lou Stagner, Break X, Golf Monthly) so simulated variance matches real handicap tiers.

---

## Differentiators vs. Current Market

| Dimension | PinHigh | Typical GPS / sim products |
|-----------|--------|----------------------------|
| **AI opponent** | **Benchmark-calibrated** shot variance (GIR, fairways, putts, scrambling by handicap); **EW 2K as GOAT** and **plus-handicap differentiation**; same wind/slope as user when Pro Mode on. | Often fixed difficulty, generic variance, or no shot-by-shot opponent; little or no calibration to real handicap stats. |
| **Conditions in yardage** | **Slope-adjusted distances** (to target, to pin) and wind in UI; single “plays as” and 4-number distance block; wind as arrow + mph. | Many apps show raw yardage only; slope/wind often separate or absent. |
| **Competition formats** | **Stroke, match, team scramble, tournament** with field size, net/gross, and field handicap range; flow before AI selection. | Most focus on stroke play or simple vs-CPU; few offer tournament field customization and team scramble options. |
| **Variance & calibration** | **Data-driven** mapping from handicap benchmarks to dispersion and make rates; batch tests and CSV export to tune against real stats. | Simulations often too consistent; few products expose a repeatable validation loop tied to published human performance data. |
| **Patent / IP** | **Provisional patent** (PinHigh AI engine): benchmark-to-dispersion mapping, recursive shot/lie system, batch validation and calibration. | Most golf sims use ad hoc or non-calibrated parameters. |

---

## Patent scope (meeting focus)

1. **Benchmark-to-dispersion mapping** — Handicap-indexed benchmark table (GIR, putts, 3-putt %, scrambling, fairways) drives Gaussian dispersion (distance + angle) and putting/chip parameters; GIR scales approach dispersion, scrambling scales chip dispersion; plus-handicap and elite (e.g. EW 2K) differentiation.
2. **Recursive shot and lie system** — Lie detection (green, water, bunker, fairway, rough) plus distance-to-pin drive shot type and target (fairway vs hole); tree collision/deflection; water penalty; all parameters from same benchmark mapping.
3. **Batch validation and calibration** — Many simulated rounds per skill level; aggregate stats (score, fairways %, GIR %, putts, scrambling); export (e.g. CSV); compare to same human benchmarks; iterative calibration of mapping until simulated variance matches benchmarks.

*Detailed description: `docs/PATENT_DETAILED_DESCRIPTION.md`*

---

## Summary in One Sentence

**PinHigh is a golf GPS and AI opponent app** with **benchmark-calibrated shot variance**, **EW 2K as GOAT** and **plus-handicap differentiation**, **condition-aware yardage** (wind + slope-adjusted to target and pin), **multiple competition formats** (including tournament field and team scramble), **Pro Mode** so the AI plays in the same wind/slope as the user, and a **repeatable test pipeline** with **CSV export** for validation and tuning—differentiated by **realistic variance** and **data-driven handicap calibration** versus typical GPS and sim products.
