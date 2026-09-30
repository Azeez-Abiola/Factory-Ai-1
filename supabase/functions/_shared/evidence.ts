// Saves an alert's still frame to cloud storage so alerts stay reviewable
// even when the recorder is unreachable. Never throws — returns the path or null.
const BUCKET = 'alert-evidence';

// deno-lint-ignore no-explicit-any
export async function saveEvidence(supabase: any, tenantId: string, cameraId: string, bytes: Uint8Array, mime: string): Promise<string | null> {
  if (!bytes?.length) return null;
  const ext = mime === 'image/png' ? 'png' : 'jpg';
  const path = `${tenantId}/${cameraId}/${Date.now()}.${ext}`;
  const upload = () => supabase.storage.from(BUCKET).upload(path, bytes, { contentType: mime || 'image/jpeg', upsert: false });
  try {
    let { error } = await upload();
    if (error && /bucket not found|not found/i.test(error.message ?? '')) {
      // Fresh environments may not have the private evidence bucket yet.
      await supabase.storage.createBucket(BUCKET, { public: false });
      ({ error } = await upload());
    }
    if (error) {
      console.error('evidence_upload_failed', error.message);
      return null;
    }
    return path;
  } catch (e) {
    console.error('evidence_upload_error', (e as Error).message);
    return null;
  }
}

/** Turns a data: URL or an http(s) image address into bytes. */
export async function imageToBytes(src: string | undefined): Promise<{ bytes: Uint8Array; mime: string } | null> {
  if (!src) return null;
  const m = src.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  if (m) return { bytes: Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0)), mime: m[1] };
  if (/^https?:\/\//i.test(src)) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 10_000);
      const res = await fetch(src, { signal: ctl.signal }).finally(() => clearTimeout(t));
      if (!res.ok) return null;
      const mime = (res.headers.get('content-type') ?? 'image/jpeg').split(';')[0];
      if (!mime.startsWith('image/')) return null;
      return { bytes: new Uint8Array(await res.arrayBuffer()), mime };
    } catch {
      return null;
    }
  }
  return null;
}
