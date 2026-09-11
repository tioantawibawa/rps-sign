import { z } from "zod";
import { handleRoute, ok } from "@/lib/api";
import { getSubjectOrThrow } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";
import { canReadDocument } from "@/domain/permissions";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { saveMetadata } from "@/server/documents/document-service";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const subject = await getSubjectOrThrow();
    const { id } = await params;
    const doc = await prisma.document.findUnique({
      where: { id },
      include: {
        course: true,
        studyProgram: true,
        academicPeriod: true,
        owner: { select: { id: true, name: true } },
        currentVersion: { include: { metadata: true, validations: true } },
        approvals: { include: { workflowStep: true, approver: { select: { name: true } } } },
      },
    });
    if (!doc) throw new NotFoundError();
    if (!canReadDocument(subject, doc)) throw new ForbiddenError();
    return ok(doc);
  });
}

const metadataSchema = z.object({
  courseCode: z.string().min(1),
  courseName: z.string().min(1),
  credits: z.number().int().min(1).max(12),
  semester: z.number().int().min(1).max(14),
  developerName: z.string().min(1),
  revisionNumber: z.string().optional(),
  preparationDate: z.coerce.date(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const subject = await getSubjectOrThrow();
    const { id } = await params;
    const body = metadataSchema.parse(await req.json());
    await saveMetadata(subject, id, body);
    return ok({ updated: true });
  });
}
