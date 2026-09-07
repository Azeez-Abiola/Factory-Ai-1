/**
 * Known streaming-gateway URL patterns.
 * The gateway is hosted by the factory IT team; the app only stores its base URL
 * and derives playback + snapshot addresses from these vendor conventions.
 */

export type GatewayVendor = "mediamtx" | "go2rtc" | "frigate" | "antmedia" | "custom";

export interface GatewayPattern {
  id: GatewayVendor;
  label: string;
  hls: (base: string, id: string) => string;
  webrtc: (base: string, id: string) => string;
  mjpeg: (base: string, id: string) => string;
  /** JPEG still used by the AI worker. Empty string = vendor has no standard snapshot route. */
  snapshot: (base: string, id: string) => string;
  note: string;
}

const trim = (base: string) => base.replace(/\/+$/, "");

export const GATEWAY_PATTERNS: GatewayPattern[] = [
  {
    id: "mediamtx",
    label: "MediaMTX",
    hls: (b, id) => `${trim(b)}/${id}/index.m3u8`,
    webrtc: (b, id) => `${trim(b)}/${id}/whep`,
    mjpeg: (b, id) => `${trim(b)}/${id}`,
    snapshot: (b, id) => `${trim(b)}/${id}/snapshot.jpg`,
    note: "Enable the HLS and WebRTC servers; snapshots need the playback API or a companion snapshotter.",
  },
  {
    id: "go2rtc",
    label: "go2rtc",
    hls: (b, id) => `${trim(b)}/api/stream.m3u8?src=${encodeURIComponent(id)}`,
    webrtc: (b, id) => `${trim(b)}/api/whep?src=${encodeURIComponent(id)}`,
    mjpeg: (b, id) => `${trim(b)}/api/stream.mjpeg?src=${encodeURIComponent(id)}`,
    snapshot: (b, id) => `${trim(b)}/api/frame.jpeg?src=${encodeURIComponent(id)}`,
    note: "go2rtc exposes a native JPEG frame endpoint — ideal for AI snapshots.",
  },
  {
    id: "frigate",
    label: "Frigate NVR",
    hls: (b, id) => `${trim(b)}/api/${id}/master.m3u8`,
    webrtc: (b, id) => `${trim(b)}/api/go2rtc/api/whep?src=${encodeURIComponent(id)}`,
    mjpeg: (b, id) => `${trim(b)}/api/${id}?fps=5`,
    snapshot: (b, id) => `${trim(b)}/api/${id}/latest.jpg`,
    note: "Use the Frigate camera name as the stream key.",
  },
  {
    id: "antmedia",
    label: "Ant Media Server",
    hls: (b, id) => `${trim(b)}/streams/${id}.m3u8`,
    webrtc: (b, id) => `${trim(b)}/${id}.whep`,
    mjpeg: (b, id) => `${trim(b)}/streams/${id}.mjpeg`,
    snapshot: (b, id) => `${trim(b)}/streams/${id}/preview.png`,
    note: "Ant Media generates previews per stream ID from the application context path.",
  },
  {
    id: "custom",
    label: "Custom / other",
    hls: (b, id) => `${trim(b)}/${id}/index.m3u8`,
    webrtc: (b, id) => `${trim(b)}/${id}/whep`,
    mjpeg: (b, id) => `${trim(b)}/${id}`,
    snapshot: () => "",
    note: "Paste the addresses your gateway documents; nothing is guessed.",
  },
];

export const getGatewayPattern = (vendor?: string | null): GatewayPattern =>
  GATEWAY_PATTERNS.find((p) => p.id === vendor) ?? GATEWAY_PATTERNS[0];

/** Common on-camera snapshot routes, used when no gateway snapshot exists. */
export const CAMERA_SNAPSHOT_PATTERNS: { brand: string; path: (host: string, channel: number) => string }[] = [
  { brand: "Hikvision", path: (h, c) => `http://${h}/ISAPI/Streaming/channels/${c}01/picture` },
  { brand: "Dahua", path: (h, c) => `http://${h}/cgi-bin/snapshot.cgi?channel=${c}` },
  { brand: "Axis", path: (h, c) => `http://${h}/axis-cgi/jpg/image.cgi?camera=${c}` },
  { brand: "Uniview", path: (h, c) => `http://${h}/images/snapshot.jpg?channel=${c}` },
  { brand: "Reolink", path: (h) => `http://${h}/cgi-bin/api.cgi?cmd=Snap&channel=0` },
  { brand: "ONVIF (generic)", path: (h) => `http://${h}/onvif/snapshot` },
];

/** Derives a snapshot URL from an RTSP source when the brand is recognisable. */
export function guessSnapshotFromRtsp(rtsp: string): string | null {
  try {
    const u = new URL(rtsp);
    const host = u.port && u.port !== "554" ? `${u.hostname}:${u.port}` : u.hostname;
    const path = u.pathname.toLowerCase();
    if (path.includes("/streaming/channels") || path.includes("/isapi")) {
      const ch = path.match(/channels\/(\d)/)?.[1] ?? "1";
      return `http://${host}/ISAPI/Streaming/channels/${ch}01/picture`;
    }
    if (path.includes("cam/realmonitor") || path.includes("dahua")) {
      const ch = new URLSearchParams(u.search).get("channel") ?? "1";
      return `http://${host}/cgi-bin/snapshot.cgi?channel=${ch}`;
    }
    if (path.includes("axis-media")) return `http://${host}/axis-cgi/jpg/image.cgi`;
    if (path.includes("/unicast") || path.includes("/media")) return `http://${host}/images/snapshot.jpg`;
    return null;
  } catch {
    return null;
  }
}
