import Link from "next/link";
import { requireSubject } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";
import { roleLabel } from "@/domain/roles";
import { initials } from "@/lib/utils";
import { fmtDateTime } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const subject = await requireSubject();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: subject.userId },
    include: {
      organization: true,
      assignments: {
        include: { faculty: true, studyProgram: true, cluster: true },
      },
    },
  });

  return (
    <div>
      <PageHeader title="Profil" description="Informasi akun dan penugasan Anda." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="flex flex-col items-center p-6 text-center">
            <div className="flex size-20 items-center justify-center rounded-full bg-primary/10 text-2xl font-semibold text-primary">
              {initials(user.name)}
            </div>
            <h2 className="mt-4 text-lg font-semibold">
              {[user.titlePrefix, user.name, user.titleSuffix].filter(Boolean).join(" ")}
            </h2>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <span className="mt-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {roleLabel(user.role)}
            </span>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link href="/forgot-password">Ubah kata sandi</Link>
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Detail Akun</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <Field label="Institusi" value={user.organization.name} />
              <Field label="NIP/NIK" value={user.employeeNumber ?? "—"} />
              <Field label="NIDN" value={user.academicNumber ?? "—"} />
              <Field label="Status" value={user.status} />
              <Field label="Login terakhir" value={fmtDateTime(user.lastLoginAt)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Penugasan</CardTitle>
            </CardHeader>
            <CardContent>
              {user.assignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada penugasan.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {user.assignments.map((a) => (
                    <li key={a.id} className="rounded-md border border-border px-3 py-2">
                      {[a.faculty?.name, a.studyProgram?.name, a.cluster?.name]
                        .filter(Boolean)
                        .join(" · ") || "Penugasan umum"}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
