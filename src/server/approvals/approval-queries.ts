import { ApprovalStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Subject } from "@/domain/permissions";
import { activeRoleForStatus } from "@/domain/permissions";
import { scopedDocumentWhere } from "@/server/documents/document-queries";

/**
 * Approvals currently awaiting action from this subject — respecting sequential
 * order and scope. Used by the "Persetujuan Saya" queue and the dashboard.
 */
export async function listPendingForSubject(subject: Subject) {
  const approverRoles: Role[] = [Role.DOSEN, Role.KOORDINATOR_RMK, Role.KAPRODI];
  if (!approverRoles.includes(subject.role)) {
    return [];
  }

  const candidates = await prisma.approval.findMany({
    where: {
      status: ApprovalStatus.PENDING,
      workflowStep: { role: subject.role },
      document: scopedDocumentWhere(subject),
    },
    include: {
      workflowStep: true,
      document: {
        include: {
          course: true,
          studyProgram: true,
          owner: { select: { name: true } },
        },
      },
    },
    orderBy: { dueAt: "asc" },
  });

  // Only the active step of each document is actionable.
  return candidates.filter(
    (a) =>
      a.document.currentApprovalStep === a.workflowStep.order &&
      activeRoleForStatus(a.document.status) === subject.role,
  );
}

export async function countPendingForSubject(subject: Subject): Promise<number> {
  return (await listPendingForSubject(subject)).length;
}
