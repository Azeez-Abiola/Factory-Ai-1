import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Camera as MockCamera } from "@/data/mockData";
import { useTenants } from "@/hooks/useTenants";

export interface LiveCamera extends MockCamera {
  streamUrl?: string | null;
  streamType?: "hls" | "webrtc" | "mjpeg" | null;
  lastSeenAt?: string | null;
  heartbeatSeconds?: number;
  audioEnabled?: boolean;
  resolution?: string | null;
  fps?: number | null;
  ptzEnabled?: boolean;
  snapshotUrl?: string | null;
  inferenceEnabled?: boolean;
  inferenceIntervalSeconds?: number;
  inferenceStatus?: string | null;
  lastInferenceAt?: string | null;
  lastInferenceError?: string | null;
  regions?: Region[];
  referenceMatchEnabled?: boolean;
  referenceMatchThreshold?: number;
  referenceSamples?: ReferenceSample[];
  clipAnalysisEnabled?: boolean;
  clipSeconds?: number;
  isLive: boolean; // has a real playable stream_url
  isDbBacked: boolean; // came from cameras table (not fallback mock)

}

interface DetectionPing {
  cameraId: string;
  label: string;
  at: number;
}

const DETECTION_TTL_MS = 5 * 60 * 1000;

function computeStatus(row: any): MockCamera["status"] {
  if (row.status === "maintenance") return "maintenance";
  const heartbeat = row.heartbeat_interval_seconds ?? 60;
  const lastSeen = row.last_seen_at ? new Date(row.last_seen_at).getTime() : 0;
  const stale = Date.now() - lastSeen > heartbeat * 3 * 1000;
  if (!lastSeen || stale) return "offline";
  return row.status === "offline" ? "offline" : "online";
}

function normalize(row: any, detections: DetectionPing[]): LiveCamera {
  const camDetections = detections.filter((d) => d.cameraId === row.id);
  return {
    id: row.id,
    name: row.name,
    zone: row.zone ?? "—",
    type: row.type ?? "Vision",
    status: computeStatus(row),
    detections: camDetections.length,
    lastDetection: camDetections[0]?.label,
    streamUrl: row.stream_url ?? null,
    streamType: (row.stream_type as any) ?? "hls",
    lastSeenAt: row.last_seen_at ?? null,
    heartbeatSeconds: row.heartbeat_interval_seconds ?? 60,
    audioEnabled: !!row.audio_enabled,
    resolution: row.resolution ?? null,
    fps: row.fps ?? null,
    ptzEnabled: !!row.ptz_enabled,
    snapshotUrl: row.snapshot_url ?? null,
    inferenceEnabled: !!row.inference_enabled,
    inferenceIntervalSeconds: row.inference_interval_seconds ?? 30,
    inferenceStatus: row.inference_status ?? null,
    lastInferenceAt: row.last_inference_at ?? null,
    lastInferenceError: row.last_inference_error ?? null,
    isLive: !!row.stream_url,
    isDbBacked: true,
  };
}

/**
 * Live camera feed with realtime updates.
 * - Loads cameras from Supabase scoped to the active tenant.
 * - Subscribes to `cameras` UPDATE/INSERT/DELETE for status + config changes.
 * - Subscribes to `alerts` INSERT for live detection overlays (5-min TTL).
 * - Falls back to mock cameras when the tenant has none configured yet.
 */
export function useLiveCameras() {
  const { activeTenantId } = useTenants();
  const [rows, setRows] = useState<any[]>([]);
  const [detections, setDetections] = useState<DetectionPing[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  // Re-evaluate offline heartbeat every 15s
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, []);

  // Prune stale detections
  useEffect(() => {
    const t = setInterval(() => {
      const cutoff = Date.now() - DETECTION_TTL_MS;
      setDetections((prev) => prev.filter((d) => d.at > cutoff));
    }, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Never pull camera credentials or ingest tokens into the operator console.
      let q = supabase.from("cameras").select(
        "id, tenant_id, name, zone, type, status, resolution, stream_url, stream_type, last_seen_at, heartbeat_interval_seconds, audio_enabled, fps, ptz_enabled, snapshot_url, inference_enabled, inference_interval_seconds, inference_status, last_inference_at, last_inference_error"
      ).order("name");
      if (activeTenantId) q = q.eq("tenant_id", activeTenantId);
      const { data, error } = await q;
      if (!cancelled) {
        if (error) console.warn("[useLiveCameras] load failed:", error.message);
        setRows(data ?? []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeTenantId]);

  useEffect(() => {
    if (!activeTenantId) return;
    const channel = supabase
      .channel(`cameras-live:${activeTenantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cameras", filter: `tenant_id=eq.${activeTenantId}` },
        (payload) => {
          setRows((prev) => {
            if (payload.eventType === "DELETE") return prev.filter((r) => r.id !== (payload.old as any).id);
            const next = payload.new as any;
            const idx = prev.findIndex((r) => r.id === next.id);
            if (idx === -1) return [...prev, next];
            const copy = prev.slice();
            copy[idx] = next;
            return copy;
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alerts", filter: `tenant_id=eq.${activeTenantId}` },
        (payload) => {
          const a = payload.new as any;
          if (!a?.camera_id) return;
          setDetections((prev) => [
            { cameraId: a.camera_id, label: a.title ?? "Detection", at: Date.now() },
            ...prev,
          ].slice(0, 200));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeTenantId]);

  const cameras = useMemo<LiveCamera[]>(() => {
    void tick;
    return rows.map((r) => normalize(r, detections));
  }, [rows, detections, tick, loading]);

  return { cameras, loading, hasLiveStreams: cameras.some((c) => c.isLive) };
}
