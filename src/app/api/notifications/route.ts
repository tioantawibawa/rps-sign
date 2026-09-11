import { handleRoute, ok } from "@/lib/api";
import { getSubjectOrThrow } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => {
    const subject = await getSubjectOrThrow();
    const items = await prisma.notification.findMany({
      where: { userId: subject.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const unread = items.filter((n) => !n.readAt).length;
    return ok({ items, unread });
  });
}
