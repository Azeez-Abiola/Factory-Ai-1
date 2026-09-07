/**
 * Local (no-AI) frame comparison helpers.
 *
 * Everything here runs in the browser on a downscaled grayscale fingerprint of
 * the frame, so it costs nothing per check. It is used for two things:
 *  1. Scene-change gating — skip AI when the picture hasn't moved.
 *  2. Reference matching — compare the frame against the site's own uploaded
 *     "good"/"faulty" sample photos and only escalate to the AI when the
 *     match is ambiguous.
 */

export const SIGNATURE_SIZE = 32;

export interface Region {
  id: string;
  name: string;
  /** normalised 0..1 */
  x: number;
  y: number;
  w: number;
  h: number;
  categories?: string[];
}

export interface ReferenceSample {
  id: string;
  path: string;
  label: "good" | "defect";
  note?: string;
  /** SIGNATURE_SIZE² grayscale values, 0..1, rounded to 3dp. */
  signature: number[];
}

/** Union bounding box of the regions of interest, or the full frame. */
export function regionBounds(regions: Region[] | undefined | null) {
  if (!regions || regions.length === 0) return { x: 0, y: 0, w: 1, h: 1 };
  const x0 = Math.min(...regions.map((r) => r.x));
  const y0 = Math.min(...regions.map((r) => r.y));
  const x1 = Math.max(...regions.map((r) => r.x + r.w));
  const y1 = Math.max(...regions.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: Math.max(0.02, x1 - x0), h: Math.max(0.02, y1 - y0) };
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Downscaled grayscale fingerprint of an image, optionally cropped to the
 * camera's inspection areas so background traffic is ignored.
 */
export async function frameSignature(
  dataUrl: string,
  regions?: Region[] | null
): Promise<Float32Array | null> {
  const img = await loadImage(dataUrl);
  if (!img) return null;
  try {
    const bounds = regionBounds(regions);
    const canvas = document.createElement("canvas");
    canvas.width = SIGNATURE_SIZE;
    canvas.height = SIGNATURE_SIZE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(
      img,
      bounds.x * img.naturalWidth,
      bounds.y * img.naturalHeight,
      bounds.w * img.naturalWidth,
      bounds.h * img.naturalHeight,
      0, 0, SIGNATURE_SIZE, SIGNATURE_SIZE
    );
    const { data } = ctx.getImageData(0, 0, SIGNATURE_SIZE, SIGNATURE_SIZE);
    const out = new Float32Array(SIGNATURE_SIZE * SIGNATURE_SIZE);
    for (let i = 0; i < out.length; i++) {
      const p = i * 4;
      out[i] = (0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]) / 255;
    }
    return normalise(out);
  } catch {
    // Cross-origin frame — pixels are not readable.
    return null;
  }
}

/**
 * Remove overall brightness/contrast so a lighting change alone does not read
 * as a different product.
 */
function normalise(v: Float32Array): Float32Array {
  let mean = 0;
  for (let i = 0; i < v.length; i++) mean += v[i];
  mean /= v.length;
  let variance = 0;
  for (let i = 0; i < v.length; i++) variance += (v[i] - mean) ** 2;
  const sd = Math.sqrt(variance / v.length) || 1;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = (v[i] - mean) / sd;
  return out;
}

/** Mean absolute difference between two fingerprints (0 = identical). */
export function signatureDelta(a: Float32Array | number[], b: Float32Array | number[]): number {
  if (a.length !== b.length) return 1;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
}

export const toStoredSignature = (sig: Float32Array): number[] =>
  Array.from(sig, (n) => Math.round(n * 1000) / 1000);

export interface ReferenceVerdict {
  label: "good" | "defect";
  distance: number;
  sample: ReferenceSample;
  /** true when the distance is inside the configured match tolerance */
  confident: boolean;
}

/** Nearest uploaded sample to this frame — no AI involved. */
export function matchReference(
  signature: Float32Array,
  samples: ReferenceSample[],
  tolerance: number
): ReferenceVerdict | null {
  let best: ReferenceVerdict | null = null;
  for (const sample of samples) {
    if (!Array.isArray(sample.signature) || sample.signature.length !== signature.length) continue;
    const distance = signatureDelta(signature, sample.signature);
    if (!best || distance < best.distance) {
      best = { label: sample.label, distance, sample, confident: distance <= tolerance };
    }
  }
  return best;
}

/** Keep only detections whose centre falls inside one of the inspection areas. */
export function insideRegions<T extends { x: number; y: number; w: number; h: number }>(
  boxes: T[],
  regions?: Region[] | null
): T[] {
  if (!regions || regions.length === 0) return boxes;
  return boxes.filter((b) => {
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    return regions.some((r) => cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h);
  });
}

/** Human/AI-readable description of the areas to inspect. */
export function describeRegions(regions?: Region[] | null): string | null {
  if (!regions || regions.length === 0) return null;
  return regions
    .map(
      (r) =>
        `${r.name} at [x ${r.x.toFixed(2)}, y ${r.y.toFixed(2)}, w ${r.w.toFixed(2)}, h ${r.h.toFixed(2)}]` +
        (r.categories?.length ? ` (look for: ${r.categories.join(", ")})` : "")
    )
    .join("; ");
}
