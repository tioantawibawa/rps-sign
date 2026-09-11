import * as React from "react";
import { cn } from "@/lib/utils";
import type { BadgeTone } from "@/domain/document-status";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-muted text-muted-foreground border-transparent",
  info: "bg-secondary/10 text-secondary border-secondary/20",
  primary: "bg-primary/10 text-primary border-primary/20",
  warning: "bg-warning/15 text-[#8a5a00] border-warning/30",
  success: "bg-success/12 text-success border-success/25",
  danger: "bg-danger/12 text-danger border-danger/25",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    />
  );
}
