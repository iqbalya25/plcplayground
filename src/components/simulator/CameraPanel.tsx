"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";

// If the Next.js proxy ever buffers the video, set NEXT_PUBLIC_CAMERA_STREAM_URL
// (e.g. http://localhost:4000/camera/stream) to bypass it without touching code.
const STREAM_URL =
  process.env.NEXT_PUBLIC_CAMERA_STREAM_URL ?? "/api/plc/camera/stream";
const STATUS_URL = "/api/plc/camera/status";

type CameraState =
  | "idle"
  | "connecting"
  | "live"
  | "offline"
  | "unconfigured"
  | "unreachable";

const TEXT: Record<CameraState, { en: string; id: string }> = {
  idle: { en: "Connecting…", id: "Menghubungkan…" },
  connecting: { en: "Connecting…", id: "Menghubungkan…" },
  live: { en: "LIVE", id: "LANGSUNG" },
  offline: {
    en: "Camera offline — reconnecting…",
    id: "Kamera offline — mencoba menyambung lagi…",
  },
  unconfigured: { en: "Camera is not set up", id: "Kamera belum diatur" },
  unreachable: { en: "Server unreachable", id: "Server tidak terjangkau" },
};

function useCameraState(): CameraState {
  const [state, setState] = React.useState<CameraState>("connecting");

  React.useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch(STATUS_URL, { cache: "no-store" });
        const data = await res.json();
        if (!alive) return;
        setState(data.configured === false ? "unconfigured" : data.state);
      } catch {
        if (alive) setState("unreachable");
      }
    };
    poll();
    const timer = setInterval(poll, 2000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return state;
}

export function CameraPanel() {
  const { lang } = useLanguage();
  const state = useCameraState();
  const live = state === "live";

  // Reload the <img> if the stream request itself fails (server restarting).
  const [attempt, setAttempt] = React.useState(0);
  const imgNode = React.useRef<HTMLImageElement | null>(null);

  // An open MJPEG response can outlive its <img>; clearing src makes the
  // browser drop the connection so the backend can release the phone.
  React.useEffect(() => {
    return () => {
      if (imgNode.current) imgNode.current.src = "";
    };
  }, []);

  return (
    <aside className="flex w-[40%] min-w-[360px] flex-col gap-2 border-l-2 border-panel-border bg-panel-muted p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink">
          {lang === "en" ? "Live camera" : "Kamera langsung"}
        </span>
        <span
          className={cn(
            "flex items-center gap-1.5 text-[11px] font-bold",
            live ? "text-ok" : "text-[#c62828]",
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {live ? TEXT.live[lang] : TEXT[state][lang]}
        </span>
      </div>

      <div className="relative min-h-0 flex-1 border-2 border-panel-border bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={attempt}
          ref={(el) => {
            if (el) imgNode.current = el;
          }}
          src={`${STREAM_URL}?t=${attempt}`}
          alt={lang === "en" ? "Live view of the PLC panel" : "Tampilan langsung panel PLC"}
          className="h-full w-full object-contain"
          onError={() => setTimeout(() => setAttempt((a) => a + 1), 3000)}
        />
        {!live && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 px-4 text-center text-sm font-bold text-white">
            {TEXT[state][lang]}
          </div>
        )}
      </div>
    </aside>
  );
}