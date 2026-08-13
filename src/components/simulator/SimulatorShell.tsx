"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWiring } from "@/lib/wiring/hooks/use-wiring";
import {
  contactLesson,
  dangerCheck,
  polarityCheck,
} from "@/lib/wiring/engine/feedback";
import { PANEL_COMPONENTS } from "@/lib/wiring/config/panel";
import { usePlcStatus } from "@/lib/plc/use-plc-status";
import { sendWiring, resetPlc } from "@/lib/plc/plc-api";
import { WiringCanvas } from "./WiringCanvas";
import { ChecklistPanel } from "./ChecklistPanel";
import { MessagePanel, type Message } from "./MessagePanel";
import { PlcStatusBadge } from "./PlcStatusBadge";
import { activeModel } from "@/lib/wiring/config/plc-models";

const INITIAL_MESSAGES: Message[] = [
  {
    kind: "dim",
    text: "// MCB input is pre-wired to 220VAC. Start from MCB L1/L2 OUT. Correct wires turn green automatically — buttons and lamps may use any free X / Y address.",
  },
];

export function SimulatorShell() {
  const api = useWiring();
  const { evaluation } = api;
  const plcStatus = usePlcStatus();
  const plcReady = plcStatus === "running";

  const [hintMessages, setHintMessages] =
    React.useState<Message[]>(INITIAL_MESSAGES);
  const [missTerminals, setMissTerminals] = React.useState<ReadonlySet<string>>(
    new Set(),
  );
  const [badWireIds, setBadWireIds] = React.useState<ReadonlySet<string>>(
    new Set(),
  );

  /* ---------- PLC sync: push wire list on every change ---------- */
  // The backend maps wires -> coils and writes only the diff, so pushing
  // the full list on every add/delete is cheap and keeps relays live.
  React.useEffect(() => {
    sendWiring(api.wires.map((w) => ({ from: w.from, to: w.to }))).catch(
      () => {
        /* bridge unreachable — badge already shows disconnected;
           backend re-asserts saved intent on reconnect */
      },
    );
  }, [api.wires]);

  const liveMessages = React.useMemo<Message[]>(() => {
    if (evaluation.dangers.length > 0) {
      return evaluation.dangers.map((d) => ({ kind: "err", text: d.message }));
    }
    if (evaluation.complete) {
      return [
        {
          kind: "ok",
          text: plcReady
            ? "✅ All connections correct. Physical relays energized on the PLC."
            : "✅ All connections correct — relays will energize when the PLC reconnects.",
        },
      ];
    }
    if (plcStatus === "disconnected") {
      return [
        {
          kind: "warn",
          text: "⚠ Server disconnected — wiring is saved and will be applied to the hardware automatically on reconnect.",
        },
        ...hintMessages,
      ];
    }
    if (plcStatus === "stopped") {
      return [
        {
          kind: "warn",
          text: "⚠ PLC is in STOP mode — switch it to RUN for outputs to respond.",
        },
        ...hintMessages,
      ];
    }
    return hintMessages;
  }, [evaluation, hintMessages, plcStatus, plcReady]);

  React.useEffect(() => {
    setMissTerminals(new Set());
    setBadWireIds(new Set());
  }, [api.wires]);

  const runHint = () => {
    const msgs: Message[] = [];
    const miss = new Set<string>();
    const bad = new Set<string>();

    evaluation.tasks.forEach((t, i) => {
      if (!t.done) msgs.push({ kind: "warn", text: `◌ ${i + 1}. ${t.label}` });
    });
    for (const w of api.wires) {
      if (evaluation.okWireIds.has(w.id)) continue;
      const danger = dangerCheck(w.from, w.to);
      if (danger) {
        msgs.push({ kind: "err", text: danger });
        continue;
      }
      bad.add(w.id);
      const wrongContact = [w.from, w.to]
        .map((term) => {
          const m = /^(PB\d)\.(1[34]|2[12])$/.exec(term);
          if (!m) return null;
          const def = PANEL_COMPONENTS.find((c) => c.key === m[1]);
          return def?.contactType
            ? contactLesson(m[1], def.contactType, m[2])
            : null;
        })
        .find(Boolean);
      const lesson = wrongContact ?? polarityCheck(w.from, w.to);
      msgs.push({
        kind: "err",
        text:
          lesson ??
          `❌ ${w.from} → ${w.to} is not part of this circuit. Trace the current path: where must this signal come from?`,
      });
      miss.add(w.from);
      miss.add(w.to);
    }
    if (msgs.length === 0) {
      msgs.push({
        kind: "ok",
        text: "✅ Everything wired so far is correct — nothing missing.",
      });
    }
    setHintMessages(msgs);
    setMissTerminals(miss);
    setBadWireIds(bad);
  };

  const resetAll = () => {
    api.reset();
    // Hardware reset: all coils OFF. (The wires effect will also push an
    // empty list, but calling resetPlc() makes the intent explicit and
    // works even if the wire list was already empty.)
    resetPlc().catch(() => {
      /* bridge unreachable — reset intent is saved server-side on reconnect */
    });
    setHintMessages([
      { kind: "dim", text: "// Panel reset. Start from MCB L1/L2 OUT." },
    ]);
    setMissTerminals(new Set());
    setBadWireIds(new Set());
  };

  return (
    <div className="flex h-screen flex-col bg-[#9ea4aa] text-ink">
      <header className="flex items-center gap-3 border-b-2 border-panel-border bg-panel-box px-4 py-2">
        <span className="bg-ink px-2 py-1 text-[11px] font-bold tracking-[0.12em] text-white">
          PLC PLAYGROUND
        </span>
        <h1 className="text-[15px] font-bold">
          Wiring Simulator — Control Panel
        </h1>
        <div className="ml-auto flex items-center gap-3">
          <PlcStatusBadge status={plcStatus} />
          <span className="ml-auto font-mono text-xs text-ink-dim">
          PLC_PLayground · <b className="text-ink">Automation</b> · {activeModel().label}
        </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <WiringCanvas
            api={api}
            missTerminals={missTerminals}
            badWireIds={badWireIds}
          />
          {evaluation.complete && (
            <div className="absolute left-1/2 top-4 -translate-x-1/2 border-2 border-ok bg-[#dcefe1] px-5 py-2 text-sm font-bold text-[#14532d]">
              {plcReady
                ? "✓ Wiring complete — physical relays energized. Ready for programming."
                : "✓ Wiring complete — waiting for PLC connection to energize relays."}
            </div>
          )}
        </div>

        <aside className="flex w-[320px] flex-col gap-3 border-l-2 border-panel-border bg-panel-muted p-3">
          <ChecklistPanel evaluation={evaluation} />
          <Card>
            <CardHeader>
              <CardTitle>How to wire</CardTitle>
            </CardHeader>
            <CardContent className="text-[11.5px] leading-relaxed text-ink-dim">
              Click a terminal to start a wire, click empty space to lock a
              corner, click the destination terminal to finish.{" "}
              <kbd className="border border-[#9aa0a6] bg-white px-1 font-mono text-[10px]">
                ESC
              </kbd>{" "}
              cancels. Click a wire, then{" "}
              <kbd className="border border-[#9aa0a6] bg-white px-1 font-mono text-[10px]">
                Delete
              </kbd>{" "}
              removes it. <b>Zoom</b>: mouse wheel or the +/− buttons ·{" "}
              <b>Pan</b>: middle-mouse drag, or hold{" "}
              <kbd className="border border-[#9aa0a6] bg-white px-1 font-mono text-[10px]">
                Space
              </kbd>{" "}
              and drag.
            </CardContent>
          </Card>
        </aside>
      </div>

      {/*
        Fixed-height footer: the message console scrolls internally instead of
        growing and stealing space from the worktable.
      */}
      <footer className="flex h-[132px] shrink-0 items-stretch gap-3 border-t-2 border-panel-border bg-panel-muted px-4 py-2.5">
        <div className="flex flex-col gap-2">
          <Button onClick={runHint}>VALIDATE (HINT)</Button>
          <Button variant="secondary" onClick={resetAll}>
            RESET
          </Button>
          {api.selectedWireId && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => api.deleteWire(api.selectedWireId!)}
            >
              DELETE WIRE
            </Button>
          )}
        </div>
        <MessagePanel messages={liveMessages} />
      </footer>
    </div>
  );
}
