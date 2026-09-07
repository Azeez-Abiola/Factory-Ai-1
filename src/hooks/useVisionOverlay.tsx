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
}

export function useVisionOverlay({
  cameraId, cameraName, zone, tenantId, enabled,
  intervalSeconds = 15, startDelayMs = 0, capture, hasSnapshot,
}: Options) {
  const [boxes, setBoxes] = useState<VisionBox[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [lastRunAt, setLastRunAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const captureRef = useRef(capture);
  captureRef.current = capture;

  const runOnce = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setRunning(true);
    try {
      const frame = captureRef.current();
      let analysis: any = null;

      if (frame) {
        const { data, error: fnError } = await supabase.functions.invoke("analyze-frame", {
          body: { imageUrl: frame, cameraName, zone, tenantId },
        });
        if (fnError) throw fnError;
        analysis = (data as any)?.analysis;
      } else if (hasSnapshot) {
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
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      busy.current = false;
      setRunning(false);
    }
  }, [cameraId, cameraName, zone, tenantId, hasSnapshot]);

  useEffect(() => {
    if (!enabled) {
      setBoxes([]);
      return;
    }
    let interval: ReturnType<typeof setInterval> | null = null;
    const start = setTimeout(() => {
      runOnce();
      interval = setInterval(runOnce, Math.max(5, intervalSeconds) * 1000);
    }, startDelayMs);
    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
    };
  }, [enabled, intervalSeconds, startDelayMs, runOnce]);

  return { boxes, summary, running, lastRunAt, error, runOnce };
}
