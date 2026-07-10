import { useState } from "react";
import { Sparkles, Loader2, AlertTriangle, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  zone: string;
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

const sampleImage = "https://images.unsplash.com/photo-1565043666747-69f6646db940?w=1200";

const severityColor: Record<string, string> = {
  low: "text-success border-success/30",
  medium: "text-primary border-primary/30",
  high: "text-warning border-warning/30",
  critical: "text-destructive border-destructive/30",
};

const AIAnalyzeDialog = ({ open, onOpenChange, cameraName, zone }: Props) => {
  const [imageUrl, setImageUrl] = useState(sampleImage);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  const analyze = async () => {
    if (!imageUrl) { toast.error("Provide an image URL"); return; }
    setLoading(true); setAnalysis(null);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-frame", {
        body: {
          imageUrl,
          cameraName,
          zone,
          aiModels: ["ppe", "intrusion", "downtime", "quality", "ergonomics"],
        },
      });
      if (error) throw error;
      if (data?.analysis) {
        setAnalysis(data.analysis);
        toast.success("AI analysis complete");
      } else {
        toast.error("AI returned unstructured response");
        console.log("raw:", data?.raw);
      }
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
          <div className="space-y-2">
            <Label>Frame URL (https or data:image/…)</Label>
            <div className="flex gap-2">
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…/frame.jpg" className="font-mono text-xs" />
              <Button onClick={analyze} disabled={loading} className="gap-2 shrink-0">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {loading ? "Analyzing…" : "Analyze"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              In production, this pulls a live frame from the RTSP feed. For prototype, paste any factory floor image URL.
            </p>
          </div>

          {imageUrl && (
            <div className="rounded-lg overflow-hidden border border-border bg-muted/20 max-h-72 flex items-center justify-center">
              <img src={imageUrl} alt="Frame to analyze" className="max-h-72 object-contain" />
            </div>
          )}

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
