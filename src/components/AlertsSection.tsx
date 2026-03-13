import { motion } from "framer-motion";
import { AlertTriangle, Timer, Package, ShieldAlert, Bell } from "lucide-react";

const alerts = [
  {
    icon: ShieldAlert,
    type: "SAFETY",
    title: "PPE Violation Detected",
    detail: "Worker in Zone B-4 missing hard hat. Visual evidence captured.",
    time: "2s ago",
    severity: "critical",
  },
  {
    icon: Timer,
    type: "DOWNTIME",
    title: "Machine CNC-07 Idle",
    detail: "No activity detected for 12 minutes. Supervisor notified.",
    time: "12m ago",
    severity: "warning",
  },
  {
    icon: Package,
    type: "QUALITY",
    title: "Packaging Defect Detected",
    detail: "Line 3 — seal misalignment on batch #4821. Task created.",
    time: "45s ago",
    severity: "critical",
  },
  {
    icon: AlertTriangle,
    type: "ZONE",
    title: "Restricted Zone Entry",
    detail: "Unauthorized personnel entered maintenance area. Alert sent.",
    time: "5m ago",
    severity: "warning",
  },
];

const severityStyles: Record<string, string> = {
  critical: "border-destructive/30 bg-destructive/5",
  warning: "border-warning/30 bg-warning/5",
};

const badgeStyles: Record<string, string> = {
  critical: "bg-destructive/20 text-destructive",
  warning: "bg-warning/20 text-warning",
};

const AlertsSection = () => {
  return (
    <section className="section-padding">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-xs font-mono text-primary uppercase tracking-[0.2em] mb-4 block">
            Real-Time Alerts
          </span>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-foreground">
            Instant Awareness, <span className="text-gradient">Zero Delay</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            The moment an issue occurs, FactoryAI captures evidence, logs the incident, and notifies the right people.
          </p>
        </motion.div>

        <div className="max-w-2xl mx-auto space-y-4">
          {alerts.map((a, i) => (
            <motion.div
              key={a.title}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12 }}
              className={`rounded-xl border p-5 flex items-start gap-4 ${severityStyles[a.severity]}`}
            >
              <div className="w-10 h-10 rounded-lg bg-card/80 border border-border flex items-center justify-center shrink-0">
                <a.icon className="w-5 h-5 text-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full ${badgeStyles[a.severity]}`}>
                    {a.type}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">{a.time}</span>
                </div>
                <h4 className="text-sm font-semibold text-foreground">{a.title}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">{a.detail}</p>
              </div>
              <Bell className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AlertsSection;
