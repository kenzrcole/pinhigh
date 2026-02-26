/**
 * Course Pro editor: persist tee/green overrides, hazards, trees, fairway, boundary and presets per course.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface TeeGreen {
  tee: LatLng;
  green: LatLng;
}

export type HazardType = 'water' | 'out_of_bounds' | 'bunker';

/** Red or yellow stake (penalty area marking). */
export type HazardStake = 'red' | 'yellow';

/** Left or right side for out-of-bounds (e.g. OB left of hole). */
export type OBSide = 'left' | 'right';

/** Circle hazard (single tap to place). */
export interface HazardCircle {
  id: string;
  type: HazardType;
  shape: 'circle';
  center: LatLng;
  radiusMeters: number;
  /** Red or yellow stake for water/OB penalty areas. */
  stake?: HazardStake;
  /** For out_of_bounds: which side (left/right) of the hole. */
  obSide?: OBSide;
}

/** Polygon hazard (drawn with multiple points). */
export interface HazardPolygon {
  id: string;
  type: HazardType;
  shape: 'polygon';
  vertices: LatLng[];
  /** Red or yellow stake for water/OB polygon areas. */
  stake?: HazardStake;
  /** For out_of_bounds: which side (left/right) of the hole. */
  obSide?: OBSide;
}

export type HazardShape = HazardCircle | HazardPolygon;

/** Normalize legacy hazard (no shape) to circle. */
function normalizeHazard(h: HazardShape | (HazardShape & { shape?: string })): HazardShape {
  if ('shape' in h && (h.shape === 'circle' || h.shape === 'polygon')) return h as HazardShape;
  const legacy = h as { id: string; type: HazardType; center?: LatLng; radiusMeters?: number; vertices?: LatLng[]; stake?: HazardStake; obSide?: OBSide };
  if (legacy.vertices && Array.isArray(legacy.vertices) && legacy.vertices.length >= 3)
    return { id: legacy.id, type: legacy.type, shape: 'polygon', vertices: legacy.vertices, stake: legacy.stake, obSide: legacy.obSide };
  return {
    id: legacy.id,
    type: legacy.type,
    shape: 'circle',
    center: legacy.center ?? { lat: 0, lng: 0 },
    radiusMeters: legacy.radiusMeters ?? 10,
    stake: (legacy as { stake?: HazardStake }).stake,
    obSide: (legacy as { obSide?: OBSide }).obSide,
  };
}

export interface TreeShape {
  id: string;
  center: LatLng;
  radiusMeters: number;
  heightMeters?: number;
}

/** Forest/patch: dense cluster of trees drawn as a polygon. */
export interface TreePatch {
  id: string;
  vertices: LatLng[];
}

/** Pin (hole) position on the green. Multiple pins allowed for different hole locations. */
export interface PinPosition {
  id: string;
  position: LatLng;
}

export interface HoleOverride {
  tee: LatLng;
  green: LatLng;
  /** Multiple pin (hole) positions on the green. If empty/undefined, green center is the pin. */
  pins?: PinPosition[];
  hazards?: HazardShape[];
  trees?: TreeShape[];
  /** Forest/patch polygons (dense tree areas). */
  treePatches?: TreePatch[];
  /** One or more fairway polygons (e.g. split by cart path or hazard). Each is a ring of vertices. */
  fairways?: LatLng[][];
  /** @deprecated Use fairways. Kept for migration from single fairway. */
  fairway?: LatLng[];
  /** Hole boundary as polygon (closed). Not OB unless a separate hazard. */
  boundary?: LatLng[];
  /** Green outline as polygon (closed). */
  greenBoundary?: LatLng[];
}

export interface CoursePreset {
  id: string;
  name: string;
  createdAt: number;
  holes: Record<number, HoleOverride>;
}

export interface CourseEdits {
  overrides: Record<number, HoleOverride>;
  presets: CoursePreset[];
  /** Course boundary: array of polygons. Play is in-bounds only inside these; everything outside is OB unless otherwise marked. */
  courseBoundary?: LatLng[][];
}

const STORAGE_PREFIX = 'golfGPS_courseEdits_';

function storageKey(courseName: string): string {
  return `${STORAGE_PREFIX}${courseName.replace(/\s+/g, '_')}`;
}

export function loadCourseEdits(courseName: string): CourseEdits {
  try {
    const raw = localStorage.getItem(storageKey(courseName));
    if (!raw) return { overrides: {}, presets: [] };
    const parsed = JSON.parse(raw) as CourseEdits;
    return {
      overrides: parsed.overrides ?? {},
      presets: Array.isArray(parsed.presets) ? parsed.presets : [],
      courseBoundary: Array.isArray(parsed.courseBoundary) ? parsed.courseBoundary : undefined,
    };
  } catch {
    return { overrides: {}, presets: [] };
  }
}

export function saveCourseEdits(courseName: string, edits: CourseEdits): void {
  try {
    localStorage.setItem(storageKey(courseName), JSON.stringify(edits));
  } catch {
    // ignore
  }
}

export function getCourseBoundary(courseName: string): LatLng[][] {
  const edits = loadCourseEdits(courseName);
  return Array.isArray(edits.courseBoundary) ? edits.courseBoundary.map((p) => [...p]) : [];
}

export function addCourseBoundarySection(courseName: string, polygon: LatLng[]): void {
  if (polygon.length < 3) return;
  const edits = loadCourseEdits(courseName);
  const sections = Array.isArray(edits.courseBoundary) ? [...edits.courseBoundary] : [];
  sections.push(polygon.map((pt) => ({ ...pt })));
  saveCourseEdits(courseName, { ...edits, courseBoundary: sections });
}

export function removeCourseBoundarySection(courseName: string, index: number): void {
  const edits = loadCourseEdits(courseName);
  const sections = Array.isArray(edits.courseBoundary) ? [...edits.courseBoundary] : [];
  sections.splice(index, 1);
  saveCourseEdits(courseName, { ...edits, courseBoundary: sections.length > 0 ? sections : undefined });
}

/** Replace the entire course boundary (e.g. to seed default sections for Lincoln Park). */
export function setCourseBoundary(courseName: string, sections: LatLng[][]): void {
  const edits = loadCourseEdits(courseName);
  const normalized = sections.map((p) => p.map((pt) => ({ ...pt })));
  saveCourseEdits(courseName, { ...edits, courseBoundary: normalized.length > 0 ? normalized : undefined });
}

export function getTeeGreenOverride(
  courseName: string,
  holeNumber: number
): TeeGreen | null {
  const edits = loadCourseEdits(courseName);
  const o = edits.overrides[holeNumber];
  return o?.tee && o?.green ? { tee: { ...o.tee }, green: { ...o.green } } : null;
}

function normalizeFairways(o: HoleOverride): LatLng[][] {
  if (o.fairways && o.fairways.length > 0) return o.fairways.map((p) => [...p]);
  if (o.fairway && o.fairway.length > 0) return [[...o.fairway]];
  return [];
}

export function getHoleOverride(courseName: string, holeNumber: number): HoleOverride | null {
  const edits = loadCourseEdits(courseName);
  const o = edits.overrides[holeNumber];
  if (!o?.tee || !o?.green) return null;
  const fairways = normalizeFairways(o as HoleOverride);
  return {
    tee: { ...o.tee },
    green: { ...o.green },
    pins: o.pins ? o.pins.map((p) => ({ id: p.id, position: { ...p.position } })) : undefined,
    hazards: o.hazards ? o.hazards.map(normalizeHazard) : undefined,
    trees: o.trees ? [...o.trees] : undefined,
    treePatches: o.treePatches ? [...o.treePatches] : undefined,
    fairways: fairways.length > 0 ? fairways : undefined,
    boundary: o.boundary ? [...o.boundary] : undefined,
    greenBoundary: o.greenBoundary ? [...o.greenBoundary] : undefined,
  };
}

/** Raw override for a hole when getHoleOverride returned null (missing tee/green). Ensures hazards, trees, pins, fairway still show. */
function getRawHoleOverride(courseName: string, holeNumber: number): HoleOverride | null {
  const edits = loadCourseEdits(courseName);
  const o = edits.overrides[holeNumber];
  if (!o) return null;
  const fairways = normalizeFairways(o as HoleOverride);
  return {
    tee: o.tee && typeof (o.tee as LatLng).lat === 'number' ? { ...(o.tee as LatLng) } : { lat: 0, lng: 0 },
    green: o.green && typeof (o.green as LatLng).lat === 'number' ? { ...(o.green as LatLng) } : { lat: 0, lng: 0 },
    pins: o.pins ? o.pins.map((p) => ({ id: p.id, position: { ...p.position } })) : undefined,
    hazards: o.hazards ? o.hazards.map(normalizeHazard) : undefined,
    trees: o.trees ? [...o.trees] : undefined,
    treePatches: o.treePatches ? [...o.treePatches] : undefined,
    fairways: fairways.length > 0 ? fairways : undefined,
    boundary: o.boundary ? [...o.boundary] : undefined,
    greenBoundary: o.greenBoundary ? [...o.greenBoundary] : undefined,
  };
}

/** Get effective hole data for editing (override merged with base tee/green). When override has no tee/green, use raw override for features + base tee/green so hole 1 objects still show. */
export function getEffectiveHoleData(
  courseName: string,
  holeNumber: number,
  baseTeeGreen: TeeGreen | null
): HoleOverride {
  const override = getHoleOverride(courseName, holeNumber);
  const raw = override ? null : getRawHoleOverride(courseName, holeNumber);
  const base = override ?? raw;
  const fairways = base?.fairways ?? [];
  const useBaseTeeGreen = !override && raw;
  return {
    tee: useBaseTeeGreen ? (baseTeeGreen?.tee ?? { lat: 0, lng: 0 }) : (base?.tee ?? baseTeeGreen?.tee ?? { lat: 0, lng: 0 }),
    green: useBaseTeeGreen ? (baseTeeGreen?.green ?? { lat: 0, lng: 0 }) : (base?.green ?? baseTeeGreen?.green ?? { lat: 0, lng: 0 }),
    pins: base?.pins ?? [],
    hazards: base?.hazards ?? [],
    trees: base?.trees ?? [],
    treePatches: base?.treePatches ?? [],
    fairways: fairways.length > 0 ? fairways : undefined,
    boundary: base?.boundary,
    greenBoundary: base?.greenBoundary,
  };
}

export function setTeeGreenOverride(
  courseName: string,
  holeNumber: number,
  tee: LatLng,
  green: LatLng
): void {
  const edits = loadCourseEdits(courseName);
  const existing = edits.overrides[holeNumber];
  edits.overrides[holeNumber] = {
    ...existing,
    tee: { ...tee },
    green: { ...green },
  };
  saveCourseEdits(courseName, edits);
}

export function setHoleOverride(
  courseName: string,
  holeNumber: number,
  data: Partial<HoleOverride>
): void {
  const edits = loadCourseEdits(courseName);
  const existing = edits.overrides[holeNumber];
  const next: Record<string, unknown> = {
    ...existing,
    ...data,
    tee: data.tee ? { ...data.tee } : existing?.tee ?? { lat: 0, lng: 0 },
    green: data.green ? { ...data.green } : existing?.green ?? { lat: 0, lng: 0 },
  };
  if ('fairways' in data) delete next.fairway;
  edits.overrides[holeNumber] = next as HoleOverride;
  saveCourseEdits(courseName, edits);
}

export function addHazard(
  courseName: string,
  holeNumber: number,
  currentData: HoleOverride,
  hazard: Omit<HazardCircle, 'id'>
): string {
  const o = getHoleOverride(courseName, holeNumber);
  const base = o ?? currentData;
  const id = `hazard_${Date.now()}`;
  const hazards: HazardShape[] = [...(base.hazards ?? []), { ...hazard, id, shape: 'circle' }];
  setHoleOverride(courseName, holeNumber, { ...base, hazards });
  return id;
}

export function addHazardPolygon(
  courseName: string,
  holeNumber: number,
  currentData: HoleOverride,
  type: HazardType,
  vertices: LatLng[],
  obSide?: OBSide,
  stake?: HazardStake
): string {
  if (vertices.length < 3) return '';
  const o = getHoleOverride(courseName, holeNumber);
  const base = o ?? currentData;
  const id = `hazard_${Date.now()}`;
  const hazard: HazardPolygon = {
    id,
    type,
    shape: 'polygon',
    vertices: [...vertices],
    ...(type === 'out_of_bounds' && obSide ? { obSide } : {}),
    ...((type === 'water' || type === 'out_of_bounds') && stake ? { stake } : {}),
  };
  const hazards: HazardShape[] = [...(base.hazards ?? []), hazard];
  setHoleOverride(courseName, holeNumber, { ...base, hazards });
  return id;
}

export function removeHazard(courseName: string, holeNumber: number, hazardId: string): void {
  const o = getHoleOverride(courseName, holeNumber);
  if (!o) return;
  const hazards = (o.hazards ?? []).filter((h) => h.id !== hazardId);
  setHoleOverride(courseName, holeNumber, { ...o, hazards });
}

export function updateHazardRadius(
  courseName: string,
  holeNumber: number,
  hazardId: string,
  radiusMeters: number
): void {
  const o = getHoleOverride(courseName, holeNumber);
  if (!o) return;
  const hazards = (o.hazards ?? []).map((h) =>
    h.id === hazardId && h.shape === 'circle'
      ? { ...h, radiusMeters: Math.max(1, Math.min(50, radiusMeters)) }
      : h
  );
  setHoleOverride(courseName, holeNumber, { ...o, hazards });
}

export function updateHazardStake(
  courseName: string,
  holeNumber: number,
  hazardId: string,
  stake: HazardStake | undefined
): void {
  const o = getHoleOverride(courseName, holeNumber);
  if (!o) return;
  const hazards = (o.hazards ?? []).map((h) =>
    h.id === hazardId ? { ...h, stake } : h
  );
  setHoleOverride(courseName, holeNumber, { ...o, hazards });
}

export function updateHazardObSide(
  courseName: string,
  holeNumber: number,
  hazardId: string,
  obSide: OBSide | undefined
): void {
  const o = getHoleOverride(courseName, holeNumber);
  if (!o) return;
  const hazards = (o.hazards ?? []).map((h) =>
    h.id === hazardId && h.type === 'out_of_bounds' ? { ...h, obSide } : h
  );
  setHoleOverride(courseName, holeNumber, { ...o, hazards });
}

export function updateHazardCenter(
  courseName: string,
  holeNumber: number,
  hazardId: string,
  center: LatLng
): void {
  const o = getHoleOverride(courseName, holeNumber);
  if (!o) return;
  const hazards = (o.hazards ?? []).map((h) =>
    h.id === hazardId && h.shape === 'circle' ? { ...h, center: { ...center } } : h
  );
  setHoleOverride(courseName, holeNumber, { ...o, hazards });
}

export function updateHazardVertices(
  courseName: string,
  holeNumber: number,
  hazardId: string,
  vertices: LatLng[]
): void {
  if (vertices.length < 3) return;
  const o = getHoleOverride(courseName, holeNumber);
  if (!o) return;
  const hazards = (o.hazards ?? []).map((h) =>
    h.id === hazardId && h.shape === 'polygon' ? { ...h, vertices: vertices.map((v) => ({ ...v })) } : h
  );
  setHoleOverride(courseName, holeNumber, { ...o, hazards });
}

/** Add a pin (hole) position. Use green center if no pins exist. Base from store so pin moves aren't overwritten. */
export function addPin(
  courseName: string,
  holeNumber: number,
  position: LatLng,
  currentData: HoleOverride
): string {
  const o = getHoleOverride(courseName, holeNumber);
  const base = o ?? currentData;
  const id = `pin_${Date.now()}`;
  const pins = [...(base.pins ?? []), { id, position: { ...position } }];
  setHoleOverride(courseName, holeNumber, { ...base, pins });
  return id;
}

export function removePin(courseName: string, holeNumber: number, pinId: string): void {
  const o = getHoleOverride(courseName, holeNumber);
  if (!o) return;
  const pins = (o.pins ?? []).filter((p) => p.id !== pinId);
  setHoleOverride(courseName, holeNumber, { ...o, pins: pins.length > 0 ? pins : undefined });
}

export function updatePinPosition(
  courseName: string,
  holeNumber: number,
  pinId: string,
  position: LatLng
): void {
  const o = getHoleOverride(courseName, holeNumber);
  if (!o?.pins) return;
  const pins = o.pins.map((p) =>
    p.id === pinId ? { ...p, position: { ...position } } : p
  );
  setHoleOverride(courseName, holeNumber, { ...o, pins });
}

/** Append one tree; reads current trees from store so rapid clicks each add one tree. Returns new tree id. */
export function addTree(
  courseName: string,
  holeNumber: number,
  currentData: HoleOverride,
  tree: Omit<TreeShape, 'id'>
): string {
  const o = getHoleOverride(courseName, holeNumber);
  const base = o ?? currentData;
  const currentTrees = base.trees ?? [];
  const id = `tree_${Date.now()}`;
  const trees = [...currentTrees, { ...tree, id }];
  setHoleOverride(courseName, holeNumber, { ...base, trees });
  return id;
}

export function updateTreePosition(
  courseName: string,
  holeNumber: number,
  treeId: string,
  center: LatLng
): void {
  const o = getHoleOverride(courseName, holeNumber);
  if (!o) return;
  const trees = (o.trees ?? []).map((t) =>
    t.id === treeId ? { ...t, center: { ...center } } : t
  );
  setHoleOverride(courseName, holeNumber, { ...o, trees });
}

export function updateTreeRadius(
  courseName: string,
  holeNumber: number,
  treeId: string,
  radiusMeters: number
): void {
  const o = getHoleOverride(courseName, holeNumber);
  if (!o) return;
  const trees = (o.trees ?? []).map((t) =>
    t.id === treeId ? { ...t, radiusMeters: Math.max(2, Math.min(20, radiusMeters)) } : t
  );
  setHoleOverride(courseName, holeNumber, { ...o, trees });
}

export function removeTree(courseName: string, holeNumber: number, treeId: string): void {
  const o = getHoleOverride(courseName, holeNumber);
  if (!o) return;
  const trees = (o.trees ?? []).filter((t) => t.id !== treeId);
  setHoleOverride(courseName, holeNumber, { ...o, trees });
}

/** Append one tree patch/forest polygon (dense cluster of trees). Base from store so pin moves aren't overwritten. */
export function addTreePatch(
  courseName: string,
  holeNumber: number,
  vertices: LatLng[],
  currentData: HoleOverride
): string {
  if (vertices.length < 3) return '';
  const o = getHoleOverride(courseName, holeNumber);
  const base = o ?? currentData;
  const id = `treepatch_${Date.now()}`;
  const patch: TreePatch = { id, vertices: [...vertices] };
  const treePatches = [...(base.treePatches ?? []), patch];
  setHoleOverride(courseName, holeNumber, { ...base, treePatches });
  return id;
}

export function removeTreePatch(courseName: string, holeNumber: number, patchId: string): void {
  const o = getHoleOverride(courseName, holeNumber);
  if (!o) return;
  const treePatches = (o.treePatches ?? []).filter((p) => p.id !== patchId);
  setHoleOverride(courseName, holeNumber, { ...o, treePatches: treePatches.length > 0 ? treePatches : undefined });
}

export function updateTreePatchVertices(
  courseName: string,
  holeNumber: number,
  patchId: string,
  vertices: LatLng[]
): void {
  if (vertices.length < 3) return;
  const o = getHoleOverride(courseName, holeNumber);
  if (!o) return;
  const treePatches = (o.treePatches ?? []).map((p) =>
    p.id === patchId ? { ...p, vertices: vertices.map((v) => ({ ...v })) } : p
  );
  setHoleOverride(courseName, holeNumber, { ...o, treePatches });
}

/** Append one fairway polygon (e.g. for holes with multiple fairways separated by path or hazard). Base from store so pin moves aren't overwritten. */
export function addFairway(courseName: string, holeNumber: number, path: LatLng[], currentData: HoleOverride): void {
  if (path.length < 3) return;
  const o = getHoleOverride(courseName, holeNumber);
  const base = o ?? currentData;
  const existing = base.fairways ?? [];
  setHoleOverride(courseName, holeNumber, { ...base, fairways: [...existing, path] });
}

export function removeFairway(courseName: string, holeNumber: number, index: number): void {
  const o = getHoleOverride(courseName, holeNumber);
  if (!o) return;
  const fairways = (o.fairways ?? []).filter((_, i) => i !== index);
  setHoleOverride(courseName, holeNumber, { ...o, fairways: fairways.length > 0 ? fairways : undefined });
}

export function updateFairway(
  courseName: string,
  holeNumber: number,
  index: number,
  path: LatLng[]
): void {
  if (path.length < 3) return;
  const o = getHoleOverride(courseName, holeNumber);
  if (!o?.fairways || index < 0 || index >= o.fairways.length) return;
  const fairways = o.fairways.map((p, i) => (i === index ? path.map((pt) => ({ ...pt })) : [...p]));
  setHoleOverride(courseName, holeNumber, { ...o, fairways });
}

export function setBoundary(courseName: string, holeNumber: number, path: LatLng[], currentData: HoleOverride): void {
  const o = getHoleOverride(courseName, holeNumber);
  const base = o ?? currentData;
  setHoleOverride(courseName, holeNumber, { ...base, boundary: path.length > 0 ? path : undefined });
}

export function setGreenBoundary(courseName: string, holeNumber: number, path: LatLng[], currentData: HoleOverride): void {
  const o = getHoleOverride(courseName, holeNumber);
  const base = o ?? currentData;
  setHoleOverride(courseName, holeNumber, { ...base, greenBoundary: path.length > 0 ? path : undefined });
}

export function discardHoleChanges(courseName: string, holeNumber: number): void {
  const edits = loadCourseEdits(courseName);
  delete edits.overrides[holeNumber];
  saveCourseEdits(courseName, edits);
}

/** Reset hole to base data (remove override). */
export function startHoleFromScratch(courseName: string, holeNumber: number): void {
  discardHoleChanges(courseName, holeNumber);
}

/**
 * Clear only AI-mapped features (hazards, trees, fairways, green boundary) so "AI map this hole" again
 * replaces with a fresh pass instead of appending. Keeps tee, green, pins, and boundary.
 * Uses explicit empty arrays so stored override clearly has no hazards/trees (no ambiguity with undefined).
 */
export function clearHoleFeaturesForAIMap(
  courseName: string,
  holeNumber: number,
  currentData: HoleOverride
): void {
  setHoleOverride(courseName, holeNumber, {
    ...currentData,
    hazards: [],
    trees: [],
    treePatches: [],
    fairways: [],
    fairway: undefined,
    greenBoundary: undefined,
  });
}

export function getPresets(courseName: string): CoursePreset[] {
  return loadCourseEdits(courseName).presets;
}

export function saveAsPreset(courseName: string, name: string): CoursePreset {
  const edits = loadCourseEdits(courseName);
  const holes: Record<number, HoleOverride> = {};
  Object.entries(edits.overrides).forEach(([k, v]) => {
    if (v?.tee && v?.green) holes[Number(k)] = { ...v };
  });
  const preset: CoursePreset = {
    id: `preset_${Date.now()}`,
    name,
    createdAt: Date.now(),
    holes,
  };
  edits.presets = [...edits.presets, preset];
  saveCourseEdits(courseName, edits);
  return preset;
}

export function loadPreset(courseName: string, presetId: string): void {
  const edits = loadCourseEdits(courseName);
  const preset = edits.presets.find((p) => p.id === presetId);
  if (!preset) return;
  edits.overrides = { ...preset.holes };
  saveCourseEdits(courseName, edits);
}

export function deletePreset(courseName: string, presetId: string): void {
  const edits = loadCourseEdits(courseName);
  edits.presets = edits.presets.filter((p) => p.id !== presetId);
  saveCourseEdits(courseName, edits);
}
