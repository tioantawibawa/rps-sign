import { handleRoute, ok } from "@/lib/api";
import { getSubjectOrThrow } from "@/server/auth/session";
import { env } from "@/lib/env";
import { BadRequestError } from "@/server/errors";
import { uploadVersion } from "@/server/documents/document-service";
import { writeAudit } from "@/server/audit/audit-service";
import { AuditAction } from "@/server/audit/actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Upload a revised version while the document is in REVISION_REQUESTED. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const subject = await getSubjectOrThrow();
    const { id } = await params;
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) throw new BadRequestError("Berkas tidak ditemukan");
    const f = file as File;
    if (f.size > env.DOC_MAX_UPLOAD_BYTES) throw new BadRequestError("Ukuran berkas melebihi batas");

    const buffer = Buffer.from(await f.arrayBuffer());
    const result = await uploadVersion(subject, id, {
      fileName: f.name,
      buffer,
      declaredMime: f.type,
      changeSummary: form.get("changeSummary")?.toString() ?? "Revisi dokumen",
    });

    await writeAudit({
      organizationId: subject.organizationId,
      userId: subject.userId,
      documentId: id,
      action: AuditAction.REVISION_UPLOADED,
      entityType: "DocumentVersion",
      entityId: result.versionId,
    });

    return ok(result, { status: 201 });
  });
}
