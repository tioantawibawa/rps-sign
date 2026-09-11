import { z } from "zod";
import { handleRoute, ok } from "@/lib/api";
import { getSubjectOrThrow } from "@/server/auth/session";
import { reject } from "@/server/approvals/approval-service";

export const dynamic = "force-dynamic";

const schema = z.object({ notes: z.string().min(5) });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; approvalId: string }> },
) {
  return handleRoute(async () => {
    const subject = await getSubjectOrThrow();
    const { id, approvalId } = await params;
    const body = schema.parse(await req.json());
    await reject(subject, id, approvalId, body);
    return ok({ rejected: true });
  });
}
