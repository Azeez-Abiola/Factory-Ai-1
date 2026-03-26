import { CreditCard, TrendingUp, DollarSign, AlertCircle } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { mockInvoices, revenueData, planDistribution, type InvoiceStatus } from "@/data/adminMockData";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const statusColors: Record<InvoiceStatus, string> = {
  paid: "bg-success/10 text-[hsl(var(--success))] border-success/20",
  pending: "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20",
  overdue: "bg-destructive/10 text-destructive border-destructive/20",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const Billing = () => {
  const totalMRR = revenueData[revenueData.length - 1].mrr;
  const prevMRR = revenueData[revenueData.length - 2].mrr;
  const mrrGrowth = ((totalMRR - prevMRR) / prevMRR * 100).toFixed(1);
  const overdueCount = mockInvoices.filter(i => i.status === "overdue").length;
  const overdueTotal = mockInvoices.filter(i => i.status === "overdue").reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Billing & Plans</h1>
        <p className="text-sm text-muted-foreground">Revenue, subscriptions, and invoicing</p>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Monthly Recurring Revenue", value: `$${totalMRR.toLocaleString()}`, icon: DollarSign, sub: `+${mrrGrowth}% MoM growth` },
          { label: "Active Subscriptions", value: planDistribution.reduce((s, p) => s + p.tenants, 0), icon: CreditCard, sub: "Across all plans" },
          { label: "ARR Projection", value: `$${(totalMRR * 12).toLocaleString()}`, icon: TrendingUp, sub: "Annualized" },
          { label: "Overdue Invoices", value: overdueCount, icon: AlertCircle, sub: overdueCount > 0 ? `$${overdueTotal.toLocaleString()} outstanding` : "All clear" },
        ].map((stat) => (
          <div key={stat.label} className="glass rounded-xl p-4 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* MRR Trend */}
        <div className="glass rounded-xl p-5 border border-border lg:col-span-2">
          <h3 className="text-sm font-semibold text-foreground mb-4">MRR Growth</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 16%)" />
              <XAxis dataKey="month" tick={{ fill: "hsl(215 12% 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(215 12% 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "hsl(220 18% 8%)", border: "1px solid hsl(220 14% 16%)", borderRadius: 8, color: "hsl(210 20% 92%)" }} />
              <Area type="monotone" dataKey="mrr" stroke="hsl(142 71% 45%)" fill="hsl(142 71% 45% / 0.1)" strokeWidth={2} name="MRR ($)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Plan Distribution */}
        <div className="glass rounded-xl p-5 border border-border">
          <h3 className="text-sm font-semibold text-foreground mb-4">Plan Breakdown</h3>
          <div className="space-y-4">
            {planDistribution.map((plan) => (
              <div key={plan.plan}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-foreground font-medium">{plan.plan}</span>
                  <span className="text-muted-foreground">{plan.tenants} tenants</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${(plan.revenue / totalMRR) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">${plan.revenue.toLocaleString()}/mo</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Invoice Table */}
      <div className="glass rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Recent Invoices</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Invoice</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockInvoices.map((inv) => (
              <TableRow key={inv.id} className="border-border">
                <TableCell className="font-mono text-xs text-foreground">{inv.id}</TableCell>
                <TableCell className="text-sm text-foreground">{inv.tenantName}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{inv.period}</TableCell>
                <TableCell className="text-sm font-medium text-foreground">${inv.amount.toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("text-xs capitalize", statusColors[inv.status])}>
                    {inv.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(inv.dueDate).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Billing;
