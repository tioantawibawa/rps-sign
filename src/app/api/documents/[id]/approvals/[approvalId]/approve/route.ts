import { z } from "zod";
import { handleRoute, ok } from "@/lib/api";
import { getSubjectOrThrow } from "@/server/auth/session";
import { approve } from "@/server/approvals/approval-service";

export const dynamic = "force-dynamic";

const schema = z.object({
  signatureId: z.string().optional(),
  comments: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; approvalId: string }> },
) {
  return handleRoute(async () => {
    const subject = await getSubjectOrThrow();
    const { id, approvalId } = await params;
    const body = schema.parse(await req.json().catch(() => ({})));
    const result = await approve(subject, id, approvalId, body);
    return ok(result);
  });
}
