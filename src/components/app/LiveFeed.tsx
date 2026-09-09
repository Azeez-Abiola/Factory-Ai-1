import { MutableRefObject, ReactNode, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LiveFeedProps {
  url: string;
  type?: "hls" | "webrtc" | "mjpeg" | "snapshot" | null;
  /** Refresh interval for snapshot playback (ms). */
  snapshotIntervalMs?: number;
  muted?: boolean;
  className?: string;
  poster?: string;
  /** Filled with a function that grabs the current frame as a JPEG data URL. */
  captureRef?: MutableRefObject<(() => string | null) | null>;
  /** Filled with a function that records N seconds of the feed as a WebM data URL. */
  recordRef?: MutableRefObject<((seconds: number) => Promise<string | null>) | null>;

  /** Rendered above the video (detection boxes, HUD). */
  overlay?: ReactNode;
}

/**
 * Live video renderer.
 * - HLS via hls.js (with native Safari playback fallback).
 * - MJPEG via <img>.
 * - WebRTC/WHEP: attempts a minimal WHEP handshake (POST SDP offer, receive answer).
 *
 * A real production deploy will front cameras with a media gateway (MediaMTX,
 * AWS KVS, Frigate, Ant Media, etc.) that exposes HLS/WHEP URLs per camera.
 * Store that URL in `cameras.stream_url` and this component plays it.
 */
export default function LiveFeed({ url, type = "hls", muted = true, className, poster, captureRef, recordRef, overlay, snapshotIntervalMs = 1000 }: LiveFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<"loading" | "playing" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [attempt, setAttempt] = useState(0);
  const [snapshotTick, setSnapshotTick] = useState(0);
  const isImageFeed = type === "mjpeg" || type === "snapshot";

  // Snapshot playback: re-fetch the still image on a timer so the tile animates.
  useEffect(() => {
    if (type !== "snapshot") return;
    const ms = Math.max(250, snapshotIntervalMs);
    const t = window.setInterval(() => setSnapshotTick((n) => n + 1), ms);
    return () => window.clearInterval(t);
  }, [type, snapshotIntervalMs, attempt]);

  // Expose a frame grabber so the AI vision loop can read the live picture.
  useEffect(() => {
    if (!captureRef) return;
    captureRef.current = () => {
      const source: HTMLVideoElement | HTMLImageElement | null =
        isImageFeed ? imgRef.current : videoRef.current;
      if (!source) return null;
      const width = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
      const height = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
      if (!width || !height) return null;
      try {
        const canvas = document.createElement("canvas");
        const maxW = 960;
        const scale = Math.min(1, maxW / width);
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        ctx.drawImage(source as CanvasImageSource, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/jpeg", 0.7);
      } catch {
        // Cross-origin stream — pixels are not readable in the browser.
        return null;
      }
    };
    return () => { if (captureRef) captureRef.current = null; };
  }, [captureRef, type, attempt]);

  // Expose a short-clip recorder for quality checks that need motion, not a still.
  useEffect(() => {
    if (!recordRef) return;
    recordRef.current = (seconds: number) =>
      new Promise((resolve) => {
        const source: HTMLVideoElement | HTMLImageElement | null =
          isImageFeed ? imgRef.current : videoRef.current;
        if (!source || typeof MediaRecorder === "undefined") return resolve(null);
        const width = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
        const height = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
        if (!width || !height) return resolve(null);
        try {
          const canvas = document.createElement("canvas");
          const scale = Math.min(1, 640 / width);
          canvas.width = Math.round(width * scale);
          canvas.height = Math.round(height * scale);
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(null);
          const fps = 8;
          const draw = () => {
            try { ctx.drawImage(source as CanvasImageSource, 0, 0, canvas.width, canvas.height); } catch { /* tainted */ }
          };
          draw();
          const painter = window.setInterval(draw, 1000 / fps);
          const stream = canvas.captureStream(fps);
          const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
            .find((m) => MediaRecorder.isTypeSupported(m));
          const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
          const chunks: BlobPart[] = [];
          recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
          recorder.onstop = () => {
            window.clearInterval(painter);
            stream.getTracks().forEach((t) => t.stop());
            const blob = new Blob(chunks, { type: mime ?? "video/webm" });
            if (!blob.size) return resolve(null);
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          };
          recorder.start();
          window.setTimeout(() => { if (recorder.state !== "inactive") recorder.stop(); }, Math.max(2, seconds) * 1000);
        } catch {
          resolve(null);
        }
      });
    return () => { if (recordRef) recordRef.current = null; };
  }, [recordRef, type, attempt]);



  useEffect(() => {
    setState("loading");
    setErrorMsg("");
    const video = videoRef.current;

    if (isImageFeed) {
      return;
    }

    if (!video) return;
    let hls: Hls | null = null;
    let pc: RTCPeerConnection | null = null;
    let cancelled = false;

    async function startWhep() {
      try {
        pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
        pc.addTransceiver("video", { direction: "recvonly" });
        pc.addTransceiver("audio", { direction: "recvonly" });
        pc.ontrack = (ev) => {
          if (video && ev.streams[0]) {
            video.srcObject = ev.streams[0];
            video.play().catch(() => {});
          }
        };
        pc.onconnectionstatechange = () => {
          if (cancelled || !pc) return;
          if (pc.connectionState === "connected") setState("playing");
          if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
            setErrorMsg(`WebRTC ${pc.connectionState}`);
            setState("error");
          }
        };
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/sdp" },
          body: offer.sdp ?? "",
        });
        if (!res.ok) throw new Error(`WHEP ${res.status}`);
        const answer = await res.text();
        if (cancelled) return;
        await pc.setRemoteDescription({ type: "answer", sdp: answer });
      } catch (error: unknown) {
        if (!cancelled) {
          setErrorMsg(error instanceof Error ? error.message : "WebRTC failed");
          setState("error");
        }
      }
    }

    if (type === "webrtc") {
      startWhep();
    } else if (Hls.isSupported()) {
      hls = new Hls({ lowLatencyMode: true, backBufferLength: 15, maxBufferLength: 6 });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().then(() => setState("playing")).catch(() => setState("playing"));
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) { setErrorMsg(data.details ?? "stream error"); setState("error"); }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      video.addEventListener("loadedmetadata", () => {
        video.play().then(() => setState("playing")).catch(() => setState("playing"));
      });
      video.addEventListener("error", () => { setErrorMsg("stream error"); setState("error"); });
    } else {
      setErrorMsg("HLS not supported in this browser");
      setState("error");
    }

    return () => {
      cancelled = true;
      if (hls) { hls.destroy(); }
      if (pc) { pc.close(); }
      if (video) { video.srcObject = null; video.removeAttribute("src"); video.load(); }
    };
  }, [url, type, attempt]);

  if (isImageFeed) {
    const src =
      type === "snapshot"
        ? `${url}${url.includes("?") ? "&" : "?"}_t=${snapshotTick}`
        : url;
    return (
      <div className={className} style={{ position: "relative", width: "100%", height: "100%" }}>
        <img
          ref={imgRef}
          key={type === "snapshot" ? attempt : attempt}
          src={src}
          alt="Live camera feed"
          crossOrigin="anonymous"
          className="h-full w-full object-cover"
          onLoad={() => setState("playing")}
          onError={() => {
            if (type === "snapshot" && state === "playing") return; // one dropped frame is not a failure
            setErrorMsg(type === "snapshot" ? "Snapshot image could not be loaded" : "MJPEG stream could not be loaded by this browser");
            setState("error");
          }}
        />
        {state === "playing" && overlay}
        {state === "loading" && <FeedLoading />}
        {state === "error" && <FeedError message={errorMsg} onRetry={() => setAttempt((value) => value + 1)} />}
      </div>
    );
  }

  return (
    <div className={className} style={{ position: "relative", width: "100%", height: "100%" }}>
      <video
        ref={videoRef}
        muted={muted}
        autoPlay
        playsInline
        crossOrigin="anonymous"
        poster={poster}
        style={{ width: "100%", height: "100%", objectFit: "cover", background: "#000" }}
      />
      {state === "playing" && overlay}
      {state === "loading" && (
        <FeedLoading />
      )}
      {state === "error" && (
        <FeedError message={errorMsg} onRetry={() => setAttempt((value) => value + 1)} />
      )}
    </div>
  );
}


const FeedLoading = () => (
  <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-sm">
    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Connecting to live stream" />
  </div>
);

const FeedError = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80 px-3 text-center">
    <AlertTriangle className="h-5 w-5 text-destructive" />
    <p className="text-[10px] font-mono text-destructive">Stream unavailable</p>
    <p className="max-w-full truncate text-[9px] text-muted-foreground">{message}</p>
    <Button type="button" size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={onRetry}>
      <RefreshCw className="h-3 w-3" /> Retry
    </Button>
  </div>
);
