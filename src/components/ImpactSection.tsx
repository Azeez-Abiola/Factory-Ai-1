import { motion } from "framer-motion";
import { ShieldCheck, TrendingUp, Target, FileCheck } from "lucide-react";

const impacts = [
  {
    icon: ShieldCheck,
    metric: "91%",
    title: "Fewer Safety Incidents",
    description: "AI-supervised compliance reduces workplace violations by catching them the moment they occur.",
  },
  {
    icon: TrendingUp,
    metric: "34%",
    title: "More Production Output",
    description: "Eliminating hidden downtime and bottlenecks directly increases throughput per shift.",
  },
  {
    icon: Target,
    metric: "67%",
    title: "Fewer Product Defects",
    description: "Computer vision catches quality issues that human inspectors consistently miss.",
  },
  {
    icon: FileCheck,
    metric: "100%",
    title: "Audit-Ready Records",
    description: "Every incident is automatically documented with visual evidence and timestamped logs.",
  },
];

const ImpactSection = () => {
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
            Business Impact
          </span>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-foreground">
            Measurable Results, <span className="text-gradient">Day One</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {impacts.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass-hover rounded-xl p-6 text-center"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
                <item.icon className="w-6 h-6 text-primary" />
              </div>
              <div className="text-3xl font-black text-gradient mb-2">{item.metric}</div>
              <h3 className="text-sm font-semibold text-foreground mb-2">{item.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ImpactSection;
