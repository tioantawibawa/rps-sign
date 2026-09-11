import { DocumentStatus, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Subject } from "@/domain/permissions";

/**
 * Build the Prisma filter that constrains which documents a subject may see.
 * This is the single source of truth for list/scope visibility on the server.
 */
export function scopedDocumentWhere(subject: Subject): Prisma.DocumentWhereInput {
  switch (subject.role) {
    case Role.ADMIN:
      return { organizationId: subject.organizationId };
    case Role.AUDITOR:
      return {
        organizationId: subject.organizationId,
        status: { in: [DocumentStatus.APPROVED, DocumentStatus.ARCHIVED] },
      };
    case Role.DOSEN:
      return { ownerId: subject.userId };
    case Role.KOORDINATOR_RMK:
      return {
        organizationId: subject.organizationId,
        clusterId: { in: subject.clusterIds.length ? subject.clusterIds : ["__none__"] },
      };
    case Role.KAPRODI:
      return {
        organizationId: subject.organizationId,
        studyProgramId: {
          in: subject.studyProgramIds.length ? subject.studyProgramIds : ["__none__"],
        },
      };
    default:
      return { id: "__none__" };
  }
}

export interface ListDocumentsParams {
  status?: DocumentStatus;
  query?: string;
  page?: number;
  pageSize?: number;
}

export async function listDocuments(subject: Subject, params: ListDocumentsParams = {}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, params.pageSize ?? 10);
  const where: Prisma.DocumentWhereInput = {
    AND: [
      scopedDocumentWhere(subject),
      params.status ? { status: params.status } : {},
      params.query
        ? {
            OR: [
              { title: { contains: params.query, mode: "insensitive" } },
              { documentNumber: { contains: params.query, mode: "insensitive" } },
              { course: { name: { contains: params.query, mode: "insensitive" } } },
            ],
          }
        : {},
    ],
  };

  const [items, total] = await Promise.all([
    prisma.document.findMany({
      where,
      include: {
        course: true,
        studyProgram: true,
        academicPeriod: true,
        owner: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.document.count({ where }),
  ]);

  return { items, total, page, pageSize, pageCount: Math.ceil(total / pageSize) };
}
