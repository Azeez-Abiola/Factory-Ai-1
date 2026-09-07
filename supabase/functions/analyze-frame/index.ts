import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

interface Body {
  imageUrl?: string;      // https URL or data:image/...;base64,...
  videoUrl?: string;      // https URL or data:video/...;base64,... (short clip)
  cameraName?: string;
  zone?: string;
  aiModels?: string[];    // legacy — kept for backward compatibility
  categories?: string[];  // preferred — override active categories for this call
  context?: string;
  tenantId?: string;      // if provided, tenant-specific config is loaded
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

    if (body.tenantId) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        const { data } = await supabase
          .from("ai_analysis_config")
          .select("system_prompt, model, categories")
          .eq("tenant_id", body.tenantId)
          .maybeSingle();
        if (data) {
          if (data.system_prompt && data.system_prompt.trim().length > 20) systemPrompt = data.system_prompt;
          if (data.model) model = data.model;
          if (Array.isArray(data.categories) && data.categories.length) {
            categories = data.categories.filter((c: any) => c?.enabled !== false);
          }
        }
      } catch (e) {
        console.warn("failed to load tenant ai_analysis_config", (e as Error).message);
      }
    }

    // Category filter from request (subset of active ids)
    const filter = body.categories ?? body.aiModels;
    if (filter && filter.length) {
      categories = categories.filter((c) => filter.includes(c.id));
    }

    const finalSystemPrompt = buildSystemPrompt(systemPrompt, categories);

    const userText = [
      `Camera: ${body.cameraName ?? "Unknown"}`,
      `Zone: ${body.zone ?? "Unknown"}`,
      `Active categories: ${categories.map((c) => c.id).join(", ") || "all"}`,
      body.context ? `Additional context: ${body.context}` : "",
      body.videoUrl
        ? "This is a short video clip from the camera. Watch the full clip, account for motion and events over time, and return the JSON per schema summarising the whole clip."
        : "Analyze this frame and return the JSON per schema.",
    ].filter(Boolean).join("\n");

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

    return new Response(JSON.stringify({ analysis, raw, model, media: body.videoUrl ? "video" : "image", categories: categories.map((c) => c.id) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("analyze-frame crash", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
