import { ValidationSeverity, ValidationStatus } from "@prisma/client";

/**
 * Document validation rule engine. Rules are pure functions over a context so
 * they can be unit-tested without a database. System-metadata rules are kept
 * separate from best-effort document-content heuristics — we do NOT pretend to
 * parse the full academic structure of a DOCX perfectly.
 */
export interface ValidationContext {
  metadata: {
    courseCode?: string | null;
    courseName?: string | null;
    credits?: number | null;
    semester?: number | null;
    developerName?: string | null;
    preparationDate?: Date | null;
    revisionNumber?: string | null;
  };
  courseExists: boolean;
  academicPeriodActive: boolean;
  developerResolved: boolean;
  signersHaveActiveAssignment: boolean;
  pdfRendered: boolean;
  pageCount: number;
  sourceHash?: string | null;
  /** Heuristic: did the source appear to contain an approval/signature block? */
  hasApprovalBlockHint: boolean;
}

export interface ValidationFinding {
  ruleCode: string;
  category: string;
  severity: ValidationSeverity;
  status: ValidationStatus;
  title: string;
  description: string;
  pageNumber?: number | null;
}

interface Rule {
  code: string;
  category: string;
  severity: ValidationSeverity;
  title: string;
  evaluate: (ctx: ValidationContext) => {
    passed: boolean;
    description: string;
    pageNumber?: number | null;
  };
}

const RULES: Rule[] = [
  {
    code: "META_REQUIRED",
    category: "metadata",
    severity: ValidationSeverity.ERROR,
    title: "Metadata wajib lengkap",
    evaluate: (ctx) => {
      const m = ctx.metadata;
      const missing: string[] = [];
      if (!m.courseCode) missing.push("kode MK");
      if (!m.courseName) missing.push("nama MK");
      if (m.credits == null) missing.push("SKS");
      if (m.semester == null) missing.push("semester");
      if (!m.developerName) missing.push("dosen pengembang");
      if (!m.preparationDate) missing.push("tanggal penyusunan");
      return {
        passed: missing.length === 0,
        description:
          missing.length === 0
            ? "Seluruh metadata wajib telah terisi."
            : `Metadata belum lengkap: ${missing.join(", ")}.`,
      };
    },
  },
  {
    code: "COURSE_CODE_PRESENT",
    category: "metadata",
    severity: ValidationSeverity.ERROR,
    title: "Kode mata kuliah tersedia",
    evaluate: (ctx) => ({
      passed: ctx.courseExists && !!ctx.metadata.courseCode,
      description: ctx.courseExists
        ? "Kode mata kuliah terdaftar pada master data."
        : "Kode mata kuliah tidak ditemukan pada master data.",
    }),
  },
  {
    code: "CREDITS_VALID",
    category: "metadata",
    severity: ValidationSeverity.ERROR,
    title: "SKS valid",
    evaluate: (ctx) => {
      const c = ctx.metadata.credits;
      const valid = c != null && Number.isInteger(c) && c >= 1 && c <= 12;
      return {
        passed: valid,
        description: valid
          ? `Jumlah SKS (${c}) berada dalam rentang wajar.`
          : "Jumlah SKS harus berupa bilangan 1–12.",
      };
    },
  },
  {
    code: "ACADEMIC_PERIOD_ACTIVE",
    category: "system",
    severity: ValidationSeverity.ERROR,
    title: "Periode akademik aktif",
    evaluate: (ctx) => ({
      passed: ctx.academicPeriodActive,
      description: ctx.academicPeriodActive
        ? "Dokumen terkait periode akademik yang aktif."
        : "Periode akademik yang dipilih tidak aktif.",
    }),
  },
  {
    code: "DEVELOPER_RESOLVED",
    category: "system",
    severity: ValidationSeverity.ERROR,
    title: "Dosen pengembang tersedia",
    evaluate: (ctx) => ({
      passed: ctx.developerResolved,
      description: ctx.developerResolved
        ? "Dosen pengembang teridentifikasi pada sistem."
        : "Dosen pengembang tidak dapat dipetakan ke pengguna aktif.",
    }),
  },
  {
    code: "SIGNER_ASSIGNMENT_ACTIVE",
    category: "system",
    severity: ValidationSeverity.ERROR,
    title: "Penandatangan memiliki penugasan aktif",
    evaluate: (ctx) => ({
      passed: ctx.signersHaveActiveAssignment,
      description: ctx.signersHaveActiveAssignment
        ? "Seluruh penandatangan memiliki penugasan aktif."
        : "Sebagian penandatangan belum memiliki penugasan aktif (Koordinator/Kaprodi).",
    }),
  },
  {
    code: "PDF_RENDERED",
    category: "document",
    severity: ValidationSeverity.ERROR,
    title: "PDF berhasil dirender",
    evaluate: (ctx) => ({
      passed: ctx.pdfRendered,
      description: ctx.pdfRendered
        ? "Dokumen berhasil dikonversi/dibaca sebagai PDF."
        : "Dokumen gagal dirender sebagai PDF.",
    }),
  },
  {
    code: "PAGE_COUNT_POSITIVE",
    category: "document",
    severity: ValidationSeverity.ERROR,
    title: "Jumlah halaman lebih dari nol",
    evaluate: (ctx) => ({
      passed: ctx.pageCount > 0,
      description:
        ctx.pageCount > 0
          ? `Dokumen memiliki ${ctx.pageCount} halaman.`
          : "Dokumen tidak memiliki halaman yang dapat dibaca.",
    }),
  },
  {
    code: "SOURCE_HASH_PRESENT",
    category: "document",
    severity: ValidationSeverity.ERROR,
    title: "Hash sumber tersedia",
    evaluate: (ctx) => ({
      passed: !!ctx.sourceHash,
      description: ctx.sourceHash
        ? "Sidik jari (hash) berkas sumber telah dihitung."
        : "Hash berkas sumber tidak tersedia.",
    }),
  },
  {
    code: "APPROVAL_BLOCK_HINT",
    category: "content",
    severity: ValidationSeverity.WARNING,
    title: "Referensi blok pengesahan",
    evaluate: (ctx) => ({
      passed: ctx.hasApprovalBlockHint,
      description: ctx.hasApprovalBlockHint
        ? "Terindikasi blok pengesahan/tanda tangan pada dokumen."
        : "Blok pengesahan tidak terdeteksi otomatis. Pastikan template pengesahan tersedia (heuristik, dapat dilanjutkan).",
    }),
  },
  {
    code: "REVISION_RECOMMENDED",
    category: "content",
    severity: ValidationSeverity.INFO,
    title: "Nomor revisi terisi",
    evaluate: (ctx) => ({
      passed: !!ctx.metadata.revisionNumber,
      description: ctx.metadata.revisionNumber
        ? `Nomor revisi: ${ctx.metadata.revisionNumber}.`
        : "Disarankan mencantumkan nomor revisi RPS.",
    }),
  },
];

export function runValidation(ctx: ValidationContext): ValidationFinding[] {
  return RULES.map((rule) => {
    const result = rule.evaluate(ctx);
    return {
      ruleCode: rule.code,
      category: rule.category,
      severity: rule.severity,
      status: result.passed
        ? ValidationStatus.PASSED
        : ValidationStatus.FAILED,
      title: rule.title,
      description: result.description,
      pageNumber: result.pageNumber ?? null,
    };
  });
}

/** True when there is at least one failing ERROR-severity rule. */
export function hasBlockingErrors(findings: ValidationFinding[]): boolean {
  return findings.some(
    (f) =>
      f.severity === ValidationSeverity.ERROR &&
      f.status === ValidationStatus.FAILED,
  );
}

export function summarizeValidation(findings: ValidationFinding[]) {
  return {
    errors: findings.filter(
      (f) =>
        f.severity === ValidationSeverity.ERROR &&
        f.status === ValidationStatus.FAILED,
    ).length,
    warnings: findings.filter(
      (f) =>
        f.severity === ValidationSeverity.WARNING &&
        f.status === ValidationStatus.FAILED,
    ).length,
    info: findings.filter((f) => f.severity === ValidationSeverity.INFO).length,
    blocking: hasBlockingErrors(findings),
  };
}
