import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Body {
  imageUrl?: string;      // https URL or data:image/...;base64,...
  cameraName?: string;
  zone?: string;
  aiModels?: string[];    // e.g. ["ppe", "intrusion", "downtime", "quality"]
  context?: string;
}

const SYSTEM_PROMPT = `You are an industrial vision safety analyst for a factory floor monitoring platform.
Analyze the provided camera frame and return a STRICT JSON object with this schema:
{
  "summary": string,                       // one-line description of the scene
  "risk_score": number,                    // 0-100 (higher = more risk)
  "severity": "low"|"medium"|"high"|"critical",
  "detections": [
    { "label": string, "confidence": number, "bbox_hint": string }
  ],
  "safety_violations": [
    { "type": string, "description": string, "severity": "low"|"medium"|"high"|"critical" }
  ],
  "productivity_notes": string[],
  "recommended_actions": string[]
}
Focus on: PPE compliance (hard hats, vests, gloves, goggles), restricted zone entry,
machine idle/downtime signals, ergonomic risks, quality/defect indicators, housekeeping (spills, obstructions).
Return ONLY the JSON object — no markdown, no prose.`;

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
    if (!body.imageUrl) {
      return new Response(JSON.stringify({ error: "imageUrl is required (https URL or data URL)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userText = [
      `Camera: ${body.cameraName ?? "Unknown"}`,
      `Zone: ${body.zone ?? "Unknown"}`,
      `Active AI models: ${(body.aiModels ?? ["ppe", "intrusion", "downtime", "quality"]).join(", ")}`,
      body.context ? `Additional context: ${body.context}` : "",
      "Analyze this frame and return the JSON per schema.",
    ].filter(Boolean).join("\n");

    const gwRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: body.imageUrl } },
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
      // Fallback: try to find first {...} block
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) { try { analysis = JSON.parse(match[0]); } catch { /* noop */ } }
    }

    return new Response(JSON.stringify({ analysis, raw }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("analyze-frame crash", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
