import { motion } from "framer-motion";
import { Camera, Brain, Zap } from "lucide-react";

const steps = [
  {
    icon: Camera,
    step: "01",
    title: "Cameras Observe",
    description: "Your existing CCTV and IP cameras become AI-powered sensors. No new hardware required.",
  },
  {
    icon: Brain,
    step: "02",
    title: "AI Detects Issues",
    description: "Computer vision models analyze every frame in real time — detecting safety, quality, and efficiency issues instantly.",
  },
  {
    icon: Zap,
    step: "03",
    title: "System Takes Action",
    description: "Automated alerts, task creation, visual evidence capture, and compliance logging — all without human intervention.",
  },
];

const SolutionSection = () => {
  return (
    <section className="section-padding relative" id="solution">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,hsl(172,66%,50%,0.05),transparent_60%)]" />
      <div className="container mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <span className="text-xs font-mono text-primary uppercase tracking-[0.2em] mb-4 block">
            The Solution
          </span>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-foreground">
            From Cameras to <span className="text-gradient">Intelligence</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Three steps to transform your factory into an AI-supervised operation.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto relative">
          {/* Connector line */}
          <div className="hidden md:block absolute top-16 left-[20%] right-[20%] h-px bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20" />

          {steps.map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="text-center relative"
            >
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6 relative z-10">
                <s.icon className="w-7 h-7 text-primary" />
              </div>
              <span className="text-xs font-mono text-primary/60 mb-2 block">{s.step}</span>
              <h3 className="text-xl font-bold text-foreground mb-3">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SolutionSection;
