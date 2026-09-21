/**
 * "On-site mode": the console is being opened from a browser that sits on the
 * factory network (served over plain http from a plant PC, or from a private
 * address). Only in that case can the browser load video straight from the
 * recorder — a secure public page is blocked from loading plain-http streams,
 * which is the whole reason a gateway is normally needed.
 */
const PRIVATE_HOST =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|.*\.local)$/i;

export function isOnSiteBrowser(): boolean {
  if (typeof window === "undefined") return false;
  const { protocol, hostname } = window.location;
  if (protocol === "http:") return true;
  return PRIVATE_HOST.test(hostname);
}

/** True when a URL can only be reached from inside the factory network. */
export function isLocalAddress(url?: string | null): boolean {
  if (!url) return false;
  try {
    return PRIVATE_HOST.test(new URL(url).hostname);
  } catch {
    return false;
  }
}
