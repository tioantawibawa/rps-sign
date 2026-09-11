import { SignatureType } from "@prisma/client";
import { fileTypeFromBuffer } from "file-type";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { sha256Hex } from "@/lib/crypto";
import type { Subject } from "@/domain/permissions";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/server/errors";
import { storage } from "@/server/storage";
import { writeAudit } from "@/server/audit/audit-service";
import { AuditAction } from "@/server/audit/actions";

const ALLOWED_IMAGE_MIME = new Set(["image/png", "image/jpeg"]);

export interface CreateSignatureInput {
  type: SignatureType;
  /** Raw image bytes (already decoded from a data URL or upload). */
  buffer: Buffer;
  setDefault?: boolean;
}

/**
 * Register a signature for the current user. Only PNG/JPEG are accepted, checked
 * by file signature (never by extension). SVG and other formats are rejected.
 * A user may only ever create signatures for themselves.
 */
export async function createSignature(subject: Subject, input: CreateSignatureInput) {
  if (input.buffer.byteLength > env.SIGNATURE_MAX_UPLOAD_BYTES) {
    throw new BadRequestError("Ukuran berkas tanda tangan melebihi batas");
  }
  const sniff = await fileTypeFromBuffer(input.buffer);
  if (!sniff || !ALLOWED_IMAGE_MIME.has(sniff.mime)) {
    throw new BadRequestError("Format tanda tangan harus PNG atau JPEG");
  }

  const imageHash = sha256Hex(input.buffer);
  const id = crypto.randomUUID();
  const key = `signatures/${subject.userId}/${id}.${sniff.ext}`;
  await storage.putObject({ key, body: input.buffer, contentType: sniff.mime });

  const signature = await prisma.$transaction(async (tx) => {
    if (input.setDefault) {
      await tx.signature.updateMany({
        where: { userId: subject.userId, isDefault: true },
        data: { isDefault: false },
      });
    }
    const created = await tx.signature.create({
      data: {
        userId: subject.userId,
        type: input.type,
        storageKey: key,
        imageHash,
        isDefault: input.setDefault ?? false,
      },
    });
    await writeAudit(
      {
        organizationId: subject.organizationId,
        userId: subject.userId,
        action: AuditAction.SIGNATURE_CREATED,
        entityType: "Signature",
        entityId: created.id,
        metadata: { type: input.type },
      },
      tx,
    );
    return created;
  });

  return signature;
}

export async function listSignatures(subject: Subject) {
  return prisma.signature.findMany({
    where: { userId: subject.userId, revokedAt: null },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
}

export async function revokeSignature(subject: Subject, signatureId: string) {
  const sig = await prisma.signature.findUnique({ where: { id: signatureId } });
  if (!sig) throw new NotFoundError();
  if (sig.userId !== subject.userId) {
    throw new ForbiddenError("Anda hanya dapat mencabut tanda tangan milik sendiri");
  }
  return prisma.signature.update({
    where: { id: signatureId },
    data: { revokedAt: new Date(), isDefault: false },
  });
}

export async function setDefaultSignature(subject: Subject, signatureId: string) {
  const sig = await prisma.signature.findUnique({ where: { id: signatureId } });
  if (!sig || sig.userId !== subject.userId) throw new ForbiddenError();
  await prisma.$transaction([
    prisma.signature.updateMany({
      where: { userId: subject.userId, isDefault: true },
      data: { isDefault: false },
    }),
    prisma.signature.update({ where: { id: signatureId }, data: { isDefault: true } }),
  ]);
}
