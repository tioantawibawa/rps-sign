import { handleRoute, ok } from "@/lib/api";
import { getSubjectOrThrow } from "@/server/auth/session";
import { listPendingForSubject } from "@/server/approvals/approval-queries";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => {
    const subject = await getSubjectOrThrow();
    const items = await listPendingForSubject(subject);
    return ok(
      items.map((a) => ({
        approvalId: a.id,
        documentId: a.document.id,
        documentNumber: a.document.documentNumber,
        courseName: a.document.course.name,
        owner: a.document.owner.name,
        step: a.workflowStep.label,
        dueAt: a.dueAt,
      })),
    );
  });
}
