import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSubject } from "@/server/auth/session";
import { canReadDocument } from "@/domain/permissions";
import { AUDIT_ACTION_LABELS } from "@/server/audit/actions";
import { fmtDateTime } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

export const dynamic = "force-dynamic";

export default async function DocumentAuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const subject = await requireSubject();
  const doc = await prisma.document.findUnique({
    where: { id },
    select: {
      title: true,
      documentNumber: true,
      organizationId: true,
      studyProgramId: true,
      clusterId: true,
      ownerId: true,
      status: true,
    },
  });
  if (!doc) notFound();
  if (!canReadDocument(subject, doc)) notFound();

  const logs = await prisma.auditLog.findMany({
    where: { documentId: id },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return (
    <div>
      <PageHeader
        title="Audit Trail"
        description={`${doc.documentNumber ?? doc.title}`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/documents/${id}`}>
              <ArrowLeft className="size-4" /> Kembali
            </Link>
          </Button>
        }
      />
      {logs.length === 0 ? (
        <EmptyState title="Belum ada aktivitas" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Waktu</th>
                  <th className="px-4 py-3 font-medium">Aksi</th>
                  <th className="px-4 py-3 font-medium">Oleh</th>
                  <th className="px-4 py-3 font-medium">Entitas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{fmtDateTime(l.createdAt)}</td>
                    <td className="px-4 py-2.5 font-medium">{AUDIT_ACTION_LABELS[l.action] ?? l.action}</td>
                    <td className="px-4 py-2.5">{l.user?.name ?? "Sistem"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{l.entityType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
