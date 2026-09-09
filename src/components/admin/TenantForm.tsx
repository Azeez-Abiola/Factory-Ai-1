import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import { Building2, Shield, Contact2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import AddressFields from "@/components/forms/AddressFields";
import type { TenantRow } from "@/hooks/useTenants";

const tenantSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  slug: z
    .string()
    .trim()
    .min(2, "Slug is required")
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, digits, and dashes only"),
  industry: z.string().trim().max(100).optional().or(z.literal("")),
  plan: z.enum(["starter", "professional", "enterprise"]),
  status: z.enum(["active", "trial", "suspended"]),
  contact_email: z.string().trim().email("Enter a valid email address").max(255).optional().or(z.literal("")),
  contact_phone: z
    .string()
    .trim()
    .max(50)
    .regex(/^$|^[+()\d\s-]{7,}$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  timezone: z.string().trim().max(64).optional().or(z.literal("")),
});

export type TenantFormValues = z.infer<typeof tenantSchema>;

interface TenantFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant?: TenantRow | null;
  parentTenant?: TenantRow | null;
  onSubmit: (data: TenantFormValues & { parent_id?: string | null; id?: string }) => Promise<void> | void;
}

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

// Common IANA timezones — kept short; users can still free-type via Input fallback.
const TIMEZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

const SectionHeader = ({ icon: Icon, title, hint }: { icon: React.ElementType; title: string; hint?: string }) => (
  <div className="flex items-start gap-2.5">
    <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
      <Icon className="h-3.5 w-3.5" />
    </div>
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  </div>
);

const TenantForm = ({ open, onOpenChange, tenant, parentTenant, onSubmit }: TenantFormProps) => {
  const isEdit = !!tenant;
  const isSubTenant = !!parentTenant;

  const form = useForm<TenantFormValues>({
    resolver: zodResolver(tenantSchema),
    defaultValues: tenant
      ? {
          name: tenant.name,
          slug: tenant.slug,
          industry: tenant.industry ?? "",
          plan: (tenant.plan as "starter" | "professional" | "enterprise") ?? "starter",
          status: (tenant.status as "active" | "trial" | "suspended") ?? "active",
          contact_email: tenant.contact_email ?? "",
          contact_phone: tenant.contact_phone ?? "",
          address: tenant.address ?? "",
          timezone: tenant.timezone ?? "UTC",
        }
      : {
          name: "",
          slug: "",
          industry: parentTenant?.industry ?? "",
          plan: (parentTenant?.plan as "starter" | "professional" | "enterprise") ?? "starter",
          status: "trial" as const,
          contact_email: "",
          contact_phone: "",
          address: "",
          timezone: parentTenant?.timezone ?? "UTC",
        },
  });

  const nameValue = form.watch("name");
  useEffect(() => {
    if (!isEdit && nameValue && !form.getValues("slug")) {
      form.setValue("slug", slugify(nameValue), { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameValue, isEdit]);

  const handleSubmit = async (values: TenantFormValues) => {
    await onSubmit({
      ...values,
      id: tenant?.id,
      parent_id: parentId,
    });
    onOpenChange(false);
    form.reset();
  };

  const title = isEdit
    ? "Edit Tenant"
    : isSubTenant
    ? `Add Sub-Tenant · ${parentTenant!.name}`
    : "Add New Tenant";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto bg-card">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-lg">{title}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update organization details. Changes are audit-logged."
              : "Provision an isolated workspace. You can invite members and configure cameras next."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Organization */}
            <section className="space-y-4">
              <SectionHeader icon={Building2} title="Organization" hint="Public identity of this tenant." />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required>{isSubTenant ? "Sub-Tenant Name" : "Organization Name"}</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Manufacturing" autoComplete="organization" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required>URL Slug</FormLabel>
                      <FormControl>
                        <Input placeholder="acme-mfg" {...field} />
                      </FormControl>
                      <FormDescription className="text-xs">Used in URLs. Lowercase, dashes only.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel optional>Industry</FormLabel>
                    <FormControl>
                      <Input placeholder="Manufacturing, Pharma, FMCG…" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            <Separator />

            {/* Plan & Status */}
            <section className="space-y-4">
              <SectionHeader icon={Shield} title="Plan & Access" hint="Determines quotas and default features." />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="plan"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required>Plan</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="starter">Starter · up to 5 cameras</SelectItem>
                          <SelectItem value="professional">Professional · up to 50 cameras</SelectItem>
                          <SelectItem value="enterprise">Enterprise · unlimited</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="trial">Trial</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <Separator />

            {/* Contact & Location */}
            <section className="space-y-4">
              <SectionHeader
                icon={Contact2}
                title="Contact & Location"
                hint="Primary contact for alerts, escalations, and compliance mail."
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="contact_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel optional>Contact Email</FormLabel>
                      <FormControl>
                        <Input type="email" inputMode="email" autoComplete="email" placeholder="ops@company.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contact_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel optional>Contact Phone</FormLabel>
                      <FormControl>
                        <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="+1 555 000 0000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel optional>Primary Timezone</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "UTC"}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select timezone" /></SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-64">
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-xs">
                      Used for scheduling shift reports and escalation windows.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <AddressFields
                        value={field.value}
                        onChange={(formatted) => field.onChange(formatted)}
                        description="Primary facility address. Used for compliance records and site tagging."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? "Saving…"
                  : isEdit
                  ? "Save Changes"
                  : isSubTenant
                  ? "Create Sub-Tenant"
                  : "Create Tenant"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default TenantForm;
