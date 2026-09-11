import { requireCapability } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";
import { roleLabel } from "@/domain/roles";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";

export const dynamic = "force-dynamic";

export default async function AdminWorkflowPage() {
  const subject = await requireCapability("workflow:manage");
  const workflows = await prisma.workflow.findMany({
    where: { organizationId: subject.organizationId },
    include: { steps: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader title="Workflow & SLA" description="Konfigurasi tahap persetujuan dan batas waktu (SLA)." />
      {workflows.length === 0 ? (
        <EmptyState title="Belum ada workflow" description="Jalankan seed untuk membuat workflow default." />
      ) : (
        <div className="space-y-6">
          {workflows.map((w) => (
            <Card key={w.id}>
              <CardHeader className="flex-row items-center justify-between pb-3">
                <CardTitle>{w.name}</CardTitle>
                <Badge tone={w.isActive ? "success" : "neutral"}>{w.isActive ? "Aktif" : "Nonaktif"}</Badge>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2">
                  {w.steps.map((s) => (
                    <li key={s.id} className="flex items-center justify-between rounded-md border border-border p-3">
                      <div className="flex items-center gap-3">
                        <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {s.order}
                        </span>
                        <div>
                          <p className="text-sm font-medium">{s.label}</p>
                          <p className="text-xs text-muted-foreground">{roleLabel(s.role)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Badge tone="info">SLA {s.slaHours} jam</Badge>
                        {s.requiresSignature && <Badge tone="primary">Tanda tangan</Badge>}
                        {s.requiresChecklist && <Badge tone="neutral">Checklist</Badge>}
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
