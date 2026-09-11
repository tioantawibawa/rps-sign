import { z } from "zod";
import { DocumentStatus } from "@prisma/client";
import { handleRoute, ok } from "@/lib/api";
import { getSubjectOrThrow } from "@/server/auth/session";
import { createDraft } from "@/server/documents/document-service";
import { listDocuments } from "@/server/documents/document-queries";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  courseId: z.string().min(1),
  academicPeriodId: z.string().min(1),
  title: z.string().min(3).max(200),
});

export async function POST(req: Request) {
  return handleRoute(async () => {
    const subject = await getSubjectOrThrow();
    const body = createSchema.parse(await req.json());
    const document = await createDraft(subject, body);
    return ok({ id: document.id }, { status: 201 });
  });
}

export async function GET(req: Request) {
  return handleRoute(async () => {
    const subject = await getSubjectOrThrow();
    const url = new URL(req.url);
    const status = url.searchParams.get("status") as DocumentStatus | null;
    const result = await listDocuments(subject, {
      status: status && status in DocumentStatus ? status : undefined,
      query: url.searchParams.get("q") ?? undefined,
      page: Number(url.searchParams.get("page") ?? 1),
    });
    return ok(result);
  });
}
