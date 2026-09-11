import { requireCapability } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AdminOrganizationPage() {
  const subject = await requireCapability("masterdata:manage");
  const faculties = await prisma.faculty.findMany({
    where: { organizationId: subject.organizationId },
    include: {
      studyPrograms: {
        include: {
          courseClusters: true,
          courses: true,
        },
      },
    },
    orderBy: { code: "asc" },
  });
  const periods = await prisma.academicPeriod.findMany({
    where: { organizationId: subject.organizationId },
    orderBy: { startDate: "desc" },
  });

  return (
    <div>
      <PageHeader title="Struktur Akademik" description="Fakultas, program studi, rumpun mata kuliah, dan periode." />
      <div className="space-y-6">
        {faculties.map((f) => (
          <Card key={f.id}>
            <CardHeader className="pb-3">
              <CardTitle>
                {f.name} <span className="text-sm font-normal text-muted-foreground">({f.code})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {f.studyPrograms.map((sp) => (
                <div key={sp.id} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {sp.level} {sp.name}
                    </p>
                    <div className="flex gap-2">
                      <Badge tone="info">{sp.courses.length} MK</Badge>
                      <Badge tone="neutral">{sp.courseClusters.length} rumpun</Badge>
                    </div>
                  </div>
                  {sp.courseClusters.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Rumpun: {sp.courseClusters.map((c) => c.name).join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Periode Akademik</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {periods.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                <span>
                  {p.name} · {p.academicYear} {p.term}
                </span>
                {p.isActive && <Badge tone="success">Aktif</Badge>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
