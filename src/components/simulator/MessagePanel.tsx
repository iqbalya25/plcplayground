"use client";

export interface Message {
  kind: "ok" | "err" | "warn" | "dim";
  text: string;
}

const COLORS: Record<Message["kind"], string> = {
  ok: "text-ok",
  err: "text-danger",
  warn: "text-warn",
  dim: "text-[#8a9096]",
};

export function MessagePanel({ messages }: { messages: Message[] }) {
  return (
    <div className="h-full min-h-[76px] flex-1 overflow-y-auto border border-[#9aa0a6] bg-white px-3 py-2 font-mono text-[12.5px] leading-relaxed text-[#33383d]">
      {messages.map((m, i) => (
        <div key={i} className={COLORS[m.kind]}>
          {m.text}
        </div>
      ))}
    </div>
  );
}
