import { requireCapability } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";
import { fmtDateTime } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const subject = await requireCapability("settings:manage");
  const settings = await prisma.systemSetting.findMany({
    where: { organizationId: subject.organizationId },
    orderBy: { key: "asc" },
  });

  return (
    <div>
      <PageHeader title="Pengaturan Sistem" description="Parameter konfigurasi tingkat institusi." />
      {settings.length === 0 ? (
        <EmptyState title="Belum ada pengaturan" description="Pengaturan default dibuat melalui seed." />
      ) : (
        <div className="space-y-3">
          {settings.map((s) => (
            <Card key={s.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{s.key}</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="overflow-x-auto rounded-md bg-muted/60 p-3 text-xs">
                  {JSON.stringify(s.value, null, 2)}
                </pre>
                <p className="mt-2 text-xs text-muted-foreground">Diperbarui {fmtDateTime(s.updatedAt)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
