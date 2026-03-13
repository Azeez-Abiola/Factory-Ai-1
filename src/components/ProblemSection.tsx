import { motion } from "framer-motion";
import { AlertTriangle, Eye, ClipboardList, TrendingDown } from "lucide-react";

const problems = [
  {
    icon: AlertTriangle,
    title: "Safety Violations Go Unnoticed",
    description: "Workers skip PPE, enter restricted zones, and interact unsafely with machinery — and supervisors only find out after an incident.",
    stat: "60%",
    statLabel: "of violations are undetected",
  },
  {
    icon: TrendingDown,
    title: "Hidden Production Losses",
    description: "Machine downtime, bottlenecks, and idle workstations silently erode output. By the time it's spotted, the shift is over.",
    stat: "23%",
    statLabel: "average OEE loss",
  },
  {
    icon: Eye,
    title: "Quality Defects Slip Through",
    description: "Manual inspection catches only a fraction of defects. Packaging errors and labeling issues reach customers.",
    stat: "15%",
    statLabel: "defect escape rate",
  },
  {
    icon: ClipboardList,
    title: "Manual Audits Are Broken",
    description: "Compliance relies on clipboards, spreadsheets, and memory. When auditors arrive, evidence is incomplete or fabricated.",
    stat: "40hrs",
    statLabel: "wasted per audit cycle",
  },
];

const ProblemSection = () => {
  return (
    <section className="section-padding relative" id="problem">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-xs font-mono text-primary uppercase tracking-[0.2em] mb-4 block">
            The Problem
          </span>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-foreground">
            Your Factory Has Blind Spots
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Every minute of every shift, critical issues go undetected on your production floor.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {problems.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass-hover rounded-xl p-8 group"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center justify-center shrink-0">
                  <p.icon className="w-5 h-5 text-destructive" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-foreground mb-2">{p.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">{p.description}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-destructive">{p.stat}</span>
                    <span className="text-xs text-muted-foreground">{p.statLabel}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProblemSection;
