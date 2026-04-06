import { useParams, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { ScrollText, ArrowLeft, Calendar, User, Activity, Shield, Hash, MapPin, Globe, Database, Info } from "lucide-react";
import { mockAuditLog } from "@/data/extendedMockData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const actionColors: Record<string, string> = {
  "tenant.create": "bg-success/10 text-success",
  "tenant.suspend": "bg-destructive/10 text-destructive",
  "user.invite": "bg-primary/10 text-primary",
  "user.role_change": "bg-primary/10 text-primary",
  "alert.resolve": "bg-success/10 text-success",
  "camera.add": "bg-primary/10 text-primary",
  "camera.configure": "bg-primary/10 text-primary",
  "billing.invoice": "bg-warning/10 text-warning",
  "report.generate": "bg-muted text-muted-foreground",
  "system.backup": "bg-muted text-muted-foreground",
  "plan.upgrade": "bg-success/10 text-success",
  "zone.update": "bg-primary/10 text-primary",
};

const AuditDetail = () => {
  const { auditId } = useParams<{ auditId: string }>();
  const navigate = useNavigate();

  const entry = useMemo(() => {
    return mockAuditLog.find((e) => e.id === auditId) || null;
  }, [auditId]);

  if (!entry) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ScrollText className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Audit Entry Not Found</h2>
        <p className="text-muted-foreground mb-6">The activity record you're looking for doesn't exist.</p>
        <Button onClick={() => navigate("/admin/audit-log")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Logs
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button variant="ghost" className="w-fit -ml-2 text-muted-foreground hover:text-foreground" onClick={() => navigate("/admin/audit-log")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Audit Log
        </Button>

        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
            <ScrollText className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Activity Detail</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <Badge variant="outline" className={cn("text-xs font-mono", actionColors[entry.action] || "bg-muted text-muted-foreground")}>
                {entry.action}
              </Badge>
              <span className="text-xs text-muted-foreground font-mono">{entry.id}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Detailed Log Info */}
          <Card className="border-border overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <Info className="w-4 h-4" /> Action Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-lg font-medium text-foreground mb-4">
                {entry.details}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 text-sm">
                <div className="space-y-1">
                  <p className="text-muted-foreground flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Timestamp</p>
                  <p className="text-foreground font-medium">{new Date(entry.timestamp).toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> Resource</p>
                  <p className="text-foreground font-medium">{entry.resource}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> IP Address</p>
                  <p className="text-foreground font-mono">{entry.ipAddress}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Tenant</p>
                  <p className="text-foreground font-medium">{entry.tenant}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actor Profile */}
          <Card className="border-border">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <User className="w-4 h-4 text-primary" /> Actor Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-primary font-bold text-lg">
                  {entry.actor.split(" ").map(n => n[0]).join("")}
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">{entry.actor}</h3>
                  <p className="text-sm text-muted-foreground">{entry.actorRole}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Platform Consistency */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Hash className="w-4 h-4 text-muted-foreground" /> Platform Metadata
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1"><Database className="w-3 h-3" /> Event Hash</span>
                  <span className="text-foreground font-mono text-[10px]">sha256:4ae0...f2ba</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1"><Globe className="w-3 h-3" /> Data Region</span>
                  <span className="text-foreground font-medium">Asia-South-1</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1"><Shield className="w-3 h-3" /> Compliance</span>
                  <span className="text-foreground font-medium">SOC2 Compliant</span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed pt-2 border-t border-border/50">
                Audit logs are immutable records of platform activity. This specific entry is digitally signed and cryptographically linked to the platform-wide audit chain.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AuditDetail;
