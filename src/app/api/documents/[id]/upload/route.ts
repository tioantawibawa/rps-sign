import { handleRoute, ok } from "@/lib/api";
import { getSubjectOrThrow } from "@/server/auth/session";
import { env } from "@/lib/env";
import { BadRequestError } from "@/server/errors";
import { uploadVersion } from "@/server/documents/document-service";

export const dynamic = "force-dynamic";
// Allow larger request bodies for uploads.
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const subject = await getSubjectOrThrow();
    const { id } = await params;

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob) || typeof (file as File).name !== "string") {
      throw new BadRequestError("Berkas tidak ditemukan pada permintaan");
    }
    const f = file as File;
    if (f.size > env.DOC_MAX_UPLOAD_BYTES) {
      throw new BadRequestError("Ukuran berkas melebihi batas maksimum");
    }

    const buffer = Buffer.from(await f.arrayBuffer());
    const result = await uploadVersion(subject, id, {
      fileName: f.name,
      buffer,
      declaredMime: f.type,
      changeSummary: form.get("changeSummary")?.toString(),
    });

    return ok(result, { status: 201 });
  });
}
