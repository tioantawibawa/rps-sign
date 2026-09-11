import { ApprovalStatus, DocumentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { turnaroundHours, agingBucket } from "@/domain/sla";

export interface ReportFilters {
  organizationId: string;
  academicPeriodId?: string;
  facultyId?: string;
  studyProgramId?: string;
  clusterId?: string;
  status?: DocumentStatus;
  dateFrom?: Date;
  dateTo?: Date;
}

function whereFromFilters(f: ReportFilters): Prisma.DocumentWhereInput {
  return {
    organizationId: f.organizationId,
    academicPeriodId: f.academicPeriodId,
    facultyId: f.facultyId,
    studyProgramId: f.studyProgramId,
    clusterId: f.clusterId,
    status: f.status,
    createdAt:
      f.dateFrom || f.dateTo
        ? { gte: f.dateFrom, lte: f.dateTo }
        : undefined,
  };
}

export interface ReportSummary {
  total: number;
  byStatus: Record<string, number>;
  draft: number;
  submitted: number;
  needsRevision: number;
  approved: number;
  approvalRate: number;
  averageTurnaroundHours: number;
  slaCompliance: number;
  aging: Record<string, number>;
  stageAverages: { role: string; averageHours: number; count: number }[];
}

export async function getReportSummary(f: ReportFilters): Promise<ReportSummary> {
  const where = whereFromFilters(f);

  const grouped = await prisma.document.groupBy({
    by: ["status"],
    where,
    _count: { _all: true },
  });
  const byStatus: Record<string, number> = {};
  for (const g of grouped) byStatus[g.status] = g._count._all;
  const total = grouped.reduce((s, g) => s + g._count._all, 0);

  const approved = byStatus[DocumentStatus.APPROVED] ?? 0;
  const rejected = byStatus[DocumentStatus.REJECTED] ?? 0;
  const approvalRate = approved + rejected > 0 ? approved / (approved + rejected) : 0;

  // Turnaround for approved documents.
  const approvedDocs = await prisma.document.findMany({
    where: { ...where, status: DocumentStatus.APPROVED, submittedAt: { not: null }, approvedAt: { not: null } },
    select: { submittedAt: true, approvedAt: true },
  });
  const turnarounds = approvedDocs
    .filter((d) => d.submittedAt && d.approvedAt)
    .map((d) => turnaroundHours(d.submittedAt!, d.approvedAt!));
  const averageTurnaroundHours =
    turnarounds.length > 0 ? turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length : 0;

  // SLA compliance across acted approvals.
  const actedApprovals = await prisma.approval.findMany({
    where: {
      document: where,
      actedAt: { not: null },
      dueAt: { not: null },
      status: { in: [ApprovalStatus.APPROVED, ApprovalStatus.REVISION_REQUESTED, ApprovalStatus.REJECTED] },
    },
    select: { actedAt: true, dueAt: true, startedAt: true, workflowStep: { select: { role: true } } },
  });
  const onTime = actedApprovals.filter((a) => a.actedAt! <= a.dueAt!).length;
  const slaCompliance = actedApprovals.length > 0 ? onTime / actedApprovals.length : 1;

  // Stage averages (time from startedAt to actedAt) grouped by role.
  const stageMap = new Map<string, { total: number; count: number }>();
  for (const a of actedApprovals) {
    if (!a.startedAt || !a.actedAt) continue;
    const role = a.workflowStep.role;
    const entry = stageMap.get(role) ?? { total: 0, count: 0 };
    entry.total += turnaroundHours(a.startedAt, a.actedAt);
    entry.count += 1;
    stageMap.set(role, entry);
  }
  const stageAverages = Array.from(stageMap.entries()).map(([role, v]) => ({
    role,
    averageHours: v.count > 0 ? v.total / v.count : 0,
    count: v.count,
  }));

  // Aging of in-progress documents.
  const inProgress = await prisma.document.findMany({
    where: {
      ...where,
      status: {
        in: [
          DocumentStatus.WAITING_LECTURER_SIGNATURE,
          DocumentStatus.WAITING_RMK_APPROVAL,
          DocumentStatus.WAITING_KAPRODI_APPROVAL,
        ],
      },
      submittedAt: { not: null },
    },
    select: { submittedAt: true },
  });
  const aging: Record<string, number> = { "0-24": 0, "24-48": 0, "48-72": 0, ">72": 0 };
  const now = new Date();
  for (const d of inProgress) {
    if (!d.submittedAt) continue;
    aging[agingBucket(turnaroundHours(d.submittedAt, now))]++;
  }

  return {
    total,
    byStatus,
    draft: byStatus[DocumentStatus.DRAFT] ?? 0,
    submitted:
      (byStatus[DocumentStatus.SUBMITTED] ?? 0) +
      (byStatus[DocumentStatus.WAITING_LECTURER_SIGNATURE] ?? 0) +
      (byStatus[DocumentStatus.WAITING_RMK_APPROVAL] ?? 0) +
      (byStatus[DocumentStatus.WAITING_KAPRODI_APPROVAL] ?? 0),
    needsRevision: byStatus[DocumentStatus.REVISION_REQUESTED] ?? 0,
    approved,
    approvalRate,
    averageTurnaroundHours,
    slaCompliance,
    aging,
    stageAverages,
  };
}

/** Export a flat CSV of documents matching the filters. */
export async function exportDocumentsCsv(f: ReportFilters): Promise<string> {
  const rows = await prisma.document.findMany({
    where: whereFromFilters(f),
    include: {
      course: true,
      studyProgram: true,
      academicPeriod: true,
      owner: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const header = [
    "Nomor Dokumen",
    "Judul",
    "Kode MK",
    "Mata Kuliah",
    "Program Studi",
    "Periode",
    "Pemilik",
    "Status",
    "Diajukan",
    "Disahkan",
  ];
  const lines = [header.join(",")];
  for (const d of rows) {
    lines.push(
      [
        d.documentNumber ?? "",
        d.title,
        d.course.code,
        d.course.name,
        d.studyProgram.name,
        `${d.academicPeriod.academicYear} ${d.academicPeriod.term}`,
        d.owner.name,
        d.status,
        d.submittedAt?.toISOString() ?? "",
        d.approvedAt?.toISOString() ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\n");
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
