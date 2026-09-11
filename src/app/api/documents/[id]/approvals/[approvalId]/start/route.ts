import { handleRoute, ok } from "@/lib/api";
import { getSubjectOrThrow } from "@/server/auth/session";
import { startReview } from "@/server/approvals/approval-service";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; approvalId: string }> },
) {
  return handleRoute(async () => {
    const subject = await getSubjectOrThrow();
    const { id, approvalId } = await params;
    await startReview(subject, id, approvalId);
    return ok({ started: true });
  });
}
