import { z } from "zod";
import { ChecklistStatus } from "@prisma/client";
import { handleRoute, ok } from "@/lib/api";
import { getSubjectOrThrow } from "@/server/auth/session";
import { saveChecklist } from "@/server/approvals/approval-service";

export const dynamic = "force-dynamic";

const schema = z.object({
  items: z.array(
    z.object({
      itemCode: z.string(),
      label: z.string(),
      status: z.nativeEnum(ChecklistStatus),
      comment: z.string().optional(),
      pageNumber: z.number().int().nullable().optional(),
    }),
  ),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; approvalId: string }> },
) {
  return handleRoute(async () => {
    const subject = await getSubjectOrThrow();
    const { id, approvalId } = await params;
    const { items } = schema.parse(await req.json());
    await saveChecklist(subject, id, approvalId, items);
    return ok({ saved: true });
  });
}
