import { PANEL_COMPONENTS, Y_COM_GROUPS } from "../wiring/config/panel";
import type { TaskResult } from "../wiring/types";

export type Lang = "en" | "id";
type MsgEntry = { en: string; id: string };

export const MESSAGES: Record<string, MsgEntry> = {
  // dangers
  "ac-dc-contact": {
    en: "⚠ DANGER: 220VAC must never touch a 24VDC terminal. In a real panel this destroys the DC circuit instantly.",
    id: "⚠ BAHAYA: 220VAC tidak boleh menyentuh terminal 24VDC. Di panel asli, ini langsung merusak rangkaian DC.",
  },
  "short-24-0": {
    en: "⚠ DANGER: +24V wired to 0V is a dead short across the power supply.",
    id: "⚠ BAHAYA: +24V terhubung ke 0V adalah hubung singkat langsung pada power supply.",
  },
  "short-l1-l2": {
    en: "⚠ DANGER: L1 wired directly to L2 is a dead short — the MCB would trip immediately.",
    id: "⚠ BAHAYA: L1 terhubung langsung ke L2 adalah hubung singkat — MCB akan langsung trip.",
  },
  // polarity lessons
  "ss-needs-0v": {
    en: "❌ S/S must receive 0VDC, not 24V. Feed it from the 0V block.",
    id: "❌ S/S harus menerima 0VDC, bukan 24V. Ambil dari blok 0V.",
  },
  "com-needs-0v": {
    en: "❌ COM terminals must receive 0VDC, not 24V. The output common is the 0V side in this configuration.",
    id: "❌ Terminal COM harus menerima 0VDC, bukan 24V. Common output ada di sisi 0V pada konfigurasi ini.",
  },
  "x-input-no-0v": {
    en: "❌ X inputs must not be tied to 0V. Because S/S is at 0V, an input activates when switched to 24V through a button.",
    id: "❌ Input X tidak boleh terhubung langsung ke 0V. Karena S/S di 0V, input aktif saat di-switch ke 24V lewat tombol.",
  },
  "x-input-direct-24v": {
    en: "❌ Do not wire an X input straight to 24V — it would be permanently ON. The 24V must pass through a push button contact.",
    id: "❌ Jangan sambungkan input X langsung ke 24V — nanti selalu ON. 24V harus lewat kontak push button dulu.",
  },
  "lamp-needs-24v": {
    en: "❌ The lamp's other terminal must go to the +24V block, not 0V. The Y output switches the 0V side internally through COM.",
    id: "❌ Terminal lampu yang lain harus ke blok +24V, bukan 0V. Output Y men-switch sisi 0V secara internal lewat COM.",
  },
  "button-switch-24v": {
    en: "❌ The button must switch 24V into the input, not 0V. Wire the button from the +24V block.",
    id: "❌ Tombol harus men-switch 24V ke input, bukan 0V. Sambungkan tombol dari blok +24V.",
  },
  "lamp-spare": {
    en: "❌ That lamp terminal is a spare — it is not connected internally. Use X1/X2.",
    id: "❌ Terminal lampu itu cadangan (spare) — tidak terhubung secara internal. Gunakan X1/X2.",
  },
  "same-net": {
    en: "❌ Both ends of this wire are already the same electrical point — the jumper block connects its terminals internally.",
    id: "❌ Kedua ujung kabel ini sudah satu titik elektrik yang sama — blok jumper menyambungkan terminalnya secara internal.",
  },
  // fallback + UI status messages
  "not-part-of-circuit": {
    en: "❌ {from} → {to} is not part of this circuit. Trace the current path: where must this signal come from?",
    id: "❌ {from} → {to} bukan bagian dari rangkaian ini. Telusuri jalur arusnya: sinyal ini seharusnya datang dari mana?",
  },
  "all-correct-live": {
    en: "✅ All connections correct. Physical relays energized on the PLC.",
    id: "✅ Semua koneksi sudah benar. Relay fisik di PLC sudah aktif.",
  },
  "all-correct-pending": {
    en: "✅ All connections correct — relays will energize when the PLC reconnects.",
    id: "✅ Semua koneksi sudah benar — relay akan aktif begitu PLC tersambung kembali.",
  },
  "server-disconnected": {
    en: "⚠ Server disconnected — wiring is saved and will be applied to the hardware automatically on reconnect.",
    id: "⚠ Server terputus — wiring tersimpan dan akan otomatis diterapkan ke hardware saat tersambung kembali.",
  },
  "plc-stopped": {
    en: "⚠ PLC is in STOP mode — switch it to RUN for outputs to respond.",
    id: "⚠ PLC dalam mode STOP — ubah ke RUN agar output bisa merespons.",
  },
  "everything-correct-so-far": {
    en: "✅ Everything wired so far is correct — nothing missing.",
    id: "✅ Semua yang sudah terpasang sudah benar — tidak ada yang kurang.",
  },
  "panel-reset": {
    en: "// Panel reset. Start from MCB L1/L2 OUT.",
    id: "// Panel direset. Mulai dari MCB L1/L2 OUT.",
  },
  "initial-hint": {
    en: "// MCB input is pre-wired to 220VAC. Start from MCB L1/L2 OUT. Correct wires turn green automatically — buttons and lamps may use any free X / Y address.",
    id: "// Input MCB sudah pre-wired ke 220VAC. Mulai dari MCB L1/L2 OUT. Kabel yang benar otomatis jadi hijau — tombol dan lampu boleh pakai alamat X/Y bebas.",
  },
};

export function translateMessage(
  key: string,
  lang: Lang,
  params?: Record<string, string>,
): string {
  const entry = MESSAGES[key];
  if (!entry) return key;
  let text = entry[lang];
  if (params)
    for (const [k, v] of Object.entries(params))
      text = text.replaceAll(`{${k}}`, v);
  return text;
}

/* ---------- checklist task labels ---------------------------------------- */
const FIXED_TASK_LABELS: Record<string, MsgEntry> = {
  "ac-plc-l": {
    en: "PLC power — PLC L on the L line (from MCB L1 OUT)",
    id: "Daya PLC — PLC L pada jalur L (dari MCB L1 OUT)",
  },
  "ac-plc-n": {
    en: "PLC power — PLC N on the N line (from MCB L2 OUT)",
    id: "Daya PLC — PLC N pada jalur N (dari MCB L2 OUT)",
  },
  "ac-psu-l": {
    en: "Power supply input — PSU L on the L line",
    id: "Input catu daya — PSU L pada jalur L",
  },
  "ac-psu-n": {
    en: "Power supply input — PSU N on the N line",
    id: "Input catu daya — PSU N pada jalur N",
  },
  "dist-24": {
    en: "24V distribution — PSU +V → +24V block",
    id: "Distribusi 24V — PSU +V → blok +24V",
  },
  "dist-0": {
    en: "0V distribution — PSU −V → 0V block",
    id: "Distribusi 0V — PSU −V → blok 0V",
  },
  ss: {
    en: "Input common — S/S on the 0V net",
    id: "Common input — S/S pada jalur 0V",
  },
  "com-pending": {
    en: "Output common — 0V → COM of the Y group you use",
    id: "Common output — 0V → COM dari grup Y yang dipakai",
  },
};

function buttonType(key: string): "NO" | "NC" {
  return PANEL_COMPONENTS.find((c) => c.key === key)?.contactType ?? "NO";
}
const PAIR_LABEL: Record<"NO" | "NC", string> = { NO: "3/4", NC: "1/2" };

export function translateTask(task: TaskResult, lang: Lang): string {
  if (lang === "en") return task.label;

  const fixed = FIXED_TASK_LABELS[task.id];
  if (fixed) return fixed.id;

  let m = task.id.match(/^(PB\d+)-supply$/);
  if (m) {
    const type = buttonType(m[1]);
    return `${m[1]} supply — 24V (blok, PSU, atau jumper) → kontak ${type} (${PAIR_LABEL[type]})`;
  }
  m = task.id.match(/^(PB\d+)-signal$/);
  if (m) return `${m[1]} sinyal — kontak → input X mana pun yang masih kosong`;

  m = task.id.match(/^(LAMP\d+)-signal$/);
  if (m)
    return `${m[1]} penggerak — output Y mana pun yang masih kosong → lampu (X1/X2)`;

  m = task.id.match(/^(LAMP\d+)-return$/);
  if (m) return `${m[1]} balik — lampu → blok +24V (blok, PSU, atau jumper)`;

  m = task.id.match(/^com-(COM\d+)$/);
  if (m) {
    const members = Y_COM_GROUPS[m[1]]?.join(", ") ?? "";
    return `Common output — 0V → ${m[1]} (${members})`;
  }
  return task.label; // fallback aman: tampilkan English drpd error
}
