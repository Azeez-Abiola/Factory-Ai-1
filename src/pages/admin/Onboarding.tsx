import { useState } from "react";
import { Building2, Camera, MapPin, Bell, Users, CheckCircle, ChevronRight, ChevronLeft, ArrowRight, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { onboardingSteps } from "@/data/extendedMockData";
import { toast } from "sonner";

const stepIcons = [Building2, Camera, MapPin, Bell, Users];

interface CameraEntry {
  id: string;
  name: string;
  rtspUrl: string;
  status: "connected" | "pending";
}

const defaultCameras: CameraEntry[] = [
  { id: "cam-1", name: "Main Entrance", rtspUrl: "rtsp://192.168.1.10/stream", status: "connected" },
  { id: "cam-2", name: "Assembly Line 1", rtspUrl: "rtsp://192.168.1.11/stream", status: "connected" },
  { id: "cam-3", name: "Packaging Hall", rtspUrl: "rtsp://192.168.1.12/stream", status: "connected" },
  { id: "cam-4", name: "QC Station", rtspUrl: "rtsp://192.168.1.13/stream", status: "connected" },
];

const Onboarding = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [cameras, setCameras] = useState<CameraEntry[]>(defaultCameras);
  const [addCameraOpen, setAddCameraOpen] = useState(false);
  const [newCameraName, setNewCameraName] = useState("");
  const [newCameraUrl, setNewCameraUrl] = useState("");

  const handleComplete = () => {
    toast.success("Tenant onboarding complete! The new factory is now active.", { duration: 4000 });
    setCurrentStep(0);
  };

  const handleAddCamera = () => {
    if (!newCameraName.trim() || !newCameraUrl.trim()) {
      toast.error("Please fill in both camera name and RTSP URL.");
      return;
    }
    const cam: CameraEntry = {
      id: `cam-${Date.now()}`,
      name: newCameraName.trim(),
      rtspUrl: newCameraUrl.trim(),
      status: "pending",
    };
    setCameras((prev) => [...prev, cam]);
    setNewCameraName("");
    setNewCameraUrl("");
    setAddCameraOpen(false);
    toast.success(`Camera "${cam.name}" added successfully`);
  };

  const handleRemoveCamera = (id: string) => {
    setCameras((prev) => prev.filter((c) => c.id !== id));
    toast.info("Camera removed");
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
                onClick={() => setCurrentStep(i)}
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
              {cameras.map((cam) => (
                <div key={cam.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border group">
                  <Camera className="w-5 h-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{cam.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{cam.rtspUrl}</p>
                  </div>
                  <Badge variant="outline" className={cn("text-xs shrink-0", cam.status === "connected" ? "bg-success/10 text-success" : "bg-warning/10 text-warning")}>
                    {cam.status === "connected" ? "Connected" : "Pending"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveCamera(cam.id)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setAddCameraOpen(true)}>
              <Plus className="w-4 h-4" /> Add Camera
            </Button>

            {/* Add Camera Dialog */}
            <Dialog open={addCameraOpen} onOpenChange={setAddCameraOpen}>
              <DialogContent className="bg-card border-border max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-foreground">Add New Camera</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Camera Name</Label>
                    <Input
                      placeholder="e.g., Warehouse Bay 2"
                      value={newCameraName}
                      onChange={(e) => setNewCameraName(e.target.value)}
                      className="bg-background border-border mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">RTSP URL</Label>
                    <Input
                      placeholder="rtsp://192.168.1.xx/stream"
                      value={newCameraUrl}
                      onChange={(e) => setNewCameraUrl(e.target.value)}
                      className="bg-background border-border mt-1"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setAddCameraOpen(false)}>Cancel</Button>
                    <Button onClick={handleAddCamera} className="gap-2">
                      <Camera className="w-4 h-4" /> Add Camera
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
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
