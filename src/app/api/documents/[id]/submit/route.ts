import { handleRoute, ok } from "@/lib/api";
import { getSubjectOrThrow } from "@/server/auth/session";
import { submitDocument } from "@/server/documents/document-service";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const subject = await getSubjectOrThrow();
    const { id } = await params;
    const result = await submitDocument(subject, id);
    return ok(result);
  });
}
