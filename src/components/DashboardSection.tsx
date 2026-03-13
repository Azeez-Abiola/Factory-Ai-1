import { motion } from "framer-motion";
import dashboardImage from "@/assets/dashboard-preview.jpg";

const DashboardSection = () => {
  return (
    <section className="section-padding relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(172,66%,50%,0.06),transparent_60%)]" />
      <div className="container mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-xs font-mono text-primary uppercase tracking-[0.2em] mb-4 block">
            Analytics Dashboard
          </span>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-foreground">
            Complete <span className="text-gradient">Operational Visibility</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Safety scores, downtime analytics, defect trends, and productivity insights — all in one unified view.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-5xl mx-auto"
        >
          <div className="relative rounded-xl overflow-hidden glow-border">
            <img
              src={dashboardImage}
              alt="FactoryAI analytics dashboard showing safety scores, production metrics, and defect trends"
              className="w-full object-cover rounded-xl"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
          </div>

          {/* Stats overlay */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            {[
              { value: "98.7%", label: "Safety Score" },
              { value: "↓ 42%", label: "Downtime Reduction" },
              { value: "0.02%", label: "Defect Escape Rate" },
              { value: "↑ 31%", label: "Productivity Gain" },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="glass rounded-lg p-4 text-center"
              >
                <div className="text-2xl font-bold text-primary mb-1">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default DashboardSection;
