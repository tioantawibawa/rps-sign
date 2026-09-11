import { DocumentStatus } from "@prisma/client";

/**
 * Document lifecycle state machine.
 *
 * Approval path: Dosen Pengembang → Koordinator RMK → Ketua Program Studi → Disahkan.
 * Transitions here are the ONLY legal status changes; services must call
 * {@link assertTransition} before persisting a new status.
 */
export const DOCUMENT_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  DRAFT: [
    DocumentStatus.VALIDATING,
    DocumentStatus.CANCELLED,
  ],
  VALIDATING: [
    DocumentStatus.READY_TO_SUBMIT,
    DocumentStatus.DRAFT, // validation produced blocking errors
    DocumentStatus.CANCELLED,
  ],
  READY_TO_SUBMIT: [
    DocumentStatus.SUBMITTED,
    DocumentStatus.DRAFT,
    DocumentStatus.CANCELLED,
  ],
  SUBMITTED: [
    DocumentStatus.WAITING_LECTURER_SIGNATURE,
    DocumentStatus.CANCELLED,
  ],
  WAITING_LECTURER_SIGNATURE: [
    DocumentStatus.WAITING_RMK_APPROVAL,
    DocumentStatus.REVISION_REQUESTED,
    DocumentStatus.REJECTED,
    DocumentStatus.CANCELLED,
  ],
  WAITING_RMK_APPROVAL: [
    DocumentStatus.WAITING_KAPRODI_APPROVAL,
    DocumentStatus.REVISION_REQUESTED,
    DocumentStatus.REJECTED,
    DocumentStatus.CANCELLED,
  ],
  WAITING_KAPRODI_APPROVAL: [
    DocumentStatus.PROCESSING_FINAL_DOCUMENT,
    DocumentStatus.REVISION_REQUESTED,
    DocumentStatus.REJECTED,
    DocumentStatus.CANCELLED,
  ],
  PROCESSING_FINAL_DOCUMENT: [
    DocumentStatus.APPROVED,
    // stays here (idempotent retry) on stamping failure — no illegal jump to APPROVED
    DocumentStatus.WAITING_KAPRODI_APPROVAL,
  ],
  REVISION_REQUESTED: [
    DocumentStatus.DRAFT,
    DocumentStatus.VALIDATING,
    DocumentStatus.CANCELLED,
  ],
  REJECTED: [
    DocumentStatus.DRAFT,
    DocumentStatus.CANCELLED,
  ],
  APPROVED: [DocumentStatus.ARCHIVED],
  ARCHIVED: [],
  CANCELLED: [],
};

export function canTransition(
  from: DocumentStatus,
  to: DocumentStatus,
): boolean {
  return DOCUMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: DocumentStatus,
    public readonly to: DocumentStatus,
  ) {
    super(`Transisi status tidak sah: ${from} → ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function assertTransition(
  from: DocumentStatus,
  to: DocumentStatus,
): void {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
}

/** Map a workflow step order (1-based) to the "waiting" status for that step. */
export function waitingStatusForStep(order: number): DocumentStatus {
  switch (order) {
    case 1:
      return DocumentStatus.WAITING_LECTURER_SIGNATURE;
    case 2:
      return DocumentStatus.WAITING_RMK_APPROVAL;
    case 3:
      return DocumentStatus.WAITING_KAPRODI_APPROVAL;
    default:
      return DocumentStatus.WAITING_KAPRODI_APPROVAL;
  }
}
