import { useEffect, useMemo, useState } from "react";
import { Download, ImageOff, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { detectionsToBoxes, categoryColor, type VisionBox } from "@/hooks/useVisionOverlay";
import { cn } from "@/lib/utils";

interface Props {
  metadata: Record<string, unknown> | null;
  cameraId: string | null;
  /** Compact thumbnail (list row) vs. full evidence viewer (detail dialog). */
  variant?: "thumb" | "full";
  className?: string;
  title?: string;
}

/**
 * Renders the camera frame captured at the moment of detection, with the
 * AI bounding boxes drawn over it so an operator can confirm the alert
 * visually instead of reading text alone.
 */
export default function AlertEvidence({ metadata, cameraId, variant = "full", className, title }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const evidencePath = typeof metadata?.evidence_path === "string" ? (metadata.evidence_path as string) : null;
  const boxes: VisionBox[] = useMemo(() => detectionsToBoxes(metadata ?? {}), [metadata]);

  useEffect(() => {
    let active = true;
    const resolve = async () => {
      setLoading(true);
      setUrl(null);
      if (evidencePath) {
        const { data } = await supabase.storage.from("alert-evidence").createSignedUrl(evidencePath, 3600);
        if (active && data?.signedUrl) {
          setUrl(data.signedUrl);
          setLoading(false);
          return;
        }
      }
      // Fall back to the camera's current still frame when no frame was stored.
      if (cameraId) {
        const { data } = await supabase.from("cameras").select("snapshot_url").eq("id", cameraId).maybeSingle();
        if (active && data?.snapshot_url) {
          setUrl(data.snapshot_url);
          setLoading(false);
          return;
        }
      }
      if (active) setLoading(false);
    };
    resolve();
    return () => { active = false; };
  }, [evidencePath, cameraId]);

  const isThumb = variant === "thumb";

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center rounded-lg border border-border bg-muted/30", isThumb ? "h-16 w-24" : "aspect-video w-full", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!url) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-muted/20 text-muted-foreground", isThumb ? "h-16 w-24" : "aspect-video w-full", className)}>
        <ImageOff className={isThumb ? "h-4 w-4" : "h-5 w-5"} />
        {!isThumb && <p className="text-xs">No frame captured for this alert</p>}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className={cn("relative overflow-hidden rounded-lg border border-border bg-black", isThumb ? "h-16 w-24" : "aspect-video w-full")}>
        <img src={url} alt={title ? `Camera frame for ${title}` : "Alert camera frame"} className="h-full w-full object-cover" loading="lazy" />
        {boxes.map((b) => (
          <div
            key={b.id}
            className="absolute rounded-[3px] border-2"
            style={{
              left: `${b.x * 100}%`,
              top: `${b.y * 100}%`,
              width: `${b.w * 100}%`,
              height: `${b.h * 100}%`,
              borderColor: categoryColor(b.category),
              boxShadow: `0 0 0 1px hsl(var(--background) / 0.5)`,
            }}
          >
            {!isThumb && (
              <span
                className="absolute -top-5 left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-mono font-medium text-background"
                style={{ background: categoryColor(b.category) }}
              >
                {b.label}{b.confidence ? ` ${Math.round(b.confidence * 100)}%` : ""}
              </span>
            )}
          </div>
        ))}
        {isThumb && boxes.length > 0 && (
          <span className="absolute bottom-0.5 right-0.5 rounded bg-background/80 px-1 text-[9px] font-mono text-foreground">
            {boxes.length}
          </span>
        )}
      </div>

      {!isThumb && (
        <div className="flex flex-wrap items-center gap-2">
          {boxes.map((b) => (
            <span key={`legend-${b.id}`} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="h-2 w-2 rounded-sm" style={{ background: categoryColor(b.category) }} />
              {b.label}
            </span>
          ))}
          <Button asChild size="sm" variant="outline" className="ml-auto h-7 gap-1.5 text-xs">
            <a href={url} target="_blank" rel="noreferrer" download>
              <Download className="h-3 w-3" /> Frame
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}
