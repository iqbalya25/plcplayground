
import type { Lang } from "@/lib/i18n/messages";

/**
 * Inline SVG flags. Windows does not render flag emoji (it shows the
 * country letters instead), so the flags are drawn here.
 */
export function FlagIcon({ lang }: { lang: Lang }) {
  if (lang === "id") {
    // Indonesia: red over white
    return (
      <svg
        viewBox="0 0 3 2"
        className="h-[14px] w-[21px] shrink-0"
        aria-hidden="true"
      >
        <rect width="3" height="1" fill="#CE1126" />
        <rect y="1" width="3" height="1" fill="#FFFFFF" />
        <rect
          width="3"
          height="2"
          fill="none"
          stroke="#9aa0a6"
          strokeWidth="0.1"
        />
      </svg>
    );
  }

  // United Kingdom
  return (
    <svg
      viewBox="0 0 60 30"
      className="h-[14px] w-[28px] shrink-0"
      aria-hidden="true"
    >
      <clipPath id="flag-gb-s">
        <path d="M0,0 v30 h60 v-30 z" />
      </clipPath>
      <clipPath id="flag-gb-t">
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <g clipPath="url(#flag-gb-s)">
        <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#FFFFFF" strokeWidth="6" />
        <path
          d="M0,0 L60,30 M60,0 L0,30"
          clipPath="url(#flag-gb-t)"
          stroke="#C8102E"
          strokeWidth="4"
        />
        <path d="M30,0 v30 M0,15 h60" stroke="#FFFFFF" strokeWidth="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  );
}