import { IMAGE_TERMINALS } from "./terminals.generated";
import type { TerminalDef } from "../types";

export type PlcModelKey = "FX3U-48M" | "FX5U-32MR";

/**
 * Hand-edited switch. Change this constant and rebuild to swap the active
 * PLC for this deployment. Both models' configs stay in the codebase either
 * way — nothing is deleted when you switch.
 */
export const ACTIVE_PLC_MODEL: PlcModelKey = "FX5U-32MR";

export interface PlcModelDef {
  key: PlcModelKey;
  label: string;
  imageSrc: string;
  widthMm: number;
  heightMm: number;
  terminalsKey: "PLC_FX3U" | "PLC_FX5U";
  /** Output common group name -> Y addresses it serves. */
  comGroups: Record<string, string[]>;
}

export const PLC_MODELS: Record<PlcModelKey, PlcModelDef> = {
  "FX3U-48M": {
    key: "FX3U-48M",
    label: "FX3U-48M",
    imageSrc: "/images/plc.webp",
    widthMm: 182,
    heightMm: 90,
    terminalsKey: "PLC_FX3U",
    comGroups: {
      COM1: ["Y0", "Y1", "Y2", "Y3"],
      COM2: ["Y4", "Y5", "Y6", "Y7"],
      COM3: ["Y10", "Y11", "Y12", "Y13"],
      COM4: ["Y14", "Y15", "Y16", "Y17"],
      COM5: ["Y20", "Y21", "Y22", "Y23", "Y24", "Y25", "Y26", "Y27"],
    },
  },
  "FX5U-32MR": {
    key: "FX5U-32MR",
    label: "FX5U-32MR",
    imageSrc: "/images/plc-fx5u.webp", // TODO: drop your cropped FX5U photo here
    widthMm: 150,
    heightMm: 90,
    terminalsKey: "PLC_FX5U",
    comGroups: {
      COM0: ["Y0", "Y1", "Y2", "Y3"],
      COM1: ["Y4", "Y5", "Y6", "Y7"],
      COM2: ["Y10", "Y11", "Y12", "Y13"],
      COM3: ["Y14", "Y15", "Y16", "Y17"],
    },
  },
};

export function activeModel(): PlcModelDef {
  return PLC_MODELS[ACTIVE_PLC_MODEL];
}

/** All terminals (X/Y/power/analog/RS-485) for the active model, fully interactive. */
export function activePlcTerminals(fixed: string[] = []): TerminalDef[] {
  const model = activeModel();
  const raw = IMAGE_TERMINALS[model.terminalsKey];
  return Object.entries(raw).map(([id, [xPct, yPct]]) => ({
    id,
    xPct,
    yPct,
    fixed: fixed.includes(id),
  }));
}