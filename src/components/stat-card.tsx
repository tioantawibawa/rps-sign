import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BadgeTone } from "@/domain/document-status";

const TONE_BG: Record<BadgeTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-secondary/10 text-secondary",
  primary: "bg-primary/10 text-primary",
  warning: "bg-warning/15 text-[#8a5a00]",
  success: "bg-success/12 text-success",
  danger: "bg-danger/12 text-danger",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
  hint,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: BadgeTone;
  hint?: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className={cn("flex size-10 items-center justify-center rounded-lg", TONE_BG[tone])}>
          <Icon className="size-5" />
        </div>
      </div>
    </Card>
  );
}
