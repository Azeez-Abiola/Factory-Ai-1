import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Body {
  natural_language: string;
  name?: string;
  category?: string;
  severity?: string;
}

const SYSTEM_PROMPT = `You are a factory-floor safety and compliance policy compiler.
Given a plain-English policy from a factory manager, convert it into:
1. A concise SYSTEM PROMPT the vision model can use to detect violations of this policy.
2. A structured DETECTION RULE the alert engine can evaluate.

Return STRICT JSON only, no markdown, matching this schema:
{
  "vision_prompt": string,
  "rule": {
    "detect": string[],
    "conditions": [ { "field": string, "op": "eq"|"gt"|"gte"|"lt"|"lte"|"in"|"not_in"|"contains", "value": any } ],
    "combinator": "AND"|"OR",
    "trigger_severity": "low"|"medium"|"high"|"critical",
    "recommended_confidence": number
  },
  "summary": string,
  "suggested_actions": string[]
}
Focus on: PPE, restricted zones, downtime, ergonomics, quality/defect, housekeeping, security & theft control, ingress/egress.`;

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
    if (!body.natural_language || body.natural_language.trim().length < 5) {
      return new Response(JSON.stringify({ error: "natural_language is required (min 5 chars)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userText = [
      body.name ? `Policy name: ${body.name}` : "",
      body.category ? `Category: ${body.category}` : "",
      body.severity ? `Target severity: ${body.severity}` : "",
      `Policy (plain English):\n${body.natural_language}`,
      "\nReturn the JSON per schema.",
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
          { role: "user", content: userText },
        ],
      }),
    });

    if (!gwRes.ok) {
      const errText = await gwRes.text();
      console.error("AI gateway error", gwRes.status, errText);
      if (gwRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit hit — retry shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (gwRes.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI gateway failed", details: errText }), {
        status: gwRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await gwRes.json();
    const raw: string = payload?.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

    let compiled: any = null;
    try { compiled = JSON.parse(cleaned); }
    catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) { try { compiled = JSON.parse(match[0]); } catch { /* noop */ } }
    }

    if (!compiled) {
      return new Response(JSON.stringify({ error: "Failed to parse AI response", raw }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ compiled, raw }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("compile-policy crash", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
