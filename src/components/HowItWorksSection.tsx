import { motion } from "framer-motion";
import { Camera, Cpu, Bell, ClipboardCheck, BarChart3, ChevronRight } from "lucide-react";

const steps = [
  { icon: Camera, label: "Cameras" },
  { icon: Cpu, label: "AI Detection" },
  { icon: Bell, label: "Alerts" },
  { icon: ClipboardCheck, label: "Tasks" },
  { icon: BarChart3, label: "Analytics" },
];

const HowItWorksSection = () => {
  return (
    <section className="section-padding relative" id="how-it-works">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(172,66%,50%,0.04),transparent_60%)]" />
      <div className="container mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-xs font-mono text-primary uppercase tracking-[0.2em] mb-4 block">
            Architecture
          </span>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-foreground">
            Simple Architecture, <span className="text-gradient">Powerful Results</span>
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-wrap items-center justify-center gap-3 md:gap-4 max-w-4xl mx-auto"
        >
          {steps.map((s, i) => (
            <div key={s.label} className="flex items-center gap-3 md:gap-4">
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl glass flex items-center justify-center glow-border">
                  <s.icon className="w-7 h-7 md:w-8 md:h-8 text-primary" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <ChevronRight className="w-5 h-5 text-primary/40 mb-5" />
              )}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
