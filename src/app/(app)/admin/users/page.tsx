import { Role } from "@prisma/client";
import { requireCapability } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS } from "@/domain/roles";
import { fmtDateTime } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CreateUserForm } from "./create-user-form";
import { changeRoleAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const subject = await requireCapability("users:manage");
  const users = await prisma.user.findMany({
    where: { organizationId: subject.organizationId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader title="Pengguna & Peran" description="Kelola akun dan peran pengguna institusi." />
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Tambah Pengguna</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateUserForm />
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle>Daftar Pengguna ({users.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Nama</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Login Terakhir</th>
                    <th className="px-4 py-3 font-medium">Peran</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="px-4 py-2.5 font-medium">{u.name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{u.email}</td>
                      <td className="px-4 py-2.5">
                        <Badge tone={u.status === "ACTIVE" ? "success" : "neutral"}>{u.status}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{fmtDateTime(u.lastLoginAt)}</td>
                      <td className="px-4 py-2.5">
                        <form action={changeRoleAction} className="flex items-center gap-2">
                          <input type="hidden" name="userId" value={u.id} />
                          <Select name="role" defaultValue={u.role} className="h-8 w-44 text-xs">
                            {Object.entries(ROLE_LABELS).map(([v, l]) => (
                              <option key={v} value={v}>
                                {l}
                              </option>
                            ))}
                          </Select>
                          <Button type="submit" variant="outline" size="sm" disabled={u.id === subject.userId && u.role === Role.ADMIN}>
                            Simpan
                          </Button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
