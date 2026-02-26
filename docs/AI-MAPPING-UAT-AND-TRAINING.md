# AI Mapping Tool: UAT and Training Guide

The **AI mapping** feature does a first-pass layout of a hole in the Course Editor: it pulls OpenStreetMap (OSM) hazards (bunkers, water, rough) in the tee–green area and adds heuristic fairway, green boundary, and tree circles. You then refine by hand (move/delete/add).

---

## Where to find it

1. **Home** → **Settings** → **Edit course**
2. Pick a **course** (e.g. TPC Harding Park) and open **hole 1** (or any hole)
3. In the right-hand **Hole Editor** panel, scroll to **“AI mapping”**
4. Use **“AI map this hole”** (sparkles icon). It runs a short loading state (“Mapping…”), then draws hazards, fairway, green boundary, and trees

**Prerequisites:** Tee and green must be set (drag the T and flag on the map if needed). The feature uses that line to define the hole and fetch OSM data in a box around it.

---

## UAT (User Acceptance Testing)

### Goals

- Confirm AI mapping runs without errors on all supported courses/holes
- Confirm output is usable (hazards in the right area, fairway/green/trees plausible)
- Catch regressions (e.g. blank map, infinite loop, missing or duplicated features)

### Test matrix

| # | Scenario | Steps | Expected | Pass? |
|---|----------|--------|----------|-------|
| 1 | Happy path – one hole | Open TPC Harding Park → Hole 1 → set tee/green if needed → **AI map this hole** | Hazards (if OSM has them), fairway band, green circle, 2 tree circles; no console errors | |
| 2 | Multiple holes, same course | For TPC Harding Park, run AI map on holes 1, 9, 18 | Each hole gets its own layout; no cross-hole mix-up; map view stable (no “max update” error) | |
| 3 | Multiple courses | Run AI map on one hole each for: Lincoln Park, Golden Gate Park, TPC Harding Park, Half Moon Bay (Ocean/Old) | Same behavior; no crashes; OSM may return nothing for some (heuristic-only is OK) | |
| 4 | Hole with no OSM hazards | Pick a hole/course where OSM has no bunkers/water in bbox | Only fairway + green + 2 trees; no errors | |
| 5 | After “Start from scratch” | **Start from scratch** → then **AI map this hole** | Fresh AI layout; no leftover features from before | |
| 6 | After “Discard changes” | **AI map** → make a small edit → **Discard changes** → **AI map** again | Second run replaces first; no duplicate layers or stale overlays | |
| 7 | Verify playability | After AI map, start a **Play** round on that course/hole; hit **AI Play** | AI plays the hole using the new hazards/trees; no runtime errors; ball respects hazards where expected | |

### What to verify on the map

- **Hazards:** Bunkers and water (and rough if mapped) appear roughly where they are on satellite; no huge misplacement
- **Fairway:** Single band between tee and green; width ~35 m heuristic
- **Green:** Circle around the green pin (~12 m radius)
- **Trees:** Two circles (left/right of hole); can be adjusted or removed later
- **No duplicates:** Running “AI map” again should replace, not stack (you may need to **Discard** or **Start from scratch** first if the UI appends)

### How to report issues

- **Course name + hole number** (e.g. “TPC Harding Park, Hole 1”)
- **What you did** (e.g. “Clicked AI map this hole”)
- **What you expected** (e.g. “Bunkers and water from OSM”)
- **What happened** (e.g. “Blank map”, “Maximum update depth”, “No hazards at all”, “Wrong position”)
- **Browser console** (any red errors or Overpass/network errors)
- **Screenshot** of the map and panel if useful

---

## Training users (how to use the feature)

### Short “how to” for testers or course editors

1. **Open the hole**  
   Settings → Edit course → select course → open the hole (e.g. Hole 1).

2. **Set tee and green**  
   If the hole has no tee/green yet, drag the **T** (tee) and **flag** (green) to the correct spots on the satellite map. AI mapping uses the line between them.

3. **Run AI mapping**  
   In the right panel, find **“AI mapping”** and click **“AI map this hole”**. Wait for “Mapping…” to finish.

4. **Review and refine**  
   - **Hazards:** Move, resize, or remove (water/bunker/OB/stake) via the list and map.  
   - **Fairway / green:** Use the **Fairway** and **Green boundary** tools to redraw if the heuristic shape is wrong.  
   - **Trees:** Delete or add tree circles as needed.

5. **Save and test in Play**  
   Save (or rely on auto-save if applicable), then start a round and use **Play** → that course/hole → **AI Play** to confirm the AI uses the new layout.

### Tips to mention

- AI mapping is a **first pass**. Expect to delete wrong hazards and nudge fairway/green on real courses.
- If a course has **no OSM data** for that hole, you still get fairway + green + trees (heuristics only).
- **Start from scratch** clears the hole; **Discard changes** reverts to last saved. Use before re-running AI map if you want a clean replace.

---

## Improving the “AI” (data and heuristics)

The current “AI” is **rule-based**: OSM Overpass query + fixed heuristics. There is no ML model to train; “training” here means **validation and tuning**.

### 1. Validate OSM coverage

- Run AI map on several holes per course. Note where **no hazards** appear even when you see bunkers/water on the map.
- Check [OpenStreetMap](https://www.openstreetmap.org) for those areas: tags like `golf=bunker`, `golf=water_hazard`, `natural=water` + `golf=yes`, `landuse=grass` + `golf=rough`. If tags are missing or different, OSM won’t return them; the code would need to stay as-is or the Overpass query extended (in `hazardService.ts`).

### 2. Tune heuristics (optional)

In `src/services/aiMappingService.ts`:

- **Fairway width:** `heuristicFairway(tee, green, 35)` — change `35` (meters) for wider/narrower default fairway.
- **Green size:** `heuristicGreenBoundary(green, 12, 12)` — radius and point count.
- **Tree offset:** `heuristicTrees(tee, green, 28)` — distance from centerline; radius/height in that function.
- **Bbox padding:** `bboxFromTeeGreen(tee, green, 250)` — 250 m padding; increase if you want more area for OSM hazards.

Change these, re-run UAT on 2–3 holes per course, and document what values work best for your courses.

### 3. Optional: automated smoke test

You can add a small script that calls `mapHoleWithAI(tee, green)` for a fixed tee/green (e.g. TPC Harding Park hole 1) and checks that the result has `hazards`, `fairwayPolygon`, `greenBoundaryPolygon`, and `trees` with expected shapes/lengths. That gives a quick regression check after changing `aiMappingService` or `hazardService`.

---

## Quick reference

| Item | Where |
|------|--------|
| Feature entry | Settings → Edit course → [Course] → [Hole] → “AI mapping” → “AI map this hole” |
| AI logic | `src/services/aiMappingService.ts` (`mapHoleWithAI`) |
| OSM fetch | `src/services/hazardService.ts` (Overpass API) |
| Editor UI | `src/components/CourseEditorHoleView.tsx` (handleAIMap, “AI mapping” panel) |
| UAT checklist | This doc, “Test matrix” and “What to verify” |
| Tuning | `aiMappingService.ts` (heuristic constants and bbox padding) |
