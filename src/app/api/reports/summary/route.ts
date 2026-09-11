import { DocumentStatus } from "@prisma/client";
import { handleRoute, ok } from "@/lib/api";
import { getSubjectOrThrow } from "@/server/auth/session";
import { ForbiddenError } from "@/server/errors";
import { hasCapability } from "@/domain/permissions";
import { getReportSummary } from "@/server/reporting/reporting-service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handleRoute(async () => {
    const subject = await getSubjectOrThrow();
    if (!hasCapability(subject.role, "reporting:read")) throw new ForbiddenError();
    const url = new URL(req.url);
    const status = url.searchParams.get("status") as DocumentStatus | null;
    const summary = await getReportSummary({
      organizationId: subject.organizationId,
      academicPeriodId: url.searchParams.get("academicPeriodId") ?? undefined,
      facultyId: url.searchParams.get("facultyId") ?? undefined,
      studyProgramId: url.searchParams.get("studyProgramId") ?? undefined,
      clusterId: url.searchParams.get("clusterId") ?? undefined,
      status: status && status in DocumentStatus ? status : undefined,
    });
    return ok(summary);
  });
}
