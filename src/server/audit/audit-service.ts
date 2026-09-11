import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuditActionType } from "./actions";

type Db = PrismaClient | Prisma.TransactionClient;

export interface AuditInput {
  organizationId: string;
  action: AuditActionType | string;
  entityType: string;
  entityId: string;
  userId?: string | null;
  documentId?: string | null;
  oldValues?: Prisma.InputJsonValue | null;
  newValues?: Prisma.InputJsonValue | null;
  metadata?: Prisma.InputJsonValue | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/** Fields that must never be persisted into audit payloads. */
const FORBIDDEN_KEYS = new Set([
  "password",
  "passwordHash",
  "token",
  "tokenHash",
  "verificationToken",
  "verificationTokenHash",
  "signatureData",
  "imageBase64",
]);

function redact(value: Prisma.InputJsonValue | null | undefined) {
  if (value == null || typeof value !== "object") return value ?? undefined;
  const clone: Record<string, unknown> = Array.isArray(value)
    ? {}
    : { ...(value as Record<string, unknown>) };
  if (!Array.isArray(value)) {
    for (const key of Object.keys(clone)) {
      if (FORBIDDEN_KEYS.has(key)) clone[key] = "[redacted]";
    }
  }
  return clone as Prisma.InputJsonValue;
}

/**
 * Append an audit event. Append-only: there is no update/delete path.
 * Pass a transaction client to make the audit atomic with the change.
 */
export async function writeAudit(input: AuditInput, db: Db = prisma) {
  return db.auditLog.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId ?? null,
      documentId: input.documentId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      oldValues: redact(input.oldValues) ?? undefined,
      newValues: redact(input.newValues) ?? undefined,
      metadata: input.metadata ?? undefined,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}
