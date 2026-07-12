import type { Config } from "tailwindcss";

/* Classic panel aesthetic: sharp corners everywhere, white/gray palette. */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      borderRadius: { none: "0", DEFAULT: "0", md: "0", lg: "0", xl: "0", full: "9999px" },
      colors: {
        panel: { plate: "#ffffff", box: "#f4f5f6", border: "#4a4f54", muted: "#e8eaec" },
        ink: { DEFAULT: "#1d2023", dim: "#5c6268" },
        safety: "#e6a800",
        ok: "#1e8a45",
        danger: "#c62828",
        warn: "#c77700",
      },
      fontFamily: { mono: ["Consolas", "ui-monospace", "monospace"] },
    },
  },
  plugins: [],
};
export default config;
