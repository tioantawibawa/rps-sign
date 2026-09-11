import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { requireSubject } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { fmtDateTime } from "@/lib/format";
import { markAllRead } from "./actions";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const subject = await requireSubject();
  const items = await prisma.notification.findMany({
    where: { userId: subject.userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <PageHeader
        title="Notifikasi"
        description="Pemberitahuan terkait alur pengesahan RPS Anda."
        actions={
          <form action={markAllRead}>
            <Button type="submit" variant="outline" size="sm">
              <CheckCheck className="size-4" /> Tandai semua dibaca
            </Button>
          </form>
        }
      />
      {items.length === 0 ? (
        <EmptyState icon={<Bell className="size-6" />} title="Tidak ada notifikasi" />
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const body = (
              <Card
                className={`p-4 ${n.readAt ? "" : "border-primary/30 bg-primary/5"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-sm text-muted-foreground">{n.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{fmtDateTime(n.createdAt)}</p>
                  </div>
                  {!n.readAt && <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />}
                </div>
              </Card>
            );
            return n.link ? (
              <Link key={n.id} href={n.link}>
                {body}
              </Link>
            ) : (
              <div key={n.id}>{body}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
