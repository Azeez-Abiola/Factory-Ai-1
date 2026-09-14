import { useCallback, useEffect, useState } from "react";
import { MapPinPlus, Loader2, RefreshCw, Send, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import PageHeader from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import { useTenants } from "@/hooks/useTenants";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const schema = z.object({
  site_name: z.string().trim().min(2, "Enter the site name").max(120),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  estimated_cameras: z.coerce.number().int().min(1, "At least one camera").max(500),
  expected_go_live: z.string().optional().or(z.literal("")),
  contact_email: z.string().trim().email("Enter a valid email").max(160).optional().or(z.literal("")),
  contact_phone: z.string().trim().max(40).optional().or(z.literal("")),
  justification: z.string().trim().max(2000).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

interface RequestRow {
  id: string;
  site_name: string;
  location: string | null;
  estimated_cameras: number;
  expected_go_live: string | null;
  justification: string | null;
  status: string;
  review_notes: string | null;
  created_at: string;
  requested_by: string | null;
}

const statusCls = (s: string) =>
  s === "approved" ? "bg-success/10 text-success border-success/20"
    : s === "declined" ? "bg-destructive/10 text-destructive border-destructive/20"
      : s === "in_review" ? "bg-primary/10 text-primary border-primary/20"
        : "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20";

const PortalSiteRequests = () => {
  const { activeTenant, activeTenantId, loading: tenantsLoading } = useTenants();
  const { user } = useAuth();
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      site_name: "", location: "", estimated_cameras: 4,
      expected_go_live: "", contact_email: "", contact_phone: "", justification: "",
    },
  });

  const load = useCallback(async () => {
    if (!activeTenantId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("site_requests")
      .select("*")
      .eq("tenant_id", activeTenantId)
      .order("created_at", { ascending: false });
    if (error) toast.error("Could not load your requests");
    setRows((data ?? []) as RequestRow[]);
    setLoading(false);
  }, [activeTenantId]);

  useEffect(() => { if (!tenantsLoading) load(); }, [tenantsLoading, load]);

  const onSubmit = async (values: FormValues) => {
    if (!activeTenantId || !user) return;
    setSubmitting(true);
    const { error } = await supabase.from("site_requests").insert({
      tenant_id: activeTenantId,
      requested_by: user.id,
      site_name: values.site_name,
      location: values.location || null,
      estimated_cameras: values.estimated_cameras,
      expected_go_live: values.expected_go_live || null,
      contact_email: values.contact_email || null,
      contact_phone: values.contact_phone || null,
      justification: values.justification || null,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Site request submitted for review");
    form.reset({
      site_name: "", location: "", estimated_cameras: 4,
      expected_go_live: "", contact_email: "", contact_phone: "", justification: "",
    });
    load();
  };

  const withdraw = async (id: string) => {
    const { error } = await supabase.from("site_requests").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Request withdrawn");
    load();
  };

  return (
    <>
      <PageHeader
        eyebrow="Manager portal"
        icon={MapPinPlus}
        title="Request a new site"
        description={`Ask your ${activeTenant?.name ?? "workspace"} administrators to set up another factory site. They review and provision it for you.`}
        actions={
          <Button variant="outline" onClick={load} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-2">
          <h2 className="font-display font-bold mb-4">New request</h2>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="site_name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Site name *</FormLabel>
                  <FormControl><Input placeholder="Ikeja Plant 2" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="location" render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl><Input placeholder="Ikeja, Lagos, Nigeria" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField control={form.control} name="estimated_cameras" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cameras *</FormLabel>
                    <FormControl><Input type="number" min={1} max={500} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="expected_go_live" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target go-live</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="contact_email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Site contact email</FormLabel>
                  <FormControl><Input type="email" placeholder="plant.manager@company.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="contact_phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Site contact phone</FormLabel>
                  <FormControl><Input placeholder="+234 800 000 0000" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="justification" render={({ field }) => (
                <FormItem>
                  <FormLabel>Why this site is needed</FormLabel>
                  <FormControl>
                    <Textarea rows={4} placeholder="Production line expansion, new packaging hall, compliance requirement…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" disabled={submitting || !activeTenantId} className="w-full gap-2">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Submit request
              </Button>
            </form>
          </Form>
        </Card>

        <Card className="p-5 lg:col-span-3">
          <h2 className="font-display font-bold mb-4">Your requests</h2>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-16 text-center">No site requests yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {rows.map((r) => (
                <div key={r.id} className="py-4 flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm">{r.site_name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {r.location ? `${r.location} · ` : ""}{r.estimated_cameras} cameras
                      {r.expected_go_live ? ` · target ${new Date(r.expected_go_live).toLocaleDateString()}` : ""}
                    </div>
                    {r.justification && (
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{r.justification}</p>
                    )}
                    {r.review_notes && (
                      <p className="text-xs mt-2 rounded-md bg-muted px-2.5 py-2">
                        <span className="font-semibold">Reviewer: </span>{r.review_notes}
                      </p>
                    )}
                    <div className="text-[11px] text-muted-foreground mt-1.5">
                      Submitted {new Date(r.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className={cn("capitalize", statusCls(r.status))}>
                      {r.status.replace("_", " ")}
                    </Badge>
                    {r.status === "pending" && r.requested_by === user?.id && (
                      <Button
                        variant="ghost" size="icon" aria-label="Withdraw request"
                        onClick={() => withdraw(r.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
};

export default PortalSiteRequests;
