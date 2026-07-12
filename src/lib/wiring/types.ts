/** A terminal is addressed as "COMPONENT.TERMINAL", e.g. "PLC.X0", "TB0.T3". */
export type TerminalId = string;

export interface Point {
  x: number;
  y: number;
}

export interface Wire {
  id: string;
  from: TerminalId;
  to: TerminalId;
  /** Anchor points placed by the user; rendered with orthogonal elbows. */
  points: Point[];
}

export type ComponentKind = "image" | "button" | "lamp" | "terminalBlock";

export interface TerminalDef {
  id: string;
  /** Position: percentage of the component rectangle. */
  xPct: number;
  yPct: number;
  label?: string;
  labelSide?: "above" | "below";
  /** Non-interactive (pre-wired) terminals. */
  fixed?: boolean;
}

export interface ComponentDef {
  key: string;
  kind: ComponentKind;
  x: number;
  y: number;
  w: number;
  h: number;
  name?: string;
  subtitle?: string;
  imageSrc?: string;
  /** button/lamp accent color */
  accent?: string;
  /** NO or NC device type (buttons) */
  contactType?: "NO" | "NC";
  terminals: TerminalDef[];
}

export interface TaskResult {
  id: string;
  label: string;
  done: boolean;
  /** e.g. resolved address assignment: "→ X5" */
  detail?: string;
}

export interface DangerHit {
  wireId: string;
  message: string;
}

export interface EvalResult {
  tasks: TaskResult[];
  /** Wires that belong to a satisfied task (rendered green). */
  okWireIds: ReadonlySet<string>;
  dangers: DangerHit[];
  /** Button/lamp → assigned PLC address (for UI feedback). */
  assignments: Record<string, string>;
  complete: boolean;
}
