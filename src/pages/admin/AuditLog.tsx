import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScrollText, Search, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { mockAuditLog } from "@/data/extendedMockData";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

const AuditLog = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filterActor, setFilterActor] = useState("all");

  const actors = [...new Set(mockAuditLog.map((e) => e.actor))];
  const filtered = mockAuditLog.filter((entry) => {
    if (filterActor !== "all" && entry.actor !== filterActor) return false;
    if (search && !entry.details.toLowerCase().includes(search.toLowerCase()) && !entry.action.toLowerCase().includes(search.toLowerCase()) && !entry.resource.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ScrollText className="w-6 h-6 text-destructive" /> Audit Log
        </h1>
        <p className="text-sm text-muted-foreground">Immutable activity trail across the platform</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search actions, resources..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card border-border" />
        </div>
        <Select value={filterActor} onValueChange={setFilterActor}>
          <SelectTrigger className="w-48 bg-card border-border">
            <SelectValue placeholder="Filter by actor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actors</SelectItem>
            {actors.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="glass rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left p-3 text-xs font-medium text-muted-foreground">Timestamp</th>
              <th className="text-left p-3 text-xs font-medium text-muted-foreground">Actor</th>
              <th className="text-left p-3 text-xs font-medium text-muted-foreground">Action</th>
              <th className="text-left p-3 text-xs font-medium text-muted-foreground">Resource</th>
              <th className="text-left p-3 text-xs font-medium text-muted-foreground">Details</th>
              <th className="text-left p-3 text-xs font-medium text-muted-foreground">Tenant</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => (
              <tr key={entry.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => navigate(`/admin/audit-log/${entry.id}`)}>
                <td className="p-3 text-xs font-mono text-muted-foreground whitespace-nowrap">
                  {new Date(entry.timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="p-3">
                  <div className="text-sm text-foreground">{entry.actor}</div>
                  <div className="text-xs text-muted-foreground">{entry.actorRole}</div>
                </td>
                <td className="p-3">
                  <Badge variant="outline" className={cn("text-xs font-mono", actionColors[entry.action] || "bg-muted text-muted-foreground")}>
                    {entry.action}
                  </Badge>
                </td>
                <td className="p-3 text-sm text-foreground font-medium">{entry.resource}</td>
                <td className="p-3 text-xs text-muted-foreground max-w-[200px] truncate">{entry.details}</td>
                <td className="p-3 text-xs text-muted-foreground">{entry.tenant}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AuditLog;
