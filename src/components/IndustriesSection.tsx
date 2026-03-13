import { motion } from "framer-motion";
import { Factory, Utensils, Pill, Warehouse } from "lucide-react";

const industries = [
  {
    icon: Factory,
    title: "FMCG Manufacturing",
    description: "High-speed production lines demand zero defect tolerance. FactoryAI monitors quality, packaging, and labeling at line speed.",
    highlights: ["Line speed quality inspection", "Packaging verification", "SKU compliance"],
  },
  {
    icon: Utensils,
    title: "Food Processing",
    description: "Ensure hygiene compliance, contamination prevention, and food safety standards are met at every stage of production.",
    highlights: ["Hygiene monitoring", "Foreign object detection", "Temperature zone compliance"],
  },
  {
    icon: Pill,
    title: "Pharmaceutical Production",
    description: "GMP compliance, cleanroom monitoring, and batch integrity verification powered by continuous AI surveillance.",
    highlights: ["GMP violation detection", "Cleanroom monitoring", "Batch traceability"],
  },
  {
    icon: Warehouse,
    title: "Industrial & Logistics",
    description: "Monitor warehouse operations, forklift safety, loading dock efficiency, and workforce productivity across facilities.",
    highlights: ["Forklift safety monitoring", "Loading dock analytics", "Inventory movement tracking"],
  },
];

const IndustriesSection = () => {
  return (
    <section className="section-padding" id="industries">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-xs font-mono text-primary uppercase tracking-[0.2em] mb-4 block">
            Industries
          </span>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-foreground">
            Built for <span className="text-gradient">Your Industry</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Pre-trained AI models tailored to the unique challenges of your manufacturing sector.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {industries.map((ind, i) => (
            <motion.div
              key={ind.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass-hover rounded-xl p-8"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
                <ind.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">{ind.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">{ind.description}</p>
              <div className="flex flex-wrap gap-2">
                {ind.highlights.map((h) => (
                  <span key={h} className="text-xs px-3 py-1 rounded-full bg-primary/5 border border-primary/15 text-primary/80">
                    {h}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default IndustriesSection;
