import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  frameSignature, signatureDelta, matchReference, insideRegions,
  type Region, type ReferenceSample, type ReferenceVerdict,
} from "@/lib/visionMatch";


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

/**
 * Normalises whatever shape the model returned into a 0..1 {x,y,w,h} box.
 *
 * Handles: [x,y,w,h], [x1,y1,x2,y2], Gemini's box_2d [ymin,xmin,ymax,xmax],
 * object forms ({x,y,width,height} / {left,top,right,bottom} / {xmin,...}),
 * and values expressed as fractions, percentages, 0..1000 units or raw pixels.
 */
function parseBox(raw: any, frame?: { width: number; height: number } | null): { x: number; y: number; w: number; h: number } | null {
  let v: number[] | null = null;
  let corners = false;


  const num = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? n : undefined);

  if (Array.isArray(raw) && raw.length >= 4 && raw.slice(0, 4).every((n) => num(n) !== undefined)) {
    v = raw.slice(0, 4);
  } else if (raw && typeof raw === "object") {
    const x = num(raw.x) ?? num(raw.left) ?? num(raw.xmin) ?? num(raw.x1) ?? num(raw.x_min);
    const y = num(raw.y) ?? num(raw.top) ?? num(raw.ymin) ?? num(raw.y1) ?? num(raw.y_min);
    const w = num(raw.w) ?? num(raw.width);
    const h = num(raw.h) ?? num(raw.height);
    const x2 = num(raw.right) ?? num(raw.xmax) ?? num(raw.x2) ?? num(raw.x_max);
    const y2 = num(raw.bottom) ?? num(raw.ymax) ?? num(raw.y2) ?? num(raw.y_max);
    if (x !== undefined && y !== undefined && w !== undefined && h !== undefined) {
      v = [x, y, w, h];
    } else if (x !== undefined && y !== undefined && x2 !== undefined && y2 !== undefined) {
      v = [x, y, x2, y2];
      corners = true;
    }
  }
  if (!v) return null;



  // Work out the unit the numbers are in.
  const max = Math.max(...v.map(Math.abs));
  let sx = 1;
  let sy = 1;
  if (max > 1.5) {
    if (frame && max > 1000) {
      sx = frame.width;
      sy = frame.height;
    } else if (max <= 100) {
      sx = sy = 100;
    } else if (max <= 1000) {
      sx = sy = 1000;
    } else {
      sx = sy = max;
    }
  }

  let [a, b, c, d] = [v[0] / sx, v[1] / sy, v[2] / sx, v[3] / sy];
  if (yFirst) [a, b, c, d] = [b, a, d, c];

  let x = a;
  let y = b;
  let w = corners ? c - a : c;
  let h = corners ? d - b : d;

  // Some models emit [x1,y1,x2,y2] while claiming [x,y,w,h]; a box that would
  // spill far outside the frame is almost always corner form.
  if (!corners && (x + w > 1.05 || y + h > 1.05) && c > a && d > b && c <= 1.05 && d <= 1.05) {
    w = c - a;
    h = d - b;
  }

  if (!(w > 0.005) || !(h > 0.005)) return null;

  // Clip to the frame so a box never hangs off the picture.
  const x0 = clamp01(x);
  const y0 = clamp01(y);
  const x1 = clamp01(x + w);
  const y1 = clamp01(y + h);
  const outW = x1 - x0;
  const outH = y1 - y0;
  if (!(outW > 0.005) || !(outH > 0.005)) return null;

  return { x: x0, y: y0, w: outW, h: outH };
}

/** Gemini box_2d arrives as [ymin, xmin, ymax, xmax] on a 0..1000 grid. */
function parseBox2d(raw: any): { x: number; y: number; w: number; h: number } | null {
  if (!Array.isArray(raw) || raw.length < 4 || !raw.slice(0, 4).every((n) => typeof n === "number")) return null;
  const [ymin, xmin, ymax, xmax] = raw as number[];
  return parseBox({ xmin, ymin, xmax, ymax });
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
  /** Records a short clip of the playing stream as a data URL, or null. */
  record?: ((seconds: number) => Promise<string | null>) | null;
  /** Server-side snapshot fallback when the browser cannot read the pixels. */
  hasSnapshot?: boolean;
  /** Skip inference while the scene is visually unchanged (cost gating). */
  sceneGating?: boolean;
  /** Mean per-pixel luma delta (0..1) that counts as a real scene change. */
  changeThreshold?: number;
  /** Force a full analysis after this many consecutive skipped ticks. */
  maxSkippedTicks?: number;
  /** Only these areas of the picture are inspected. */
  regions?: Region[];
  /** Compare the frame with uploaded samples locally before paying for AI. */
  referenceMatchEnabled?: boolean;
  referenceMatchThreshold?: number;
  referenceSamples?: ReferenceSample[];
  /** Analyse a few seconds of motion instead of a single still frame. */
  clipAnalysisEnabled?: boolean;
  clipSeconds?: number;
}


export function useVisionOverlay({
  cameraId, cameraName, zone, tenantId, enabled,
  intervalSeconds = 15, startDelayMs = 0, capture, record, hasSnapshot,
  sceneGating = true, changeThreshold = 0.012, maxSkippedTicks = 10,
  regions, referenceMatchEnabled = false, referenceMatchThreshold = 0.06,
  referenceSamples, clipAnalysisEnabled = false, clipSeconds = 5,
}: Options) {
  const [boxes, setBoxes] = useState<VisionBox[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [lastRunAt, setLastRunAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [idle, setIdle] = useState(false);
  const [skippedRuns, setSkippedRuns] = useState(0);
  const [budgetBlocked, setBudgetBlocked] = useState(false);
  const [referenceVerdict, setReferenceVerdict] = useState<ReferenceVerdict | null>(null);
  const [localChecks, setLocalChecks] = useState(0);
  const [alertsRaised, setAlertsRaised] = useState(0);
  const [lastAlertAt, setLastAlertAt] = useState<Date | null>(null);

  const busy = useRef(false);
  const captureRef = useRef(capture);
  captureRef.current = capture;
  const recordRef = useRef(record);
  recordRef.current = record;
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
        // Signatures are cropped to the inspection areas, so background
        // traffic outside them never triggers a paid analysis.
        if (sceneGating && !force) {
          const signature = await frameSignature(frame, regions);
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
          lastSignature.current = await frameSignature(frame, regions);
        }
        skippedTicks.current = 0;
        setIdle(false);

        // Local reference check — decided on this machine, costs nothing.
        if (referenceMatchEnabled && referenceSamples?.length) {
          const signature = lastSignature.current ?? (await frameSignature(frame, regions));
          const verdict = signature ? matchReference(signature, referenceSamples, referenceMatchThreshold) : null;
          setReferenceVerdict(verdict);
          if (verdict?.confident) {
            setLocalChecks((n) => n + 1);
            setLastRunAt(new Date());
            setError(null);
            if (verdict.label === "good") {
              // A clear match against a known-good sample: nothing to escalate.
              setBoxes([]);
              setSummary(`Matches known-good sample${verdict.sample.note ? ` (${verdict.sample.note})` : ""} — no AI check needed`);
              return;
            }
            // A clear match against a known-faulty sample still goes to the AI
            // so the alert carries a description and evidence.
          }
        }

        let clipUrl: string | null = null;
        if (clipAnalysisEnabled && recordRef.current) {
          clipUrl = await recordRef.current(clipSeconds);
        }

        const { data, error: fnError } = await supabase.functions.invoke("analyze-frame", {
          body: {
            ...(clipUrl ? { videoUrl: clipUrl, evidenceImage: frame } : { imageUrl: frame }),
            cameraName,
            zone,
            tenantId,
            cameraId,
            regions,
            referenceVerdict: referenceVerdict
              ? { label: referenceVerdict.label, note: referenceVerdict.sample.note ?? null }
              : undefined,
            source: clipUrl ? "overlay_clip" : "overlay",
            // Rolling analysis raises alerts by itself — quality defects seen in
            // motion no longer need a scheduled still-frame pass to be flagged.
            raiseAlerts: true,
            sceneChanged: true,
            sceneDelta,
          },
        });
        if (fnError) throw fnError;
        if ((data as any)?.error === "ai_budget_exceeded") throw new Error((data as any).message);
        analysis = (data as any)?.analysis;
        const created = Number((data as any)?.alerts_created ?? 0);
        if (created > 0) {
          setAlertsRaised((n) => n + created);
          setLastAlertAt(new Date());
        }
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

      setBoxes(insideRegions(detectionsToBoxes(analysis), regions));

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
  }, [cameraId, cameraName, zone, tenantId, hasSnapshot, sceneGating, changeThreshold, maxSkippedTicks,
      regions, referenceMatchEnabled, referenceMatchThreshold, referenceSamples, clipAnalysisEnabled, clipSeconds, referenceVerdict]);


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
    // A rolling clip needs longer than the recording itself, plus upload time.
    const tick = clipAnalysisEnabled
      ? Math.max(intervalSeconds, clipSeconds + 5)
      : Math.max(5, intervalSeconds);
    const start = setTimeout(() => {
      run(true);
      interval = setInterval(() => run(false), tick * 1000);
    }, startDelayMs);

    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
    };
  }, [enabled, intervalSeconds, startDelayMs, clipAnalysisEnabled, clipSeconds, run]);

  budgetBlockedRef.current = budgetBlocked;

  return {
    boxes, summary, running, lastRunAt, error, runOnce, idle, skippedRuns, budgetBlocked,
    referenceVerdict, localChecks, alertsRaised, lastAlertAt,
  };

}

