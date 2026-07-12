# PLC Playground — Wiring Simulator

Interactive wiring trainer: draw cables between component terminals in the
browser; a validation engine checks them live and (in production) energizes
real relays on an ESP32 wired to a Mitsubishi FX3U-48M.

## Stack

- **Next.js (App Router) + TypeScript** — strict mode
- **Tailwind CSS + shadcn-style UI primitives** — sharp industrial theme
- Real hardware photos (`public/images/*.webp`, cropped to device edges)

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit
```

## Architecture

```
src/
  lib/wiring/
    types.ts                    Domain types (Wire, ComponentDef, EvalResult…)
    config/
      panel.ts                  Panel layout, proportional sizing (4.4 px/mm),
                                COM groups, address lists
      terminals.generated.ts    AUTO-GENERATED terminal coordinates (% of image)
    engine/
      net.ts                    Electrical net resolution (jumper blocks are common)
      feedback.ts               Danger + polarity lesson rules
      evaluate.ts               Task evaluation: free X/Y address assignment,
                                contact-orientation matching, bypass detection,
                                dynamic COM-group tasks
    hooks/
      use-wiring.ts             Reducer-based wiring state + memoized evaluation
  components/
    ui/                         shadcn-style primitives (button, card, badge…)
    simulator/
      WiringCanvas.tsx          SVG canvas: click-to-place orthogonal wires
      ChecklistPanel.tsx        Live task list (green on completion, no validate)
      MessagePanel.tsx          Feedback console
      SimulatorShell.tsx        Composition + hint mode (VALIDATE button)
```

## Wiring rules (Scenario 01)

- MCB input is pre-wired to 220VAC; the student starts at **L1/L2 OUT**
- S/S ← 24VDC only (sink inputs) · COM ← 0VDC only
- Buttons: 0V block → contact → **any free X input** (each button its own X)
  - Green buttons must use the NO contact (13/14), red the NC contact (21/22)
- Lamps: **any free Y output** → lamp (X1/X2) → +24V block
- COM tasks appear dynamically for whichever Y groups are used
  (COM1: Y0–Y3, COM2: Y4–Y7, …)

## Next steps

- `POST /api/validate` route + Spring Boot backend so the answer key never
  ships to the browser; ESP32 relay commands from the server
- Scenario registry (multiple modules), endless pannable canvas
