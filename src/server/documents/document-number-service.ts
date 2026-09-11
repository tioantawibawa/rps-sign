import type { Prisma } from "@prisma/client";
import { formatDocumentNumber } from "@/domain/document-number";

/**
 * Allocate the next document number for a study program in a given year.
 * Runs inside the submit transaction so the sequence is consistent; the unique
 * constraint on Document.documentNumber is the final backstop.
 */
export async function allocateDocumentNumber(
  tx: Prisma.TransactionClient,
  params: { studyProgramId: string; programCode: string; year: number },
): Promise<string> {
  const prefix = `RPS-${params.programCode.toUpperCase()}-${params.year}-`;
  const last = await tx.document.findFirst({
    where: {
      studyProgramId: params.studyProgramId,
      documentNumber: { startsWith: prefix },
    },
    orderBy: { documentNumber: "desc" },
    select: { documentNumber: true },
  });

  let next = 1;
  if (last?.documentNumber) {
    const tail = last.documentNumber.slice(prefix.length);
    const parsed = Number.parseInt(tail, 10);
    if (Number.isFinite(parsed)) next = parsed + 1;
  }

  return formatDocumentNumber({
    programCode: params.programCode,
    year: params.year,
    sequence: next,
  });
}
