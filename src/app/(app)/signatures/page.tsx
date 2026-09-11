import { PenLine, Star, Trash2 } from "lucide-react";
import { requireSubject } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { fmtDateTime } from "@/lib/format";
import { SignatureCreator } from "./signature-pad";
import { revokeSignatureAction, setDefaultSignatureAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function SignaturesPage() {
  const subject = await requireSubject();
  const signatures = await prisma.signature.findMany({
    where: { userId: subject.userId, revokedAt: null },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div>
      <PageHeader
        title="Tanda Tangan Tersimpan"
        description="Kelola tanda tangan untuk persetujuan digital internal. Hanya dapat digunakan oleh Anda sendiri."
      />
      <div className="space-y-6">
        <SignatureCreator />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <PenLine className="size-4" /> Tanda Tangan Aktif
            </CardTitle>
          </CardHeader>
          <CardContent>
            {signatures.length === 0 ? (
              <EmptyState icon={<PenLine className="size-6" />} title="Belum ada tanda tangan" />
            ) : (
              <ul className="divide-y divide-border">
                {signatures.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-medium">
                        {s.type === "DRAWN" ? "Gambar tangan" : "Unggahan gambar"}
                        {s.isDefault && <Badge tone="success">Default</Badge>}
                      </p>
                      <p className="text-xs text-muted-foreground">Dibuat {fmtDateTime(s.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!s.isDefault && (
                        <form action={setDefaultSignatureAction}>
                          <input type="hidden" name="id" value={s.id} />
                          <Button type="submit" variant="ghost" size="sm">
                            <Star className="size-4" /> Default
                          </Button>
                        </form>
                      )}
                      <form action={revokeSignatureAction}>
                        <input type="hidden" name="id" value={s.id} />
                        <Button type="submit" variant="ghost" size="sm" className="text-danger">
                          <Trash2 className="size-4" /> Cabut
                        </Button>
                      </form>
                    </div>
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
