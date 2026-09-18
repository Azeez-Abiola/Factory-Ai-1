import { useState } from "react";
import { Sparkles, Loader2, AlertTriangle, ShieldCheck, Zap, Ban, Clock, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cameraName: string;
  cameraId: string;
  snapshotUrl?: string | null;
}

interface Analysis {
  summary: string;
  risk_score: number;
  severity: "low" | "medium" | "high" | "critical";
  detections: { label: string; confidence: number; bbox_hint: string }[];
  safety_violations: { type: string; description: string; severity: string }[];
  productivity_notes: string[];
  recommended_actions: string[];
}

const severityColor: Record<string, string> = {
  low: "text-success border-success/30",
  medium: "text-primary border-primary/30",
  high: "text-warning border-warning/30",
  critical: "text-destructive border-destructive/30",
};

interface Blocked {
  title: string;
  message: string;
  hint: string;
  retryable: boolean;
}

const blockedFor = (code: string, message: string): Blocked | null => {
  switch (code) {
    case "ai_credits_exhausted":
      return {
        title: "AI analysis unavailable — no AI credit left",
        message: message || "The AI credit for this workspace has run out, so this frame could not be analysed.",
        hint: "Nothing was charged and no alert was raised. Ask your platform administrator to top up AI credit, then try again. In the meantime the reference check below still runs at no cost.",
        retryable: false,
      };
    case "ai_budget_exceeded":
      return {
        title: "AI analysis paused — site budget reached",
        message: message || "This site has reached its monthly AI analysis budget.",
        hint: "A site administrator can raise the monthly budget in Admin → AI Budget to resume analysis.",
        retryable: false,
      };
    case "ai_blocked":
      return {
        title: "AI analysis is blocked",
        message: message || "AI analysis is currently blocked by an administrator limit.",
        hint: "An administrator needs to re-enable AI analysis before this camera can be checked.",
        retryable: false,
      };
    case "ai_rate_limited":
    case "analyze_429":
      return {
        title: "Too many AI checks right now",
        message: message || "The AI service is busy handling other requests.",
        hint: "Wait about a minute and press Analyze again.",
        retryable: true,
      };
    default:
      return null;
  }
};

const AIAnalyzeDialog = ({ open, onOpenChange, cameraName, cameraId, snapshotUrl }: Props) => {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [blocked, setBlocked] = useState<Blocked | null>(null);

  const analyze = async () => {
    setLoading(true); setAnalysis(null); setBlocked(null);
    try {
      const { data, error } = await supabase.functions.invoke("run-inference", {
        body: { camera_id: cameraId },
      });
      if (error) throw error;
      const result = data?.results?.[0];
      if (!result) throw new Error("No analysis result was returned");

      const stop = blockedFor(String(result.code ?? result.reason ?? ""), String(result.message ?? result.error ?? ""));
      if (stop || result.blocked) {
        const notice = stop ?? {
          title: "AI analysis unavailable",
          message: String(result.message ?? result.error ?? "This frame could not be analysed."),
          hint: "No charge was made and no alert was raised.",
          retryable: false,
        };
        setBlocked(notice);
        toast.error(notice.title);
        return;
      }

      if (result.status === "error") throw new Error(result.error ?? "Analysis failed");
      setAnalysis(result.analysis ?? {
        summary: result.summary ?? "Live frame analyzed successfully.",
        risk_score: result.risk_score ?? 0,
        severity: result.severity ?? "low",
        detections: result.detections ?? [],
        safety_violations: result.safety_violations ?? [],
        productivity_notes: result.productivity_notes ?? [],
        recommended_actions: result.recommended_actions ?? [],
      });
      toast.success(result.alerts_created ? `${result.alerts_created} alert raised from this frame` : "Live frame analysis complete");
    } catch (e) {
      toast.error("Analysis failed: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Vision Analysis — {cameraName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-4">
            <div>
              <p className="text-sm font-medium">Analyze current live frame</p>
              <p className="text-xs text-muted-foreground">Uses {cameraName}'s configured AI snapshot and tenant policies.</p>
            </div>
              <Button onClick={analyze} disabled={loading || !snapshotUrl} className="gap-2 shrink-0">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {loading ? "Analyzing…" : "Analyze"}
              </Button>
            {!snapshotUrl && <p className="text-xs text-warning">No AI snapshot is configured for this camera.</p>}
          </div>

          {blocked && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2 text-destructive">
                {blocked.retryable ? <Clock className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                {blocked.title}
              </h4>
              <p className="text-sm text-foreground">{blocked.message}</p>
              <p className="text-xs text-muted-foreground">{blocked.hint}</p>
              {blocked.retryable && (
                <Button size="sm" variant="outline" onClick={analyze} disabled={loading} className="mt-1">
                  Try again
                </Button>
              )}
            </div>
          )}

          <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-success" /> Reference check (no AI cost)
            </h4>
            <p className="text-xs text-muted-foreground">
              Separately from this button, the console keeps comparing {cameraName}'s live picture with the good and faulty
              sample images saved for it (Admin → Cameras → Edit camera → Inspection). The comparison happens on this
              computer, so it uses no AI credit.
            </p>
            <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1">
              <li>Clear match to a <span className="text-foreground">good</span> sample — the frame is passed as normal and the AI is not called.</li>
              <li>Clear match to a <span className="text-foreground">faulty</span> sample — the AI is still called so the alert carries a description and evidence.</li>
              <li>No clear match — the frame goes to the AI as usual.</li>
              <li>If AI credit has run out, reference checks keep working, but frames needing AI are not analysed.</li>
            </ul>
          </div>


          {analysis && (
            <div className="space-y-4">
              <div className="glass rounded-lg border border-border p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-primary" /> Scene Summary
                  </h4>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={severityColor[analysis.severity]}>
                      {analysis.severity?.toUpperCase()}
                    </Badge>
                    <Badge variant="outline">Risk {analysis.risk_score}/100</Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{analysis.summary}</p>
              </div>

              {analysis.detections?.length > 0 && (
                <div className="glass rounded-lg border border-border p-4">
                  <h4 className="font-semibold mb-2 text-sm">Detections ({analysis.detections.length})</h4>
                  <div className="space-y-1.5">
                    {analysis.detections.map((d, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-foreground">{d.label} <span className="text-muted-foreground text-xs">— {d.bbox_hint}</span></span>
                        <Badge variant="outline" className="text-xs">{Math.round(d.confidence * 100)}%</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysis.safety_violations?.length > 0 && (
                <div className="glass rounded-lg border border-destructive/30 p-4">
                  <h4 className="font-semibold mb-2 text-sm flex items-center gap-2 text-destructive">
                    <AlertTriangle className="w-4 h-4" /> Safety Violations
                  </h4>
                  <div className="space-y-2">
                    {analysis.safety_violations.map((v, i) => (
                      <div key={i} className="text-sm">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={severityColor[v.severity] ?? ""}>{v.severity}</Badge>
                          <span className="font-medium">{v.type}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{v.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysis.productivity_notes?.length > 0 && (
                <div className="glass rounded-lg border border-border p-4">
                  <h4 className="font-semibold mb-2 text-sm flex items-center gap-2">
                    <Zap className="w-4 h-4 text-warning" /> Productivity Notes
                  </h4>
                  <ul className="space-y-1 text-sm text-muted-foreground list-disc pl-5">
                    {analysis.productivity_notes.map((n, i) => <li key={i}>{n}</li>)}
                  </ul>
                </div>
              )}

              {analysis.recommended_actions?.length > 0 && (
                <div className="glass rounded-lg border border-primary/30 p-4">
                  <h4 className="font-semibold mb-2 text-sm text-primary">Recommended Actions</h4>
                  <ul className="space-y-1 text-sm text-foreground list-disc pl-5">
                    {analysis.recommended_actions.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AIAnalyzeDialog;
