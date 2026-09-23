/**
 * Direct Google Gemini access (OpenAI-compatible endpoint), replacing the
 * Lovable AI gateway. Model ids stored in the DB / hardcoded here still use
 * the historical "vendor/model" convention (e.g. "google/gemini-2.5-pro");
 * we strip the vendor prefix since only Gemini is reachable now.
 */

export const GEMINI_CHAT_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

export function getGeminiKey(): string | undefined {
  return Deno.env.get("GEMINI_API_KEY");
}

export function toGeminiModel(model: string): string {
  return model.includes("/") ? model.split("/").slice(1).join("/") : model;
}

export function geminiHeaders(key: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };
}

/**
 * Video is not supported by the OpenAI-compatible endpoint above — it
 * rejects any "video_url" content part outright ("Invalid content part
 * type: video_url"), OpenAI's chat completions spec having no concept of
 * video at all. Gemini's own native generateContent endpoint does support
 * inline video (as an inlineData part), but takes a different auth header
 * and an entirely different request/response shape.
 */
export function geminiNativeUrl(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${toGeminiModel(model)}:generateContent`;
}

export function geminiNativeHeaders(key: string) {
  return {
    "Content-Type": "application/json",
    "x-goog-api-key": key,
  };
}
