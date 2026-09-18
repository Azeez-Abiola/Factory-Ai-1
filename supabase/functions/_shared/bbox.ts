/**
 * Shared box handling for AI detections.
 *
 * Vision models place objects far more accurately when they answer in their
 * native grounding convention: `box_2d = [ymin, xmin, ymax, xmax]` on a
 * 0-1000 grid. We therefore ask for `box_2d` and convert it here into the
 * normalised `[x, y, width, height]` fractions the UI draws with, instead of
 * asking the model to do the arithmetic itself (which produced boxes landing
 * on empty ground).
 */

export type Box = [number, number, number, number];

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Convert `[ymin, xmin, ymax, xmax]` on a 0-1000 grid into x/y/w/h fractions. */
export function box2dToBbox(raw: unknown): Box | null {
  if (!Array.isArray(raw) || raw.length < 4) return null;
  const nums = raw.slice(0, 4).map((n) => Number(n));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  // Tolerate models that answer on a 0-1 scale instead of 0-1000.
  const scale = nums.every((n) => n >= 0 && n <= 1) ? 1 : 1000;
  const [ymin, xmin, ymax, xmax] = nums.map((n) => clamp01(n / scale));
  const x = Math.min(xmin, xmax);
  const y = Math.min(ymin, ymax);
  const w = Math.abs(xmax - xmin);
  const h = Math.abs(ymax - ymin);
  if (w <= 0.001 || h <= 0.001) return null;
  return [x, y, Math.min(w, 1 - x), Math.min(h, 1 - y)];
}

/** Accept a legacy `[x, y, width, height]` box (0-1, 0-100 or 0-1000). */
export function legacyBbox(raw: unknown): Box | null {
  if (!Array.isArray(raw) || raw.length < 4) return null;
  const nums = raw.slice(0, 4).map((n) => Number(n));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  const max = Math.max(...nums.map(Math.abs));
  const scale = max <= 1.5 ? 1 : max <= 100 ? 100 : 1000;
  const [x, y, w, h] = nums.map((n) => clamp01(n / scale));
  if (w <= 0.001 || h <= 0.001) return null;
  return [x, y, Math.min(w, 1 - x), Math.min(h, 1 - y)];
}

/**
 * Normalise every detection in an analysis: resolve a usable bbox, or mark the
 * detection as unlocated so the console can say "no box" rather than draw a
 * guess over empty floor.
 */
export function normaliseDetections(analysis: any): void {
  if (!analysis || typeof analysis !== "object") return;
  const detections = Array.isArray(analysis.detections) ? analysis.detections : [];
  for (const d of detections) {
    if (!d || typeof d !== "object") continue;
    const box = box2dToBbox(d.box_2d) ?? legacyBbox(d.bbox ?? d.box ?? d.bounding_box);
    if (box) {
      d.bbox = box.map((n: number) => Number(n.toFixed(4)));
      d.box_2d = [
        Math.round(box[1] * 1000),
        Math.round(box[0] * 1000),
        Math.round((box[1] + box[3]) * 1000),
        Math.round((box[0] + box[2]) * 1000),
      ];
      d.located = true;
    } else {
      delete d.bbox;
      delete d.box_2d;
      d.located = false;
    }
  }
}

/** Detections that belong to a specific violation, so alerts don't show unrelated boxes. */
export function detectionsForViolation(violation: any, detections: any[]): any[] {
  const type = String(violation?.type ?? "").toLowerCase();
  const category = String(violation?.category ?? "").toLowerCase();
  const words = type.split(/[^a-z]+/).filter((w) => w.length > 3);
  const related = detections.filter((d) => {
    const label = String(d?.label ?? "").toLowerCase();
    const cat = String(d?.category ?? "").toLowerCase();
    if (category && cat === category) return true;
    if (cat && type.includes(cat)) return true;
    if (label && (type.includes(label) || label.includes(type))) return true;
    return words.some((w) => label.includes(w) || cat.includes(w));
  });
  return related.length ? related : detections;
}
