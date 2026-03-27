const Footer = () => {
  return (
    <footer className="border-t border-border py-16 px-6">
      <div className="container mx-auto">
        <div className="grid md:grid-cols-4 gap-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img src="/techhub-logo.png" alt="TechHub" className="h-10 w-auto" />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              AI-powered manufacturing intelligence platform. Making factories safer, smarter, and more efficient.
            </p>
          </div>
          {/* Links */}
          {[
            {
              title: "Product",
              links: ["Visual Compliance", "Production Analytics", "Quality Inspection", "Workforce Intelligence"],
            },
            {
              title: "Company",
              links: ["About", "Careers", "Blog", "Contact"],
            },
            {
              title: "Resources",
              links: ["Documentation", "Case Studies", "API Reference", "System Status"],
            },
          ].map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-foreground mb-4">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l}>
                    <a href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-border mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">with love from techhub</p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Terms</a>
            <a href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Security</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
