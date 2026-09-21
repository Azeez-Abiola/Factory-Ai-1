/**
 * CCTV snapshots are often tiny (704x576 on older recorders). Vision models
 * place boxes noticeably better on a larger image, so we upscale small frames
 * before analysis. Normalised coordinates are unaffected by a uniform resize,
 * so nothing downstream needs to change.
 */
import { decode, Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

const MIN_WIDTH = 1100;
const MAX_WIDTH = 1600;

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
