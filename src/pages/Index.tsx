import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import ProblemSection from "@/components/ProblemSection";
import SolutionSection from "@/components/SolutionSection";
import FeaturesSection from "@/components/FeaturesSection";
import AlertsSection from "@/components/AlertsSection";
import DashboardSection from "@/components/DashboardSection";
import ImpactSection from "@/components/ImpactSection";
import IndustriesSection from "@/components/IndustriesSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import TrustSection from "@/components/TrustSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <ProblemSection />
      <SolutionSection />
      <FeaturesSection />
      <AlertsSection />
      <DashboardSection />
      <ImpactSection />
      <IndustriesSection />
      <HowItWorksSection />
      <TrustSection />
      <CTASection />
      <Footer />
    </div>
  );
};

export default Index;
