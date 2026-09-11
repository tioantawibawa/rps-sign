import { DocumentStatus, Role } from "@prisma/client";

/**
 * Centralised authorization policy. Every server action / route handler must
 * consult these functions. Hiding a button in the UI is NEVER a substitute for
 * a server-side check.
 */

/** The authenticated subject with their *active* assignment scope. */
export interface Subject {
  userId: string;
  role: Role;
  organizationId: string;
  facultyIds: string[];
  studyProgramIds: string[];
  clusterIds: string[];
}

/** Minimal document context needed for authorization decisions. */
export interface DocumentContext {
  organizationId: string;
  studyProgramId: string;
  clusterId: string | null;
  ownerId: string;
  status: DocumentStatus;
}

export type Capability =
  | "document:create"
  | "document:read"
  | "document:update"
  | "document:submit"
  | "document:cancel"
  | "document:validate"
  | "review:start"
  | "review:checklist"
  | "approval:act" // approve / request revision / reject at the active step
  | "signature:apply"
  | "document:archive"
  | "revision:upload"
  | "masterdata:manage"
  | "users:manage"
  | "workflow:manage"
  | "template:manage"
  | "settings:manage"
  | "audit:read"
  | "reporting:read";

/**
 * Static capability matrix (coarse-grained). Fine-grained ownership / scope
 * checks are layered on top by the `can*` helpers below.
 */
export const PERMISSION_MATRIX: Record<Role, Capability[]> = {
  DOSEN: [
    "document:create",
    "document:read",
    "document:update",
    "document:submit",
    "document:cancel",
    "document:validate",
    "signature:apply",
    "revision:upload",
    "reporting:read",
  ],
  KOORDINATOR_RMK: [
    "document:read",
    "review:start",
    "review:checklist",
    "approval:act",
    "signature:apply",
    "reporting:read",
  ],
  KAPRODI: [
    "document:read",
    "review:start",
    "review:checklist",
    "approval:act",
    "signature:apply",
    "reporting:read",
  ],
  ADMIN: [
    "document:read",
    "document:archive",
    "masterdata:manage",
    "users:manage",
    "workflow:manage",
    "template:manage",
    "settings:manage",
    "audit:read",
    "reporting:read",
  ],
  AUDITOR: ["document:read", "audit:read", "reporting:read"],
};

export function hasCapability(role: Role, cap: Capability): boolean {
  return PERMISSION_MATRIX[role]?.includes(cap) ?? false;
}

function sameOrg(subject: Subject, doc: DocumentContext): boolean {
  return subject.organizationId === doc.organizationId;
}

function inClusterScope(subject: Subject, doc: DocumentContext): boolean {
  return doc.clusterId !== null && subject.clusterIds.includes(doc.clusterId);
}

function inProgramScope(subject: Subject, doc: DocumentContext): boolean {
  return subject.studyProgramIds.includes(doc.studyProgramId);
}

/** The workflow step (role) currently expected to act on the document. */
export function activeRoleForStatus(status: DocumentStatus): Role | null {
  switch (status) {
    case DocumentStatus.WAITING_LECTURER_SIGNATURE:
      return Role.DOSEN;
    case DocumentStatus.WAITING_RMK_APPROVAL:
      return Role.KOORDINATOR_RMK;
    case DocumentStatus.WAITING_KAPRODI_APPROVAL:
      return Role.KAPRODI;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Document-scoped decisions
// ---------------------------------------------------------------------------

export function canReadDocument(subject: Subject, doc: DocumentContext): boolean {
  if (!sameOrg(subject, doc)) return false;
  switch (subject.role) {
    case Role.ADMIN:
      return true;
    case Role.AUDITOR:
      // Auditors see final/archived documents only.
      return (
        doc.status === DocumentStatus.APPROVED ||
        doc.status === DocumentStatus.ARCHIVED
      );
    case Role.DOSEN:
      return doc.ownerId === subject.userId;
    case Role.KOORDINATOR_RMK:
      return inClusterScope(subject, doc);
    case Role.KAPRODI:
      return inProgramScope(subject, doc);
    default:
      return false;
  }
}

export function canEditDocument(subject: Subject, doc: DocumentContext): boolean {
  if (subject.role !== Role.DOSEN) return false;
  if (doc.ownerId !== subject.userId) return false;
  return (
    doc.status === DocumentStatus.DRAFT ||
    doc.status === DocumentStatus.VALIDATING ||
    doc.status === DocumentStatus.READY_TO_SUBMIT ||
    doc.status === DocumentStatus.REVISION_REQUESTED
  );
}

export function canSubmitDocument(
  subject: Subject,
  doc: DocumentContext,
): boolean {
  return (
    subject.role === Role.DOSEN &&
    doc.ownerId === subject.userId &&
    doc.status === DocumentStatus.READY_TO_SUBMIT
  );
}

export function canUploadRevision(
  subject: Subject,
  doc: DocumentContext,
): boolean {
  return (
    subject.role === Role.DOSEN &&
    doc.ownerId === subject.userId &&
    doc.status === DocumentStatus.REVISION_REQUESTED
  );
}

/**
 * May this subject act on the *currently active* approval step of the document?
 * Enforces sequential approval AND scope.
 */
export function canActOnActiveStep(
  subject: Subject,
  doc: DocumentContext,
): boolean {
  if (!sameOrg(subject, doc)) return false;
  const activeRole = activeRoleForStatus(doc.status);
  if (activeRole === null) return false;
  if (subject.role !== activeRole) return false;

  switch (subject.role) {
    case Role.DOSEN:
      // The developer signs their own document at the first step.
      return doc.ownerId === subject.userId;
    case Role.KOORDINATOR_RMK:
      return inClusterScope(subject, doc);
    case Role.KAPRODI:
      return inProgramScope(subject, doc);
    default:
      return false;
  }
}

export function canArchiveDocument(
  subject: Subject,
  doc: DocumentContext,
): boolean {
  return (
    subject.role === Role.ADMIN &&
    sameOrg(subject, doc) &&
    doc.status === DocumentStatus.APPROVED
  );
}

export function canCancelDocument(
  subject: Subject,
  doc: DocumentContext,
): boolean {
  if (!sameOrg(subject, doc)) return false;
  if (subject.role === Role.ADMIN) return true;
  return (
    subject.role === Role.DOSEN &&
    doc.ownerId === subject.userId &&
    doc.status !== DocumentStatus.APPROVED &&
    doc.status !== DocumentStatus.ARCHIVED &&
    doc.status !== DocumentStatus.CANCELLED
  );
}

// ---------------------------------------------------------------------------
// Admin-scoped decisions (org-wide)
// ---------------------------------------------------------------------------

export function canManage(subject: Subject, cap: Capability): boolean {
  return hasCapability(subject.role, cap);
}
