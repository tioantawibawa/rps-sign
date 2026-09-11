import {
  ApprovalStatus,
  ChecklistStatus,
  DocumentStatus,
  NotificationType,
  Prisma,
  RevisionCategory,
  Role,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Subject } from "@/domain/permissions";
import { canActOnActiveStep } from "@/domain/permissions";
import { assertTransition, waitingStatusForStep } from "@/domain/state-machine";
import { computeDueAt } from "@/domain/sla";
import { ConflictError, ForbiddenError, NotFoundError, UnprocessableError } from "@/server/errors";
import { writeAudit } from "@/server/audit/audit-service";
import { AuditAction } from "@/server/audit/actions";
import { notify } from "@/server/notifications/notification-service";
import { finalizeDocument } from "@/server/verification/finalization-service";

const DEFAULT_CHECKLIST: { itemCode: string; label: string }[] = [
  { itemCode: "IDENTITAS", label: "Identitas mata kuliah sesuai" },
  { itemCode: "CPL_CPMK", label: "CPL/CPMK tercantum dan relevan" },
  { itemCode: "MATERI", label: "Materi & rencana mingguan lengkap" },
  { itemCode: "PENILAIAN", label: "Komponen penilaian jelas" },
  { itemCode: "REFERENSI", label: "Referensi mutakhir dan memadai" },
];

async function loadActiveApproval(documentId: string, approvalId: string) {
  const approval = await prisma.approval.findUnique({
    where: { id: approvalId },
    include: {
      workflowStep: true,
      document: {
        select: {
          id: true,
          organizationId: true,
          studyProgramId: true,
          clusterId: true,
          ownerId: true,
          status: true,
          currentApprovalStep: true,
          currentVersionId: true,
          documentNumber: true,
        },
      },
    },
  });
  if (!approval || approval.documentId !== documentId) {
    throw new NotFoundError("Persetujuan tidak ditemukan");
  }
  return approval;
}

function assertActionable(
  subject: Subject,
  approval: Awaited<ReturnType<typeof loadActiveApproval>>,
) {
  const doc = approval.document;
  // Must be the active step and PENDING.
  if (approval.status !== ApprovalStatus.PENDING) {
    throw new ConflictError("Persetujuan ini sudah diproses");
  }
  if (approval.workflowStep.order !== doc.currentApprovalStep) {
    throw new ConflictError("Bukan tahap persetujuan yang aktif");
  }
  if (
    !canActOnActiveStep(subject, {
      organizationId: doc.organizationId,
      studyProgramId: doc.studyProgramId,
      clusterId: doc.clusterId,
      ownerId: doc.ownerId,
      status: doc.status,
    })
  ) {
    throw new ForbiddenError("Anda tidak berwenang pada tahap ini");
  }
}

export async function startReview(subject: Subject, documentId: string, approvalId: string) {
  const approval = await loadActiveApproval(documentId, approvalId);
  assertActionable(subject, approval);

  await prisma.$transaction(async (tx) => {
    if (!approval.startedAt) {
      await tx.approval.update({
        where: { id: approval.id },
        data: {
          startedAt: new Date(),
          dueAt: computeDueAt(new Date(), approval.workflowStep.slaHours),
          approverId: subject.userId,
        },
      });
    }
    if (approval.workflowStep.requiresChecklist) {
      const existing = await tx.reviewChecklist.count({ where: { approvalId: approval.id } });
      if (existing === 0) {
        await tx.reviewChecklist.createMany({
          data: DEFAULT_CHECKLIST.map((c) => ({ approvalId: approval.id, ...c })),
        });
      }
    }
    await writeAudit(
      {
        organizationId: approval.document.organizationId,
        userId: subject.userId,
        documentId,
        action: AuditAction.REVIEW_STARTED,
        entityType: "Approval",
        entityId: approval.id,
      },
      tx,
    );
  });
}

export interface ChecklistItemInput {
  itemCode: string;
  label: string;
  status: ChecklistStatus;
  comment?: string;
  pageNumber?: number | null;
}

export async function saveChecklist(
  subject: Subject,
  documentId: string,
  approvalId: string,
  items: ChecklistItemInput[],
) {
  const approval = await loadActiveApproval(documentId, approvalId);
  assertActionable(subject, approval);

  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      await tx.reviewChecklist.upsert({
        where: { approvalId_itemCode: { approvalId: approval.id, itemCode: item.itemCode } },
        create: {
          approvalId: approval.id,
          itemCode: item.itemCode,
          label: item.label,
          status: item.status,
          comment: item.comment,
          pageNumber: item.pageNumber ?? null,
        },
        update: {
          status: item.status,
          comment: item.comment,
          pageNumber: item.pageNumber ?? null,
        },
      });
    }
    await writeAudit(
      {
        organizationId: approval.document.organizationId,
        userId: subject.userId,
        documentId,
        action: AuditAction.CHECKLIST_UPDATED,
        entityType: "Approval",
        entityId: approval.id,
        metadata: { count: items.length },
      },
      tx,
    );
  });
}

export interface ApproveInput {
  comments?: string;
  signatureId?: string;
}

export async function approve(
  subject: Subject,
  documentId: string,
  approvalId: string,
  input: ApproveInput,
) {
  const approval = await loadActiveApproval(documentId, approvalId);
  assertActionable(subject, approval);

  // Signature requirement.
  let signatureId: string | null = null;
  if (approval.workflowStep.requiresSignature) {
    if (!input.signatureId) {
      throw new UnprocessableError("Tahap ini membutuhkan persetujuan digital (tanda tangan)");
    }
    const sig = await prisma.signature.findUnique({ where: { id: input.signatureId } });
    if (!sig || sig.userId !== subject.userId) {
      throw new ForbiddenError("Tanda tangan tidak valid atau bukan milik Anda");
    }
    if (sig.revokedAt) {
      throw new UnprocessableError("Tanda tangan telah dicabut dan tidak dapat digunakan");
    }
    signatureId = sig.id;
  }

  // Checklist completeness (if required).
  if (approval.workflowStep.requiresChecklist) {
    const unresolved = await prisma.reviewChecklist.count({
      where: { approvalId: approval.id, status: ChecklistStatus.UNCHECKED },
    });
    if (unresolved > 0) {
      throw new UnprocessableError("Lengkapi seluruh item checklist sebelum menyetujui");
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const now = new Date();
    const doc = approval.document;

    await tx.approval.update({
      where: { id: approval.id },
      data: {
        status: ApprovalStatus.APPROVED,
        approverId: subject.userId,
        comments: input.comments,
        actedAt: now,
        signatureId,
      },
    });

    if (signatureId) {
      await writeAudit(
        {
          organizationId: doc.organizationId,
          userId: subject.userId,
          documentId,
          action: AuditAction.SIGNATURE_USED,
          entityType: "Signature",
          entityId: signatureId,
          metadata: { approvalId: approval.id, role: subject.role },
        },
        tx,
      );
    }

    // Determine next step.
    const nextStep = await tx.workflowStep.findFirst({
      where: {
        workflowId: approval.workflowStep.workflowId,
        order: approval.workflowStep.order + 1,
      },
    });

    if (nextStep) {
      const nextApproval = await tx.approval.findFirst({
        where: {
          documentId: doc.id,
          workflowStepId: nextStep.id,
          documentVersionId: doc.currentVersionId ?? undefined,
          status: ApprovalStatus.PENDING,
        },
      });
      if (nextApproval) {
        await tx.approval.update({
          where: { id: nextApproval.id },
          data: { startedAt: now, dueAt: computeDueAt(now, nextStep.slaHours) },
        });
      }
      const nextStatus = waitingStatusForStep(nextStep.order);
      assertTransition(doc.status, nextStatus);
      await tx.document.update({
        where: { id: doc.id },
        data: { status: nextStatus, currentApprovalStep: nextStep.order },
      });

      // Notify next-step actors within scope.
      await notifyStepActors(tx, doc.id, nextStep.role, doc.organizationId, {
        documentNumber: doc.documentNumber,
        clusterId: doc.clusterId,
        studyProgramId: doc.studyProgramId,
        ownerId: doc.ownerId,
      });

      await writeAudit(
        {
          organizationId: doc.organizationId,
          userId: subject.userId,
          documentId,
          action: AuditAction.DOCUMENT_APPROVED,
          entityType: "Approval",
          entityId: approval.id,
          metadata: { step: approval.workflowStep.order, advancedTo: nextStep.order },
        },
        tx,
      );
      return { finalized: false as const };
    }

    // Last step approved -> move to processing (finalization runs after commit).
    assertTransition(doc.status, DocumentStatus.PROCESSING_FINAL_DOCUMENT);
    await tx.document.update({
      where: { id: doc.id },
      data: { status: DocumentStatus.PROCESSING_FINAL_DOCUMENT, approvedAt: now },
    });
    await writeAudit(
      {
        organizationId: doc.organizationId,
        userId: subject.userId,
        documentId,
        action: AuditAction.DOCUMENT_APPROVED,
        entityType: "Approval",
        entityId: approval.id,
        metadata: { step: approval.workflowStep.order, final: true },
      },
      tx,
    );
    return { finalized: true as const };
  });

  // Heavy PDF finalization runs outside the transaction and is idempotent/retriable.
  if (result.finalized) {
    await finalizeDocument(documentId).catch(() => {
      // finalizeDocument already logs; document stays in PROCESSING for retry.
    });
  }

  return result;
}

export async function requestRevision(
  subject: Subject,
  documentId: string,
  approvalId: string,
  input: { category: RevisionCategory; notes: string },
) {
  const approval = await loadActiveApproval(documentId, approvalId);
  assertActionable(subject, approval);
  const doc = approval.document;

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    await tx.approval.update({
      where: { id: approval.id },
      data: { status: ApprovalStatus.REVISION_REQUESTED, approverId: subject.userId, comments: input.notes, actedAt: now },
    });
    await tx.revisionRequest.create({
      data: {
        documentId,
        documentVersionId: doc.currentVersionId!,
        approvalId: approval.id,
        requestedById: subject.userId,
        category: input.category,
        notes: input.notes,
      },
    });
    // Invalidate remaining pending approvals for this version.
    await tx.approval.updateMany({
      where: {
        documentId,
        documentVersionId: doc.currentVersionId!,
        status: ApprovalStatus.PENDING,
      },
      data: { status: ApprovalStatus.INVALIDATED, invalidatedAt: now },
    });
    assertTransition(doc.status, DocumentStatus.REVISION_REQUESTED);
    await tx.document.update({
      where: { id: documentId },
      data: { status: DocumentStatus.REVISION_REQUESTED },
    });
    await writeAudit(
      {
        organizationId: doc.organizationId,
        userId: subject.userId,
        documentId,
        action: AuditAction.REVISION_REQUESTED,
        entityType: "Approval",
        entityId: approval.id,
        metadata: { category: input.category },
      },
      tx,
    );
    await notify(
      {
        userId: doc.ownerId,
        type: NotificationType.REVISION_REQUESTED,
        title: "Permintaan revisi RPS",
        message: `Dokumen ${doc.documentNumber ?? ""} memerlukan revisi: ${input.notes}`,
        link: `/documents/${documentId}`,
        email: true,
      },
      tx,
    );
  });
}

export async function reject(
  subject: Subject,
  documentId: string,
  approvalId: string,
  input: { notes: string },
) {
  const approval = await loadActiveApproval(documentId, approvalId);
  assertActionable(subject, approval);
  const doc = approval.document;

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    await tx.approval.update({
      where: { id: approval.id },
      data: { status: ApprovalStatus.REJECTED, approverId: subject.userId, comments: input.notes, actedAt: now },
    });
    await tx.approval.updateMany({
      where: { documentId, documentVersionId: doc.currentVersionId!, status: ApprovalStatus.PENDING },
      data: { status: ApprovalStatus.INVALIDATED, invalidatedAt: now },
    });
    assertTransition(doc.status, DocumentStatus.REJECTED);
    await tx.document.update({ where: { id: documentId }, data: { status: DocumentStatus.REJECTED } });
    await writeAudit(
      {
        organizationId: doc.organizationId,
        userId: subject.userId,
        documentId,
        action: AuditAction.DOCUMENT_REJECTED,
        entityType: "Approval",
        entityId: approval.id,
      },
      tx,
    );
    await notify(
      {
        userId: doc.ownerId,
        type: NotificationType.DOCUMENT_REJECTED,
        title: "RPS ditolak",
        message: `Dokumen ${doc.documentNumber ?? ""} ditolak: ${input.notes}`,
        link: `/documents/${documentId}`,
        email: true,
      },
      tx,
    );
  });
}

async function notifyStepActors(
  tx: Prisma.TransactionClient,
  documentId: string,
  role: Role,
  organizationId: string,
  ctx: { documentNumber: string | null; clusterId: string | null; studyProgramId: string; ownerId: string },
) {
  let userIds: string[] = [];
  if (role === Role.DOSEN) {
    userIds = [ctx.ownerId];
  } else {
    const now = new Date();
    const scope =
      role === Role.KOORDINATOR_RMK
        ? { clusterId: ctx.clusterId ?? "__none__" }
        : { studyProgramId: ctx.studyProgramId };
    const assignments = await tx.userAssignment.findMany({
      where: {
        ...scope,
        user: { role, organizationId },
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gte: now } }],
      },
      select: { userId: true },
    });
    userIds = Array.from(new Set(assignments.map((a) => a.userId)));
  }

  for (const userId of userIds) {
    await notify(
      {
        userId,
        type: NotificationType.APPROVAL_STAGE_ACTIVE,
        title: "Persetujuan RPS menunggu tindakan",
        message: `Dokumen ${ctx.documentNumber ?? ""} menunggu tindakan Anda.`,
        link: `/documents/${documentId}`,
        email: true,
      },
      tx,
    );
  }
}
