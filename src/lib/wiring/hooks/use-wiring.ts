"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import type { Point, TerminalId, Wire } from "../types";
import { evaluate } from "../engine/evaluate";

/** Sticky palette: black by default, no red (red is reserved for errors). */
export const CABLE_COLORS = [
  { name: "Black", value: "#17191c" },
  { name: "Blue", value: "#1565c0" },
  { name: "Yellow", value: "#f3b300" },
  { name: "Green", value: "#2e7d32" },
  { name: "White", value: "#f2f3f4" },
  { name: "Grey", value: "#8a9096" },
] as const;

export const DEFAULT_CABLE_COLOR = CABLE_COLORS[0].value; // black

interface DraftWire {
  from: TerminalId;
  points: Point[];
}

interface WiringState {
  wires: Wire[];
  draft: DraftWire | null;
  selectedWireId: string | null;
}

type Action =
  | { type: "startDraft"; from: TerminalId; at: Point }
  | { type: "addAnchor"; at: Point }
  | { type: "commitDraft"; to: TerminalId; at: Point; color: string }
  | { type: "cancelDraft" }
  | { type: "selectWire"; id: string | null }
  | { type: "deleteWire"; id: string }
  | { type: "recolorWire"; id: string; color: string }
  | { type: "hydrate"; wires: Wire[] }
  | { type: "reset" };

let wireSeq = 0;
const nextWireId = () => `w${++wireSeq}`;

const STORAGE_KEY = "plc-playground-wiring-v1";

function loadWires(): Wire[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Keep the ID counter ahead of the highest saved ID ("w7" -> 7),
    // otherwise the next new wire would reuse "w1" and collide.
    for (const w of parsed) {
      const n = Number(String(w?.id).slice(1));
      if (Number.isFinite(n) && n > wireSeq) wireSeq = n;
    }
    return parsed as Wire[];
  } catch {
    return []; // storage blocked or corrupted JSON
  }
}

function saveWires(wires: Wire[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wires));
  } catch {
    // storage full or blocked, not critical, ignore
  }
}

function reducer(state: WiringState, action: Action): WiringState {
  switch (action.type) {
    case "startDraft":
      return {
        ...state,
        draft: { from: action.from, points: [action.at] },
        selectedWireId: null,
      };
    case "addAnchor":
      return state.draft
        ? {
            ...state,
            draft: {
              ...state.draft,
              points: [...state.draft.points, action.at],
            },
          }
        : state;
    case "commitDraft": {
      if (!state.draft || state.draft.from === action.to) return state;
      const wire: Wire = {
        id: nextWireId(),
        from: state.draft.from,
        to: action.to,
        points: [...state.draft.points, action.at],
        color: action.color,
      };
      return { ...state, wires: [...state.wires, wire], draft: null };
    }
    case "cancelDraft":
      return { ...state, draft: null };
    case "selectWire":
      return { ...state, selectedWireId: action.id };
    case "deleteWire":
      return {
        ...state,
        wires: state.wires.filter((w) => w.id !== action.id),
        selectedWireId:
          state.selectedWireId === action.id ? null : state.selectedWireId,
      };
    case "recolorWire":
      return {
        ...state,
        wires: state.wires.map((w) =>
          w.id === action.id ? { ...w, color: action.color } : w,
        ),
      };
    case "hydrate":
      return { ...state, wires: action.wires };
    case "reset":
      return { wires: [], draft: null, selectedWireId: null };
    default:
      return state;
  }
}

export function useWiring() {
  const [state, dispatch] = useReducer(reducer, {
    wires: [],
    draft: null,
    selectedWireId: null,
  });

  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    dispatch({ type: "hydrate", wires: loadWires() });
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveWires(state.wires);
  }, [hydrated, state.wires]);

  const [drawColor, setDrawColorState] = useState<string>(DEFAULT_CABLE_COLOR);

  const evaluation = useMemo(() => evaluate(state.wires), [state.wires]);

  const startDraft = useCallback(
    (from: TerminalId, at: Point) => dispatch({ type: "startDraft", from, at }),
    [],
  );
  const addAnchor = useCallback(
    (at: Point) => dispatch({ type: "addAnchor", at }),
    [],
  );
  const commitDraft = useCallback(
    (to: TerminalId, at: Point) =>
      dispatch({ type: "commitDraft", to, at, color: drawColor }),
    [drawColor],
  );
  const cancelDraft = useCallback(() => dispatch({ type: "cancelDraft" }), []);
  const selectWire = useCallback(
    (id: string | null) => dispatch({ type: "selectWire", id }),
    [],
  );
  const deleteWire = useCallback(
    (id: string) => dispatch({ type: "deleteWire", id }),
    [],
  );
  const reset = useCallback(() => dispatch({ type: "reset" }), []);

  const setDrawColor = useCallback(
    (color: string) => {
      setDrawColorState(color);
      // Recolor the selected cable too — gives users a repair path for
      // "I drew it in the wrong color".
      if (state.selectedWireId) {
        dispatch({ type: "recolorWire", id: state.selectedWireId, color });
      }
    },
    [state.selectedWireId],
  );

  return {
    ...state,
    evaluation,
    drawColor,
    setDrawColor,
    startDraft,
    addAnchor,
    commitDraft,
    cancelDraft,
    selectWire,
    deleteWire,
    reset,
  };
}

export type WiringApi = ReturnType<typeof useWiring>;
