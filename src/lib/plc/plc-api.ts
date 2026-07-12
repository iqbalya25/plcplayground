/**
 * plc-api.ts
 * Frontend helper for talking to the PLC bridge (via the Next.js proxy).
 * Place in: src/lib/plc/plc-api.ts
 *
 * Call sendWiring() whenever the wire list changes (add/delete), and
 * resetPlc() from the Reset button.
 */

export interface WireDTO {
  from: string;
  to: string;
}

export interface PlcResponse {
  ok: boolean;
  plc: "running" | "stopped" | "disconnected";
  coils: Record<string, boolean>;
  applied?: Record<string, boolean>;
  error?: string;
}

export async function sendWiring(wires: WireDTO[]): Promise<PlcResponse> {
  const res = await fetch("/api/plc/wiring", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wires }),
  });
  return res.json();
}

export async function resetPlc(): Promise<PlcResponse> {
  const res = await fetch("/api/plc/reset", { method: "POST" });
  return res.json();
}
