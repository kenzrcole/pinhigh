# PinHigh — Daily Changelog

Log all changes made in each 24-hour window. The previous day’s section is used for the 9 AM PST summary email.

**How to use:** Add a new `## YYYY-MM-DD` section at the top each day (or as you start work). Under it, list bullet-point changes. Keep one line per change; you can add sub-bullets for detail.

---

## 2026-02-12

- **UI – Score bug (HoleMapViewGoogleMaps):**
  - Stroke counter is now par-based: show only 1..Par by default (e.g. Par 4 → 1,2,3,4); reveal extra numbers when over par (e.g. 5th stroke on Par 4). Resets per hole.
  - Removed hole ordinal (e.g. "7TH") next to stroke counter; kept yardage.
  - Removed "HOLE COMPLETE" blue banner; kept all hole-complete logic (green score bug, score entry form, navigation).
- **UI – HCP in score bug:** Show hole stroke index (HCP) after yardage in the middle row (e.g. "368 YDS · HCP 7"). Only shown when hole has `strokeIndex`.
- **Docs – Daily process:** Added this daily changelog and 9 AM PST summary script (see `scripts/README.md`).

---

## Template (copy for new days)

```markdown
## YYYY-MM-DD

- **Area – Short title:** Brief description.
- **Area – Short title:** Brief description.
```

---

*(Older entries below.)*
