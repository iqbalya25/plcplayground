import type { ComponentDef, TerminalDef } from "../types";
import { IMAGE_TERMINALS } from "./terminals.generated";

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
const buttonTerminals: TerminalDef[] = (
  [
    ["13", 14],
    ["14", 32],
    ["21", 68],
    ["22", 86],
  ] as const
).map(([id, xPct]) => ({ id, xPct, yPct: 84, label: id, labelSide: "below" }));

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
    w: mm(182),
    h: mm(90),
    imageSrc: "/images/plc.webp",
    terminals: imageTerminals("PLC"),
  },
  ...(
    [
      ["PB1", "NO", "#1e8a45"],
      ["PB2", "NO", "#1e8a45"],
      ["PB3", "NO", "#1e8a45"],
      ["PB4", "NC", "#c62828"],
    ] as const
  ).map(
    ([key, contactType, accent], i): ComponentDef => ({
      key,
      kind: "button",
      contactType,
      accent,
      name: `PUSH BUTTON ${contactType}`,
      subtitle: key,
      x: PLC_X + i * (BTN_W + 45),
      y: 60,
      w: BTN_W,
      h: BTN_H,
      terminals: buttonTerminals,
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
export const Y_COM_GROUPS: Record<string, string[]> = {
  COM1: ["Y0", "Y1", "Y2", "Y3"],
  COM2: ["Y4", "Y5", "Y6", "Y7"],
  COM3: ["Y10", "Y11", "Y12", "Y13"],
  COM4: ["Y14", "Y15", "Y16", "Y17"],
  COM5: ["Y20", "Y21", "Y22", "Y23", "Y24", "Y25", "Y26", "Y27"],
};

export const BUTTON_KEYS = ["PB1", "PB2", "PB3", "PB4"] as const;
export const LAMP_KEYS = ["LAMP1", "LAMP2", "LAMP3", "LAMP4"] as const;

export const X_INPUTS = Object.keys(IMAGE_TERMINALS.PLC).filter((t) =>
  /^X\d+$/.test(t),
);
export const Y_OUTPUTS = Object.keys(IMAGE_TERMINALS.PLC).filter((t) =>
  /^Y\d+$/.test(t),
);
