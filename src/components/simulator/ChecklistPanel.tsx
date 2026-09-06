"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EvalResult } from "@/lib/wiring/types";
import { translateTask } from "@/lib/i18n/messages";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function ChecklistPanel({ evaluation }: { evaluation: EvalResult }) {
  const { lang } = useLanguage();
  const done = evaluation.tasks.filter((t) => t.done).length;
  return (
    <Card className="flex min-h-0 flex-1 flex-col">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>
          {lang === "en" ? "Wiring checklist" : "Checklist wiring"}
        </CardTitle>
        <Badge variant={done === evaluation.tasks.length ? "ok" : "muted"}>
          {done}/{evaluation.tasks.length}
        </Badge>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 p-0">
        <ScrollArea className="h-full px-3 pb-3">
          <ol className="flex flex-col gap-1">
            {evaluation.tasks.map((t, i) => (
              <li
                key={t.id}
                className={cn(
                  "flex items-start gap-2 border border-[#c4c8cc] bg-panel-box px-2 py-1.5 text-[11.5px] leading-snug text-[#43484d]",
                  t.done && "border-ok bg-[#dcefe1] text-[#14532d]",
                )}
              >
                <span
                  className={cn(
                    "min-w-[20px] font-mono font-bold text-[#8a9096]",
                    t.done && "text-ok",
                  )}
                >
                  {i + 1}.
                </span>
                <span
                  className={cn(
                    "mt-px flex h-3.5 w-3.5 min-w-3.5 items-center justify-center border-[1.5px] border-[#9aa0a6] bg-white text-[9px] font-bold text-white",
                    t.done && "border-ok bg-ok",
                  )}
                >
                  {t.done ? "✓" : ""}
                </span>
                <span>
                  {translateTask(t, lang)}
                  {t.detail && <b className="ml-1 font-mono">{t.detail}</b>}
                </span>
              </li>
            ))}
          </ol>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
