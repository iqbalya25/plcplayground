"use client";

import { useCallback, useMemo, useReducer } from "react";
import type { Point, TerminalId, Wire } from "../types";
import { evaluate } from "../engine/evaluate";

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
  | { type: "commitDraft"; to: TerminalId; at: Point }
  | { type: "cancelDraft" }
  | { type: "selectWire"; id: string | null }
  | { type: "deleteWire"; id: string }
  | { type: "reset" };

let wireSeq = 0;
const nextWireId = () => `w${++wireSeq}`;

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
    (to: TerminalId, at: Point) => dispatch({ type: "commitDraft", to, at }),
    [],
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

  return {
    ...state,
    evaluation,
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
