import { useState } from "react";
import { Building2, Camera, MapPin, Bell, Users, CheckCircle, ChevronRight, ChevronLeft, ArrowRight, Plus, X, Rocket, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { onboardingSteps } from "@/data/extendedMockData";
import { toast } from "sonner";
import PageHeader from "@/components/app/PageHeader";
import FieldLabel from "@/components/forms/FieldLabel";
import AddressFields from "@/components/forms/AddressFields";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenants } from "@/hooks/useTenants";
import { auditLog } from "@/lib/audit";
import { useNavigate } from "react-router-dom";

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

const RTSP_RE = /^rtsp:\/\/[^\s]+$/i;

const Onboarding = () => {
  const { user } = useAuth();
  const { reload: reloadTenants, setActiveTenantId } = useTenants();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [cameras, setCameras] = useState<CameraEntry[]>(defaultCameras);
  const [addCameraOpen, setAddCameraOpen] = useState(false);
  const [newCameraName, setNewCameraName] = useState("");
  const [newCameraUrl, setNewCameraUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<{ email: string; role: string }[]>([]);

  // Org details
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [plan, setPlan] = useState("");
  const [address, setAddress] = useState("");

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("operator");

  const slugify = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || `tenant-${Date.now()}`;

  const handleComplete = async () => {
    if (!companyName.trim() || !industry || !plan) {
      toast.error("Complete Organization details (name, industry, plan) before finishing.");
      setCurrentStep(0);
      return;
    }
    if (!user?.id) {
      toast.error("You must be signed in to complete onboarding.");
      return;
    }
    setSubmitting(true);
    try {
      // 1. Create tenant
      const { data: tenant, error: tErr } = await supabase.from("tenants").insert({
        name: companyName.trim(),
        slug: slugify(companyName),
        industry,
        plan,
        status: "active",
        address: address || null,
        created_by: user.id,
      }).select().single();
      if (tErr || !tenant) throw tErr ?? new Error("Tenant creation failed");

      // 2. Add creator as owner
      await supabase.from("tenant_members").insert({
        tenant_id: tenant.id, user_id: user.id, role: "owner",
      });

      // 3. Cameras
      if (cameras.length) {
        await supabase.from("cameras").insert(cameras.map((c) => ({
          tenant_id: tenant.id,
          name: c.name,
          stream_url: c.rtspUrl,
          stream_type: "rtsp",
          status: "offline",
        })));
      }

      // 4. Invitations
      if (pendingInvites.length) {
        await supabase.from("tenant_invitations").insert(pendingInvites.map((i) => ({
          tenant_id: tenant.id, email: i.email, role: i.role, invited_by: user.id,
        })));
      }

      await auditLog({
        tenantId: tenant.id, action: "tenant.onboarded", entityType: "tenant", entityId: tenant.id,
        metadata: { cameras: cameras.length, invites: pendingInvites.length, plan, industry },
      });

      await reloadTenants();
      setActiveTenantId(tenant.id);
      toast.success(`${tenant.name} is live · ${cameras.length} cameras · ${pendingInvites.length} invites sent`, { duration: 4500 });
      setCurrentStep(0);
      setCompanyName(""); setIndustry(""); setPlan(""); setAddress("");
      setCameras(defaultCameras); setPendingInvites([]);
      navigate(`/admin/tenants/${tenant.id}`);
    } catch (e: any) {
      toast.error("Onboarding failed: " + (e?.message ?? "unknown error"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddCamera = () => {
    if (!newCameraName.trim()) {
      toast.error("Camera name is required");
      return;
    }
    if (!RTSP_RE.test(newCameraUrl.trim())) {
      toast.error("Enter a valid RTSP URL (e.g. rtsp://192.168.1.10/stream)");
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

  const handleInvite = () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email address");
      return;
    }
    if (pendingInvites.some((i) => i.email === email)) {
      toast.info("Already queued");
      return;
    }
    setPendingInvites((p) => [...p, { email, role: inviteRole }]);
    toast.success(`Invitation queued for ${email} as ${inviteRole}`);
    setInviteEmail("");
  };

  const removeQueuedInvite = (email: string) =>
    setPendingInvites((p) => p.filter((i) => i.email !== email));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Provisioning"
        icon={Rocket}
        title="Tenant Onboarding"
        description="Step-by-step wizard to set up a new factory — from org details to camera mapping."
      />

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
                  isActive
                    ? "bg-destructive/10 text-destructive border border-destructive/30"
                    : isDone
                    ? "bg-success/10 text-success"
                    : "bg-muted/50 text-muted-foreground",
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
          <div className="space-y-6 max-w-2xl">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Organization Details</h2>
              <p className="text-sm text-muted-foreground">Foundational information about the new tenant.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <FieldLabel required htmlFor="ob-company">Company Name</FieldLabel>
                <Input
                  id="ob-company"
                  autoComplete="organization"
                  placeholder="e.g. Tata Steel Works"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel required>Industry</FieldLabel>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manufacturing">Manufacturing</SelectItem>
                    <SelectItem value="fmcg">FMCG</SelectItem>
                    <SelectItem value="pharma">Pharmaceuticals</SelectItem>
                    <SelectItem value="automotive">Automotive</SelectItem>
                    <SelectItem value="electronics">Electronics</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <FieldLabel required hint="Determines quotas and default features.">Plan</FieldLabel>
                <Select value={plan} onValueChange={setPlan}>
                  <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter · up to 5 cameras</SelectItem>
                    <SelectItem value="professional">Professional · up to 50 cameras</SelectItem>
                    <SelectItem value="enterprise">Enterprise · unlimited</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <AddressFields
              value={address}
              onChange={setAddress}
              label="Facility Address"
              description="Primary site for this tenant. Used for compliance records and site tagging."
            />
          </div>
        )}

        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Add Cameras</h2>
              <p className="text-sm text-muted-foreground">Connect IP cameras to the platform. You can add more later.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-xl">
              {cameras.map((cam) => (
                <div key={cam.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border group">
                  <Camera className="w-5 h-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{cam.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{cam.rtspUrl}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs shrink-0",
                      cam.status === "connected"
                        ? "bg-success/10 text-success"
                        : "bg-warning/10 text-warning",
                    )}
                  >
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
                  <DialogTitle>Add New Camera</DialogTitle>
                  <DialogDescription>
                    Provide a friendly name and the RTSP stream URL from your camera.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <FieldLabel required htmlFor="cam-name">Camera Name</FieldLabel>
                    <Input
                      id="cam-name"
                      placeholder="e.g. Warehouse Bay 2"
                      value={newCameraName}
                      onChange={(e) => setNewCameraName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel required htmlFor="cam-url" hint="Format: rtsp://host[:port]/path">
                      RTSP URL
                    </FieldLabel>
                    <Input
                      id="cam-url"
                      placeholder="rtsp://192.168.1.10/stream"
                      value={newCameraUrl}
                      onChange={(e) => setNewCameraUrl(e.target.value)}
                      inputMode="url"
                      spellCheck={false}
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
            <div>
              <h2 className="text-lg font-semibold text-foreground">Define Factory Zones</h2>
              <p className="text-sm text-muted-foreground">Map your factory into logical zones for monitoring.</p>
            </div>
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
          <div className="space-y-4 max-w-xl">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Alert Thresholds</h2>
              <p className="text-sm text-muted-foreground">Configure detection sensitivity and alert rules.</p>
            </div>
            {[
              { label: "PPE Violation Detection", desc: "Trigger alert when PPE missing for" },
              { label: "Machine Idle Timeout", desc: "Alert if machine idle for" },
              { label: "Quality Defect Sensitivity", desc: "Minimum confidence threshold" },
              { label: "Restricted Zone Alert", desc: "Immediate alert on unauthorized entry" },
            ].map((rule, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                <div>
                  <p className="text-sm text-foreground">{rule.label}</p>
                  <p className="text-xs text-muted-foreground">{rule.desc}</p>
                </div>
                <Select defaultValue={i === 3 ? "instant" : "5min"}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instant">Instant</SelectItem>
                    <SelectItem value="2min">2 min</SelectItem>
                    <SelectItem value="5min">5 min</SelectItem>
                    <SelectItem value="10min">10 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-4 max-w-xl">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Invite Team Members</h2>
              <p className="text-sm text-muted-foreground">Add users and assign roles for this factory.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
              <div className="space-y-1">
                <FieldLabel htmlFor="ob-invite-email">Email</FieldLabel>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="ob-invite-email"
                    type="email"
                    autoComplete="email"
                    placeholder="teammate@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <FieldLabel>Role</FieldLabel>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tenant_admin">Tenant Admin</SelectItem>
                    <SelectItem value="operator">Operator</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <FieldLabel className="opacity-0">&nbsp;</FieldLabel>
                <Button variant="outline" onClick={handleInvite}>Invite</Button>
              </div>
            </div>
            <div className="space-y-2">
              {pendingInvites.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No invitations queued yet. Add teammates above — they'll be sent when you complete onboarding.</p>
              ) : pendingInvites.map((inv) => (
                <div key={inv.email} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="text-sm text-foreground">{inv.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs capitalize">{inv.role.replace("_", " ")}</Badge>
                    <Badge variant="outline" className="text-xs bg-warning/10 text-warning">Queued</Badge>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => removeQueuedInvite(inv.email)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0 || submitting}
          className="gap-2"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>
        {currentStep < onboardingSteps.length - 1 ? (
          <Button onClick={() => setCurrentStep(currentStep + 1)} className="gap-2 bg-destructive hover:bg-destructive/90">
            Next <ArrowRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button onClick={handleComplete} disabled={submitting} className="gap-2 bg-success hover:bg-success/90 text-primary-foreground">
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Provisioning…</> : <><CheckCircle className="w-4 h-4" /> Complete Onboarding</>}
          </Button>
        )}
      </div>
    </div>
  );
};

export default Onboarding;
