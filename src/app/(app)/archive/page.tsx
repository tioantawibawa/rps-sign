import Link from "next/link";
import { Archive, FileText } from "lucide-react";
import { DocumentStatus } from "@prisma/client";
import { requireSubject } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";
import { scopedDocumentWhere } from "@/server/documents/document-queries";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { DocumentStatusBadge } from "@/components/status-badge";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const subject = await requireSubject();
  const docs = await prisma.document.findMany({
    where: {
      AND: [
        scopedDocumentWhere(subject),
        { status: { in: [DocumentStatus.APPROVED, DocumentStatus.ARCHIVED] } },
      ],
    },
    include: { course: true, studyProgram: true },
    orderBy: { approvedAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <PageHeader title="Arsip" description="Dokumen RPS yang telah disahkan dan diarsipkan." />
      {docs.length === 0 ? (
        <EmptyState icon={<Archive className="size-6" />} title="Arsip kosong" description="Belum ada dokumen final." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {docs.map((d) => (
            <Card key={d.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileText className="size-5 text-primary" />
                  <div>
                    <Link href={`/documents/${d.id}`} className="font-medium hover:underline">
                      {d.course.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{d.documentNumber}</p>
                  </div>
                </div>
                <DocumentStatusBadge status={d.status} />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {d.studyProgram.name} · Disahkan {fmtDate(d.approvedAt)}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
