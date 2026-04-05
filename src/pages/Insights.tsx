import { useState, useMemo } from "react";
import { Brain, TrendingUp, TrendingDown, Minus, Shield, Zap, Eye, DollarSign, Sparkles, Search, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mockInsights, AIInsight } from "@/data/extendedMockData";
import { cn } from "@/lib/utils";

const categoryConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  safety: { icon: <Shield className="w-5 h-5" />, color: "bg-destructive/10 text-destructive", label: "Safety" },
  efficiency: { icon: <Zap className="w-5 h-5" />, color: "bg-primary/10 text-primary", label: "Efficiency" },
  quality: { icon: <Eye className="w-5 h-5" />, color: "bg-warning/10 text-warning", label: "Quality" },
  cost: { icon: <DollarSign className="w-5 h-5" />, color: "bg-success/10 text-success", label: "Cost" },
};

const trendIcons = {
  up: <TrendingUp className="w-4 h-4" />,
  down: <TrendingDown className="w-4 h-4" />,
  stable: <Minus className="w-4 h-4" />,
};

const impactColors = {
  high: "bg-destructive/10 text-destructive border-destructive/30",
  medium: "bg-warning/10 text-warning border-warning/30",
  low: "bg-muted text-muted-foreground border-border",
};

const Insights = () => {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterImpact, setFilterImpact] = useState("all");
  const [timeRange, setTimeRange] = useState("7d");

  const filtered = useMemo(() => {
    let result = [...mockInsights];
    if (filterCategory !== "all") result = result.filter((i) => i.category === filterCategory);
    if (filterImpact !== "all") result = result.filter((i) => i.impact === filterImpact);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.recommendation.toLowerCase().includes(q)
      );
    }
    return result;
  }, [search, filterCategory, filterImpact]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" /> AI Insights
          </h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} insight{filtered.length !== 1 ? "s" : ""} · {timeRange === "7d" ? "Last 7 days" : timeRange === "30d" ? "Last 30 days" : "Last 90 days"}
          </p>
        </div>
        <Badge variant="outline" className="text-xs gap-1">
          <Brain className="w-3 h-3" /> Generated Mar 27, 2026
        </Badge>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search insights..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-40 bg-card border-border">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="safety">Safety</SelectItem>
            <SelectItem value="efficiency">Efficiency</SelectItem>
            <SelectItem value="quality">Quality</SelectItem>
            <SelectItem value="cost">Cost</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterImpact} onValueChange={setFilterImpact}>
          <SelectTrigger className="w-36 bg-card border-border">
            <SelectValue placeholder="Impact" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Impact</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-1 bg-card border border-border rounded-lg p-1">
          {["7d", "30d", "90d"].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                timeRange === range ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No insights match your filters</p>
          <p className="text-sm">Try adjusting your search or filters.</p>
        </div>
      )}

      <div className="space-y-4">
        {filtered.map((insight) => {
          const config = categoryConfig[insight.category];
          return (
            <div key={insight.id} className="glass rounded-xl p-5 border border-border hover:border-primary/20 transition-all">
              <div className="flex items-start gap-4">
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", config.color)}>
                  {config.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-sm font-semibold text-foreground">{insight.title}</h3>
                    <Badge variant="outline" className="text-xs">{config.label}</Badge>
                    <Badge variant="outline" className={cn("text-xs", impactColors[insight.impact])}>
                      {insight.impact} impact
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {insight.confidence}% confidence
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{insight.description}</p>
                  
                  <div className="flex items-center gap-6 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{insight.metric}:</span>
                      <span className={cn("text-sm font-bold", insight.trend === "up" ? "text-destructive" : insight.trend === "down" ? "text-success" : "text-foreground")}>
                        {insight.metricValue}
                      </span>
                      <span className={cn(insight.trend === "up" ? "text-destructive" : insight.trend === "down" ? "text-success" : "text-muted-foreground")}>
                        {trendIcons[insight.trend]}
                      </span>
                    </div>
                  </div>

                  <div className="bg-primary/5 border border-primary/15 rounded-lg p-3">
                    <p className="text-xs font-semibold text-primary mb-1">💡 Recommendation</p>
                    <p className="text-sm text-foreground">{insight.recommendation}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Insights;
