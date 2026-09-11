import { handleRoute, ok } from "@/lib/api";
import { getSubjectOrThrow } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/server/errors";

export const dynamic = "force-dynamic";

export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const subject = await getSubjectOrThrow();
    const { id } = await params;
    const notif = await prisma.notification.findUnique({ where: { id } });
    if (!notif || notif.userId !== subject.userId) throw new NotFoundError();
    await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
    return ok({ read: true });
  });
}
