import Link from "next/link";
import {
  FileText,
  FilePlus2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ClipboardList,
  ArrowRight,
} from "lucide-react";
import { DocumentStatus, Role } from "@prisma/client";
import { requireSubject } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";
import { scopedDocumentWhere } from "@/server/documents/document-queries";
import { listPendingForSubject } from "@/server/approvals/approval-queries";
import { roleLabel } from "@/domain/roles";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { DocumentStatusBadge } from "@/components/status-badge";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const subject = await requireSubject();
  const where = scopedDocumentWhere(subject);

  const grouped = await prisma.document.groupBy({
    by: ["status"],
    where,
    _count: { _all: true },
  });
  const byStatus: Record<string, number> = {};
  for (const g of grouped) byStatus[g.status] = g._count._all;
  const total = grouped.reduce((s, g) => s + g._count._all, 0);

  const inProgress =
    (byStatus[DocumentStatus.WAITING_LECTURER_SIGNATURE] ?? 0) +
    (byStatus[DocumentStatus.WAITING_RMK_APPROVAL] ?? 0) +
    (byStatus[DocumentStatus.WAITING_KAPRODI_APPROVAL] ?? 0) +
    (byStatus[DocumentStatus.SUBMITTED] ?? 0);

  const recent = await prisma.document.findMany({
    where,
    include: { course: true, owner: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
    take: 6,
  });

  const pending = await listPendingForSubject(subject);

  return (
    <div>
      <PageHeader
        title={`Selamat datang, ${subject.role === Role.DOSEN ? "Dosen" : roleLabel(subject.role)}`}
        description="Ringkasan aktivitas pengesahan RPS Anda."
        actions={
          subject.role === Role.DOSEN ? (
            <Button asChild>
              <Link href="/documents/new">
                <FilePlus2 className="size-4" /> Ajukan RPS
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total RPS" value={total} icon={FileText} tone="primary" />
        <StatCard label="Draf" value={byStatus[DocumentStatus.DRAFT] ?? 0} icon={FilePlus2} tone="neutral" />
        <StatCard label="Dalam Proses" value={inProgress} icon={Clock} tone="warning" />
        <StatCard label="Disahkan" value={byStatus[DocumentStatus.APPROVED] ?? 0} icon={CheckCircle2} tone="success" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Dokumen Terbaru</CardTitle>
            <Link href="/documents" className="text-sm font-medium text-primary hover:underline">
              Lihat semua
            </Link>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <EmptyState
                icon={<FileText className="size-6" />}
                title="Belum ada dokumen"
                description="Dokumen RPS akan tampil di sini."
              />
            ) : (
              <ul className="divide-y divide-border">
                {recent.map((doc) => (
                  <li key={doc.id}>
                    <Link
                      href={`/documents/${doc.id}`}
                      className="flex items-center justify-between gap-3 py-3 hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{doc.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {doc.documentNumber ?? "Belum bernomor"} · {doc.course.name} · {doc.owner.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <DocumentStatusBadge status={doc.status} />
                        <span className="hidden text-xs text-muted-foreground sm:inline">
                          {fmtDate(doc.updatedAt)}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Menunggu Tindakan</CardTitle>
            {pending.length > 0 && (
              <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-[#8a5a00]">
                {pending.length}
              </span>
            )}
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <EmptyState
                icon={<ClipboardList className="size-6" />}
                title="Tidak ada antrean"
                description="Tidak ada persetujuan yang menunggu Anda."
              />
            ) : (
              <ul className="space-y-2">
                {pending.slice(0, 5).map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/documents/${a.document.id}`}
                      className="flex items-center justify-between gap-2 rounded-md border border-border p-3 hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{a.document.course.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {a.document.documentNumber ?? "—"} · {a.document.owner.name}
                        </p>
                      </div>
                      {a.dueAt && a.dueAt < new Date() ? (
                        <AlertTriangle className="size-4 shrink-0 text-danger" />
                      ) : (
                        <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
