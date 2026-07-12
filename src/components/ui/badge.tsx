import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center border px-2 py-0.5 text-[11px] font-mono font-bold", {
  variants: {
    variant: {
      default: "border-panel-border bg-ink text-white",
      ok: "border-ok bg-[#dcefe1] text-[#14532d]",
      muted: "border-[#9aa0a6] bg-panel-muted text-ink-dim",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
