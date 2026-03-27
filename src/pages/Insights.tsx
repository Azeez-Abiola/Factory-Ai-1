import { Brain, TrendingUp, TrendingDown, Minus, Shield, Zap, Eye, DollarSign, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { mockInsights, AIInsight } from "@/data/extendedMockData";
import { cn } from "@/lib/utils";

const categoryConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  safety: { icon: <Shield className="w-5 h-5" />, color: "bg-destructive/10 text-destructive" },
  efficiency: { icon: <Zap className="w-5 h-5" />, color: "bg-primary/10 text-primary" },
  quality: { icon: <Eye className="w-5 h-5" />, color: "bg-warning/10 text-warning" },
  cost: { icon: <DollarSign className="w-5 h-5" />, color: "bg-success/10 text-success" },
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
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" /> AI Insights
          </h1>
          <p className="text-sm text-muted-foreground">Weekly auto-generated intelligence from your factory data</p>
        </div>
        <Badge variant="outline" className="text-xs gap-1">
          <Brain className="w-3 h-3" /> Generated Mar 27, 2026
        </Badge>
      </div>

      <div className="space-y-4">
        {mockInsights.map((insight) => {
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
