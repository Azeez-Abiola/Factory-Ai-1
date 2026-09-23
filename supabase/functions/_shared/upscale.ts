/**
 * CCTV snapshots are often tiny (704x576 on older recorders). Vision models
 * place boxes noticeably better on a larger image, so we upscale small frames
 * before analysis. Normalised coordinates are unaffected by a uniform resize,
 * so nothing downstream needs to change.
 */
import { decode, Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

const MIN_WIDTH = 1100;
const MAX_WIDTH = 1600;

/**
 * Gemini's OpenAI-compatible chat/completions endpoint does not fetch remote
 * image URLs the way OpenAI's own API does — an https image_url.url is
 * rejected outright with a plain "Request contains an invalid argument"
 * (400 INVALID_ARGUMENT), no matter how ordinary the URL. Only inline
 * `data:` URIs work. Camera snapshots and signed Supabase Storage URLs are
 * both plain https, so every image must be fetched and inlined here first.
 */
export async function ensureDataUrl(url: string | undefined): Promise<string | undefined> {
  if (!url || url.startsWith("data:")) return url;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch image for analysis (${res.status})`);
  const contentType = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0];
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return `data:${contentType};base64,${btoa(binary)}`;
}

export async function upscaleDataUrl(dataUrl: string | undefined): Promise<string | undefined> {
  if (!dataUrl || !dataUrl.startsWith("data:image/")) return dataUrl;
  try {
    const comma = dataUrl.indexOf(",");
    const bytes = Uint8Array.from(atob(dataUrl.slice(comma + 1)), (c) => c.charCodeAt(0));
    const img = await decode(bytes);
    if (!(img instanceof Image)) return dataUrl;
    if (img.width >= MIN_WIDTH) return dataUrl;

    const factor = Math.min(MAX_WIDTH / img.width, 2.5);
    const resized = img.resize(Math.round(img.width * factor), Math.round(img.height * factor));
    const jpeg = await resized.encodeJPEG(92);
    let binary = "";
    for (const b of jpeg) binary += String.fromCharCode(b);
    return `data:image/jpeg;base64,${btoa(binary)}`;
  } catch (_e) {
    return dataUrl; // never let image handling break an analysis
  }
}
