import { useState } from "react";
import { Building2, Camera, MapPin, Bell, Users, CheckCircle, ChevronRight, ChevronLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { onboardingSteps } from "@/data/extendedMockData";
import { toast } from "sonner";

const stepIcons = [Building2, Camera, MapPin, Bell, Users];

const Onboarding = () => {
  const [currentStep, setCurrentStep] = useState(0);

  const handleComplete = () => {
    toast.success("Tenant onboarding complete! The new factory is now active.", { duration: 4000 });
    setCurrentStep(0);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tenant Onboarding</h1>
        <p className="text-sm text-muted-foreground">Step-by-step wizard to set up a new factory</p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {onboardingSteps.map((step, i) => {
          const Icon = stepIcons[i];
          const isActive = i === currentStep;
          const isDone = i < currentStep;
          return (
            <div key={step.id} className="flex items-center gap-2 flex-1">
              <button
                onClick={() => i <= currentStep && setCurrentStep(i)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all w-full",
                  isActive ? "bg-destructive/10 text-destructive border border-destructive/30" :
                  isDone ? "bg-success/10 text-success" : "bg-muted/50 text-muted-foreground"
                )}
              >
                {isDone ? <CheckCircle className="w-4 h-4 shrink-0" /> : <Icon className="w-4 h-4 shrink-0" />}
                <span className="hidden lg:inline truncate">{step.title}</span>
              </button>
              {i < onboardingSteps.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="glass rounded-xl p-6 border border-border min-h-[350px]">
        {currentStep === 0 && (
          <div className="space-y-4 max-w-md">
            <h2 className="text-lg font-semibold text-foreground">Organization Details</h2>
            <div className="space-y-3">
              <div><Label className="text-xs text-muted-foreground">Company Name</Label><Input placeholder="e.g., Tata Steel Works" className="bg-background border-border mt-1" /></div>
              <div><Label className="text-xs text-muted-foreground">Industry</Label>
                <Select><SelectTrigger className="bg-background border-border mt-1"><SelectValue placeholder="Select industry" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manufacturing">Manufacturing</SelectItem><SelectItem value="fmcg">FMCG</SelectItem>
                    <SelectItem value="pharma">Pharmaceuticals</SelectItem><SelectItem value="automotive">Automotive</SelectItem>
                    <SelectItem value="electronics">Electronics</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs text-muted-foreground">Region</Label><Input placeholder="e.g., India – Jamshedpur" className="bg-background border-border mt-1" /></div>
              <div><Label className="text-xs text-muted-foreground">Plan</Label>
                <Select><SelectTrigger className="bg-background border-border mt-1"><SelectValue placeholder="Select plan" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem><SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Add Cameras</h2>
            <p className="text-sm text-muted-foreground">Connect IP cameras to the platform. You can add more later.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-xl">
              {["Main Entrance", "Assembly Line 1", "Packaging Hall", "QC Station"].map((name, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                  <Camera className="w-5 h-5 text-primary" />
                  <div className="flex-1"><p className="text-sm text-foreground">{name}</p><p className="text-xs text-muted-foreground">rtsp://192.168.1.{10 + i}/stream</p></div>
                  <Badge variant="outline" className="text-xs bg-success/10 text-success">Connected</Badge>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="gap-2"><Camera className="w-4 h-4" /> Add Camera</Button>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Define Factory Zones</h2>
            <p className="text-sm text-muted-foreground">Map your factory into logical zones for monitoring.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-2xl">
              {["Zone A – Main Hall", "Zone B – Assembly", "Zone C – Packaging", "Zone D – Storage", "Zone E – QC Lab", "Zone F – Loading Dock"].map((zone, i) => (
                <div key={i} className="p-3 rounded-lg bg-muted/30 border border-border text-center">
                  <MapPin className="w-5 h-5 text-primary mx-auto mb-1" />
                  <p className="text-sm text-foreground">{zone}</p>
                  <p className="text-xs text-muted-foreground">{2 + i} cameras</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4 max-w-md">
            <h2 className="text-lg font-semibold text-foreground">Alert Thresholds</h2>
            <p className="text-sm text-muted-foreground">Configure detection sensitivity and alert rules.</p>
            {[
              { label: "PPE Violation Detection", desc: "Trigger alert when PPE missing for" },
              { label: "Machine Idle Timeout", desc: "Alert if machine idle for" },
              { label: "Quality Defect Sensitivity", desc: "Minimum confidence threshold" },
              { label: "Restricted Zone Alert", desc: "Immediate alert on unauthorized entry" },
            ].map((rule, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                <div><p className="text-sm text-foreground">{rule.label}</p><p className="text-xs text-muted-foreground">{rule.desc}</p></div>
                <Select defaultValue={i === 3 ? "instant" : "5min"}>
                  <SelectTrigger className="w-28 bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instant">Instant</SelectItem><SelectItem value="2min">2 min</SelectItem>
                    <SelectItem value="5min">5 min</SelectItem><SelectItem value="10min">10 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-4 max-w-lg">
            <h2 className="text-lg font-semibold text-foreground">Invite Team Members</h2>
            <p className="text-sm text-muted-foreground">Add users and assign roles for this factory.</p>
            <div className="flex gap-2">
              <Input placeholder="email@company.com" className="bg-background border-border" />
              <Select defaultValue="operator">
                <SelectTrigger className="w-40 bg-background border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tenant_admin">Tenant Admin</SelectItem><SelectItem value="operator">Operator</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline">Invite</Button>
            </div>
            <div className="space-y-2">
              {[
                { name: "ravi@company.com", role: "Tenant Admin", status: "Invited" },
                { name: "priya@company.com", role: "Operator", status: "Invited" },
              ].map((user, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                  <div className="flex items-center gap-2"><Users className="w-4 h-4 text-primary" /><span className="text-sm text-foreground">{user.name}</span></div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{user.role}</Badge>
                    <Badge variant="outline" className="text-xs bg-warning/10 text-warning">{user.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setCurrentStep(Math.max(0, currentStep - 1))} disabled={currentStep === 0} className="gap-2">
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>
        {currentStep < onboardingSteps.length - 1 ? (
          <Button onClick={() => setCurrentStep(currentStep + 1)} className="gap-2 bg-destructive hover:bg-destructive/90">
            Next <ArrowRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button onClick={handleComplete} className="gap-2 bg-success hover:bg-success/90 text-primary-foreground">
            <CheckCircle className="w-4 h-4" /> Complete Onboarding
          </Button>
        )}
      </div>
    </div>
  );
};

export default Onboarding;
