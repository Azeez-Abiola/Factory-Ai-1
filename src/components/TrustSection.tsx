import { motion } from "framer-motion";
import { Lock, Blocks, Scale } from "lucide-react";

const pillars = [
  {
    icon: Lock,
    title: "Enterprise-Grade Security",
    description: "SOC 2 Type II compliant. End-to-end encryption. On-premise deployment options. Your data never leaves your infrastructure.",
    tags: ["SOC 2", "AES-256", "On-Prem", "GDPR"],
  },
  {
    icon: Blocks,
    title: "Seamless Integrations",
    description: "Connect FactoryAI with your existing operational stack — ERP, MES, HR, and communication systems.",
    tags: ["SAP", "Oracle", "Siemens MES", "Microsoft"],
  },
  {
    icon: Scale,
    title: "Scalable Deployment",
    description: "From a single production line to hundreds of facilities worldwide. FactoryAI scales with your operation.",
    tags: ["Multi-site", "Edge + Cloud", "99.99% SLA", "24/7 Support"],
  },
];

const TrustSection = () => {
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
            Enterprise Ready
          </span>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-foreground">
            Built for <span className="text-gradient">Enterprise Scale</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {pillars.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass-hover rounded-xl p-8"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
                <p.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-3">{p.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">{p.description}</p>
              <div className="flex flex-wrap gap-2">
                {p.tags.map((t) => (
                  <span key={t} className="text-xs px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground font-mono">
                    {t}
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

export default TrustSection;
