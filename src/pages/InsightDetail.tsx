import { useParams, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import {
  ArrowLeft, Brain, TrendingUp, TrendingDown, Minus, Shield, Zap, Eye, DollarSign,
  Sparkles, Calendar, Target, BarChart3, Lightbulb, AlertTriangle, CheckCircle2,
  Clock, ArrowUpRight, Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { mockInsights, AIInsight } from "@/data/extendedMockData";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, AreaChart, Area
} from "recharts";

const categoryConfig: Record<string, { icon: React.ReactNode; color: string; label: string; bgClass: string }> = {
  safety: { icon: <Shield className="w-6 h-6" />, color: "bg-destructive/10 text-destructive", label: "Safety", bgClass: "bg-destructive/10" },
  efficiency: { icon: <Zap className="w-6 h-6" />, color: "bg-primary/10 text-primary", label: "Efficiency", bgClass: "bg-primary/10" },
  quality: { icon: <Eye className="w-6 h-6" />, color: "bg-warning/10 text-warning", label: "Quality", bgClass: "bg-warning/10" },
  cost: { icon: <DollarSign className="w-6 h-6" />, color: "bg-success/10 text-success", label: "Cost", bgClass: "bg-success/10" },
};

const trendIcons = {
  up: <TrendingUp className="w-5 h-5" />,
  down: <TrendingDown className="w-5 h-5" />,
  stable: <Minus className="w-5 h-5" />,
};

const impactColors = {
  high: "bg-destructive/10 text-destructive border-destructive/30",
  medium: "bg-warning/10 text-warning border-warning/30",
  low: "bg-muted text-muted-foreground border-border",
};

const generateTrendData = (insight: AIInsight) => {
  const isUp = insight.trend === "up";
  const baseValues = isUp
    ? [22, 28, 25, 32, 35, 38, 40]
    : insight.trend === "down"
    ? [45, 42, 38, 35, 30, 28, 25]
    : [30, 32, 31, 33, 30, 32, 31];
  return baseValues.map((val, i) => ({
    day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
    value: val + Math.floor(Math.random() * 5),
  }));
};

const generateImpactProjection = () => [
  { month: "Current", withAction: 100, withoutAction: 100 },
  { month: "Month 1", withAction: 88, withoutAction: 105 },
  { month: "Month 2", withAction: 72, withoutAction: 112 },
  { month: "Month 3", withAction: 55, withoutAction: 120 },
  { month: "Month 4", withAction: 38, withoutAction: 130 },
  { month: "Month 5", withAction: 22, withoutAction: 142 },
  { month: "Month 6", withAction: 10, withoutAction: 155 },
];

const generateZoneBreakdown = () => [
  { zone: "Zone A", incidents: 4 },
  { zone: "Zone B", incidents: 12 },
  { zone: "Zone C", incidents: 7 },
  { zone: "Zone D", incidents: 5 },
  { zone: "Zone E", incidents: 9 },
  { zone: "Zone F", incidents: 2 },
];

const relatedAlerts = [
  { id: "ALT-001", title: "Missing PPE – Hard Hat", severity: "critical", time: "2h ago" },
  { id: "ALT-004", title: "Restricted Zone Entry", severity: "critical", time: "5h ago" },
  { id: "ALT-005", title: "Production Bottleneck", severity: "medium", time: "8h ago" },
];

const actionSteps = [
  { step: 1, title: "Immediate Assessment", description: "Conduct a detailed review of current conditions in affected zones.", status: "completed", dueDate: "2026-03-28" },
  { step: 2, title: "Root Cause Analysis", description: "Identify underlying factors contributing to the detected pattern.", status: "in-progress", dueDate: "2026-03-30" },
  { step: 3, title: "Implement Corrective Measures", description: "Deploy recommended changes based on root cause findings.", status: "pending", dueDate: "2026-04-05" },
  { step: 4, title: "Validation & Monitoring", description: "Monitor effectiveness of changes for at least 2 weeks.", status: "pending", dueDate: "2026-04-20" },
];

const statusColors: Record<string, string> = {
  completed: "bg-success/10 text-success border-success/30",
  "in-progress": "bg-warning/10 text-warning border-warning/30",
  pending: "bg-muted text-muted-foreground border-border",
};

const statusDotColors: Record<string, string> = {
  completed: "bg-success",
  "in-progress": "bg-warning",
  pending: "bg-muted-foreground",
};

const InsightDetail = () => {
  const { insightId } = useParams<{ insightId: string }>();
  const navigate = useNavigate();

  const insight = useMemo(() => {
    return mockInsights.find((i) => i.id === insightId) || null;
  }, [insightId]);

  const trendData = useMemo(() => (insight ? generateTrendData(insight) : []), [insight]);
  const impactProjection = useMemo(() => generateImpactProjection(), []);
  const zoneBreakdown = useMemo(() => generateZoneBreakdown(), []);

  if (!insight) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Brain className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Insight Not Found</h2>
        <p className="text-muted-foreground mb-6">The insight you're looking for doesn't exist.</p>
        <Button onClick={() => navigate("/app/insights")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Insights
        </Button>
      </div>
    );
  }

  const config = categoryConfig[insight.category];
  const trendColor = insight.trend === "up" ? "text-destructive" : insight.trend === "down" ? "text-success" : "text-foreground";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button variant="ghost" className="w-fit -ml-2 text-muted-foreground hover:text-foreground" onClick={() => navigate("/app/insights")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to AI Insights
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center shrink-0", config.color)}>
              {config.icon}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{insight.title}</h1>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <Badge variant="outline" className="text-xs">{config.label}</Badge>
                <Badge variant="outline" className={cn("text-xs", impactColors[insight.impact])}>
                  {insight.impact} impact
                </Badge>
                <Badge variant="outline" className="text-xs gap-1">
                  <Sparkles className="w-3 h-3" /> {insight.confidence}% confidence
                </Badge>
                <span className="text-xs text-muted-foreground font-mono">{insight.id}</span>
              </div>
            </div>
          </div>

          <Badge variant="outline" className="text-xs gap-1 shrink-0">
            <Calendar className="w-3 h-3" /> Generated {new Date(insight.generatedAt).toLocaleDateString()}
          </Badge>
        </div>
      </div>

      {/* Key Metric Highlight */}
      <Card className="border-border bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">{insight.metric}</p>
              <div className="flex items-center gap-3">
                <span className={cn("text-4xl font-bold", trendColor)}>{insight.metricValue}</span>
                <span className={cn("flex items-center gap-1", trendColor)}>
                  {trendIcons[insight.trend]}
                  <span className="text-sm font-medium">
                    {insight.trend === "up" ? "Increasing" : insight.trend === "down" ? "Decreasing" : "Stable"}
                  </span>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Confidence Level</p>
                <p className="text-lg font-bold text-foreground">{insight.confidence}%</p>
              </div>
              <div className="w-16 h-16">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="14" fill="none" stroke="hsl(var(--primary))" strokeWidth="3"
                    strokeDasharray={`${(insight.confidence / 100) * 88} 88`} strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Description & Analysis */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" /> AI Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-foreground leading-relaxed">{insight.description}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="glass rounded-lg p-3 border border-border">
              <p className="text-xs text-muted-foreground">Data Points Analyzed</p>
              <p className="text-lg font-bold text-foreground">12,847</p>
            </div>
            <div className="glass rounded-lg p-3 border border-border">
              <p className="text-xs text-muted-foreground">Time Window</p>
              <p className="text-lg font-bold text-foreground">30 days</p>
            </div>
            <div className="glass rounded-lg p-3 border border-border">
              <p className="text-xs text-muted-foreground">Pattern Strength</p>
              <p className="text-lg font-bold text-primary">Strong</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Metric Trend */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">7-Day Metric Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#colorValue)" dot={{ fill: "hsl(var(--primary))", r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Zone Breakdown */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Incidents by Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={zoneBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="zone" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                <Bar dataKey="incidents" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Impact Projection */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" /> Impact Projection (6 Months)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={impactProjection}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
              <Line type="monotone" dataKey="withAction" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", r: 4 }} name="With Action" />
              <Line type="monotone" dataKey="withoutAction" stroke="hsl(0 72% 51%)" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: "hsl(0 72% 51%)", r: 4 }} name="Without Action" />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-6 mt-3 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-primary rounded" />
              <span className="text-muted-foreground">With corrective action</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-destructive rounded border-dashed" style={{ borderTop: "2px dashed hsl(0 72% 51%)" }} />
              <span className="text-muted-foreground">Without action (projected risk)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommendation & Action Plan */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Recommendation */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-warning" /> AI Recommendation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 mb-4">
              <p className="text-sm text-foreground leading-relaxed">{insight.recommendation}</p>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Expected Outcomes</p>
              <div className="space-y-2">
                {[
                  { label: "Risk Reduction", value: "60-75%" },
                  { label: "ROI Timeline", value: "2-3 months" },
                  { label: "Implementation Effort", value: insight.impact === "high" ? "Significant" : "Moderate" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                    <span className="text-xs font-semibold text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Plan */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" /> Action Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {actionSteps.map((step) => (
              <div key={step.step} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/20 transition-colors">
                <div className={cn("w-2.5 h-2.5 rounded-full mt-1.5 shrink-0", statusDotColors[step.status])} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-xs font-mono text-muted-foreground">Step {step.step}</span>
                    <span className="text-sm font-semibold text-foreground">{step.title}</span>
                    <Badge variant="outline" className={cn("text-xs", statusColors[step.status])}>
                      {step.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">{step.description}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" /> Due: {step.dueDate}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Related Alerts */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" /> Related Alerts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {relatedAlerts.map((alert) => (
            <div key={alert.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/20 transition-colors cursor-pointer" onClick={() => navigate("/app/alerts")}>
              <div className="flex items-center gap-3">
                <div className={cn("w-2 h-2 rounded-full", alert.severity === "critical" ? "bg-destructive" : "bg-warning")} />
                <div>
                  <p className="text-sm font-medium text-foreground">{alert.title}</p>
                  <p className="text-xs text-muted-foreground font-mono">{alert.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{alert.time}</span>
                <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default InsightDetail;
