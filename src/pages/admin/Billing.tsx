import { useCallback, useEffect, useMemo, useState } from "react";
import { CreditCard, TrendingUp, DollarSign, AlertCircle, Loader2, Camera, Users } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import PageHeader from "@/components/app/PageHeader";
import { supabase } from "@/integrations/supabase/client";

// Usage-based rate card (USD). Charges are computed from live tenant usage.
const RATE_CARD: Record<string, { base: number; perCamera: number; label: string }> = {
  starter: { base: 0, perCamera: 15, label: "Starter" },
  professional: { base: 499, perCamera: 25, label: "Professional" },
  enterprise: { base: 1499, perCamera: 40, label: "Enterprise" },
};
const rateFor = (plan: string) => RATE_CARD[plan] ?? RATE_CARD.starter;

interface TenantBilling {
  id: string;
  name: string;
  plan: string;
  status: string;
  createdAt: string;
  cameras: number;
  members: number;
  alerts30d: number;
  mrr: number;
}

const statusColors: Record<string, string> = {
  active: "bg-success/10 text-[hsl(var(--success))] border-success/20",
  trial: "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20",
  suspended: "bg-destructive/10 text-destructive border-destructive/20",
  inactive: "bg-muted text-muted-foreground border-border",
};

const Billing = () => {
  const [rows, setRows] = useState<TenantBilling[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const [tenantRes, cameraRes, memberRes, alertRes] = await Promise.all([
      supabase.from("tenants").select("id,name,plan,status,created_at").order("created_at"),
      supabase.from("cameras").select("id,tenant_id"),
      supabase.from("tenant_members").select("id,tenant_id"),
      supabase.from("alerts").select("id,tenant_id").gte("detected_at", since),
    ]);

    const cams = cameraRes.data ?? [];
    const members = memberRes.data ?? [];
    const alerts = alertRes.data ?? [];

    const count = (list: { tenant_id: string }[], id: string) => list.filter((x) => x.tenant_id === id).length;

    setRows(
      (tenantRes.data ?? []).map((t) => {
        const cameras = count(cams, t.id);
        const rate = rateFor(t.plan);
        const billable = t.status === "active";
        return {
          id: t.id,
          name: t.name,
          plan: t.plan,
          status: t.status,
          createdAt: t.created_at,
          cameras,
          members: count(members, t.id),
          alerts30d: count(alerts, t.id),
          mrr: billable ? rate.base + cameras * rate.perCamera : 0,
        };
      }),
    );
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalMRR = rows.reduce((s, r) => s + r.mrr, 0);
  const activeSubs = rows.filter((r) => r.status === "active").length;
  const nonBilling = rows.filter((r) => r.status !== "active");

  // Revenue trend: MRR contributed by tenants that existed in each of the last 6 months.
  const revenueData = useMemo(() => {
    const months: { month: string; mrr: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const mrr = rows
        .filter((r) => new Date(r.createdAt) < end && r.status === "active")
        .reduce((s, r) => s + r.mrr, 0);
      months.push({ month: new Date(now.getFullYear(), now.getMonth() - i, 1).toLocaleString([], { month: "short" }), mrr });
    }
    return months;
  }, [rows]);

  const planBreakdown = useMemo(() => {
    return Object.keys(RATE_CARD).map((plan) => {
      const list = rows.filter((r) => r.plan === plan);
      return { plan: RATE_CARD[plan].label, tenants: list.length, revenue: list.reduce((s, r) => s + r.mrr, 0) };
    });
  }, [rows]);

  const totalCameras = rows.reduce((s, r) => s + r.cameras, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading billing data…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Revenue"
        icon={DollarSign}
        title="Billing & Plans"
        description="Subscription charges calculated from live tenant usage."
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Monthly Recurring Revenue", value: `$${totalMRR.toLocaleString()}`, icon: DollarSign, sub: `${activeSubs} billable tenants` },
          { label: "Active Subscriptions", value: activeSubs, icon: CreditCard, sub: `${rows.length} tenants total` },
          { label: "ARR Projection", value: `$${(totalMRR * 12).toLocaleString()}`, icon: TrendingUp, sub: "Annualized at current usage" },
          { label: "Non-billing Tenants", value: nonBilling.length, icon: AlertCircle, sub: nonBilling.length ? nonBilling.map((t) => t.name).slice(0, 2).join(", ") : "All tenants billable" },
        ].map((stat) => (
          <div key={stat.label} className="glass rounded-xl p-4 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{stat.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass rounded-xl p-5 border border-border lg:col-span-2">
          <h3 className="text-sm font-semibold text-foreground mb-4">MRR by month (based on tenants active in each period)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
              <Area type="monotone" dataKey="mrr" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.12)" strokeWidth={2} name="MRR ($)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass rounded-xl p-5 border border-border">
          <h3 className="text-sm font-semibold text-foreground mb-4">Plan Breakdown</h3>
          <div className="space-y-4">
            {planBreakdown.map((plan) => (
              <div key={plan.plan}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-foreground font-medium">{plan.plan}</span>
                  <span className="text-muted-foreground">{plan.tenants} tenants</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${totalMRR ? (plan.revenue / totalMRR) * 100 : 0}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">${plan.revenue.toLocaleString()}/mo</p>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-border space-y-1.5 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5"><Camera className="w-3.5 h-3.5" /> {totalCameras} cameras billed platform-wide</p>
            <p className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {rows.reduce((s, r) => s + r.members, 0)} seats provisioned</p>
          </div>
        </div>
      </div>

      <div className="glass rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Current period charges</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Plan base fee plus per-camera usage, recalculated from live data.</p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Tenant</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cameras</TableHead>
                <TableHead>Seats</TableHead>
                <TableHead>Alerts (30d)</TableHead>
                <TableHead>Monthly charge</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">No tenants found.</TableCell></TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id} className="border-border">
                  <TableCell className="text-sm text-foreground font-medium">{r.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground capitalize">{rateFor(r.plan).label}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("text-xs capitalize", statusColors[r.status] ?? statusColors.inactive)}>{r.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.cameras}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.members}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.alerts30d}</TableCell>
                  <TableCell className="text-sm font-medium text-foreground">${r.mrr.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default Billing;
