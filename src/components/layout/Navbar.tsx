"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useHeaderStatus, useCameraToggle } from "./HeaderStatusContext";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { FlagIcon } from "./FlagIcon";

const TABS = [
  { href: "/", label: "Wiring Simulator" },
  { href: "/powermeter", label: "Power Meter Playground" },
] as const;

const STATUS_STYLES: Record<string, string> = {
  ok: "border-ok text-[#14532d] bg-[#dcefe1]",
  warn: "border-[#e6a800] text-[#7a5200] bg-[#fdf1d6]",
  error: "border-[#c62828] text-[#c62828] bg-[#fbe4e4]",
  idle: "border-panel-border text-ink-dim bg-panel-muted",
};

export function Navbar() {
  function CameraIcon() {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" />
      </svg>
    );
  }
  const pathname = usePathname();
  const status = useHeaderStatus();
  const camera = useCameraToggle();
  const { lang, setLang } = useLanguage();

  return (
    <header className="flex shrink-0 items-center gap-3 border-b-2 border-panel-border bg-panel-box px-4 py-2">
      <span className="bg-ink px-2 py-1 text-[11px] font-bold tracking-[0.12em] text-white">
        PLC PLAYGROUND
      </span>

      <nav className="flex items-center gap-1">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "px-3 py-1.5 text-[13px] font-bold",
                active
                  ? "border-b-2 border-ink text-ink"
                  : "text-ink-dim hover:text-ink",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {camera && (
        <button
          onClick={camera.onToggle}
          aria-pressed={camera.open}
          title={camera.open ? "Hide camera" : "Show live camera"}
          className={cn(
            "ml-auto flex items-center gap-1.5 border px-2 py-1 text-xs font-bold",
            camera.open
              ? "border-ink bg-ink text-white"
              : "border-panel-border bg-panel-box text-ink hover:bg-white",
          )}
        >
          <CameraIcon />
          {lang === "en" ? "Camera" : "Kamera"}
        </button>
      )}
      <div
        className={cn(
          !camera && "ml-auto",
          "flex items-center gap-1.5 border px-2 py-1 text-xs font-bold",
          STATUS_STYLES[status.state],
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {status.label}
      </div>
      <button
        onClick={() => setLang(lang === "en" ? "id" : "en")}
        className="flex items-center gap-1.5 border border-panel-border px-2 py-1 text-xs font-bold uppercase"
        title={
          lang === "en" ? "Switch to Bahasa Indonesia" : "Switch to English"
        }
        aria-label={
          lang === "en" ? "Switch to Bahasa Indonesia" : "Switch to English"
        }
      >
        <FlagIcon lang={lang} />
        {lang === "en" ? "EN" : "ID"}
      </button>
    </header>
  );
}
