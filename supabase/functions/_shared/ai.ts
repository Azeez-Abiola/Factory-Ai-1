/**
 * Direct model access, replacing the Lovable AI gateway. Model ids stored in
 * the DB / hardcoded here use the "vendor/model" convention
 * (e.g. "google/gemini-3.6-flash", "openai/gpt-5.5"); the vendor prefix picks
 * the provider, endpoint and API key, and is stripped before the API call.
 *
 * Gemini and OpenAI both speak the OpenAI chat-completions request/response
 * shape, so callers build one request and only the target differs.
 */

export const GEMINI_CHAT_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
export const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

export type Provider = "google" | "openai";

export function getGeminiKey(): string | undefined {
  return Deno.env.get("GEMINI_API_KEY");
}

export function getOpenAIKey(): string | undefined {
  return Deno.env.get("OPENAI_API_KEY");
}

export function providerOf(model: string): Provider {
  return model.startsWith("openai/") ? "openai" : "google";
}

export function stripVendor(model: string): string {
  return model.includes("/") ? model.split("/").slice(1).join("/") : model;
}

/** Kept for existing callers; identical to stripVendor. */
export const toGeminiModel = stripVendor;

export function geminiHeaders(key: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };
}

export interface ChatTarget {
  provider: Provider;
  url: string;
  headers: Record<string, string>;
  /** Model id as the provider's API expects it (no vendor prefix). */
  model: string;
  keyName: "GEMINI_API_KEY" | "OPENAI_API_KEY";
  hasKey: boolean;
}

/** Endpoint + auth + model id for a chat-completions call to `model`. */
export function chatTarget(model: string): ChatTarget {
  if (providerOf(model) === "openai") {
    const key = getOpenAIKey();
    return {
      provider: "openai", url: OPENAI_CHAT_URL, headers: geminiHeaders(key ?? ""),
      model: stripVendor(model), keyName: "OPENAI_API_KEY", hasKey: Boolean(key),
    };
  }
  const key = getGeminiKey();
  return {
    provider: "google", url: GEMINI_CHAT_URL, headers: geminiHeaders(key ?? ""),
    model: stripVendor(model), keyName: "GEMINI_API_KEY", hasKey: Boolean(key),
  };
}

/**
 * Video is not supported by either chat-completions endpoint — Gemini's
 * rejects any "video_url" part outright ("Invalid content part type:
 * video_url") and OpenAI has no video input at all. Gemini's own native
 * generateContent endpoint does support inline video (as an inlineData
 * part), but takes a different auth header and request/response shape.
 * Video therefore always runs on Gemini, whatever the site's model is.
 */
export function geminiNativeUrl(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${stripVendor(model)}:generateContent`;
}

export function geminiNativeHeaders(key: string) {
  return {
    "Content-Type": "application/json",
    "x-goog-api-key": key,
  };
}

/** Model used for video clips when a site's own model isn't Gemini. */
export const VIDEO_FALLBACK_MODEL = "google/gemini-3.6-flash";
