import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { AlertTriangle, Loader2 } from "lucide-react";

interface LiveFeedProps {
  url: string;
  type?: "hls" | "webrtc" | "mjpeg" | null;
  muted?: boolean;
  className?: string;
  poster?: string;
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
export default function LiveFeed({ url, type = "hls", muted = true, className, poster }: LiveFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"loading" | "playing" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    setState("loading");
    setErrorMsg("");
    const video = videoRef.current;

    if (type === "mjpeg") {
      setState("playing");
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
        setState("playing");
      } catch (e: any) {
        if (!cancelled) { setErrorMsg(e?.message ?? "WebRTC failed"); setState("error"); }
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
  }, [url, type]);

  if (type === "mjpeg") {
    return <img src={url} alt="Live feed" className={className} />;
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
        <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-sm">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {state === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/70 text-center px-3">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <p className="text-[10px] font-mono text-destructive">Stream unavailable</p>
          <p className="text-[9px] text-muted-foreground truncate max-w-full">{errorMsg}</p>
        </div>
      )}
    </div>
  );
}
