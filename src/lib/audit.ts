import { supabase } from "@/integrations/supabase/client";

export interface AuditEntry {
  tenantId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

/** Append an entry to the append-only audit log. Silent no-op on failure. */
export async function auditLog(entry: AuditEntry) {
  const { data: userRes } = await supabase.auth.getUser();
  const actor_id = userRes.user?.id;
  if (!actor_id) return;
  const { error } = await supabase.from("audit_log").insert({
    actor_id,
    tenant_id: entry.tenantId ?? null,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    metadata: entry.metadata ?? {},
  });
  if (error) console.warn("audit_log insert failed", error.message);
}
