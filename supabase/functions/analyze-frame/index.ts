import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getBudgetState, recordUsage } from "../_shared/aiBudget.ts";
import { loadGateRules, gateViolation, effectiveCooldown } from "../_shared/alertGating.ts";
import { GEMINI_CHAT_URL, geminiHeaders, getGeminiKey, toGeminiModel } from "../_shared/ai.ts";
import { normaliseDetections, detectionsForViolation } from "../_shared/bbox.ts";
import { upscaleDataUrl } from "../_shared/upscale.ts";

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

  // Site alert rules layer their own confidence bar and cooldown on the camera's.
  const gateRules = await loadGateRules(supabase, cam.tenant_id);
  const decisions = new Map<any, ReturnType<typeof gateViolation>>();
  for (const v of violations) decisions.set(v, gateViolation(v, detections, threshold, gateRules));

  const cooldownSeconds = effectiveCooldown(gateRules, Math.max((cam.inference_interval_seconds ?? 30) * 3, 300));

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
    .filter((v: any) => decisions.get(v)!.pass)

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
        detections: detectionsForViolation(v, detections),
        all_detections: detections,
        recommended_actions: analysis.recommended_actions ?? [],
        reference_verdict: body.referenceVerdict ?? null,
        scene_delta: typeof body.sceneDelta === "number" ? Number(body.sceneDelta.toFixed(3)) : null,
        confidence_gate: decisions.get(v) ?? null,
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
  { id: "ppe",          label: "PPE Compliance",       description: "missing or incorrectly worn hard hats, hi-vis vests, gloves, goggles, hearing or respiratory protection — flag the person missing the item, not people who are fully compliant" },
  { id: "intrusion",    label: "Restricted Zone Entry",description: "people inside cordoned, guarded or hazardous areas; reaching into a running machine; bypassed guarding or interlocks" },
  { id: "downtime",     label: "Machine Downtime",     description: "idle or stalled line, product backing up on a conveyor, station left unmanned while running" },
  { id: "ergonomics",   label: "Ergonomic Risk",       description: "bending at the waist, twisting under load, overhead or two-handed heavy lifts, repeated strain at one station — report the station once, not every repetition" },
  { id: "quality",      label: "Quality / Defect",     description: "visible product or packaging defects: crushed, torn, leaking, mislabelled, open flaps, misaligned or missing items on the line" },
  { id: "housekeeping", label: "Housekeeping",         description: "spills, debris, trailing cables, stock stacked in walkways, blocked exits, extinguishers or panels obstructed" },
  { id: "forklift",     label: "Forklift / Pedestrian",description: "forklift and pedestrian sharing an unsegregated path, no spotter, raised load in motion, unsafe speed or reversing without visibility" },
  { id: "security",     label: "Security & Theft Control", description: "visible events or conditions suggesting unauthorized access, removal, concealment or movement of company assets: unauthorized persons in restricted areas; materials removed from designated locations; a person carrying materials away from the expected workflow; products, tools or equipment being concealed (under clothing, in bags, behind other stock); unusual movement of inventory or transfers with no obvious operational context; unauthorized access to stores, warehouses, offices, production or controlled zones; tampering with equipment, storage, locks, doors or security barriers; loitering around inventory or high-value assets; unusual after-hours activity where the timestamp or context shows it; vehicles or persons interacting with materials in an apparently abnormal manner" },
];


const DEFAULT_SYSTEM_PROMPT = `You are an industrial vision analyst for a factory floor monitoring platform.
You are responsible for EVERY active detection category listed below — not only the obvious hazard in the picture.

METHOD (follow in order, silently):
1. Describe the scene to yourself: area type, people, machines, vehicles, materials, lighting, time-of-day cues.
2. Sweep the frame category by category, in the order the active categories are listed. For each one, decide explicitly: is there evidence for it here, yes or no? Never skip a category because another one already produced a finding.
3. Only then write the JSON. A single frame may legitimately produce findings in several categories at once, or none at all.

EVIDENCE RULES — a false finding is worse than a missed one:
- Report only objects you can actually SEE in this frame. Never infer from context, from what a camera like this usually shows, or from what "should" be there. Do not name an object type (chair, box, spill, tool) unless its shape is clearly distinguishable — if you can only tell that "something" is there, do not report it.
- Before you list any detection, state to yourself the pixels that prove it: its outline, colour and where it sits relative to a fixed landmark. If you cannot do that, drop it.
- CCTV frames are often low-resolution, compressed, dark or back-lit. In those conditions distant blobs, shadows, wall stains, reflections, railings and parked objects are NOT findings. When the frame is too poor to judge a category, say so in "summary" and report nothing for it.
- One entry per distinct subject or event. Do not repeat the same person, machine or defect across multiple detections, and do not emit one detection per video frame — summarise the whole clip once.
- "confidence" is calibrated 0-1 and must reflect image quality as well as certainty: ≥0.85 only when the object is unmistakable at this resolution, 0.6-0.85 likely, <0.6 uncertain. Do not report anything below 0.6 on a low-quality frame.
- Every safety_violation must correspond to at least one detection of the same category, so the operator can see where it is.
- A clean frame is the most common correct answer: return empty "detections" and "safety_violations" arrays, a short summary and a low risk_score. You are never rewarded for finding something — only for being right.

SEVERITY:
- low = housekeeping or minor deviation, no injury or loss pathway.
- medium = policy breach with plausible harm or loss if repeated.
- high = imminent injury, significant product loss, or asset removal in progress.
- critical = life-threatening exposure, fire/chemical/electrical emergency, or major theft/unauthorised access.
"risk_score" must be the highest-severity finding in the frame and must agree with the "severity" band.

Return a STRICT JSON object with this schema:
{
  "summary": string,     // 1-2 sentences: what is happening and what matters
  "risk_score": number,  // integer 0-100 (low 1-30, medium 31-60, high 61-85, critical 86-100) — must agree with "severity"
  "severity": "low"|"medium"|"high"|"critical",
  "detections": [ {
      "label": string,
      "category": "ppe"|"intrusion"|"downtime"|"ergonomics"|"quality"|"housekeeping"|"forklift"|"security"|"other",
      "severity": "low"|"medium"|"high"|"critical",
      "confidence": number,
      "box_2d": [ymin, xmin, ymax, xmax],
      "bbox_hint": string
  } ],
  "safety_violations": [ { "type": string, "category": string, "description": string, "severity": "low"|"medium"|"high"|"critical" } ],
  "productivity_notes": string[],
  "recommended_actions": string[]
}
LOCALISATION — this is graded as strictly as the finding itself:
- "box_2d" uses your standard 2D grounding convention: [ymin, xmin, ymax, xmax] as INTEGERS on a 0-1000 grid, measured against the FULL frame supplied (top-left = 0,0; bottom-right = 1000,1000).
- The box must tightly enclose the subject you are describing — nothing else. Before answering, re-read the frame at those coordinates and confirm the subject is actually inside them; correct the numbers if it is not.
- Never output a box over empty floor, sky or wall. If you cannot place the subject confidently, set "box_2d": null and explain the location in words in "bbox_hint" — an honest missing box is correct, an invented one is a failure.
- One box per distinct person, vehicle, machine, product or hazard. Do not reuse a box for a second subject.
- Each safety_violation carries the "category" of the detection that shows it, so the operator sees the right box.
"recommended_actions" are concrete, shift-level instructions ("stop line 3 and clear the spill at the palletiser"), never generic advice.
Return ONLY the JSON object — no markdown, no prose.`;


const SITE_PPE_MODEL_ID = "site/ppe-reference";
const SITE_PPE_BASE_MODEL = "google/gemini-2.5-pro";

const BBOX_CONTRACT = `Every detection MUST include "category" (one of ppe, intrusion, downtime, ergonomics, quality, housekeeping, forklift, security, other), "severity", "confidence" (0-1) and "box_2d": [ymin, xmin, ymax, xmax] as integers on a 0-1000 grid measured against the FULL frame (top-left = 0,0, bottom-right = 1000,1000). The box must tightly enclose the subject — verify it before answering, and use "box_2d": null with a written location in "bbox_hint" when you cannot place the subject confidently. Never output a box over empty floor, sky or wall, and never reuse one box for two subjects.`;

function buildSystemPrompt(base: string, categories: { id: string; label: string; description: string; severity_hint?: string }[]) {
  const focus = categories.length
    ? `\n\nACTIVE DETECTION CATEGORIES — check the frame against EVERY one of these, in this order, before answering. Use the exact id in the "category" field:\n${categories
        .map((c, i) => `${i + 1}. ${c.id} — ${c.label}: ${c.description}${(c as any).severity_hint ? ` [default severity: ${(c as any).severity_hint}]` : ""}`)
        .join("\n")}\n\nCoverage rule: these ${categories.length} categories are the complete scope for this site. Anything outside them is not reported. Anything inside them is reported even when a different category already yielded a more serious finding. Findings that fit none of the listed categories use "other" and are described plainly.`
    : "";
  return `${base}${focus}\n\n${BBOX_CONTRACT}`;
}

/**
 * Verification pass: shows the same frame back with the findings the first pass
 * produced and keeps only the ones the model can confirm at the coordinates it
 * gave. Cheap insurance against hallucinated objects on grainy CCTV frames —
 * runs only when the first pass actually reported something.
 */
async function verifyFindings(
  analysis: any,
  opts: { key: string; model: string; content: Record<string, unknown> },
): Promise<void> {
  if (!analysis || typeof analysis !== "object") return;
  const detections: any[] = Array.isArray(analysis.detections) ? analysis.detections : [];
  const violations: any[] = Array.isArray(analysis.safety_violations) ? analysis.safety_violations : [];
  if (!detections.length && !violations.length) return;

  const claims = detections.map((d, i) => {
    const b = Array.isArray(d?.box_2d) ? d.box_2d.join(", ") : "no box";
    return `${i}. "${d?.label}" (${d?.category}) at box_2d [${b}] — ${d?.bbox_hint ?? ""}`;
  }).join("\n");

  const verifyPrompt = `You are auditing another analyst's report on this CCTV frame. Be sceptical: their job was to spot problems, yours is to throw out anything that is not really there.
For each numbered claim, look at the frame at the given coordinates (box_2d is [ymin, xmin, ymax, xmax] on a 0-1000 grid over the full frame) and decide:
- keep it ONLY if the named object is clearly visible AND actually inside those coordinates;
- reject it if the region is empty floor/wall/sky, if the object is a shadow, stain, reflection, railing or indistinct blob, or if the object is real but the box is in the wrong place;
- reject it if the frame is too dark, small or compressed for you to confirm the object type by its shape.
Claims:
${claims}

For every claim you keep, re-draw the box yourself from scratch by looking at the frame — do not copy their numbers unless they are already tight around the object.
Return ONLY strict JSON:
{"findings": [ { "index": number, "box_2d": [ymin, xmin, ymax, xmax] } ], "reason": "one short sentence"}
List only the claims you confirm; omit the rest. An empty "findings" list is a perfectly good answer.`;

  const res = await fetch(GEMINI_CHAT_URL, {
    method: "POST",
    headers: geminiHeaders(opts.key),
    body: JSON.stringify({
      model: toGeminiModel(opts.model),
      messages: [
        { role: "system", content: "You verify industrial vision findings against the image. You reject anything you cannot see with certainty. Answer with JSON only." },
        { role: "user", content: [{ type: "text", text: verifyPrompt }, opts.content] },
      ],
    }),
  });
  if (!res.ok) return; // never let verification break a successful analysis

  const raw: string = (await res.json())?.choices?.[0]?.message?.content ?? "";
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  let verdict: any = null;
  try { verdict = JSON.parse(cleaned); } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) { try { verdict = JSON.parse(m[0]); } catch { /* noop */ } }
  }
  const findings: any[] = Array.isArray(verdict?.findings)
    ? verdict.findings
    : Array.isArray(verdict?.keep)
      ? verdict.keep.map((n: unknown) => ({ index: n })) // tolerate the simpler shape
      : [];
  if (!verdict || (!Array.isArray(verdict.findings) && !Array.isArray(verdict.keep))) return;

  const corrections = new Map<number, unknown>();
  for (const f of findings) {
    const i = Number(f?.index);
    if (Number.isInteger(i)) corrections.set(i, f?.box_2d);
  }

  const kept = detections.filter((_d, i) => corrections.has(i));
  // The second look re-draws each box; keep the first pass's box only if the
  // re-drawn one is unusable.
  detections.forEach((d, i) => {
    const fresh = corrections.get(i);
    if (fresh) d.box_2d = fresh;
  });
  const dropped = detections.length - kept.length;
  analysis.detections = kept;
  normaliseDetections(analysis);

  // A violation with no surviving evidence is dropped with it.
  const keptCategories = new Set(kept.map((d) => String(d?.category ?? "").toLowerCase()));
  analysis.safety_violations = violations.filter((v) => {
    const cat = String(v?.category ?? "").toLowerCase();
    if (!kept.length) return false;
    return !cat || keptCategories.has(cat);
  });

  analysis.verification = {
    checked: detections.length,
    kept: kept.length,
    dropped,
    reason: typeof verdict.reason === "string" ? verdict.reason.slice(0, 300) : null,
  };

  if (!analysis.safety_violations.length && !kept.length) {
    analysis.severity = "low";
    analysis.risk_score = Math.min(Number(analysis.risk_score) || 10, 20);
    if (dropped > 0) {
      analysis.summary = `No confirmed findings in this frame${
        verdict.reason ? ` — ${String(verdict.reason).slice(0, 200)}` : ""
      }`;
    }
  }
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const key = getGeminiKey();
    if (!key) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured" }), {
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
    let defectTypes: { label: string; description?: string; severity_hint?: string }[] = [];

    const supabase = body.tenantId
      ? createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
      : null;

    if (body.tenantId && supabase) {
      const authHeader = req.headers.get("Authorization") ?? "";
      const jwt = authHeader.replace(/^Bearer\s+/i, "");
      const isServiceRole = jwt === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!isServiceRole) {
        if (!jwt) {
          return new Response(JSON.stringify({ error: "Authentication required" }), {
            status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: userData } = await supabase.auth.getUser(jwt);
        const userId = userData?.user?.id;
        if (!userId) {
          return new Response(JSON.stringify({ error: "Authentication required" }), {
            status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const [{ data: member }, { data: superAdmin }] = await Promise.all([
          supabase.rpc("is_tenant_member", { _tenant_id: body.tenantId, _user_id: userId }),
          supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" }),
        ]);
        if (!member && !superAdmin) {
          return new Response(JSON.stringify({ error: "You do not have access to this site" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      try {
        const { data } = await supabase
          .from("ai_analysis_config")
          .select("system_prompt, model, categories, reference_images, defect_types")
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
          if (Array.isArray((data as any).defect_types)) {
            defectTypes = (data as any).defect_types.filter((d: any) => d?.label && d?.enabled !== false);
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
    if (defectTypes.length) {
      finalSystemPrompt += `\n\nProduct defect types this site inspects for (use these exact labels when reporting a quality issue):\n${defectTypes
        .map((d: any) => `• ${d.label}${d.description ? `: ${d.description}` : ""}${d.severity_hint ? ` [default severity: ${d.severity_hint}]` : ""}`)
        .join("\n")}`;
    }
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

    // Small recorder snapshots get upscaled first — the model localises much
    // better on a larger frame, and normalised boxes are unaffected.
    const analysisImageUrl = body.videoUrl ? undefined : await upscaleDataUrl(body.imageUrl);

    const gwRes = await fetch(GEMINI_CHAT_URL, {
      method: "POST",
      headers: geminiHeaders(key),
      body: JSON.stringify({
        model: toGeminiModel(model),
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
              : { type: "image_url", image_url: { url: analysisImageUrl ?? body.imageUrl } },
          ]},
        ],
      }),
    });

    if (!gwRes.ok) {
      const errText = await gwRes.text();
      console.error("AI request error", gwRes.status, errText);

      let message = "AI analysis could not be completed.";
      let code = "ai_gateway_error";
      if (gwRes.status === 402) {
        code = "ai_credits_exhausted";
        message = "AI credits have run out for this workspace. Contact your platform administrator to restore analysis capacity.";
      } else if (gwRes.status === 403) {
        code = "ai_blocked";
        message = "AI analysis was rejected — check that GEMINI_API_KEY is valid and has access to this model.";
      } else if (gwRes.status === 429) {
        code = "ai_rate_limited";
        message = "Too many AI requests right now. Analysis will resume shortly — try again in a minute.";
      } else if (gwRes.status >= 500) {
        code = "ai_upstream_error";
        message = "The AI service is temporarily unavailable. Please try again shortly.";
      }

      return new Response(JSON.stringify({
        error: code,
        message,
        status: gwRes.status,
        retryable: gwRes.status === 429 || gwRes.status >= 500,
        details: errText,
      }), {
        status: gwRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await gwRes.json();
    const raw: string = payload?.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

    let analysis: any = null;
    try { analysis = JSON.parse(cleaned); }
    catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) { try { analysis = JSON.parse(match[0]); } catch { /* noop */ } }
    }

    // Resolve every detection's box before anything stores or draws it.
    normaliseDetections(analysis);

    // Second look: CCTV frames are noisy and the first pass sometimes names
    // objects that are not there. Re-show the frame and keep only findings the
    // model can confirm at the exact coordinates it gave.
    try {
      await verifyFindings(analysis, {
        key,
        model,
        content: body.videoUrl
          ? { type: "video_url", video_url: { url: body.videoUrl } }
          : { type: "image_url", image_url: { url: analysisImageUrl ?? body.imageUrl } },
      });
    } catch (e) {
      console.warn("verification pass skipped", e instanceof Error ? e.message : e);
    }

    // Models sometimes answer on a 0-10 scale. Normalise to 0-100 and keep the
    // score consistent with the severity word so the UI never disagrees itself.
    if (analysis && typeof analysis === "object") {
      const sev = String(analysis.severity ?? "").toLowerCase();
      let score = typeof analysis.risk_score === "number" ? analysis.risk_score : NaN;
      if (Number.isFinite(score) && score <= 10 && sev && sev !== "low") score *= 10;
      if (!Number.isFinite(score)) score = SEVERITY_SCORE[sev] ?? 50;
      const band: Record<string, [number, number]> = {
        low: [1, 30], medium: [31, 60], high: [61, 85], critical: [86, 100],
      };
      const range = band[sev];
      if (range) score = Math.min(range[1], Math.max(range[0], score));
      analysis.risk_score = Math.round(Math.min(100, Math.max(0, score)));
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
        metadata: {
          camera: body.cameraName ?? null,
          zone: body.zone ?? null,
          verification: analysis?.verification ?? null,
        },
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
