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
