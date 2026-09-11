import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { requireSubject } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { SubmitStepper } from "./submit-stepper";

export const dynamic = "force-dynamic";

export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ documentId?: string }>;
}) {
  const subject = await requireSubject();
  if (subject.role !== Role.DOSEN) redirect("/documents");
  const { documentId } = await searchParams;

  const me = await prisma.user.findUnique({
    where: { id: subject.userId },
    select: { name: true },
  });

  const [courses, periods] = await Promise.all([
    prisma.course.findMany({
      where: { organizationId: subject.organizationId },
      include: { studyProgram: true },
      orderBy: { code: "asc" },
    }),
    prisma.academicPeriod.findMany({
      where: { organizationId: subject.organizationId, isActive: true },
      orderBy: { startDate: "desc" },
    }),
  ]);

  let existing = null;
  if (documentId) {
    const doc = await prisma.document.findFirst({
      where: { id: documentId, ownerId: subject.userId },
      include: { currentVersion: { include: { metadata: true } } },
    });
    if (doc) {
      existing = {
        id: doc.id,
        courseId: doc.courseId,
        academicPeriodId: doc.academicPeriodId,
        title: doc.title,
        hasVersion: !!doc.currentVersionId,
        status: doc.status,
        metadata: doc.currentVersion?.metadata
          ? {
              courseCode: doc.currentVersion.metadata.courseCode,
              courseName: doc.currentVersion.metadata.courseName,
              credits: doc.currentVersion.metadata.credits,
              semester: doc.currentVersion.metadata.semester,
              developerName: doc.currentVersion.metadata.developerName,
              revisionNumber: doc.currentVersion.metadata.revisionNumber,
            }
          : null,
      };
    }
  }

  return (
    <div>
      <PageHeader
        title="Pengajuan RPS"
        description="Lengkapi setiap langkah untuk mengajukan RPS ke alur pengesahan."
      />
      <SubmitStepper
        courses={courses.map((c) => ({
          id: c.id,
          code: c.code,
          name: c.name,
          credits: c.credits,
          defaultSemester: c.defaultSemester,
          studyProgram: c.studyProgram.name,
        }))}
        periods={periods.map((p) => ({
          id: p.id,
          label: `${p.name} (${p.academicYear} ${p.term})`,
        }))}
        developerName={me?.name ?? ""}
        existing={existing}
      />
    </div>
  );
}
