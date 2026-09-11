import { z } from "zod";
import { RevisionCategory } from "@prisma/client";
import { handleRoute, ok } from "@/lib/api";
import { getSubjectOrThrow } from "@/server/auth/session";
import { requestRevision } from "@/server/approvals/approval-service";

export const dynamic = "force-dynamic";

const schema = z.object({
  category: z.nativeEnum(RevisionCategory),
  notes: z.string().min(5),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; approvalId: string }> },
) {
  return handleRoute(async () => {
    const subject = await getSubjectOrThrow();
    const { id, approvalId } = await params;
    const body = schema.parse(await req.json());
    await requestRevision(subject, id, approvalId, body);
    return ok({ requested: true });
  });
}
