/**
 * Document number generation. Format: RPS-<PRODI>-<YEAR>-<SEQ>
 * e.g. RPS-AKT-2026-001
 */
export interface DocumentNumberParts {
  prefix?: string;
  programCode: string;
  year: number;
  sequence: number;
  padding?: number;
}

export function formatDocumentNumber({
  prefix = "RPS",
  programCode,
  year,
  sequence,
  padding = 3,
}: DocumentNumberParts): string {
  const seq = String(sequence).padStart(padding, "0");
  const code = programCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `${prefix}-${code}-${year}-${seq}`;
}

/** Parse a document number back into parts (best-effort). */
export function parseDocumentNumber(value: string): DocumentNumberParts | null {
  const m = value.match(/^([A-Z]+)-([A-Z0-9]+)-(\d{4})-(\d+)$/);
  if (!m) return null;
  return {
    prefix: m[1],
    programCode: m[2],
    year: Number(m[3]),
    sequence: Number(m[4]),
  };
}

/**
 * Certificate number. Format: CERT-<YEAR>-<SUFFIX>
 */
export function formatCertificateNumber(year: number, suffix: string): string {
  return `CERT-${year}-${suffix}`;
}
