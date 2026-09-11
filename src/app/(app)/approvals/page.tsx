import Link from "next/link";
import { ClipboardCheck, ArrowRight, AlertTriangle } from "lucide-react";
import { requireSubject } from "@/server/auth/session";
import { listPendingForSubject } from "@/server/approvals/approval-queries";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const subject = await requireSubject();
  const pending = await listPendingForSubject(subject);

  return (
    <div>
      <PageHeader
        title="Persetujuan Saya"
        description="Dokumen yang menunggu tindakan Anda sesuai tahap dan kewenangan."
      />
      {pending.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="size-6" />}
          title="Tidak ada antrean persetujuan"
          description="Semua dokumen dalam kewenangan Anda sudah diproses."
        />
      ) : (
        <div className="grid gap-3">
          {pending.map((a) => {
            const overdue = a.dueAt && a.dueAt < new Date();
            return (
              <Link key={a.id} href={`/documents/${a.document.id}`}>
                <Card className="flex items-center justify-between gap-4 p-4 transition-colors hover:border-primary/40">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{a.document.course.name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {a.document.documentNumber ?? "Belum bernomor"} · {a.document.owner.name} · {a.workflowStep.label}
                    </p>
                    {a.dueAt && (
                      <p className={`mt-1 flex items-center gap-1 text-xs ${overdue ? "text-danger" : "text-muted-foreground"}`}>
                        {overdue && <AlertTriangle className="size-3.5" />}
                        Batas: {fmtDateTime(a.dueAt)}
                      </p>
                    )}
                  </div>
                  <ArrowRight className="size-5 shrink-0 text-muted-foreground" />
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
