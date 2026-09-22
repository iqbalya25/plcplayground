"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWiring } from "@/lib/wiring/hooks/use-wiring";
import { dangerCheck, polarityCheck } from "@/lib/wiring/engine/feedback";
import { PANEL_COMPONENTS } from "@/lib/wiring/config/panel";
import { usePlcStatus } from "@/lib/plc/use-plc-status";
import { sendWiring, resetPlc, powerOff, powerOn } from "@/lib/plc/plc-api";
import { WiringCanvas } from "./WiringCanvas";
import { ChecklistPanel } from "./ChecklistPanel";
import { MessagePanel, type Message } from "./MessagePanel";
import { usePublishHeaderStatus } from "../layout/HeaderStatusContext";
import { translateMessage, translateTask } from "@/lib/i18n/messages";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function SimulatorShell() {
  const api = useWiring();
  const { evaluation } = api;
  const plcStatus = usePlcStatus();
  const plcReady = plcStatus === "running";
  const { lang } = useLanguage();

  const [poweredOn, setPoweredOn] = React.useState(false);
  const [pressedButtons, setPressedButtons] = React.useState<
    ReadonlySet<string>
  >(new Set());
  const [litLamps] = React.useState<ReadonlySet<string>>(new Set());

  usePublishHeaderStatus({
    label: plcReady ? "PLC Connected" : "Server disconnected",
    state: plcReady ? "ok" : "error",
  });

  const [hintMessages, setHintMessages] = React.useState<Message[]>([
    { kind: "dim", text: translateMessage("initial-hint", lang) },
  ]);
  const [missTerminals, setMissTerminals] = React.useState<ReadonlySet<string>>(
    new Set(),
  );
  const [badWireIds, setBadWireIds] = React.useState<ReadonlySet<string>>(
    new Set(),
  );

  /* ---------- PLC sync: push wiring + button state, only while powered on ---------- */
  React.useEffect(() => {
    if (!poweredOn) return;
    sendWiring(
      api.wires.map((w) => ({ from: w.from, to: w.to })),
      [...pressedButtons],
    ).catch((err) => {
      console.error("[sendWiring] failed:", err);
    });
  }, [api.wires, pressedButtons, poweredOn]);

  const liveMessages = React.useMemo<Message[]>(() => {
    if (evaluation.dangers.length > 0) {
      return evaluation.dangers.map((d) => ({
        kind: "err",
        text: translateMessage(d.messageKey, lang),
      }));
    }
    if (evaluation.complete) {
      return [
        {
          kind: "ok",
          text: translateMessage(
            plcReady ? "all-correct-live" : "all-correct-pending",
            lang,
          ),
        },
      ];
    }
    if (plcStatus === "disconnected") {
      return [
        { kind: "warn", text: translateMessage("server-disconnected", lang) },
        ...hintMessages,
      ];
    }
    if (plcStatus === "stopped") {
      return [
        { kind: "warn", text: translateMessage("plc-stopped", lang) },
        ...hintMessages,
      ];
    }
    return hintMessages;
  }, [evaluation, hintMessages, plcStatus, plcReady, lang]);

  async function handleTogglePower() {
    if (poweredOn) {
      setPoweredOn(false);
      powerOff().catch(() => {});
      return;
    }

    const hasDanger = evaluation.dangers.length > 0;
    const result = await powerOn(
      api.wires.map((w) => ({ from: w.from, to: w.to })),
      hasDanger,
      [...pressedButtons],
    ).catch(() => null);

    if (result?.ok) {
      setPoweredOn(true);
    } else {
      setHintMessages([
        {
          kind: "err",
          text:
            result?.error ?? "❌ Cannot power on — fix wiring errors first.",
        },
      ]);
    }
  }

  const runHint = () => {
    const msgs: Message[] = [];
    const miss = new Set<string>();
    const bad = new Set<string>();

    evaluation.tasks.forEach((t, i) => {
      if (!t.done)
        msgs.push({
          kind: "warn",
          text: `◌ ${i + 1}. ${translateTask(t, lang)}`,
        });
    });
    for (const w of api.wires) {
      if (evaluation.okWireIds.has(w.id)) continue;
      const dangerKey = dangerCheck(w.from, w.to);
      if (dangerKey) {
        msgs.push({ kind: "err", text: translateMessage(dangerKey, lang) });
        continue;
      }
      bad.add(w.id);
      const polarityKey = polarityCheck(w.from, w.to);
      const text = polarityKey
        ? translateMessage(polarityKey, lang)
        : translateMessage("not-part-of-circuit", lang, {
            from: w.from,
            to: w.to,
          });
      msgs.push({ kind: "err", text });
      miss.add(w.from);
      miss.add(w.to);
    }
    if (msgs.length === 0) {
      msgs.push({
        kind: "ok",
        text: translateMessage("everything-correct-so-far", lang),
      });
    }
    setHintMessages(msgs);
    setMissTerminals(miss);
    setBadWireIds(bad);
  };

  const resetAll = () => {
    api.reset();
    setPoweredOn(false);
    resetPlc().catch(() => {});
    setHintMessages([
      { kind: "dim", text: translateMessage("panel-reset", lang) },
    ]);
    setMissTerminals(new Set());
    setBadWireIds(new Set());
  };

  const handlePress = React.useCallback((key: string) => {
    setPressedButtons((prev) => new Set(prev).add(key));
  }, []);
  const handleRelease = React.useCallback((key: string) => {
    setPressedButtons((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);
  // Safety net: kalau mouse dilepas di luar tombol (drag keluar area), tetap terlepas.
  React.useEffect(() => {
    const up = () => setPressedButtons(new Set());
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  return (
    <div className="flex h-full flex-col bg-[#9ea4aa] text-ink">
      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <WiringCanvas
            api={api}
            missTerminals={missTerminals}
            badWireIds={badWireIds}
            pressed={pressedButtons}
            litLamps={litLamps}
            onPress={handlePress}
            onRelease={handleRelease}
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
          <Button
            onClick={handleTogglePower}
            variant={poweredOn ? "default" : "secondary"}
          >
            {poweredOn ? "POWER OFF" : "POWER ON"}
          </Button>
          <Button onClick={runHint}>
            {lang === "en" ? "VALIDATE (HINT)" : "VALIDASI (BANTUAN)"}
          </Button>
          <Button variant="secondary" onClick={resetAll}>
            RESET
          </Button>
          {api.selectedWireId && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => api.deleteWire(api.selectedWireId!)}
            >
              {lang === "en" ? "DELETE WIRE" : "HAPUS KABEL"}
            </Button>
          )}
        </div>
        <MessagePanel messages={liveMessages} />
      </footer>
    </div>
  );
}
