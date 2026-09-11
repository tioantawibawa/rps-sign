import {
  ApprovalStatus,
  CertificateStatus,
  DocumentStatus,
  NotificationType,
} from "@prisma/client";
import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { sha256Hex, generateVerificationToken, randomSuffix } from "@/lib/crypto";
import { formatCertificateNumber } from "@/domain/document-number";
import { assertTransition } from "@/domain/state-machine";
import { ConflictError } from "@/server/errors";
import { storage } from "@/server/storage";
import { writeAudit } from "@/server/audit/audit-service";
import { AuditAction } from "@/server/audit/actions";
import { notify } from "@/server/notifications/notification-service";
import { roleLabel } from "@/domain/roles";

const BRAND = rgb(7 / 255, 94 / 255, 155 / 255);
const INK = rgb(15 / 255, 31 / 255, 46 / 255);

/**
 * Generate the final, stamped PDF for a fully-approved document, issue its
 * verification certificate, and mark the document APPROVED.
 *
 * Idempotent & retriable: if a certificate already exists it is returned; on
 * failure the document remains in PROCESSING_FINAL_DOCUMENT for a safe retry
 * and is NEVER marked approved.
 */
export async function finalizeDocument(documentId: string) {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      organization: true,
      studyProgram: true,
      currentVersion: true,
      approvals: {
        where: { status: ApprovalStatus.APPROVED },
        include: {
          workflowStep: true,
          signature: true,
          approver: true,
        },
      },
      certificates: { where: { status: CertificateStatus.ACTIVE } },
    },
  });

  if (!doc) throw new ConflictError("Dokumen tidak ditemukan");
  if (doc.status === DocumentStatus.APPROVED && doc.certificates[0]) {
    return { certificateId: doc.certificates[0].id, alreadyDone: true };
  }
  if (doc.status !== DocumentStatus.PROCESSING_FINAL_DOCUMENT) {
    throw new ConflictError("Dokumen tidak dalam tahap pemrosesan final");
  }
  const version = doc.currentVersion;
  if (!version?.convertedPdfStorageKey) {
    throw new ConflictError("PDF terkonversi tidak tersedia");
  }

  try {
    // 1. Integrity check — the source must be unchanged since upload/validation.
    const original = await storage.getObject(version.originalStorageKey);
    if (sha256Hex(original) !== version.sourceHash) {
      throw new ConflictError("Integritas berkas sumber tidak konsisten (hash berbeda)");
    }

    // 2. Load converted PDF for stamping.
    const pdfBytes = await storage.getObject(version.convertedPdfStorageKey);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pages = pdfDoc.getPages();

    // 3. Prepare verification token + certificate number + QR.
    const { token, tokenHash } = generateVerificationToken();
    const year = new Date().getFullYear();
    const certificateNumber = formatCertificateNumber(year, randomSuffix(6));
    const verifyUrl = `${env.APP_URL}/verify/${token}`;
    const qrPngBuffer = await QRCode.toBuffer(verifyUrl, {
      width: 220,
      margin: 1,
      errorCorrectionLevel: "M",
    });
    const qrImage = await pdfDoc.embedPng(qrPngBuffer);

    // 4. Load the active placement template.
    const template = await prisma.signaturePlacementTemplate.findFirst({
      where: { organizationId: doc.organizationId, isActive: true, documentType: "RPS" },
      include: { placements: true },
    });

    // 5. Stamp each approver's signature at its placement.
    for (const approval of doc.approvals) {
      const placement = template?.placements.find(
        (p) => p.role === approval.workflowStep.role,
      );
      if (!placement || !approval.signature) continue;
      const pageIndex = Math.min(placement.pageNumber - 1, pages.length - 1);
      const page = pages[pageIndex];
      if (!page) continue;
      const { height } = page.getSize();

      const sigBytes = await storage.getObject(approval.signature.storageKey);
      const img = isPng(sigBytes)
        ? await pdfDoc.embedPng(sigBytes)
        : await pdfDoc.embedJpg(sigBytes);

      const y = height - placement.y - placement.height;
      page.drawImage(img, {
        x: placement.x,
        y: y + 14,
        width: placement.width,
        height: placement.height,
      });

      let textY = y + 6;
      if (placement.includeName && approval.approver) {
        page.drawText(fullName(approval.approver), {
          x: placement.x,
          y: textY,
          size: 8,
          font: fontBold,
          color: INK,
        });
        textY -= 10;
      }
      if (placement.includeTitle) {
        page.drawText(roleLabel(approval.workflowStep.role), {
          x: placement.x,
          y: textY,
          size: 7,
          font,
          color: INK,
        });
        textY -= 9;
      }
      if (placement.includeTimestamp && approval.actedAt) {
        page.drawText(
          `Disetujui: ${approval.actedAt.toISOString().slice(0, 16).replace("T", " ")} UTC`,
          { x: placement.x, y: textY, size: 6, font, color: rgb(0.4, 0.45, 0.5) },
        );
      }
    }

    // 6. Footer band on the last page: document number, verify URL, QR.
    const last = pages[pages.length - 1]!;
    const { width } = last.getSize();
    last.drawRectangle({ x: 0, y: 0, width, height: 74, color: rgb(0.96, 0.97, 0.98) });
    last.drawText("Disahkan secara digital melalui RPS Sign", {
      x: 36,
      y: 52,
      size: 9,
      font: fontBold,
      color: BRAND,
    });
    last.drawText(`Nomor Dokumen: ${doc.documentNumber ?? "-"}`, {
      x: 36,
      y: 38,
      size: 8,
      font,
      color: INK,
    });
    last.drawText(`Sertifikat: ${certificateNumber}`, {
      x: 36,
      y: 26,
      size: 8,
      font,
      color: INK,
    });
    last.drawText(`Verifikasi: ${verifyUrl}`, {
      x: 36,
      y: 14,
      size: 7,
      font,
      color: rgb(0.35, 0.4, 0.46),
    });
    last.drawImage(qrImage, { x: width - 96, y: 6, width: 60, height: 60 });

    // 7. Persist final PDF + hash.
    const finalBytes = Buffer.from(await pdfDoc.save());
    const finalHash = sha256Hex(finalBytes);
    const finalKey = `documents/${documentId}/v${version.versionNumber}/final.pdf`;
    await storage.putObject({ key: finalKey, body: finalBytes, contentType: "application/pdf" });

    let qrKey: string | null = null;
    qrKey = `documents/${documentId}/v${version.versionNumber}/qr.png`;
    await storage.putObject({ key: qrKey, body: qrPngBuffer, contentType: "image/png" });

    // 8. Transaction: certificate + version + document status.
    const certificate = await prisma.$transaction(async (tx) => {
      await tx.documentVersion.update({
        where: { id: version.id },
        data: { finalPdfStorageKey: finalKey, finalHash },
      });
      const cert = await tx.verificationCertificate.create({
        data: {
          documentId,
          documentVersionId: version.id,
          certificateNumber,
          verificationTokenHash: tokenHash,
          finalDocumentHash: finalHash,
          qrStorageKey: qrKey,
          status: CertificateStatus.ACTIVE,
        },
      });
      assertTransition(DocumentStatus.PROCESSING_FINAL_DOCUMENT, DocumentStatus.APPROVED);
      await tx.document.update({
        where: { id: documentId },
        data: { status: DocumentStatus.APPROVED },
      });
      await writeAudit(
        {
          organizationId: doc.organizationId,
          documentId,
          action: AuditAction.FINAL_PDF_GENERATED,
          entityType: "DocumentVersion",
          entityId: version.id,
          metadata: { finalHash },
        },
        tx,
      );
      await writeAudit(
        {
          organizationId: doc.organizationId,
          documentId,
          action: AuditAction.CERTIFICATE_ISSUED,
          entityType: "VerificationCertificate",
          entityId: cert.id,
          metadata: { certificateNumber },
        },
        tx,
      );
      return cert;
    });

    // 9. Notify all parties.
    const parties = new Set<string>([doc.ownerId]);
    for (const a of doc.approvals) if (a.approverId) parties.add(a.approverId);
    for (const userId of parties) {
      await notify({
        userId,
        type: NotificationType.FINAL_DOCUMENT_READY,
        title: "RPS telah disahkan",
        message: `Dokumen ${doc.documentNumber ?? ""} telah disahkan dan dokumen final tersedia.`,
        link: `/documents/${documentId}`,
        email: true,
      });
    }

    logger.info({ documentId, certificateNumber }, "document finalized");
    return { certificateId: certificate.id, alreadyDone: false };
  } catch (err) {
    logger.error({ err, documentId }, "finalization failed; document stays in PROCESSING");
    throw err;
  }
}

function isPng(buf: Buffer): boolean {
  return buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
}

function fullName(user: { name: string; titlePrefix: string | null; titleSuffix: string | null }): string {
  return [user.titlePrefix, user.name, user.titleSuffix].filter(Boolean).join(" ");
}
