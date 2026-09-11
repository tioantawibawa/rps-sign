import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileTypeFromBuffer } from "file-type";
import { PDFDocument } from "pdf-lib";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { sha256Hex } from "@/lib/crypto";

export const PDF_MIME = "application/pdf";
export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export interface ConverterInput {
  fileName: string;
  buffer: Buffer;
  /** Declared MIME from the upload; verified against content. */
  declaredMime?: string;
}

export interface ConvertedDocument {
  pdf: Buffer;
  sourceMime: string;
  sourceHash: string;
  pageCount: number;
  converted: boolean; // true when a real conversion happened (DOCX)
}

export interface DocumentConverter {
  convertToPdf(input: ConverterInput): Promise<ConvertedDocument>;
}

/**
 * Detect the true MIME by inspecting the file signature (magic bytes), never
 * trusting the extension alone. DOCX is a ZIP container, so file-type reports
 * either the docx mime or a generic zip; we accept both when the name ends .docx.
 */
export async function detectMime(
  buffer: Buffer,
  fileName: string,
): Promise<string | null> {
  const sniff = await fileTypeFromBuffer(buffer);
  if (!sniff) return null;
  if (sniff.mime === PDF_MIME) return PDF_MIME;
  const isZipContainer =
    sniff.mime === DOCX_MIME || sniff.mime === "application/zip";
  if (isZipContainer && fileName.toLowerCase().endsWith(".docx")) {
    return DOCX_MIME;
  }
  return sniff.mime;
}

async function countPdfPages(pdf: Buffer): Promise<number> {
  const doc = await PDFDocument.load(pdf, { updateMetadata: false });
  return doc.getPageCount();
}

/**
 * LibreOffice-backed converter. DOCX is rendered via `soffice --headless`.
 * Macros are never executed (headless conversion does not run them).
 */
export class LibreOfficeConverter implements DocumentConverter {
  async convertToPdf(input: ConverterInput): Promise<ConvertedDocument> {
    const sourceMime = await detectMime(input.buffer, input.fileName);
    const sourceHash = sha256Hex(input.buffer);

    if (sourceMime === PDF_MIME) {
      // Passthrough — validate it parses and count pages.
      const pageCount = await countPdfPages(input.buffer);
      return {
        pdf: input.buffer,
        sourceMime,
        sourceHash,
        pageCount,
        converted: false,
      };
    }

    if (sourceMime !== DOCX_MIME) {
      throw new ConversionError(
        `Tipe berkas tidak didukung: ${sourceMime ?? "unknown"}. Hanya PDF dan DOCX.`,
      );
    }

    const workDir = await mkdtemp(path.join(tmpdir(), "rps-convert-"));
    try {
      const inputPath = path.join(workDir, "source.docx");
      await writeFile(inputPath, input.buffer);
      await runSoffice(inputPath, workDir);

      const produced = (await readdir(workDir)).find((f) =>
        f.toLowerCase().endsWith(".pdf"),
      );
      if (!produced) {
        throw new ConversionError("Konversi gagal: PDF tidak dihasilkan.");
      }
      const pdf = await readFile(path.join(workDir, produced));
      const pageCount = await countPdfPages(pdf);
      return { pdf, sourceMime, sourceHash, pageCount, converted: true };
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }
}

function runSoffice(inputPath: string, outDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      env.LIBREOFFICE_BIN,
      [
        "--headless",
        "--norestore",
        "--nologo",
        "--nofirststartwizard",
        "--convert-to",
        "pdf",
        "--outdir",
        outDir,
        inputPath,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new ConversionError("Konversi melebihi batas waktu (timeout)."));
    }, env.CONVERTER_TIMEOUT_MS);

    let stderr = "";
    child.stderr?.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => {
      clearTimeout(timer);
      logger.error({ err }, "soffice spawn failed");
      reject(
        new ConversionError(
          "LibreOffice tidak tersedia. Pastikan 'soffice' terpasang atau gunakan worker konversi.",
        ),
      );
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new ConversionError(`Konversi gagal (kode ${code}): ${stderr}`));
    });
  });
}

export class ConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConversionError";
  }
}

export const converter: DocumentConverter = new LibreOfficeConverter();
