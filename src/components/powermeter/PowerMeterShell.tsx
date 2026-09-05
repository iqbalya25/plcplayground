"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePublishHeaderStatus } from "@/components/layout/HeaderStatusContext";
import { usePowerMeterState } from "@/lib/powermeter/hooks/use-powermeter-state";

const MOTORS = [
  { id: "motor1", label: "Motor 1", kw: 15 },
  { id: "motor2", label: "Motor 2", kw: 30 },
  { id: "motor3", label: "Motor 3", kw: 55 },
] as const;

function fmt(n: number | undefined, digits = 1): string {
  return n === undefined ? "—" : n.toFixed(digits);
}

function Metric({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="border border-panel-border bg-panel-muted p-2">
      <div className="text-[10px] font-bold uppercase tracking-wide text-ink-dim">
        {label}
      </div>
      <div className="font-mono text-lg font-bold">
        {value}
        {unit && <span className="ml-1 text-xs text-ink-dim">{unit}</span>}
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wide text-ink-dim">
        {label}
      </div>
      <div className="font-mono">{value}</div>
    </div>
  );
}

export function PowerMeterShell() {
  const { state, connected, setMotor } = usePowerMeterState();

  usePublishHeaderStatus({
    label: connected ? "Power Meter Connected" : "Power Meter disconnected",
    state: connected ? "ok" : "error",
  });

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#9ea4aa] p-4 text-ink">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Aggregate readings</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            <Metric label="P total" value={fmt(state?.pTotal)} unit="kW" />
            <Metric label="Q total" value={fmt(state?.qTotal)} unit="kVAR" />
            <Metric label="S total" value={fmt(state?.sTotal)} unit="kVA" />
            <Metric label="PF (cosφ)" value={fmt(state?.pfTotal, 2)} unit="" />
            <Metric
              label="Frequency"
              value={fmt(state?.frequency, 2)}
              unit="Hz"
            />
            <Metric
              label="Energy"
              value={fmt(state?.energyTotal, 2)}
              unit="kWh"
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Per-phase</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="text-ink-dim">
                  <th className="pb-1 font-bold">Phase</th>
                  <th className="pb-1 font-bold">Voltage (V)</th>
                  <th className="pb-1 font-bold">Current (A)</th>
                  <th className="pb-1 font-bold">Power (kW)</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {(["a", "b", "c"] as const).map((p) => (
                  <tr key={p} className="border-t border-panel-border">
                    <td className="py-1 font-bold uppercase">{p}</td>
                    <td>{fmt(state?.phases[p]?.v)}</td>
                    <td>{fmt(state?.phases[p]?.i, 2)}</td>
                    <td>{fmt(state?.phases[p]?.p, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 grid grid-cols-3 gap-2 text-[12px] font-mono text-ink-dim">
              <span>Vab: {fmt(state?.vab)} V</span>
              <span>Vbc: {fmt(state?.vbc)} V</span>
              <span>Vca: {fmt(state?.vca)} V</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Motor load simulation</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {MOTORS.map((m) => {
              const running = state?.motors?.[m.id] ?? false;
              return (
                <Button
                  key={m.id}
                  variant={running ? "default" : "secondary"}
                  onClick={() => setMotor(m.id, !running)}
                  className="justify-between"
                >
                  <span>
                    {m.label} · {m.kw} kW
                  </span>
                  <span>{running ? "● RUNNING" : "○ STOPPED"}</span>
                </Button>
              );
            })}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Modbus TCP connection</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-[12px] sm:grid-cols-4">
            <InfoField label="IP Address" value="192.168.0.50" />
            <InfoField label="Port" value="502" />
            <InfoField label="Unit ID" value="1" />
            <InfoField label="Register format" value="Float32, big-endian" />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Register map — for your own Modbus master</CardTitle>
          </CardHeader>
          <CardContent className="text-[11.5px] leading-relaxed text-ink-dim">
            <p className="mb-2">
              Holding Registers (FC03), float32 pairs: Va=0–1, Vb=2–3, Vc=4–5,
              Vab=6–7, Vbc=8–9, Vca=10–11, Ia=12–13, Ib=14–15, Ic=16–17,
              Pa=18–19, Pb=20–21, Pc=22–23, P total=24–25, Q total=26–27, S
              total=28–29, PF=30–31, Frequency=32–33, Energy=34–35.
            </p>
            <p className="mb-2">
              Discrete Inputs (FC02): 0 = Motor 1 running, 1 = Motor 2, 2 =
              Motor 3.
            </p>
            <p>Coils (FC01/FC05): 0 = write 1 to reset the energy counter.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
