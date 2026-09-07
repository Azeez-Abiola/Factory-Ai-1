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
  /** Inspection areas — normalised 0..1 boxes the model must restrict itself to. */
  regions?: { id?: string; name?: string; x: number; y: number; w: number; h: number; categories?: string[] }[];
  /** Result of the caller's local (no-AI) reference-sample comparison. */
  referenceVerdict?: { label: "good" | "defect"; note?: string | null };
  /** Persist violations found in this clip/frame as alerts (rolling analysis). */
  raiseAlerts?: boolean;
  /** Still frame (data URL) stored as visual evidence when a clip is analysed. */
  evidenceImage?: string;

}

interface AnalysisShape {
  summary?: string;
  risk_score?: number;
  detections?: any[];
  safety_violations?: any[];
  recommended_actions?: string[];
}

const SEVERITY_SCORE: Record<string, number> = { low: 25, medium: 50, high: 75, critical: 95 };

/**
 * Turns violations found in a rolling clip (or overlay frame) into alerts,
 * respecting the camera's confidence threshold and a per-type cooldown.
 */
async function raiseAlerts(
  supabase: any,
  body: Body,
  analysis: AnalysisShape,
  media: "image" | "video",
): Promise<number> {
  const { data: cam } = await supabase
    .from("cameras")
    .select("id, tenant_id, name, zone, confidence_threshold, inference_interval_seconds, clip_seconds")
    .eq("id", body.cameraId)
    .eq("tenant_id", body.tenantId)
    .maybeSingle();
  if (!cam) return 0;

  const threshold = (cam.confidence_threshold ?? 70) / 100;
  const violations = Array.isArray(analysis.safety_violations) ? analysis.safety_violations : [];
  const detections = Array.isArray(analysis.detections) ? analysis.detections : [];
  if (!violations.length) return 0;

  const cooldownSeconds = Math.max((cam.inference_interval_seconds ?? 30) * 3, 300);
  const since = new Date(Date.now() - cooldownSeconds * 1000).toISOString();
  const { data: recent } = await supabase
    .from("alerts")
    .select("type")
    .eq("camera_id", cam.id)
    .gte("detected_at", since);
  const recentTypes = new Set((recent ?? []).map((r: any) => r.type));

  // Store the still frame that accompanies the clip as visual evidence.
  let evidencePath: string | null = null;
  const still = body.evidenceImage ?? (media === "image" ? body.imageUrl : undefined);
  const match = still?.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  if (match) {
    try {
      const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
      const ext = match[1] === "image/png" ? "png" : "jpg";
      const path = `${cam.tenant_id}/${cam.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("alert-evidence")
        .upload(path, bytes, { contentType: match[1], upsert: false });
      if (!error) evidencePath = path;
    } catch (_e) {
      evidencePath = null;
    }
  }

  const rows = violations
    .filter((v: any) => {
      const hit = detections.find((d: any) =>
        String(d?.label ?? "").toLowerCase().includes(String(v?.type ?? "").toLowerCase()));
      const conf = typeof hit?.confidence === "number" ? hit.confidence : 1;
      return conf >= threshold;
    })
    .map((v: any) => ({
      type: String(v?.type ?? "anomaly").toLowerCase().replace(/\s+/g, "_").slice(0, 60),
      tenant_id: cam.tenant_id,
      camera_id: cam.id,
      severity: ["low", "medium", "high", "critical"].includes(v?.severity) ? v.severity : "medium",
      title: String(v?.type ?? "Detected violation").slice(0, 140),
      description: String(v?.description ?? analysis.summary ?? "").slice(0, 1000),
      status: "open",
      zone: cam.zone,
      risk_score: typeof analysis.risk_score === "number"
        ? Math.round(analysis.risk_score)
        : SEVERITY_SCORE[String(v?.severity)] ?? 50,
      detected_at: new Date().toISOString(),
      metadata: {
        source: media === "video" ? "clip_analysis" : (body.source ?? "overlay"),
        media,
        clip_seconds: media === "video" ? cam.clip_seconds ?? null : null,
        camera: cam.name,
        summary: analysis.summary ?? null,
        detections,
        recommended_actions: analysis.recommended_actions ?? [],
        reference_verdict: body.referenceVerdict ?? null,
        scene_delta: typeof body.sceneDelta === "number" ? Number(body.sceneDelta.toFixed(3)) : null,
        ...(evidencePath ? { evidence_path: evidencePath } : {}),
      },
    }))
    .filter((r: any) => !recentTypes.has(r.type));

  if (!rows.length) return 0;
  const { error } = await supabase.from("alerts").insert(rows);
  if (error) {
    console.warn("alert insert failed", error.message);
    return 0;
  }
  return rows.length;
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


const SITE_PPE_MODEL_ID = "site/ppe-reference";
const SITE_PPE_BASE_MODEL = "google/gemini-2.5-pro";

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


    // Inspection areas keep the model focused on the part of the picture that
    // matters (a conveyor, a doorway) and stop it reporting background traffic.
    const regionText = (body.regions ?? []).length
      ? `Inspection areas (normalised x, y, width, height of the image — ONLY report detections whose centre falls inside one of these areas, ignore everything else):\n${
          body.regions!
            .map((r, i) =>
              `• ${r.name ?? `Area ${i + 1}`}: [${r.x.toFixed(2)}, ${r.y.toFixed(2)}, ${r.w.toFixed(2)}, ${r.h.toFixed(2)}]` +
              (r.categories?.length ? ` — watch for: ${r.categories.join(", ")}` : "")
            )
            .join("\n")
        }`
      : "";

    const verdictText = body.referenceVerdict
      ? `A local comparison against this site's own sample photos matched a ${
          body.referenceVerdict.label === "good" ? "KNOWN-GOOD" : "KNOWN-FAULTY"
        } example${body.referenceVerdict.note ? ` (${body.referenceVerdict.note})` : ""}. Use it as a strong prior, but judge the frame on its own evidence.`
      : "";

    const userText = [
      `Camera: ${body.cameraName ?? "Unknown"}`,
      `Zone: ${body.zone ?? "Unknown"}`,
      `Active categories: ${categories.map((c) => c.id).join(", ") || "all"}`,
      regionText,
      verdictText,
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
          ...exemplars.map((ex) => ({
            role: "user" as const,
            content: [
              { type: "text", text: `Site PPE reference — ${ex.caption}` },
              { type: "image_url", image_url: { url: ex.url } },
            ],
          })),
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

    // ---- Raise alerts from browser-side (rolling clip / overlay) analysis ---
    let alertsCreated = 0;
    if (body.raiseAlerts && body.tenantId && body.cameraId && supabase && analysis) {
      try {
        alertsCreated = await raiseAlerts(supabase, body, analysis as AnalysisShape, media);
      } catch (e) {
        console.warn("raiseAlerts failed", (e as Error).message);
      }
    }

    return new Response(JSON.stringify({ analysis, raw, model, media, site_model: siteModel, reference_images_used: exemplars.length, alerts_created: alertsCreated, categories: categories.map((c) => c.id) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("analyze-frame crash", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
