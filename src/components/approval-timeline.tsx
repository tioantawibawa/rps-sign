import { ApprovalStatus } from "@prisma/client";
import { Check, Clock, RotateCcw, X, MinusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { roleLabel } from "@/domain/roles";
import { fmtDateTime } from "@/lib/format";
import { ApprovalStatusBadge } from "@/components/status-badge";

interface TimelineApproval {
  id: string;
  status: ApprovalStatus;
  comments: string | null;
  actedAt: Date | null;
  dueAt: Date | null;
  workflowStep: { order: number; label: string; role: string };
  approver: { name: string } | null;
}

const ICON: Record<ApprovalStatus, React.ReactNode> = {
  APPROVED: <Check className="size-4" />,
  PENDING: <Clock className="size-4" />,
  REVISION_REQUESTED: <RotateCcw className="size-4" />,
  REJECTED: <X className="size-4" />,
  SKIPPED: <MinusCircle className="size-4" />,
  INVALIDATED: <MinusCircle className="size-4" />,
};

const RING: Record<ApprovalStatus, string> = {
  APPROVED: "bg-success text-success-foreground",
  PENDING: "bg-muted text-muted-foreground",
  REVISION_REQUESTED: "bg-warning text-warning-foreground",
  REJECTED: "bg-danger text-danger-foreground",
  SKIPPED: "bg-muted text-muted-foreground",
  INVALIDATED: "bg-muted text-muted-foreground",
};

export function ApprovalTimeline({ approvals }: { approvals: TimelineApproval[] }) {
  const ordered = [...approvals].sort((a, b) => a.workflowStep.order - b.workflowStep.order);
  return (
    <ol className="relative space-y-5">
      {ordered.map((a, i) => (
        <li key={a.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className={cn("flex size-8 items-center justify-center rounded-full", RING[a.status])}>
              {ICON[a.status]}
            </span>
            {i < ordered.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
          </div>
          <div className="flex-1 pb-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">
                  {a.workflowStep.label}{" "}
                  <span className="text-muted-foreground">· {roleLabel(a.workflowStep.role as never)}</span>
                </p>
                {a.approver && <p className="text-xs text-muted-foreground">{a.approver.name}</p>}
              </div>
              <ApprovalStatusBadge status={a.status} />
            </div>
            {a.comments && (
              <p className="mt-1 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs text-foreground/80">
                “{a.comments}”
              </p>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">
              {a.actedAt ? `Diproses ${fmtDateTime(a.actedAt)}` : a.dueAt ? `Batas ${fmtDateTime(a.dueAt)}` : "Menunggu"}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
