"use server";

import { revalidatePath } from "next/cache";
import { ChecklistStatus, RevisionCategory } from "@prisma/client";
import { z } from "zod";
import { requireSubject } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import {
  submitDocument,
  validateDocument,
} from "@/server/documents/document-service";
import {
  approve,
  reject,
  requestRevision,
  saveChecklist,
  startReview,
} from "@/server/approvals/approval-service";
import { prisma } from "@/lib/prisma";
import { DocumentStatus } from "@prisma/client";
import { canArchiveDocument, canCancelDocument } from "@/domain/permissions";
import { assertTransition } from "@/domain/state-machine";
import { writeAudit } from "@/server/audit/audit-service";
import { AuditAction } from "@/server/audit/actions";

export interface ActionState {
  ok: boolean;
  message: string;
}

function fail(err: unknown): ActionState {
  if (err instanceof AppError) return { ok: false, message: err.message };
  return { ok: false, message: "Terjadi kesalahan. Silakan coba lagi." };
}

function refresh(id: string) {
  revalidatePath(`/documents/${id}`);
  revalidatePath("/documents");
  revalidatePath("/approvals");
  revalidatePath("/dashboard");
}

export async function validateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("documentId"));
  try {
    const subject = await requireSubject();
    const { summary } = await validateDocument(subject, id);
    refresh(id);
    return {
      ok: !summary.blocking,
      message: summary.blocking
        ? `Validasi menemukan ${summary.errors} kesalahan yang harus diperbaiki.`
        : `Validasi selesai: ${summary.warnings} peringatan. Dokumen siap diajukan.`,
    };
  } catch (err) {
    return fail(err);
  }
}

export async function submitAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("documentId"));
  try {
    const subject = await requireSubject();
    await submitDocument(subject, id);
    refresh(id);
    return { ok: true, message: "Dokumen berhasil diajukan." };
  } catch (err) {
    return fail(err);
  }
}

export async function startReviewAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("documentId"));
  const approvalId = String(formData.get("approvalId"));
  try {
    const subject = await requireSubject();
    await startReview(subject, id, approvalId);
    refresh(id);
    return { ok: true, message: "Review dimulai." };
  } catch (err) {
    return fail(err);
  }
}

const checklistSchema = z.array(
  z.object({
    itemCode: z.string(),
    label: z.string(),
    status: z.nativeEnum(ChecklistStatus),
    comment: z.string().optional(),
  }),
);

export async function saveChecklistAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("documentId"));
  const approvalId = String(formData.get("approvalId"));
  try {
    const subject = await requireSubject();
    const items = checklistSchema.parse(JSON.parse(String(formData.get("items") ?? "[]")));
    await saveChecklist(subject, id, approvalId, items);
    refresh(id);
    return { ok: true, message: "Checklist disimpan." };
  } catch (err) {
    return fail(err);
  }
}

export async function approveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("documentId"));
  const approvalId = String(formData.get("approvalId"));
  const signatureId = formData.get("signatureId") ? String(formData.get("signatureId")) : undefined;
  const comments = formData.get("comments") ? String(formData.get("comments")) : undefined;
  try {
    const subject = await requireSubject();
    await approve(subject, id, approvalId, { signatureId, comments });
    refresh(id);
    return { ok: true, message: "Persetujuan berhasil disimpan." };
  } catch (err) {
    return fail(err);
  }
}

export async function requestRevisionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("documentId"));
  const approvalId = String(formData.get("approvalId"));
  const category = String(formData.get("category")) as RevisionCategory;
  const notes = String(formData.get("notes") ?? "");
  try {
    if (notes.trim().length < 5) return { ok: false, message: "Catatan revisi terlalu singkat." };
    const subject = await requireSubject();
    await requestRevision(subject, id, approvalId, { category, notes });
    refresh(id);
    return { ok: true, message: "Permintaan revisi dikirim." };
  } catch (err) {
    return fail(err);
  }
}

export async function rejectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("documentId"));
  const approvalId = String(formData.get("approvalId"));
  const notes = String(formData.get("notes") ?? "");
  try {
    if (notes.trim().length < 5) return { ok: false, message: "Alasan penolakan terlalu singkat." };
    const subject = await requireSubject();
    await reject(subject, id, approvalId, { notes });
    refresh(id);
    return { ok: true, message: "Dokumen ditolak." };
  } catch (err) {
    return fail(err);
  }
}

export async function cancelAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("documentId"));
  try {
    const subject = await requireSubject();
    const doc = await prisma.document.findUniqueOrThrow({
      where: { id },
      select: { organizationId: true, studyProgramId: true, clusterId: true, ownerId: true, status: true },
    });
    if (!canCancelDocument(subject, doc)) return { ok: false, message: "Tidak diizinkan membatalkan dokumen ini." };
    assertTransition(doc.status, DocumentStatus.CANCELLED);
    await prisma.document.update({ where: { id }, data: { status: DocumentStatus.CANCELLED } });
    await writeAudit({
      organizationId: doc.organizationId,
      userId: subject.userId,
      documentId: id,
      action: AuditAction.DOCUMENT_CANCELLED,
      entityType: "Document",
      entityId: id,
    });
    refresh(id);
    return { ok: true, message: "Dokumen dibatalkan." };
  } catch (err) {
    return fail(err);
  }
}

export async function archiveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("documentId"));
  try {
    const subject = await requireSubject();
    const doc = await prisma.document.findUniqueOrThrow({
      where: { id },
      select: { organizationId: true, studyProgramId: true, clusterId: true, ownerId: true, status: true },
    });
    if (!canArchiveDocument(subject, doc)) return { ok: false, message: "Hanya dokumen disahkan yang dapat diarsipkan." };
    assertTransition(doc.status, DocumentStatus.ARCHIVED);
    await prisma.document.update({ where: { id }, data: { status: DocumentStatus.ARCHIVED, archivedAt: new Date() } });
    await writeAudit({
      organizationId: doc.organizationId,
      userId: subject.userId,
      documentId: id,
      action: AuditAction.DOCUMENT_ARCHIVED,
      entityType: "Document",
      entityId: id,
    });
    refresh(id);
    return { ok: true, message: "Dokumen diarsipkan." };
  } catch (err) {
    return fail(err);
  }
}
