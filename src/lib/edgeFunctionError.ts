/**
 * supabase.functions.invoke() throws a FunctionsHttpError on any non-2xx
 * response, whose .message is a generic "Edge Function returned a non-2xx
 * status code" — the actual reason (code/message/details our functions
 * return as JSON) is on error.context, the raw Response object. Without
 * this, every failure looks identical regardless of cause.
 */
export async function describeEdgeFunctionError(e: unknown): Promise<string> {
  const err = e as { message?: string; context?: Response };
  const ctx = err?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const body = await ctx.clone().json();
      const detail = body?.message || body?.error || body?.details;
      if (detail) return String(detail);
    } catch {
      try {
        const text = await ctx.clone().text();
        if (text) return text.slice(0, 300);
      } catch { /* fall through to generic message */ }
    }
  }
  return err?.message ?? "Unknown error";
}
