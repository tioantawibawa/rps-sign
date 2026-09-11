import { ApprovalStatus, DocumentStatus } from "@prisma/client";

export type BadgeTone =
  | "neutral"
  | "info"
  | "primary"
  | "warning"
  | "success"
  | "danger";

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  DRAFT: "Draf",
  VALIDATING: "Validasi",
  READY_TO_SUBMIT: "Siap Diajukan",
  SUBMITTED: "Diajukan",
  WAITING_LECTURER_SIGNATURE: "Menunggu TTD Dosen",
  WAITING_RMK_APPROVAL: "Menunggu Koordinator RMK",
  WAITING_KAPRODI_APPROVAL: "Menunggu Kaprodi",
  REVISION_REQUESTED: "Perlu Revisi",
  REJECTED: "Ditolak",
  PROCESSING_FINAL_DOCUMENT: "Memproses Dokumen Final",
  APPROVED: "Disahkan",
  ARCHIVED: "Diarsipkan",
  CANCELLED: "Dibatalkan",
};

export const DOCUMENT_STATUS_TONE: Record<DocumentStatus, BadgeTone> = {
  DRAFT: "neutral",
  VALIDATING: "info",
  READY_TO_SUBMIT: "info",
  SUBMITTED: "primary",
  WAITING_LECTURER_SIGNATURE: "warning",
  WAITING_RMK_APPROVAL: "warning",
  WAITING_KAPRODI_APPROVAL: "warning",
  REVISION_REQUESTED: "warning",
  REJECTED: "danger",
  PROCESSING_FINAL_DOCUMENT: "info",
  APPROVED: "success",
  ARCHIVED: "neutral",
  CANCELLED: "danger",
};

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  PENDING: "Menunggu",
  APPROVED: "Disetujui",
  REVISION_REQUESTED: "Diminta Revisi",
  REJECTED: "Ditolak",
  SKIPPED: "Dilewati",
  INVALIDATED: "Tidak Berlaku",
};

export const APPROVAL_STATUS_TONE: Record<ApprovalStatus, BadgeTone> = {
  PENDING: "neutral",
  APPROVED: "success",
  REVISION_REQUESTED: "warning",
  REJECTED: "danger",
  SKIPPED: "neutral",
  INVALIDATED: "neutral",
};

/** Statuses in which the document is actively in the approval pipeline. */
export const IN_PROGRESS_STATUSES: DocumentStatus[] = [
  DocumentStatus.SUBMITTED,
  DocumentStatus.WAITING_LECTURER_SIGNATURE,
  DocumentStatus.WAITING_RMK_APPROVAL,
  DocumentStatus.WAITING_KAPRODI_APPROVAL,
  DocumentStatus.PROCESSING_FINAL_DOCUMENT,
];

export const EDITABLE_STATUSES: DocumentStatus[] = [
  DocumentStatus.DRAFT,
  DocumentStatus.VALIDATING,
  DocumentStatus.READY_TO_SUBMIT,
  DocumentStatus.REVISION_REQUESTED,
];

export function isEditable(status: DocumentStatus): boolean {
  return EDITABLE_STATUSES.includes(status);
}

export function isFinal(status: DocumentStatus): boolean {
  return (
    status === DocumentStatus.APPROVED ||
    status === DocumentStatus.ARCHIVED
  );
}
