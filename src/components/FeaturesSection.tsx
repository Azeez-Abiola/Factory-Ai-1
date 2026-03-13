import { motion } from "framer-motion";
import { Shield, Timer, Search, Users } from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Visual Compliance Monitoring",
    description: "AI detects safety violations in real time — missing PPE, restricted zone breaches, and unsafe machine interactions.",
    benefits: ["Automated PPE detection", "Zone intrusion alerts", "Real-time visual evidence", "Compliance audit trail"],
    color: "primary",
  },
  {
    icon: Timer,
    title: "Production Loss Detection",
    description: "Identify and quantify every minute of lost production — machine downtime, bottlenecks, idle workstations, and workflow congestion.",
    benefits: ["Downtime root cause analysis", "Bottleneck identification", "Idle station alerts", "OEE optimization"],
    color: "warning",
  },
  {
    icon: Search,
    title: "AI Quality Inspection",
    description: "Computer vision inspects every product on the line — catching defects, packaging errors, and labeling issues humans miss.",
    benefits: ["Sub-millimeter defect detection", "Packaging verification", "Label compliance checks", "Zero-escape quality"],
    color: "success",
  },
  {
    icon: Users,
    title: "Workforce Intelligence",
    description: "Understand production floor activity patterns — worker presence, productivity trends, and operational discipline metrics.",
    benefits: ["Presence monitoring", "Productivity analytics", "Shift performance", "Operational insights"],
    color: "primary",
  },
];

const colorMap: Record<string, string> = {
  primary: "bg-primary/10 border-primary/20 text-primary",
  warning: "bg-warning/10 border-warning/20 text-warning",
  success: "bg-success/10 border-success/20 text-success",
};

const dotColor: Record<string, string> = {
  primary: "bg-primary/60",
  warning: "bg-warning/60",
  success: "bg-success/60",
};

const FeaturesSection = () => {
  return (
    <section className="section-padding" id="features">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-xs font-mono text-primary uppercase tracking-[0.2em] mb-4 block">
            Platform Modules
          </span>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-foreground">
            Four Pillars of <span className="text-gradient">Factory Intelligence</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Purpose-built AI modules that cover every critical dimension of manufacturing operations.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass-hover rounded-xl p-8"
            >
              <div className={`w-12 h-12 rounded-xl border flex items-center justify-center mb-5 ${colorMap[f.color]}`}>
                <f.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">{f.description}</p>
              <ul className="space-y-2">
                {f.benefits.map((b) => (
                  <li key={b} className="flex items-center gap-2.5 text-sm text-secondary-foreground">
                    <div className={`w-1.5 h-1.5 rounded-full ${dotColor[f.color]}`} />
                    {b}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
