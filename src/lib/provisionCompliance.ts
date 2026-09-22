import { supabase } from "@/integrations/supabase/client";
import { mergeWithDefaults, normaliseCategories } from "@/lib/detectionCategories";
import {
  POLICY_TEMPLATES,
  STARTER_PACKS,
  packForIndustry,
  type StarterPack,
} from "@/data/policyTemplates";

export interface ProvisionResult {
  pack: StarterPack;
  policiesCreated: number;
  policiesSkipped: number;
  categoriesCreated: number;
  escalationCreated: boolean;
  notificationsCreated: boolean;
  errors: string[];
}

/**
 * Provisions a tenant with a compliant baseline: detection policies from the
 * industry starter pack, matching AI detection categories, an escalation
 * policy and notification defaults. Safe to re-run — existing policies with
 * the same name are skipped and existing config rows are left untouched.
 */
export async function provisionTenantCompliance(
  tenantId: string,
  options: { industry?: string | null; packId?: string; adminEmail?: string | null } = {},
): Promise<ProvisionResult> {
  const pack =
    (options.packId ? STARTER_PACKS.find((p) => p.id === options.packId) : undefined) ??
    packForIndustry(options.industry);

  const result: ProvisionResult = {
    pack,
    policiesCreated: 0,
    policiesSkipped: 0,
    categoriesCreated: 0,
    escalationCreated: false,
    notificationsCreated: false,
    errors: [],
  };

  const templates = pack.templateIds
    .map((id) => POLICY_TEMPLATES.find((t) => t.id === id))
    .filter((t): t is (typeof POLICY_TEMPLATES)[number] => Boolean(t));

  // 1. Policies — skip anything already present for this tenant.
  const { data: existing, error: exErr } = await supabase
    .from("policies")
    .select("name")
    .eq("tenant_id", tenantId);
  if (exErr) result.errors.push(`Read policies: ${exErr.message}`);

  const existingNames = new Set((existing ?? []).map((p) => p.name.toLowerCase()));
  const toInsert = templates.filter((t) => !existingNames.has(t.name.toLowerCase()));
  result.policiesSkipped = templates.length - toInsert.length;

  if (toInsert.length) {
    const { error } = await supabase.from("policies").insert(
      toInsert.map((t) => ({
        tenant_id: tenantId,
        name: t.name,
        description: t.description,
        category: t.category,
        severity: t.severity,
        natural_language: t.natural_language,
        scope_zones: t.scope_zones?.length ? t.scope_zones : ["All zones"],
        scope_cameras: [],
        enabled: true,
      })),
    );
    if (error) result.errors.push(`Create policies: ${error.message}`);
    else result.policiesCreated = toInsert.length;
  }

  // 2. AI detection categories for this tenant.
  const { data: cfg } = await supabase
    .from("ai_analysis_config")
    .select("id, categories")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  // Always store the full object shape — plain id strings break the category
  // editor and the analyser prompt.
  const current = normaliseCategories(cfg?.categories);
  const merged = mergeWithDefaults([
    ...current,
    ...normaliseCategories(pack.categories as unknown),
  ]);
  if (merged.length !== current.length) {
    const payload = merged as unknown as never;
    const { error } = cfg
      ? await supabase.from("ai_analysis_config").update({ categories: payload }).eq("id", cfg.id)
      : await supabase.from("ai_analysis_config").insert({ tenant_id: tenantId, categories: payload });
    if (error) result.errors.push(`Detection categories: ${error.message}`);
    else result.categoriesCreated = merged.length - current.length;
  }

  // 3. Escalation policy.
  const { data: esc } = await supabase
    .from("escalation_policies")
    .select("id")
    .eq("tenant_id", tenantId)
    .limit(1);
  if (!esc?.length) {
    const { error } = await supabase.from("escalation_policies").insert({
      tenant_id: tenantId,
      name: `${pack.label} escalation`,
      timeout_minutes: pack.escalationMinutes,
      is_active: true,
      supervisor_ids: [],
    });
    if (error) result.errors.push(`Escalation policy: ${error.message}`);
    else result.escalationCreated = true;
  }

  // 4. Notification defaults.
  const { data: prefs } = await supabase
    .from("tenant_notification_prefs")
    .select("tenant_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!prefs) {
    const { error } = await supabase.from("tenant_notification_prefs").insert({
      tenant_id: tenantId,
      email_enabled: true,
      email_recipients: options.adminEmail ? [options.adminEmail] : [],
      sms_enabled: false,
      sms_recipients: [],
      min_severity: pack.minSeverity,
      notify_on_escalation: true,
    });
    if (error) result.errors.push(`Notification defaults: ${error.message}`);
    else result.notificationsCreated = true;
  }

  return result;
}
