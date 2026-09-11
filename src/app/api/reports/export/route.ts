import { DocumentStatus } from "@prisma/client";
import { getSubjectOrThrow } from "@/server/auth/session";
import { hasCapability } from "@/domain/permissions";
import { exportDocumentsCsv } from "@/server/reporting/reporting-service";
import { fail } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  let subject;
  try {
    subject = await getSubjectOrThrow();
  } catch {
    return fail("UNAUTHORIZED", "Tidak terautentikasi", 401);
  }
  if (!hasCapability(subject.role, "reporting:read")) {
    return fail("FORBIDDEN", "Tidak diizinkan", 403);
  }
  const url = new URL(req.url);
  const status = url.searchParams.get("status") as DocumentStatus | null;
  const csv = await exportDocumentsCsv({
    organizationId: subject.organizationId,
    academicPeriodId: url.searchParams.get("academicPeriodId") ?? undefined,
    studyProgramId: url.searchParams.get("studyProgramId") ?? undefined,
    status: status && status in DocumentStatus ? status : undefined,
  });

  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="laporan-rps.csv"',
    },
  });
}
