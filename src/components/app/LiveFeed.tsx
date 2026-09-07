import { MutableRefObject, ReactNode, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LiveFeedProps {
  url: string;
  type?: "hls" | "webrtc" | "mjpeg" | null;
  muted?: boolean;
  className?: string;
  poster?: string;
  /** Filled with a function that grabs the current frame as a JPEG data URL. */
  captureRef?: MutableRefObject<(() => string | null) | null>;
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
export default function LiveFeed({ url, type = "hls", muted = true, className, poster, captureRef, overlay }: LiveFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<"loading" | "playing" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [attempt, setAttempt] = useState(0);

  // Expose a frame grabber so the AI vision loop can read the live picture.
  useEffect(() => {
    if (!captureRef) return;
    captureRef.current = () => {
      const source: HTMLVideoElement | HTMLImageElement | null =
        type === "mjpeg" ? imgRef.current : videoRef.current;
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


  useEffect(() => {
    setState("loading");
    setErrorMsg("");
    const video = videoRef.current;

    if (type === "mjpeg") {
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

  if (type === "mjpeg") {
    return (
      <div className={className} style={{ position: "relative", width: "100%", height: "100%" }}>
        <img
          key={attempt}
          src={url}
          alt="Live camera feed"
          className="h-full w-full object-cover"
          onLoad={() => setState("playing")}
          onError={() => { setErrorMsg("MJPEG stream could not be loaded by this browser"); setState("error"); }}
        />
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
        poster={poster}
        style={{ width: "100%", height: "100%", objectFit: "cover", background: "#000" }}
      />
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
