import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getBudgetState, recordUsage } from "../_shared/aiBudget.ts";

interface Body {
  imageUrl?: string;      // https URL or data:image/...;base64,...
  videoUrl?: string;      // https URL or data:video/...;base64,... (short clip)
  cameraName?: string;
  zone?: string;
  aiModels?: string[];    // legacy — kept for backward compatibility
  categories?: string[];  // preferred — override active categories for this call
  context?: string;
  tenantId?: string;      // if provided, tenant-specific config is loaded
  cameraId?: string;      // metered against the tenant AI budget
  source?: string;        // live_inference | overlay | manual | insights
  sceneChanged?: boolean; // false when the caller's frame gating saw no change
  sceneDelta?: number;
}

const DEFAULT_CATEGORIES = [
  { id: "ppe",          label: "PPE Compliance",       description: "hard hats, hi-vis vests, gloves, goggles, hearing/respiratory protection" },
  { id: "intrusion",    label: "Restricted Zone Entry",description: "unauthorized personnel in cordoned or hazardous areas" },
  { id: "downtime",     label: "Machine Downtime",     description: "idle machinery, stalled lines, missing operators at stations" },
  { id: "ergonomics",   label: "Ergonomic Risk",       description: "unsafe lifts, awkward postures, repetitive strain indicators" },
  { id: "quality",      label: "Quality / Defect",     description: "visible defects, misalignment, damaged product, packaging errors" },
  { id: "housekeeping", label: "Housekeeping",         description: "spills, obstructions, blocked exits, poor 5S" },
  { id: "forklift",     label: "Forklift / Pedestrian",description: "pedestrian in forklift zone, no spotter, unsafe speed" },
];

const DEFAULT_SYSTEM_PROMPT = `You are an industrial vision safety analyst for a factory floor monitoring platform.
Analyze the provided camera frame and return a STRICT JSON object with this schema:
{
  "summary": string,
  "risk_score": number,
  "severity": "low"|"medium"|"high"|"critical",
  "detections": [ {
      "label": string,
      "category": "ppe"|"intrusion"|"downtime"|"ergonomics"|"quality"|"housekeeping"|"forklift"|"other",
      "severity": "low"|"medium"|"high"|"critical",
      "confidence": number,
      "bbox": [x, y, width, height],
      "bbox_hint": string
  } ],
  "safety_violations": [ { "type": string, "description": string, "severity": "low"|"medium"|"high"|"critical" } ],
  "productivity_notes": string[],
  "recommended_actions": string[]
}
"bbox" is REQUIRED for every detection and must be normalised to the image size as fractions between 0 and 1:
x = left edge, y = top edge, width and height are the box size (x + width <= 1, y + height <= 1).
Draw one box per distinct person, vehicle, machine or hazard you flag — boxes must tightly enclose the subject.
Return ONLY the JSON object — no markdown, no prose.`;


const BBOX_CONTRACT = `Every detection MUST include "category" (one of ppe, intrusion, downtime, ergonomics, quality, housekeeping, forklift, other), "severity", "confidence" (0-1) and "bbox": [x, y, width, height] normalised to the image as fractions between 0 and 1 (x/y = top-left corner). One tight box per distinct subject you flag.`;

function buildSystemPrompt(base: string, categories: { id: string; label: string; description: string }[]) {
  const focus = categories.length
    ? `\n\nActive detection categories (focus your attention here):\n${categories.map((c) => `• ${c.label}: ${c.description}`).join("\n")}`
    : "";
  return `${base}${focus}\n\n${BBOX_CONTRACT}`;
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Body;
    if (!body.imageUrl && !body.videoUrl) {
      return new Response(JSON.stringify({ error: "imageUrl or videoUrl is required (https URL or data URL)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load tenant-specific configuration if a tenantId was provided.
    let systemPrompt = DEFAULT_SYSTEM_PROMPT;
    let model = "google/gemini-2.5-pro";
    let categories = DEFAULT_CATEGORIES;
    let referenceImages: { path: string; label?: string; kind?: string; note?: string }[] = [];
    let siteModel = false;

    const supabase = body.tenantId
      ? createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
      : null;

    if (body.tenantId && supabase) {
      try {
        const { data } = await supabase
          .from("ai_analysis_config")
          .select("system_prompt, model, categories, reference_images")
          .eq("tenant_id", body.tenantId)
          .maybeSingle();
        if (data) {
          if (data.system_prompt && data.system_prompt.trim().length > 20) systemPrompt = data.system_prompt;
          if (data.model) model = data.model;
          if (Array.isArray(data.categories) && data.categories.length) {
            categories = data.categories.filter((c: any) => c?.enabled !== false);
          }
          if (Array.isArray((data as any).reference_images)) {
            referenceImages = (data as any).reference_images.filter((r: any) => r?.path);
          }
        }
      } catch (e) {
        console.warn("failed to load tenant ai_analysis_config", (e as Error).message);
      }
    }

    // "Site PPE model" = the tenant's own labelled PPE photos used as visual
    // exemplars on top of the base vision model.
    if (model === SITE_PPE_MODEL_ID) {
      siteModel = true;
      model = SITE_PPE_BASE_MODEL;
    }

    // Category filter from request (subset of active ids)
    const filter = body.categories ?? body.aiModels;
    if (filter && filter.length) {
      categories = categories.filter((c) => filter.includes(c.id));
    }

    // Sign the tenant's reference photos so the model can see them.
    const exemplars: { url: string; caption: string }[] = [];
    if (siteModel && supabase && referenceImages.length) {
      for (const ref of referenceImages.slice(0, 8)) {
        const { data: signed } = await supabase.storage
          .from("ppe-reference")
          .createSignedUrl(ref.path, 600);
        if (signed?.signedUrl) {
          const kind = ref.kind === "violation" ? "NON-COMPLIANT example" : "COMPLIANT example";
          exemplars.push({
            url: signed.signedUrl,
            caption: `${kind}: ${ref.label ?? "site PPE reference"}${ref.note ? ` — ${ref.note}` : ""}`,
          });
        }
      }
    }

    let finalSystemPrompt = buildSystemPrompt(systemPrompt, categories);
    if (exemplars.length) {
      finalSystemPrompt += `\n\nThis site has provided ${exemplars.length} of its OWN labelled PPE reference photos, supplied before the live frame. Treat them as the ground truth for what correct and incorrect PPE looks like at this factory (uniform colour, helmet style, vest type, local rules). Judge the live frame against these examples rather than generic PPE assumptions, and never report the reference photos themselves as detections.`;
    }


    const userText = [
      `Camera: ${body.cameraName ?? "Unknown"}`,
      `Zone: ${body.zone ?? "Unknown"}`,
      `Active categories: ${categories.map((c) => c.id).join(", ") || "all"}`,
      body.context ? `Additional context: ${body.context}` : "",
      body.videoUrl
        ? "This is a short video clip from the camera. Watch the full clip, account for motion and events over time, and return the JSON per schema summarising the whole clip."
        : "Analyze this frame and return the JSON per schema.",
    ].filter(Boolean).join("\n");

    // ---- Tenant AI budget guard -------------------------------------------
    let budget = null;
    if (body.tenantId && supabase) {
      budget = await getBudgetState(supabase, body.tenantId);
      if (budget.blocked) {
        return new Response(JSON.stringify({
          error: "ai_budget_exceeded",
          message: `This site has reached its monthly AI analysis budget ($${budget.limit.toFixed(2)}). Raise the budget in Admin → AI Budget to resume analysis.`,
          budget: { spend_usd: Number(budget.spend.toFixed(4)), limit_usd: budget.limit, pct_used: Number(budget.pctUsed.toFixed(2)) },
        }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const gwRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: finalSystemPrompt },
          { role: "user", content: [
            { type: "text", text: userText },
            body.videoUrl
              ? { type: "video_url", video_url: { url: body.videoUrl } }
              : { type: "image_url", image_url: { url: body.imageUrl } },
          ]},
        ],
      }),
    });

    if (!gwRes.ok) {
      const errText = await gwRes.text();
      console.error("AI gateway error", gwRes.status, errText);
      return new Response(JSON.stringify({ error: "AI gateway failed", status: gwRes.status, details: errText }), {
        status: gwRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await gwRes.json();
    const raw: string = payload?.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

    let analysis: unknown = null;
    try { analysis = JSON.parse(cleaned); }
    catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) { try { analysis = JSON.parse(match[0]); } catch { /* noop */ } }
    }

    const media = body.videoUrl ? "video" as const : "image" as const;
    if (body.tenantId && supabase) {
      // Only analysed (changed) frames are metered — gated frames never reach here.
      await recordUsage(supabase, {
        tenantId: body.tenantId,
        cameraId: body.cameraId ?? null,
        source: body.source ?? "manual",
        model,
        media,
        sceneChanged: body.sceneChanged !== false,
        sceneDelta: typeof body.sceneDelta === "number" ? body.sceneDelta : null,
        metadata: { camera: body.cameraName ?? null, zone: body.zone ?? null },
      }, budget ?? undefined);
    }

    return new Response(JSON.stringify({ analysis, raw, model, media, categories: categories.map((c) => c.id) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("analyze-frame crash", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
