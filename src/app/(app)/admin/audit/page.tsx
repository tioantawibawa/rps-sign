import { requireCapability } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";
import { AUDIT_ACTION_LABELS } from "@/server/audit/actions";
import { fmtDateTime } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; q?: string }>;
}) {
  const subject = await requireCapability("audit:read");
  const sp = await searchParams;

  const logs = await prisma.auditLog.findMany({
    where: {
      organizationId: subject.organizationId,
      action: sp.action || undefined,
    },
    include: { user: { select: { name: true } }, document: { select: { documentNumber: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return (
    <div>
      <PageHeader title="Audit Log" description="Catatan aktivitas sistem yang bersifat append-only." />
      <Card className="mb-4 p-4">
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" method="get">
          <div className="sm:w-64">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Aksi</label>
            <Select name="action" defaultValue={sp.action ?? ""}>
              <option value="">Semua aksi</option>
              {Object.entries(AUDIT_ACTION_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="outline">
            Terapkan
          </Button>
        </form>
      </Card>

      {logs.length === 0 ? (
        <EmptyState title="Tidak ada catatan" />
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Waktu</th>
                    <th className="px-4 py-3 font-medium">Aksi</th>
                    <th className="px-4 py-3 font-medium">Oleh</th>
                    <th className="px-4 py-3 font-medium">Dokumen</th>
                    <th className="px-4 py-3 font-medium">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map((l) => (
                    <tr key={l.id}>
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{fmtDateTime(l.createdAt)}</td>
                      <td className="px-4 py-2.5 font-medium">{AUDIT_ACTION_LABELS[l.action] ?? l.action}</td>
                      <td className="px-4 py-2.5">{l.user?.name ?? "Sistem"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{l.document?.documentNumber ?? "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{l.ipAddress ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
