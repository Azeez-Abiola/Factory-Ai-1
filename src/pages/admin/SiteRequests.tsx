import { useCallback, useEffect, useMemo, useState } from "react";
import { MapPinPlus, Loader2, RefreshCw, Check, X, Search } from "lucide-react";
import PageHeader from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useTenants } from "@/hooks/useTenants";
import { useAuth } from "@/hooks/useAuth";
import { auditLog } from "@/lib/audit";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface RequestRow {
  id: string;
  tenant_id: string;
  site_name: string;
  location: string | null;
  estimated_cameras: number;
  expected_go_live: string | null;
  justification: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: string;
  review_notes: string | null;
  created_at: string;
}

const statusCls = (s: string) =>
  s === "approved" ? "bg-success/10 text-success border-success/20"
    : s === "declined" ? "bg-destructive/10 text-destructive border-destructive/20"
      : s === "in_review" ? "bg-primary/10 text-primary border-primary/20"
        : "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20";

const SiteRequests = () => {
  const { tenants, loading: tenantsLoading } = useTenants();
  const { user } = useAuth();
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [active, setActive] = useState<RequestRow | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const tenantName = useMemo(
    () => Object.fromEntries(tenants.map((t) => [t.id, t.name])),
    [tenants],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("site_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Could not load site requests");
    setRows((data ?? []) as RequestRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { if (!tenantsLoading) load(); }, [tenantsLoading, load]);

  const decide = async (status: "approved" | "declined" | "in_review") => {
    if (!active) return;
    setSaving(true);
    const { error } = await supabase
      .from("site_requests")
      .update({
        status,
        review_notes: notes.trim() || null,
        reviewed_by: user?.id ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", active.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await auditLog({
      tenantId: active.tenant_id,
      action: `site_request.${status}`,
      entityType: "site_request",
      entityId: active.id,
      metadata: { site_name: active.site_name, review_notes: notes.trim() || null },
    });
    toast.success(`Request ${status.replace("_", " ")}`);
    setActive(null);
    setNotes("");
    load();
  };

  const filtered = rows.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [r.site_name, r.location, tenantName[r.tenant_id]]
      .some((v) => (v ?? "").toLowerCase().includes(q));
  });

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Organizations"
        icon={MapPinPlus}
        title="Site requests"
        description="New factory sites requested by managers from their portal. Review, approve, then provision through Onboarding."
        actions={
          <Button variant="outline" onClick={load} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        }
      />

      <Card className="p-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by site, location or organization…"
            className="pl-10 h-10"
            aria-label="Search site requests"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-10 md:w-full sm:w-[180px]" aria-label="Status filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_review">In review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="declined">Declined</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-sm text-muted-foreground">No site requests match these filters.</div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => { setActive(r); setNotes(r.review_notes ?? ""); }}
                className="w-full text-left px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-muted/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm">{r.site_name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {tenantName[r.tenant_id] ?? "Unknown organization"}
                    {r.location ? ` · ${r.location}` : ""} · {r.estimated_cameras} cameras
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Submitted {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>
                <Badge variant="outline" className={cn("capitalize shrink-0", statusCls(r.status))}>
                  {r.status.replace("_", " ")}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={!!active} onOpenChange={(o) => { if (!o) { setActive(null); setNotes(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{active?.site_name}</DialogTitle>
            <DialogDescription>
              {active ? tenantName[active.tenant_id] ?? "Unknown organization" : ""}
            </DialogDescription>
          </DialogHeader>
          {active && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><div className="text-xs text-muted-foreground">Location</div>{active.location ?? "—"}</div>
                <div><div className="text-xs text-muted-foreground">Cameras</div>{active.estimated_cameras}</div>
                <div>
                  <div className="text-xs text-muted-foreground">Target go-live</div>
                  {active.expected_go_live ? new Date(active.expected_go_live).toLocaleDateString() : "—"}
                </div>
                <div><div className="text-xs text-muted-foreground">Contact</div>{active.contact_email ?? active.contact_phone ?? "—"}</div>
              </div>
              {active.justification && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Justification</div>
                  <p className="rounded-md bg-muted px-3 py-2 text-sm">{active.justification}</p>
                </div>
              )}
              <div>
                <div className="text-xs text-muted-foreground mb-1">Review notes</div>
                <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Shared with the requesting manager" />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => decide("in_review")} disabled={saving}>Mark in review</Button>
            <Button variant="outline" onClick={() => decide("declined")} disabled={saving} className="gap-2">
              <X className="w-4 h-4" /> Decline
            </Button>
            <Button onClick={() => decide("approved")} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SiteRequests;
