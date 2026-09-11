import {
  DocumentStatus,
  NotificationType,
  ProcessingStatus,
  Role,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { Subject } from "@/domain/permissions";
import { canEditDocument, canSubmitDocument } from "@/domain/permissions";
import { assertTransition } from "@/domain/state-machine";
import { ConflictError, ForbiddenError, NotFoundError } from "@/server/errors";
import { converter } from "@/server/processing/converter";
import { storage } from "@/server/storage";
import {
  runValidation,
  summarizeValidation,
  type ValidationContext,
} from "./validation";
import { allocateDocumentNumber } from "./document-number-service";
import { writeAudit } from "@/server/audit/audit-service";
import { AuditAction } from "@/server/audit/actions";
import { notify } from "@/server/notifications/notification-service";
import { computeDueAt } from "@/domain/sla";

export interface CreateDraftInput {
  courseId: string;
  academicPeriodId: string;
  title: string;
}

export interface MetadataInput {
  courseCode: string;
  courseName: string;
  credits: number;
  semester: number;
  developerName: string;
  revisionNumber?: string;
  preparationDate: Date;
}

/** Load the minimal context used for authorization decisions. */
async function loadDocContext(documentId: string) {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      organizationId: true,
      studyProgramId: true,
      clusterId: true,
      ownerId: true,
      status: true,
    },
  });
  if (!doc) throw new NotFoundError("Dokumen tidak ditemukan");
  return doc;
}

export async function createDraft(subject: Subject, input: CreateDraftInput) {
  if (subject.role !== Role.DOSEN) {
    throw new ForbiddenError("Hanya dosen yang dapat membuat RPS");
  }
  const course = await prisma.course.findUnique({
    where: { id: input.courseId },
    include: { studyProgram: { include: { faculty: true } } },
  });
  if (!course) throw new NotFoundError("Mata kuliah tidak ditemukan");
  if (course.organizationId !== subject.organizationId) {
    throw new ForbiddenError();
  }

  const document = await prisma.document.create({
    data: {
      organizationId: course.organizationId,
      facultyId: course.studyProgram.facultyId,
      studyProgramId: course.studyProgramId,
      clusterId: course.clusterId,
      courseId: course.id,
      academicPeriodId: input.academicPeriodId,
      ownerId: subject.userId,
      title: input.title,
      status: DocumentStatus.DRAFT,
    },
  });

  await writeAudit({
    organizationId: course.organizationId,
    userId: subject.userId,
    documentId: document.id,
    action: AuditAction.DOCUMENT_CREATED,
    entityType: "Document",
    entityId: document.id,
    newValues: { title: input.title, courseId: course.id },
  });

  return document;
}

export interface UploadResult {
  versionId: string;
  versionNumber: number;
  pageCount: number;
  duplicateOf: string | null;
}

export async function uploadVersion(
  subject: Subject,
  documentId: string,
  file: { fileName: string; buffer: Buffer; declaredMime?: string; changeSummary?: string },
): Promise<UploadResult> {
  const ctx = await loadDocContext(documentId);
  if (!canEditDocument(subject, ctx)) {
    throw new ForbiddenError("Dokumen tidak dapat diubah pada status ini");
  }

  // Convert + hash (magic-byte MIME check happens inside the converter).
  const converted = await converter.convertToPdf({
    fileName: file.fileName,
    buffer: file.buffer,
    declaredMime: file.declaredMime,
  });

  // Duplicate detection by source hash across the organization.
  const dup = await prisma.documentVersion.findFirst({
    where: {
      sourceHash: converted.sourceHash,
      document: { organizationId: ctx.organizationId },
      NOT: { documentId },
    },
    select: { documentId: true },
  });

  const nextNumber =
    (await prisma.documentVersion.count({ where: { documentId } })) + 1;

  const baseKey = `documents/${documentId}/v${nextNumber}`;
  const originalKey = `${baseKey}/source-${sanitize(file.fileName)}`;
  const convertedKey = `${baseKey}/converted.pdf`;

  await storage.putObject({
    key: originalKey,
    body: file.buffer,
    contentType: converted.sourceMime,
  });
  await storage.putObject({
    key: convertedKey,
    body: converted.pdf,
    contentType: "application/pdf",
  });

  const version = await prisma.$transaction(async (tx) => {
    const created = await tx.documentVersion.create({
      data: {
        documentId,
        versionNumber: nextNumber,
        originalFileName: file.fileName,
        originalStorageKey: originalKey,
        convertedPdfStorageKey: convertedKey,
        mimeType: converted.sourceMime,
        fileSize: file.buffer.byteLength,
        pageCount: converted.pageCount,
        sourceHash: converted.sourceHash,
        changeSummary: file.changeSummary,
        processingStatus: ProcessingStatus.COMPLETED,
        uploadedById: subject.userId,
      },
    });
    await tx.document.update({
      where: { id: documentId },
      data: { currentVersionId: created.id },
    });
    await writeAudit(
      {
        organizationId: ctx.organizationId,
        userId: subject.userId,
        documentId,
        action: AuditAction.FILE_UPLOADED,
        entityType: "DocumentVersion",
        entityId: created.id,
        newValues: {
          fileName: file.fileName,
          pageCount: converted.pageCount,
          converted: converted.converted,
        },
      },
      tx,
    );
    return created;
  });

  return {
    versionId: version.id,
    versionNumber: nextNumber,
    pageCount: converted.pageCount,
    duplicateOf: dup?.documentId ?? null,
  };
}

export async function saveMetadata(
  subject: Subject,
  documentId: string,
  input: MetadataInput,
) {
  const ctx = await loadDocContext(documentId);
  if (!canEditDocument(subject, ctx)) throw new ForbiddenError();
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { currentVersionId: true },
  });
  if (!doc?.currentVersionId) {
    throw new ConflictError("Unggah berkas terlebih dahulu");
  }

  await prisma.documentMetadata.upsert({
    where: { documentVersionId: doc.currentVersionId },
    create: {
      documentVersionId: doc.currentVersionId,
      courseCode: input.courseCode,
      courseName: input.courseName,
      credits: input.credits,
      semester: input.semester,
      developerName: input.developerName,
      revisionNumber: input.revisionNumber ?? "0",
      preparationDate: input.preparationDate,
    },
    update: {
      courseCode: input.courseCode,
      courseName: input.courseName,
      credits: input.credits,
      semester: input.semester,
      developerName: input.developerName,
      revisionNumber: input.revisionNumber ?? "0",
      preparationDate: input.preparationDate,
    },
  });
}

export async function validateDocument(subject: Subject, documentId: string) {
  const ctx = await loadDocContext(documentId);
  if (!canEditDocument(subject, ctx)) throw new ForbiddenError();

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      academicPeriod: true,
      currentVersion: { include: { metadata: true } },
      cluster: true,
    },
  });
  if (!doc?.currentVersion) throw new ConflictError("Belum ada versi dokumen");

  const meta = doc.currentVersion.metadata;
  const courseExists = !!(await prisma.course.findFirst({
    where: { studyProgramId: doc.studyProgramId, code: meta?.courseCode ?? "" },
    select: { id: true },
  }));

  // Signers with active assignment: an RMK coordinator on the cluster and a
  // Kaprodi on the study program.
  const now = new Date();
  const activeAssign = { validFrom: { lte: now }, OR: [{ validUntil: null }, { validUntil: { gte: now } }] };
  const hasRmk = doc.clusterId
    ? !!(await prisma.userAssignment.findFirst({
        where: { clusterId: doc.clusterId, user: { role: Role.KOORDINATOR_RMK }, ...activeAssign },
      }))
    : false;
  const hasKaprodi = !!(await prisma.userAssignment.findFirst({
    where: { studyProgramId: doc.studyProgramId, user: { role: Role.KAPRODI }, ...activeAssign },
  }));

  const validationCtx: ValidationContext = {
    metadata: {
      courseCode: meta?.courseCode,
      courseName: meta?.courseName,
      credits: meta?.credits,
      semester: meta?.semester,
      developerName: meta?.developerName,
      preparationDate: meta?.preparationDate,
      revisionNumber: meta?.revisionNumber,
    },
    courseExists,
    academicPeriodActive: doc.academicPeriod.isActive,
    developerResolved: !!doc.ownerId,
    signersHaveActiveAssignment: hasRmk && hasKaprodi,
    pdfRendered: !!doc.currentVersion.convertedPdfStorageKey,
    pageCount: doc.currentVersion.pageCount,
    sourceHash: doc.currentVersion.sourceHash,
    hasApprovalBlockHint: true, // heuristic default; content parsing is out of scope
  };

  const findings = runValidation(validationCtx);
  const summary = summarizeValidation(findings);

  await prisma.$transaction(async (tx) => {
    await tx.validationResult.deleteMany({
      where: { documentVersionId: doc.currentVersion!.id },
    });
    await tx.validationResult.createMany({
      data: findings.map((f) => ({
        documentVersionId: doc.currentVersion!.id,
        ruleCode: f.ruleCode,
        category: f.category,
        severity: f.severity,
        status: f.status,
        title: f.title,
        description: f.description,
        pageNumber: f.pageNumber ?? null,
      })),
    });

    // DRAFT/REVISION_REQUESTED -> VALIDATING -> (READY_TO_SUBMIT | DRAFT)
    if (doc.status === DocumentStatus.DRAFT || doc.status === DocumentStatus.REVISION_REQUESTED) {
      assertTransition(doc.status, DocumentStatus.VALIDATING);
    }
    const target = summary.blocking
      ? DocumentStatus.DRAFT
      : DocumentStatus.READY_TO_SUBMIT;
    await tx.document.update({
      where: { id: documentId },
      data: { status: target },
    });
    await writeAudit(
      {
        organizationId: ctx.organizationId,
        userId: subject.userId,
        documentId,
        action: AuditAction.VALIDATION_COMPLETED,
        entityType: "DocumentVersion",
        entityId: doc.currentVersion!.id,
        metadata: { ...summary },
      },
      tx,
    );
  });

  return { findings, summary };
}

export async function submitDocument(subject: Subject, documentId: string) {
  const ctx = await loadDocContext(documentId);
  if (!canSubmitDocument(subject, ctx)) {
    // Idempotency: already submitted returns gracefully.
    if (ctx.status !== DocumentStatus.READY_TO_SUBMIT) {
      const inProgressStatuses: DocumentStatus[] = [
        DocumentStatus.SUBMITTED,
        DocumentStatus.WAITING_LECTURER_SIGNATURE,
        DocumentStatus.WAITING_RMK_APPROVAL,
        DocumentStatus.WAITING_KAPRODI_APPROVAL,
      ];
      if (inProgressStatuses.includes(ctx.status)) {
        return { alreadySubmitted: true, documentId };
      }
    }
    throw new ForbiddenError("Dokumen belum siap untuk diajukan");
  }

  return prisma.$transaction(async (tx) => {
    const doc = await tx.document.findUniqueOrThrow({
      where: { id: documentId },
      include: { studyProgram: true, currentVersion: true },
    });
    if (!doc.currentVersion) throw new ConflictError("Belum ada versi dokumen");

    const workflow = await tx.workflow.findFirst({
      where: { organizationId: doc.organizationId, isActive: true },
      include: { steps: { orderBy: { order: "asc" } } },
    });
    if (!workflow || workflow.steps.length === 0) {
      throw new ConflictError("Alur persetujuan belum dikonfigurasi");
    }

    // Allocate document number if not present.
    const year = new Date().getFullYear();
    const documentNumber =
      doc.documentNumber ??
      (await allocateDocumentNumber(tx, {
        studyProgramId: doc.studyProgramId,
        programCode: doc.studyProgram.code,
        year,
      }));

    // Create approvals for all steps; activate the first.
    const now = new Date();
    for (const step of workflow.steps) {
      const isFirst = step.order === 1;
      await tx.approval.create({
        data: {
          documentId: doc.id,
          documentVersionId: doc.currentVersion.id,
          workflowStepId: step.id,
          status: "PENDING",
          startedAt: isFirst ? now : null,
          dueAt: isFirst ? computeDueAt(now, step.slaHours) : null,
        },
      });
    }

    assertTransition(doc.status, DocumentStatus.SUBMITTED);
    assertTransition(DocumentStatus.SUBMITTED, DocumentStatus.WAITING_LECTURER_SIGNATURE);

    await tx.document.update({
      where: { id: doc.id },
      data: {
        status: DocumentStatus.WAITING_LECTURER_SIGNATURE,
        documentNumber,
        currentApprovalStep: 1,
        submittedAt: now,
      },
    });

    await writeAudit(
      {
        organizationId: doc.organizationId,
        userId: subject.userId,
        documentId: doc.id,
        action: AuditAction.DOCUMENT_SUBMITTED,
        entityType: "Document",
        entityId: doc.id,
        newValues: { documentNumber },
      },
      tx,
    );

    // Notify the first-step actor (the developer signs first).
    await notify(
      {
        userId: doc.ownerId,
        type: NotificationType.APPROVAL_STAGE_ACTIVE,
        title: "RPS menunggu tanda tangan Anda",
        message: `Dokumen ${documentNumber} telah diajukan dan menunggu persetujuan digital Anda sebagai Dosen Pengembang.`,
        link: `/documents/${doc.id}`,
        email: true,
      },
      tx,
    );

    logger.info({ documentId: doc.id, documentNumber }, "document submitted");
    return { alreadySubmitted: false, documentId: doc.id, documentNumber };
  });
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}
