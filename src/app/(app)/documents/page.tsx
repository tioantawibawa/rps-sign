import Link from "next/link";
import { FilePlus2, FileText, Search } from "lucide-react";
import { DocumentStatus, Role } from "@prisma/client";
import { requireSubject } from "@/server/auth/session";
import { listDocuments } from "@/server/documents/document-queries";
import { DOCUMENT_STATUS_LABELS } from "@/domain/document-status";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/feedback";
import { DocumentStatusBadge } from "@/components/status-badge";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const subject = await requireSubject();
  const status = (sp.status as DocumentStatus) || undefined;
  const result = await listDocuments(subject, {
    status: status && status in DocumentStatus ? status : undefined,
    query: sp.q,
    page: Number(sp.page ?? 1),
  });

  return (
    <div>
      <PageHeader
        title="Dokumen RPS"
        description="Kelola dan pantau seluruh dokumen RPS sesuai kewenangan Anda."
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

      <Card className="mb-4 p-4">
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" method="get">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Cari
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                defaultValue={sp.q}
                placeholder="Judul, nomor, atau mata kuliah"
                className="pl-9"
              />
            </div>
          </div>
          <div className="sm:w-56">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Status
            </label>
            <Select name="status" defaultValue={sp.status ?? ""}>
              <option value="">Semua status</option>
              {Object.entries(DOCUMENT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="outline">
            Terapkan
          </Button>
        </form>
      </Card>

      {result.items.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-6" />}
          title="Tidak ada dokumen"
          description="Belum ada dokumen yang cocok dengan filter."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Dokumen</th>
                  <th className="px-4 py-3 font-medium">Mata Kuliah</th>
                  <th className="px-4 py-3 font-medium">Pemilik</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Diperbarui</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.items.map((doc) => (
                  <tr key={doc.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link href={`/documents/${doc.id}`} className="font-medium text-primary hover:underline">
                        {doc.title}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {doc.documentNumber ?? "Belum bernomor"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {doc.course.name}
                      <div className="text-xs text-muted-foreground">{doc.course.code}</div>
                    </td>
                    <td className="px-4 py-3">{doc.owner.name}</td>
                    <td className="px-4 py-3">
                      <DocumentStatusBadge status={doc.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(doc.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {result.pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Halaman {result.page} dari {result.pageCount} · {result.total} dokumen
          </span>
          <div className="flex gap-2">
            {result.page > 1 && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/documents?page=${result.page - 1}&status=${sp.status ?? ""}&q=${sp.q ?? ""}`}>
                  Sebelumnya
                </Link>
              </Button>
            )}
            {result.page < result.pageCount && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/documents?page=${result.page + 1}&status=${sp.status ?? ""}&q=${sp.q ?? ""}`}>
                  Berikutnya
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
