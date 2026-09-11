import { CertificateStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashToken, sha256Hex } from "@/lib/crypto";
import { shortFingerprint } from "@/lib/utils";
import type { Subject } from "@/domain/permissions";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { writeAudit } from "@/server/audit/audit-service";
import { AuditAction } from "@/server/audit/actions";
import { hasCapability } from "@/domain/permissions";

export type VerificationOutcome = "VALID" | "REVOKED" | "NOT_FOUND";

export interface VerificationView {
  outcome: VerificationOutcome;
  certificateNumber?: string;
  documentNumber?: string | null;
  documentTitle?: string;
  courseName?: string;
  studyProgram?: string;
  faculty?: string;
  organization?: string;
  issuedAt?: Date;
  fingerprint?: string; // short, non-reversible
}

/**
 * Verify a certificate by its opaque public token. Only the token HASH is
 * stored, so the plaintext token is never persisted. Minimal metadata is
 * disclosed and technical differences are not leaked (NOT_FOUND is generic).
 */
export async function verifyByToken(token: string): Promise<VerificationView> {
  if (!token || token.length < 10) return { outcome: "NOT_FOUND" };
  const tokenHash = hashToken(token);
  const cert = await prisma.verificationCertificate.findUnique({
    where: { verificationTokenHash: tokenHash },
    include: {
      document: {
        include: {
          studyProgram: { include: { faculty: true } },
          organization: true,
          course: true,
        },
      },
    },
  });

  if (!cert) return { outcome: "NOT_FOUND" };
  if (cert.status === CertificateStatus.REVOKED) {
    return {
      outcome: "REVOKED",
      certificateNumber: cert.certificateNumber,
      issuedAt: cert.issuedAt,
    };
  }

  const d = cert.document;
  return {
    outcome: "VALID",
    certificateNumber: cert.certificateNumber,
    documentNumber: d.documentNumber,
    documentTitle: d.title,
    courseName: d.course.name,
    studyProgram: d.studyProgram.name,
    faculty: d.studyProgram.faculty.name,
    organization: d.organization.name,
    issuedAt: cert.issuedAt,
    fingerprint: shortFingerprint(cert.finalDocumentHash),
  };
}

export async function revokeCertificate(
  subject: Subject,
  certificateId: string,
  reason: string,
) {
  if (!hasCapability(subject.role, "audit:read") && subject.role !== "ADMIN") {
    throw new ForbiddenError();
  }
  if (subject.role !== "ADMIN") throw new ForbiddenError();

  const cert = await prisma.verificationCertificate.findUnique({
    where: { id: certificateId },
    include: { document: true },
  });
  if (!cert) throw new NotFoundError();
  if (cert.document.organizationId !== subject.organizationId) throw new ForbiddenError();

  const updated = await prisma.verificationCertificate.update({
    where: { id: certificateId },
    data: {
      status: CertificateStatus.REVOKED,
      revokedAt: new Date(),
      revocationReason: reason,
    },
  });
  await writeAudit({
    organizationId: subject.organizationId,
    userId: subject.userId,
    documentId: cert.documentId,
    action: AuditAction.CERTIFICATE_REVOKED,
    entityType: "VerificationCertificate",
    entityId: certificateId,
    metadata: { reason },
  });
  return updated;
}

/**
 * Compare an uploaded PDF's hash against issued final-document hashes.
 * The uploaded file is hashed in-memory and NOT stored.
 */
export async function verifyUploadedHash(buffer: Buffer): Promise<{
  match: boolean;
  certificateNumber?: string;
  documentNumber?: string | null;
  status?: CertificateStatus;
}> {
  const hash = sha256Hex(buffer);
  const cert = await prisma.verificationCertificate.findFirst({
    where: { finalDocumentHash: hash },
    include: { document: { select: { documentNumber: true } } },
  });
  if (!cert) return { match: false };
  return {
    match: true,
    certificateNumber: cert.certificateNumber,
    documentNumber: cert.document.documentNumber,
    status: cert.status,
  };
}
