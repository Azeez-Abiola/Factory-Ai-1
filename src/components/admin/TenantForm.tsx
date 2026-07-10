import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TenantRow } from "@/hooks/useTenants";

const tenantSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  slug: z.string().trim().min(2).max(60).regex(/^[a-z0-9-]+$/, "lowercase letters, digits, dashes"),
  industry: z.string().trim().max(100).optional().or(z.literal("")),
  plan: z.enum(["starter", "professional", "enterprise"]),
  status: z.enum(["active", "trial", "suspended"]),
  contact_email: z.string().trim().email("Valid email required").max(255).optional().or(z.literal("")),
  contact_phone: z.string().trim().max(50).optional().or(z.literal("")),
  address: z.string().trim().max(255).optional().or(z.literal("")),
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

  // Auto-slug from name when creating
  const nameValue = form.watch("name");
  useEffect(() => {
    if (!isEdit && nameValue && !form.getValues("slug")) {
      form.setValue("slug", slugify(nameValue));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameValue, isEdit]);

  const handleSubmit = async (values: TenantFormValues) => {
    await onSubmit({
      ...values,
      id: tenant?.id,
      parent_id: parentTenant?.id ?? tenant?.parent_id ?? null,
    });
    onOpenChange(false);
    form.reset();
  };

  const title = isEdit ? "Edit Tenant" : isSubTenant ? `Add Sub-Tenant under ${parentTenant!.name}` : "Add New Tenant";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-foreground">{title}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>{isSubTenant ? "Sub-Tenant Name" : "Organization"}</FormLabel>
                  <FormControl><Input placeholder="Acme Manufacturing" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>)} />
              <FormField control={form.control} name="slug" render={({ field }) => (
                <FormItem><FormLabel>Slug</FormLabel>
                  <FormControl><Input placeholder="acme-mfg" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>)} />
            </div>

            <FormField control={form.control} name="industry" render={({ field }) => (
              <FormItem><FormLabel>Industry</FormLabel>
                <FormControl><Input placeholder="Manufacturing" {...field} /></FormControl>
                <FormMessage />
              </FormItem>)} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="plan" render={({ field }) => (
                <FormItem><FormLabel>Plan</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem><FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select><FormMessage /></FormItem>)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="contact_email" render={({ field }) => (
                <FormItem><FormLabel>Contact Email</FormLabel>
                  <FormControl><Input type="email" placeholder="admin@company.com" {...field} /></FormControl>
                  <FormMessage /></FormItem>)} />
              <FormField control={form.control} name="contact_phone" render={({ field }) => (
                <FormItem><FormLabel>Contact Phone</FormLabel>
                  <FormControl><Input placeholder="+1 555 000 0000" {...field} /></FormControl>
                  <FormMessage /></FormItem>)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="timezone" render={({ field }) => (
                <FormItem><FormLabel>Timezone</FormLabel>
                  <FormControl><Input placeholder="UTC" {...field} /></FormControl>
                  <FormMessage /></FormItem>)} />
              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem><FormLabel>Address</FormLabel>
                  <FormControl><Input placeholder="City, Country" {...field} /></FormControl>
                  <FormMessage /></FormItem>)} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {isEdit ? "Save Changes" : isSubTenant ? "Create Sub-Tenant" : "Create Tenant"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default TenantForm;
