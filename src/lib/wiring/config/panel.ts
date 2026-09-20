import type { ComponentDef, TerminalDef } from "../types";
import { IMAGE_TERMINALS } from "./terminals.generated";
import { activeModel, activePlcTerminals } from "./plc-models";

/**
 * Device sizes are proportional to real hardware at PX_PER_MM:
 *   FX3U-48M 182x90mm - MCB 2P 36x85mm - PS5R-VE24 37x125mm.
 * Images are cropped to the device edges, so the rectangle == the device.
 */
export const PX_PER_MM = 4.4;
export const CANVAS_W = 1560;
export const CANVAS_H = 1060;

const mm = (v: number) => Math.round(v * PX_PER_MM);

/**
 * Hand-tuned corrections applied over the auto-generated coordinates.
 * The PSU photo has its label boxes baked into the image, which skewed the
 * auto-derived positions; these values were re-measured on the actual screw
 * heads (texture detection excluding the label rectangles).
 */
const TERMINAL_OVERRIDES: Record<string, Record<string, [number, number]>> = {
  PSU: {
    L_IN: [27.3, 7.7],
    N_IN: [52.6, 8.0],
    "0VDC": [22.7, 89.7],
    "24VDC": [78.4, 89.7],
  },
};

function imageTerminals(
  key: keyof typeof IMAGE_TERMINALS,
  fixed: string[] = [],
): TerminalDef[] {
  const overrides = TERMINAL_OVERRIDES[key] ?? {};
  return Object.entries(IMAGE_TERMINALS[key]).map(([id, pos]) => {
    const [xPct, yPct] = overrides[id] ?? pos;
    return { id, xPct, yPct, fixed: fixed.includes(id) };
  });
}

/** 4 independent screw terminals along one edge: NO pair 13/14, NC pair 21/22. */
const NO_BUTTON_TERMINALS: TerminalDef[] = [
  { id: "3", xPct: 10, yPct: 20 },
  { id: "4", xPct: 10, yPct: 75 },
];
const NC_BUTTON_TERMINALS: TerminalDef[] = [
  { id: "1", xPct: 10, yPct: 20 },
  { id: "2", xPct: 10, yPct: 75 },
];

interface ButtonCapPos {
  xPct: number;
  yPct: number;
  rPct: number;
}

export const BUTTON_CAP: Record<string, ButtonCapPos> = {
  "/images/PBNO.webp": { xPct: 83, yPct: 50, rPct: 11 },
  "/images/PBNC.webp": { xPct: 83, yPct: 50, rPct: 11 },
};
/** Lamp: X1/X2 element terminals + two spares (not internally connected). */
const lampTerminals: TerminalDef[] = (
  [
    ["X1", 14, "X1"],
    ["X2", 32, "X2"],
    ["SP1", 68, "·"],
    ["SP2", 86, "·"],
  ] as const
).map(([id, xPct, label]) => ({
  id,
  xPct,
  yPct: 16,
  label,
  labelSide: "above",
}));

const tbTerminals: TerminalDef[] = Array.from({ length: 6 }, (_, i) => ({
  id: `T${i + 1}`,
  xPct: 10 + i * 16,
  yPct: 62,
  label: String(i + 1),
  labelSide: "above",
}));

const BTN_W = 165;
const BTN_H = 140;
const PLC_X = 520;
const PLC_Y = 300;
const BTN_PHOTO_H = BTN_H;
const BTN_PHOTO_W = Math.round(BTN_PHOTO_H * (369 / 280)); // ≈ 185

export const PANEL_COMPONENTS: ComponentDef[] = [
  {
    key: "MCB",
    kind: "image",
    x: 90,
    y: 320,
    w: 150, // was mm(36) — now matches mcb.webp aspect exactly
    h: mm(85),
    imageSrc: "/images/mcb.webp",
    terminals: imageTerminals("MCB", ["L1_IN", "L2_IN"]),
  },
  {
    key: "PSU",
    kind: "image",
    x: 300,
    y: 300,
    w: 180, // was mm(37) — now matches psu.webp aspect (300:751)
    h: mm(100),
    imageSrc: "/images/psu.webp",
    terminals: imageTerminals("PSU"),
  },
  {
    key: "PLC",
    kind: "image",
    x: PLC_X,
    y: PLC_Y,
    w: mm(activeModel().widthMm),
    h: mm(activeModel().heightMm),
    imageSrc: activeModel().imageSrc,
    terminals: activePlcTerminals(),
  },
  ...(
    [
      ["PB1", "NO"],
      ["PB2", "NO"],
      ["PB3", "NO"],
      ["PB4", "NC"],
    ] as const
  ).map(
    ([key, contactType], i): ComponentDef => ({
      key,
      kind: "buttonImage",
      contactType,
      name: `PUSH BUTTON ${contactType}`,
      subtitle: key,
      // Centered on the same column the lamp below it uses — the photo is
      // wider than the old box, so shift left by half the extra width.
      x: PLC_X + i * (BTN_W + 100) - (BTN_PHOTO_W - BTN_W) / 2,
      y: 10,
      w: BTN_PHOTO_W,
      h: BTN_PHOTO_H,
      imageSrc:
        contactType === "NO" ? "/images/PBNO.webp" : "/images/PBNC.webp",
      terminals:
        contactType === "NO" ? NO_BUTTON_TERMINALS : NC_BUTTON_TERMINALS,
    }),
  ),
  ...Array.from(
    { length: 4 },
    (_, i): ComponentDef => ({
      key: `LAMP${i + 1}`,
      kind: "lamp",
      accent: "#e6a800",
      name: "PILOT LAMP",
      subtitle: `LAMP${i + 1} · 24VDC`,
      x: PLC_X + i * (BTN_W + 45),
      y: 850,
      w: BTN_W,
      h: BTN_H,
      terminals: lampTerminals,
    }),
  ),
  {
    key: "TB24",
    kind: "terminalBlock",
    name: "+24V TERMINAL BLOCK",
    accent: "#d32f2f",
    x: 40,
    y: 900,
    w: 380,
    h: 60,
    terminals: tbTerminals,
  },
  {
    key: "TB0",
    kind: "terminalBlock",
    name: "0V TERMINAL BLOCK",
    accent: "#17191c",
    x: 40,
    y: 980,
    w: 380,
    h: 60,
    terminals: tbTerminals,
  },
];

/** FX3U-48M output common groups (from the terminal strip layout). */
export const Y_COM_GROUPS: Record<string, string[]> = activeModel().comGroups;

export const BUTTON_KEYS = ["PB1", "PB2", "PB3", "PB4"] as const;
export const LAMP_KEYS = ["LAMP1", "LAMP2", "LAMP3", "LAMP4"] as const;

export const X_INPUTS = Object.keys(
  IMAGE_TERMINALS[activeModel().terminalsKey],
).filter((t) => /^X\d+$/.test(t));
export const Y_OUTPUTS = Object.keys(
  IMAGE_TERMINALS[activeModel().terminalsKey],
).filter((t) => /^Y\d+$/.test(t));
