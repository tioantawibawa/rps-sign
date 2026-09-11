import { handleRoute, ok } from "@/lib/api";
import { getSubjectOrThrow } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";
import { canReadDocument } from "@/domain/permissions";
import { ForbiddenError, NotFoundError } from "@/server/errors";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const subject = await getSubjectOrThrow();
    const { id } = await params;
    const doc = await prisma.document.findUnique({
      where: { id },
      select: {
        organizationId: true,
        studyProgramId: true,
        clusterId: true,
        ownerId: true,
        status: true,
      },
    });
    if (!doc) throw new NotFoundError();
    if (!canReadDocument(subject, doc)) throw new ForbiddenError();

    const logs = await prisma.auditLog.findMany({
      where: { documentId: id },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return ok(logs);
  });
}
