import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const CTASection = () => {
  return (
    <section className="section-padding relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(172,66%,50%,0.1),transparent_60%)]" />
      <div className="absolute inset-0 grid-bg opacity-20" />

      <div className="container mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center"
        >
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-black tracking-tight mb-6 text-foreground">
            Turn Your Factory Into an
            <br />
            <span className="text-gradient glow-text">AI-Powered Smart Operation</span>
          </h2>
          <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
            Join the manufacturers who are eliminating blind spots, reducing losses, and building safer, smarter factories.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="text-base px-10 h-14 gap-2 group">
              Book a Demo
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button variant="outline" size="lg" className="text-base px-10 h-14">
              See How It Works
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
