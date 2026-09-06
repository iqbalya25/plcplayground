"use client";

import * as React from "react";
import type { ComponentDef, Point, TerminalId, Wire } from "@/lib/wiring/types";
import {
  CANVAS_H,
  CANVAS_W,
  PANEL_COMPONENTS,
} from "@/lib/wiring/config/panel";
import { dangerCheck } from "@/lib/wiring/engine/feedback";
import { CABLE_COLORS } from "@/lib/wiring/hooks/use-wiring";
import type { WiringApi } from "@/lib/wiring/hooks/use-wiring";

/* ---------- geometry helpers ---------- */

export function terminalPosition(
  componentKey: string,
  terminalId: string,
): Point {
  const c = PANEL_COMPONENTS.find((x) => x.key === componentKey);
  if (!c) return { x: 0, y: 0 };
  const t = c.terminals.find((x) => x.id === terminalId);
  if (!t) return { x: 0, y: 0 };
  return { x: c.x + (c.w * t.xPct) / 100, y: c.y + (c.h * t.yPct) / 100 };
}

function termPos(id: TerminalId): Point {
  const [comp, ...rest] = id.split(".");
  return terminalPosition(comp, rest.join("."));
}

function orthoPath(points: readonly Point[], end?: Point): string {
  const all = end ? [...points, end] : [...points];
  if (all.length < 2) return "";
  let d = `M ${all[0].x} ${all[0].y}`;
  for (let i = 1; i < all.length; i++) {
    const a = all[i - 1];
    const b = all[i];
    d += ` L ${b.x} ${a.y} L ${b.x} ${b.y}`;
  }
  return d;
}

/** Same elbow expansion as orthoPath, but as a vertex list (for hit-testing). */
function orthoVertices(points: readonly Point[]): Point[] {
  if (points.length < 2) return [...points];
  const out: Point[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    out.push({ x: b.x, y: a.y }, { x: b.x, y: b.y });
  }
  return out;
}

/** Distance from a point to an axis-aligned segment. */
function segmentDistance(p: Point, a: Point, b: Point): number {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  const cx = Math.min(Math.max(p.x, minX), maxX);
  const cy = Math.min(Math.max(p.y, minY), maxY);
  return Math.hypot(p.x - cx, p.y - cy);
}

function wireDistance(w: Wire, p: Point): number {
  const v = orthoVertices(w.points);
  let best = Infinity;
  for (let i = 1; i < v.length; i++) {
    best = Math.min(best, segmentDistance(p, v[i - 1], v[i]));
  }
  return best;
}

/* ---------- viewport (zoom / pan) ---------- */

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const FULL_VIEW: ViewBox = { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H };
const MIN_W = CANVAS_W / 6; // max zoom-in 6x
const MAX_W = CANVAS_W * 1.5; // max zoom-out 1.5x

function clampView(v: ViewBox): ViewBox {
  const w = Math.min(Math.max(v.w, MIN_W), MAX_W);
  const h = (w / CANVAS_W) * CANVAS_H;
  return { x: v.x, y: v.y, w, h };
}

/* ---------- subcomponents ---------- */

function ImageComponent({ def }: { def: ComponentDef }) {
  return (
    <image
      href={def.imageSrc}
      x={def.x}
      y={def.y}
      width={def.w}
      height={def.h}
      preserveAspectRatio="none"
    />
  );
}

/**
 * DeviceBox — renders buttons and lamps.
 * Buttons only: the actuator circle is now pressable (mousedown/mouseup)
 * so the frontend can simulate a physical push while wired live.
 */
function DeviceBox({
  def,
  pressed,
  onPress,
  onRelease,
}: {
  def: ComponentDef;
  pressed?: boolean;
  onPress?: (key: string) => void;
  onRelease?: (key: string) => void;
}) {
  const cx = def.x + def.w / 2;
  const actuatorY = def.kind === "lamp" ? def.y + def.h - 42 : def.y + 62;
  const isButton = def.kind === "button";
  return (
    <g>
      <rect
        x={def.x}
        y={def.y}
        width={def.w}
        height={def.h}
        fill="#f4f5f6"
        stroke="#4a4f54"
        strokeWidth={2}
      />
      <text
        x={cx}
        y={def.y + 18}
        textAnchor="middle"
        fontSize={11}
        fontWeight={700}
        fill="#1d2023"
      >
        {def.name}
      </text>
      <text
        x={cx}
        y={def.y + 31}
        textAnchor="middle"
        fontSize={9}
        fill="#5c6268"
      >
        {def.subtitle}
      </text>
      <rect
        x={cx - 22}
        y={actuatorY - 22}
        width={44}
        height={44}
        fill="#dfe2e5"
        stroke="#4a4f54"
        strokeWidth={1.5}
      />
      <circle
        cx={cx}
        cy={actuatorY}
        r={isButton && pressed ? 12 : 15}
        fill={def.kind === "lamp" ? "#fff3cd" : def.accent}
        stroke="#33383d"
        strokeWidth={1.5}
        className={isButton ? "cursor-pointer" : undefined}
        onMouseDown={
          isButton
            ? (e) => {
                e.stopPropagation();
                console.log("PRESS:", def.key);
                onPress?.(def.key);
              }
            : undefined
        }
        onMouseUp={
          isButton
            ? (e) => {
                e.stopPropagation();
                console.log("RELEASE:", def.key);
                onRelease?.(def.key);
              }
            : undefined
        }
      />
      {def.kind === "lamp" && (
        <circle cx={cx} cy={actuatorY} r={8} fill={def.accent} />
      )}
      {def.kind === "button" && (
        <>
          <text
            x={def.x + def.w * 0.23}
            y={def.y + def.h * 0.84 - 14}
            textAnchor="middle"
            fontSize={8}
            fontWeight={700}
            fill="#8a9096"
            fontFamily="Consolas, monospace"
          >
            NO
          </text>
          <text
            x={def.x + def.w * 0.77}
            y={def.y + def.h * 0.84 - 14}
            textAnchor="middle"
            fontSize={8}
            fontWeight={700}
            fill="#8a9096"
            fontFamily="Consolas, monospace"
          >
            NC
          </text>
        </>
      )}
    </g>
  );
}

function TerminalBlock({ def }: { def: ComponentDef }) {
  return (
    <g>
      <rect
        x={def.x}
        y={def.y}
        width={def.w}
        height={def.h}
        fill="#f4f5f6"
        stroke="#4a4f54"
        strokeWidth={2}
      />
      <rect x={def.x} y={def.y} width={8} height={def.h} fill={def.accent} />
      <text
        x={def.x + 16}
        y={def.y + 13}
        fontSize={9}
        fontWeight={700}
        fill="#8a9096"
        fontFamily="Consolas, monospace"
      >
        {def.name}
      </text>
    </g>
  );
}

interface TerminalDotProps {
  id: TerminalId;
  pos: Point;
  label?: string;
  labelSide?: "above" | "below";
  fixed?: boolean;
  state: "idle" | "active" | "miss" | "bad";
  onClick: (id: TerminalId) => void;
}

function TerminalDot({
  id,
  pos,
  label,
  labelSide,
  fixed,
  state,
  onClick,
}: TerminalDotProps) {
  const fill =
    state === "active"
      ? "#e6a800"
      : state === "miss"
        ? "#ffd54f"
        : state === "bad"
          ? "#ef9a9a"
          : fixed
            ? "#b7bcc1"
            : "#e3e6e9";
  const stroke =
    state === "miss"
      ? "#c77700"
      : state === "bad"
        ? "#c62828"
        : fixed
          ? "#7d838a"
          : "#4a4f54";
  return (
    <g>
      <circle
        cx={pos.x}
        cy={pos.y}
        r={7}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.6}
        className={
          fixed ? "cursor-not-allowed" : "cursor-pointer hover:fill-[#e6a800]"
        }
        style={
          state === "miss" ? { animation: "pulse 1s infinite" } : undefined
        }
        onClick={(e) => {
          e.stopPropagation();
          if (!fixed) onClick(id);
        }}
      />
      {label && (
        <text
          x={pos.x}
          y={pos.y + (labelSide === "above" ? -12 : 20)}
          textAnchor="middle"
          fontSize={9}
          fontWeight={700}
          fill="#1d2023"
          fontFamily="Consolas, monospace"
          pointerEvents="none"
        >
          {label}
        </text>
      )}
    </g>
  );
}

/* ============================================================ */
/*  MAIN CANVAS — everything below is ONE interface + ONE        */
/*  function, one after another, never nested.                   */
/* ============================================================ */

/* ---------- (A) THE "SPEC SHEET" — no logic, just shapes ---------- */
export interface WiringCanvasProps {
  api: WiringApi;
  missTerminals: ReadonlySet<string>;
  badWireIds: ReadonlySet<string>;
  pressed: ReadonlySet<string>;
  onPress: (key: string) => void;
  onRelease: (key: string) => void;
}
/* ---------- interface WiringCanvasProps ENDS HERE ---------- */

/* ---------- (B) THE ACTUAL COMPONENT — the real code that runs ---------- */
export function WiringCanvas({
  api,
  missTerminals,
  badWireIds,
  pressed,
  onPress,
  onRelease,
}: WiringCanvasProps) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [cursor, setCursor] = React.useState<Point | null>(null);
  const [view, setView] = React.useState<ViewBox>(FULL_VIEW);

  // pan bookkeeping — refs so mousemove stays cheap
  const panRef = React.useRef<{
    startClient: Point;
    startView: ViewBox;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = React.useRef(false);

  const toSvgPoint = React.useCallback(
    (clientX: number, clientY: number): Point => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const m = svg.getScreenCTM();
      const p = m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
      return { x: p.x, y: p.y };
    },
    [],
  );

  /* wheel zoom toward the cursor — non-passive so we can preventDefault */
  React.useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const focus = toSvgPoint(e.clientX, e.clientY);
      setView((v) => {
        const factor = e.deltaY > 0 ? 1.12 : 1 / 1.12;
        const next = clampView({ ...v, w: v.w * factor, h: v.h * factor });
        const scale = next.w / v.w;
        return {
          ...next,
          x: focus.x - (focus.x - v.x) * scale,
          y: focus.y - (focus.y - v.y) * scale,
        };
      });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [toSvgPoint]);

  /* pan: middle-mouse drag, or left drag on empty space while holding Space */
  const spaceDown = React.useRef(false);
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceDown.current = true;
      if (e.key === "Escape") {
        if (api.draft) api.cancelDraft();
        else if (api.selectedWireId) api.selectWire(null);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && api.selectedWireId) {
        e.preventDefault();
        api.deleteWire(api.selectedWireId);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceDown.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [api]);

  const onMouseDown = (e: React.MouseEvent) => {
    const middle = e.button === 1;
    const spacePan = e.button === 0 && spaceDown.current;
    if (middle || spacePan) {
      e.preventDefault();
      panRef.current = {
        startClient: { x: e.clientX, y: e.clientY },
        startView: view,
        moved: false,
      };
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    const pan = panRef.current;
    if (pan) {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      // pixels -> svg units at the CURRENT zoom of the pan start
      const unitPerPx = pan.startView.w / rect.width;
      const dx = (e.clientX - pan.startClient.x) * unitPerPx;
      const dy = (e.clientY - pan.startClient.y) * unitPerPx;
      if (Math.abs(dx) + Math.abs(dy) > 2) pan.moved = true;
      setView({
        ...pan.startView,
        x: pan.startView.x - dx,
        y: pan.startView.y - dy,
      });
      return;
    }
    if (api.draft) setCursor(toSvgPoint(e.clientX, e.clientY));
  };

  const onMouseUp = () => {
    if (panRef.current?.moved) suppressClickRef.current = true;
    panRef.current = null;
  };

  const handleTerminalClick = (id: TerminalId) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (!api.draft) api.startDraft(id, termPos(id));
    else if (api.draft.from !== id) api.commitDraft(id, termPos(id));
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (api.draft) api.addAnchor(toSvgPoint(e.clientX, e.clientY));
    else api.selectWire(null);
  };

  /**
   * Overlap-aware wire selection with click-cycling:
   * find every cable within tolerance of the click point; if the current
   * selection is one of them, step to the next — repeated clicks on a
   * crowded spot walk through each overlapping cable in turn.
   */
  const handleWireClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    const p = toSvgPoint(e.clientX, e.clientY);
    const TOLERANCE = 9; // svg units — matches the 14-wide hit stroke
    const candidates = api.wires.filter((w) => wireDistance(w, p) <= TOLERANCE);
    if (candidates.length === 0) return;

    const idx = candidates.findIndex((w) => w.id === api.selectedWireId);
    const next =
      idx === -1
        ? candidates[candidates.length - 1] // topmost first
        : candidates[(idx + 1) % candidates.length]; // then cycle
    api.selectWire(next.id);
  };

  /** Errors only: red dashed. Correct cables keep their body color. */
  const isWrong = (w: Wire): boolean =>
    Boolean(dangerCheck(w.from, w.to)) || badWireIds.has(w.id);

  const mcbIn = [
    terminalPosition("MCB", "L1_IN"),
    terminalPosition("MCB", "L2_IN"),
  ];

  const hasSelection = api.selectedWireId !== null;

  return (
    <>
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full cursor-crosshair bg-panel-plate"
        onClick={handleCanvasClick}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {PANEL_COMPONENTS.map((c) => {
          if (c.kind === "image") return <ImageComponent key={c.key} def={c} />;
          if (c.kind === "terminalBlock")
            return <TerminalBlock key={c.key} def={c} />;
          return (
            <DeviceBox
              key={c.key}
              def={c}
              pressed={c.kind === "button" ? pressed.has(c.key) : undefined}
              onPress={onPress}
              onRelease={onRelease}
            />
          );
        })}

        <g>
          {mcbIn.map((p, i) => (
            <path
              key={i}
              d={`M ${p.x} ${p.y - 55} L ${p.x} ${p.y}`}
              fill="none"
              stroke="#9aa0a6"
              strokeWidth={3.5}
              strokeDasharray="2 4"
            />
          ))}
          <text
            x={(mcbIn[0].x + mcbIn[1].x) / 2}
            y={mcbIn[0].y - 63}
            textAnchor="middle"
            fontSize={10}
            fill="#8a9096"
            fontFamily="Consolas, monospace"
          >
            220VAC (pre-wired)
          </text>
        </g>

        {api.wires.map((w) => {
          const d = orthoPath([...w.points]);
          const selected = api.selectedWireId === w.id;
          const wrong = isWrong(w);
          const dimmed = hasSelection && !selected;
          return (
            <g key={w.id} className={dimmed ? "opacity-30" : ""}>
              <path
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth={14}
                className="cursor-pointer"
                onClick={handleWireClick}
              />
              {/* jacket outline — keeps light colors (white/yellow) visible */}
              <path
                d={d}
                fill="none"
                stroke="#3f4449"
                strokeWidth={5}
                strokeLinecap="square"
                strokeLinejoin="miter"
                className="pointer-events-none"
                opacity={wrong ? 0 : 0.55}
              />
              <path
                d={d}
                fill="none"
                stroke={wrong ? "#b71c1c" : w.color}
                strokeWidth={3.5}
                strokeLinecap="square"
                strokeLinejoin="miter"
                strokeDasharray={wrong ? "10 6" : undefined}
                className={`${selected ? "drop-shadow-[0_0_4px_#e6a800]" : ""} pointer-events-none`}
              />
            </g>
          );
        })}

        {api.draft && cursor && (
          <path
            d={orthoPath(api.draft.points, cursor)}
            fill="none"
            stroke={api.drawColor}
            strokeWidth={2.5}
            strokeDasharray="6 5"
            pointerEvents="none"
          />
        )}

        {PANEL_COMPONENTS.flatMap((c) =>
          c.terminals.map((t) => {
            const id = `${c.key}.${t.id}`;
            const pos = terminalPosition(c.key, t.id);
            const state =
              api.draft?.from === id
                ? "active"
                : missTerminals.has(id)
                  ? "miss"
                  : "idle";
            return (
              <TerminalDot
                key={id}
                id={id}
                pos={pos}
                label={t.label}
                labelSide={t.labelSide}
                fixed={t.fixed}
                state={state}
                onClick={handleTerminalClick}
              />
            );
          }),
        )}
      </svg>

      {/* cable color palette — sticky drawing color, recolors selected cable */}
      <div className="absolute right-3 top-3 flex items-center gap-1.5 border border-panel-border bg-panel-box px-2 py-1.5">
        <span className="mr-1 font-mono text-[9px] font-bold tracking-wide text-ink-dim">
          CABLE
        </span>
        {CABLE_COLORS.map((c) => {
          const active = api.drawColor === c.value;
          return (
            <button
              key={c.value}
              title={c.name}
              onClick={() => api.setDrawColor(c.value)}
              className={`h-6 w-6 border-2 transition-transform ${
                active
                  ? "scale-110 border-[#e6a800]"
                  : "border-[#9aa0a6] hover:scale-105"
              }`}
              style={{ backgroundColor: c.value }}
            />
          );
        })}
      </div>

      {/* zoom controls */}
      <div className="absolute bottom-3 right-3 flex flex-col border border-panel-border bg-panel-box">
        <button
          className="h-9 w-9 border-b border-panel-border text-lg font-bold hover:bg-white"
          title="Zoom in (or mouse wheel)"
          onClick={() =>
            setView((v) => {
              const cx = v.x + v.w / 2;
              const cy = v.y + v.h / 2;
              const next = clampView({ ...v, w: v.w / 1.25, h: v.h / 1.25 });
              return { ...next, x: cx - next.w / 2, y: cy - next.h / 2 };
            })
          }
        >
          +
        </button>
        <button
          className="h-9 w-9 border-b border-panel-border text-lg font-bold hover:bg-white"
          title="Zoom out"
          onClick={() =>
            setView((v) => {
              const cx = v.x + v.w / 2;
              const cy = v.y + v.h / 2;
              const next = clampView({ ...v, w: v.w * 1.25, h: v.h * 1.25 });
              return { ...next, x: cx - next.w / 2, y: cy - next.h / 2 };
            })
          }
        >
          −
        </button>
        <button
          className="h-9 w-9 text-[10px] font-bold hover:bg-white"
          title="Fit whole panel"
          onClick={() => setView(FULL_VIEW)}
        >
          FIT
        </button>
      </div>
    </>
  );
}
/* ---------- function WiringCanvas ENDS HERE (end of file) ---------- */
