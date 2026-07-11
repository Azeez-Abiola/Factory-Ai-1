import { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { useTenants } from "@/hooks/useTenants";
import { auditLog } from "@/lib/audit";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileText, Sheet } from "lucide-react";
import { toast } from "sonner";

interface Props { open: boolean; onOpenChange: (v: boolean) => void; }

export default function ComplianceExportDialog({ open, onOpenChange }: Props) {
  const { activeTenant, activeTenantId } = useTenants();
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);

  const fetchData = async () => {
    if (!activeTenantId) throw new Error("No active tenant");
    const fromISO = new Date(from).toISOString();
    const toISO = new Date(new Date(to).getTime() + 86_399_999).toISOString();
    const [incRes, taskRes, auditRes] = await Promise.all([
      supabase.from("incidents").select("*").eq("tenant_id", activeTenantId).gte("opened_at", fromISO).lte("opened_at", toISO).order("opened_at"),
      supabase.from("resolution_tasks").select("*").eq("tenant_id", activeTenantId).gte("created_at", fromISO).lte("created_at", toISO),
      supabase.from("audit_log").select("*").eq("tenant_id", activeTenantId).gte("created_at", fromISO).lte("created_at", toISO).order("created_at"),
    ]);
    return {
      incidents: (incRes.data ?? []) as any[],
      tasks: (taskRes.data ?? []) as any[],
      audits: (auditRes.data ?? []) as any[],
    };
  };

  const exportCsv = async () => {
    setBusy(true);
    try {
      const { incidents, tasks, audits } = await fetchData();
      const rows: string[][] = [
        ["Incident ID", "Title", "Severity", "Status", "Opened", "Closed", "Escalation Level", "Tasks Total", "Tasks Completed", "Audit Records"],
      ];
      incidents.forEach((i) => {
        const it = tasks.filter((t) => t.incident_id === i.id);
        const ia = audits.filter((a) => a.entity_id === i.id);
        rows.push([
          i.id, i.title, i.severity ?? "", i.status,
          i.opened_at, i.closed_at ?? "", String(i.escalation_level ?? 0),
          String(it.length), String(it.filter((t) => t.status === "completed").length),
          ia.map((a) => `AUD-${a.id.slice(0, 8)}(${a.action})`).join(" | "),
        ]);
      });
      const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `compliance-${activeTenant?.slug ?? "export"}-${from}_to_${to}.csv`; a.click();
      URL.revokeObjectURL(url);
      await auditLog({ tenantId: activeTenantId!, action: "compliance.export.csv", entityType: "report", metadata: { from, to, incidents: incidents.length } });
      toast.success(`Exported ${incidents.length} incidents to CSV`);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const exportPdf = async () => {
    setBusy(true);
    try {
      const { incidents, tasks, audits } = await fetchData();
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFontSize(16);
      doc.text("Compliance Audit Export", 14, 15);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`${activeTenant?.name ?? "Tenant"} · ${from} → ${to}`, 14, 22);
      doc.text(`Generated ${new Date().toLocaleString()} · ${incidents.length} incidents · ${audits.length} audit records`, 14, 27);

      autoTable(doc, {
        startY: 32,
        head: [["Incident", "Severity", "Status", "Opened", "Closed", "Esc.", "Tasks", "Audit IDs"]],
        body: incidents.map((i) => {
          const it = tasks.filter((t) => t.incident_id === i.id);
          const ia = audits.filter((a) => a.entity_id === i.id);
          return [
            i.title.slice(0, 40),
            i.severity ?? "-",
            i.status,
            new Date(i.opened_at).toLocaleString(),
            i.closed_at ? new Date(i.closed_at).toLocaleString() : "-",
            String(i.escalation_level ?? 0),
            `${it.filter((t) => t.status === "completed").length}/${it.length}`,
            ia.map((a) => `AUD-${a.id.slice(0, 8)}`).join(", "),
          ];
        }),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [30, 41, 59] },
      });

      doc.save(`compliance-${activeTenant?.slug ?? "export"}-${from}_to_${to}.pdf`);
      await auditLog({ tenantId: activeTenantId!, action: "compliance.export.pdf", entityType: "report", metadata: { from, to, incidents: incidents.length } });
      toast.success(`Exported ${incidents.length} incidents to PDF`);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Download className="w-5 h-5 text-primary" /> Compliance Audit Export</DialogTitle>
          <DialogDescription>Resolution outcomes + linked audit records for {activeTenant?.name ?? "the active tenant"}.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-background border-border" /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-background border-border" /></div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={busy}><Sheet className="w-4 h-4 mr-1" /> CSV</Button>
          <Button onClick={exportPdf} disabled={busy}><FileText className="w-4 h-4 mr-1" /> PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
