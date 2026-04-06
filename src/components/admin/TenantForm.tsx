import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Tenant, TenantPlan, TenantStatus } from "@/data/adminMockData";

const tenantSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  industry: z.string().trim().min(2, "Industry is required").max(100),
  region: z.string().trim().min(2, "Region is required").max(100),
  plan: z.enum(["starter", "professional", "enterprise"]),
  status: z.enum(["active", "trial", "suspended"]),
  cameras: z.coerce.number().int().min(0, "Must be 0 or more"),
  users: z.coerce.number().int().min(1, "At least 1 user"),
  zones: z.coerce.number().int().min(0, "Must be 0 or more"),
  mrr: z.coerce.number().min(0, "Must be 0 or more"),
  contactEmail: z.string().trim().email("Valid email required").max(255),
});

type TenantFormValues = z.infer<typeof tenantSchema>;

interface TenantFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant?: Tenant | null;
  parentTenant?: Tenant | null;
  onSubmit: (data: TenantFormValues & { id?: string; parentId?: string | null; parentName?: string | null }) => void;
}

const TenantForm = ({ open, onOpenChange, tenant, parentTenant, onSubmit }: TenantFormProps) => {
  const isEdit = !!tenant;
  const isSubTenant = !!parentTenant;

  const form = useForm<TenantFormValues>({
    resolver: zodResolver(tenantSchema),
    defaultValues: tenant
      ? {
          name: tenant.name,
          industry: tenant.industry,
          region: tenant.region,
          plan: tenant.plan,
          status: tenant.status,
          cameras: tenant.cameras,
          users: tenant.users,
          zones: tenant.zones,
          mrr: tenant.mrr,
          contactEmail: tenant.contactEmail,
        }
      : {
          name: "",
          industry: parentTenant?.industry ?? "",
          region: parentTenant?.region ?? "",
          plan: (parentTenant?.plan ?? "starter") as TenantPlan,
          status: "trial" as TenantStatus,
          cameras: 0,
          users: 1,
          zones: 0,
          mrr: 0,
          contactEmail: "",
        },
  });

  const handleSubmit = (values: TenantFormValues) => {
    onSubmit({
      ...values,
      id: tenant?.id,
      parentId: parentTenant?.id ?? tenant?.parentId ?? null,
      parentName: parentTenant?.name ?? tenant?.parentName ?? null,
    });
    onOpenChange(false);
    form.reset();
  };

  const title = isEdit
    ? "Edit Tenant"
    : isSubTenant
    ? `Add Sub-Tenant under ${parentTenant.name}`
    : "Add New Tenant";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">{title}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{isSubTenant ? "Sub-Tenant Name" : "Organization Name"}</FormLabel>
                  <FormControl>
                    <Input placeholder={isSubTenant ? "e.g., Unit 2 – Welding" : "Acme Manufacturing"} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Industry</FormLabel>
                    <FormControl>
                      <Input placeholder="Manufacturing" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="region"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Region</FormLabel>
                    <FormControl>
                      <Input placeholder="India – Maharashtra" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="plan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plan</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select plan" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="starter">Starter</SelectItem>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="enterprise">Enterprise</SelectItem>
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
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
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

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="cameras"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cameras</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="users"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Users</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="zones"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zones</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="mrr"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>MRR ($)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step={100} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contactEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="admin@company.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">
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
