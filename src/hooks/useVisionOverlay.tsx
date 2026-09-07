import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type VisionCategory =
  | "ppe" | "intrusion" | "downtime" | "ergonomics"
  | "quality" | "housekeeping" | "forklift" | "other";

export interface VisionBox {
  id: string;
  label: string;
  category: VisionCategory;
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;
  x: number; y: number; w: number; h: number; // normalised 0..1
}

export const VISION_CATEGORIES: { id: VisionCategory; label: string }[] = [
  { id: "ppe", label: "PPE" },
  { id: "intrusion", label: "Restricted zone" },
  { id: "forklift", label: "Forklift / pedestrian" },
  { id: "quality", label: "Quality" },
  { id: "housekeeping", label: "Housekeeping" },
  { id: "ergonomics", label: "Ergonomics" },
  { id: "downtime", label: "Downtime" },
  { id: "other", label: "Other" },
];

export const categoryColor = (category: VisionCategory) => `hsl(var(--vision-${category}))`;

const KNOWN: VisionCategory[] = ["ppe", "intrusion", "downtime", "ergonomics", "quality", "housekeeping", "forklift", "other"];

function guessCategory(raw: unknown, label: string): VisionCategory {
  const value = String(raw ?? "").toLowerCase();
  if (KNOWN.includes(value as VisionCategory)) return value as VisionCategory;
  const text = `${value} ${label}`.toLowerCase();
  if (/helmet|hard ?hat|vest|glove|goggle|ppe|mask|ear/.test(text)) return "ppe";
  if (/forklift|truck|vehicle|pedestrian/.test(text)) return "forklift";
  if (/restrict|intrus|unauthor|cordon|fence/.test(text)) return "intrusion";
  if (/spill|obstruct|clutter|exit|5s|housekeep/.test(text)) return "housekeeping";
  if (/defect|quality|damage|misalign|packag/.test(text)) return "quality";
  if (/lift|posture|ergonom|strain|bend/.test(text)) return "ergonomics";
  if (/idle|downtime|stall|stopped/.test(text)) return "downtime";
  return "other";
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

/** Accepts [x,y,w,h] or {x,y,width,height} in 0..1 or 0..100 / pixel-ish ranges. */
function parseBox(raw: any): { x: number; y: number; w: number; h: number } | null {
  let v: number[] | null = null;
  if (Array.isArray(raw) && raw.length >= 4 && raw.every((n) => typeof n === "number")) {
    v = raw.slice(0, 4);
  } else if (raw && typeof raw === "object") {
    const x = raw.x ?? raw.left, y = raw.y ?? raw.top;
    const w = raw.w ?? raw.width, h = raw.h ?? raw.height;
    if ([x, y, w, h].every((n) => typeof n === "number")) v = [x, y, w, h];
  }
  if (!v) return null;
  const scale = v.some((n) => n > 1.5) ? (v.some((n) => n > 100) ? 1000 : 100) : 1;
  const [x, y, w, h] = v.map((n) => n / scale);
  if (!(w > 0.01) || !(h > 0.01)) return null;
  return { x: clamp01(x), y: clamp01(y), w: clamp01(w), h: clamp01(h) };
}

export function detectionsToBoxes(analysis: any): VisionBox[] {
  const detections: any[] = Array.isArray(analysis?.detections) ? analysis.detections : [];
  const violations: any[] = Array.isArray(analysis?.safety_violations) ? analysis.safety_violations : [];
  const boxes: VisionBox[] = [];

  detections.forEach((d, i) => {
    const box = parseBox(d?.bbox ?? d?.box ?? d?.bounding_box);
    if (!box) return;
    const label = String(d?.label ?? "Detection");
    const category = guessCategory(d?.category, label);
    const matched = violations.find((v) =>
      label.toLowerCase().includes(String(v?.type ?? "").toLowerCase()) ||
      String(v?.type ?? "").toLowerCase().includes(label.toLowerCase())
    );
    const severity = (matched?.severity ?? d?.severity ?? analysis?.severity ?? "low") as VisionBox["severity"];
    boxes.push({
      id: `${i}-${label}`,
      label,
      category,
      severity: ["low", "medium", "high", "critical"].includes(severity) ? severity : "low",
      confidence: typeof d?.confidence === "number" ? d.confidence : 0,
      ...box,
    });
  });

  return boxes.slice(0, 12);
}

interface Options {
  cameraId: string;
  cameraName: string;
  zone?: string | null;
  tenantId?: string | null;
  enabled: boolean;
  intervalSeconds?: number;
  startDelayMs?: number;
  /** Returns a data URL frame grabbed from the playing stream, or null. */
  capture: () => string | null;
  /** Server-side snapshot fallback when the browser cannot read the pixels. */
  hasSnapshot?: boolean;
  /** Skip inference while the scene is visually unchanged (cost gating). */
  sceneGating?: boolean;
  /** Mean per-pixel luma delta (0..1) that counts as a real scene change. */
  changeThreshold?: number;
  /** Force a full analysis after this many consecutive skipped ticks. */
  maxSkippedTicks?: number;
}

const SIGNATURE_SIZE = 32;

/** Downscaled grayscale fingerprint of a frame, used for cheap change detection. */
function frameSignature(dataUrl: string): Promise<Float32Array | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = SIGNATURE_SIZE;
        canvas.height = SIGNATURE_SIZE;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, SIGNATURE_SIZE, SIGNATURE_SIZE);
        const { data } = ctx.getImageData(0, 0, SIGNATURE_SIZE, SIGNATURE_SIZE);
        const out = new Float32Array(SIGNATURE_SIZE * SIGNATURE_SIZE);
        for (let i = 0; i < out.length; i++) {
          const p = i * 4;
          out[i] = (0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]) / 255;
        }
        resolve(out);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function signatureDelta(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 1;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
}

export function useVisionOverlay({
  cameraId, cameraName, zone, tenantId, enabled,
  intervalSeconds = 15, startDelayMs = 0, capture, hasSnapshot,
  sceneGating = true, changeThreshold = 0.012, maxSkippedTicks = 10,
}: Options) {
  const [boxes, setBoxes] = useState<VisionBox[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [lastRunAt, setLastRunAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [idle, setIdle] = useState(false);
  const [skippedRuns, setSkippedRuns] = useState(0);
  const [budgetBlocked, setBudgetBlocked] = useState(false);
  const busy = useRef(false);
  const captureRef = useRef(capture);
  captureRef.current = capture;
  const lastSignature = useRef<Float32Array | null>(null);
  const skippedTicks = useRef(0);
  const budgetBlockedRef = useRef(false);

  const run = useCallback(async (force: boolean) => {
    if (busy.current || budgetBlockedRef.current) return;
    busy.current = true;
    setRunning(true);
    try {
      const frame = captureRef.current();
      let analysis: any = null;
      let sceneDelta: number | null = null;

      if (frame) {
        // Scene-change gating: only pay for inference when the picture moved.
        if (sceneGating && !force) {
          const signature = await frameSignature(frame);
          if (signature) {
            const previous = lastSignature.current;
            lastSignature.current = signature;
            const delta = previous ? signatureDelta(previous, signature) : 1;
            sceneDelta = delta;
            const stale = skippedTicks.current >= Math.max(1, maxSkippedTicks);
            if (previous && delta < changeThreshold && !stale) {
              skippedTicks.current += 1;
              setSkippedRuns((n) => n + 1);
              setIdle(true);
              return;
            }
          }
        } else if (sceneGating && force) {
          lastSignature.current = await frameSignature(frame);
        }
        skippedTicks.current = 0;
        setIdle(false);

        const { data, error: fnError } = await supabase.functions.invoke("analyze-frame", {
          body: {
            imageUrl: frame,
            cameraName,
            zone,
            tenantId,
            cameraId,
            source: "overlay",
            sceneChanged: true,
            sceneDelta,
          },
        });
        if (fnError) throw fnError;
        if ((data as any)?.error === "ai_budget_exceeded") throw new Error((data as any).message);
        analysis = (data as any)?.analysis;
        setBudgetBlocked(false);
      } else if (hasSnapshot) {
        setIdle(false);
        const { data, error: fnError } = await supabase.functions.invoke("run-inference", {
          body: { camera_id: cameraId },
        });
        if (fnError) throw fnError;
        analysis = (data as any)?.results?.[0]?.analysis ?? null;
      } else {
        setError("Waiting for a readable frame");
        return;
      }

      setBoxes(detectionsToBoxes(analysis));
      setSummary(typeof analysis?.summary === "string" ? analysis.summary : null);
      setLastRunAt(new Date());
      setError(null);
    } catch (e) {
      const status = (e as any)?.context?.status;
      const message = e instanceof Error ? e.message : "Analysis failed";
      if (status === 402 || /budget/i.test(message)) {
        setBudgetBlocked(true);
        setError("AI budget reached for this site — analysis paused");
      } else {
        setError(message);
      }
    } finally {
      busy.current = false;
      setRunning(false);
    }
  }, [cameraId, cameraName, zone, tenantId, hasSnapshot, sceneGating, changeThreshold, maxSkippedTicks]);

  /** Manual trigger always analyses, bypassing the change gate. */
  const runOnce = useCallback(() => run(true), [run]);

  useEffect(() => {
    if (!enabled) {
      setBoxes([]);
      setIdle(false);
      lastSignature.current = null;
      skippedTicks.current = 0;
      return;
    }
    let interval: ReturnType<typeof setInterval> | null = null;
    const start = setTimeout(() => {
      run(true);
      interval = setInterval(() => run(false), Math.max(5, intervalSeconds) * 1000);
    }, startDelayMs);
    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
    };
  }, [enabled, intervalSeconds, startDelayMs, run]);

  budgetBlockedRef.current = budgetBlocked;

  return { boxes, summary, running, lastRunAt, error, runOnce, idle, skippedRuns, budgetBlocked };
}

