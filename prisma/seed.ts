/**
 * RPS Sign — database seed.
 *
 * Self-contained (no "@/" path alias so it runs under tsx). Seeds a realistic
 * institution, users for every role, a three-stage workflow, a placement
 * template, one document per major status, and a fully-approved document with a
 * real PDF + verification certificate so the public QR verification works.
 *
 * DEMO CREDENTIALS (development only — never use in production):
 *   All accounts share the password:  Password123!
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import {
  ApprovalStatus,
  CertificateStatus,
  ChecklistStatus,
  DocumentStatus,
  PrismaClient,
  ProcessingStatus,
  Role,
  SignatureType,
  StudyProgramLevel,
  AcademicTerm,
  UserStatus,
  NotificationType,
} from "@prisma/client";
import { hash as argon2 } from "@node-rs/argon2";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Password123!";
const STORAGE_DIR = path.resolve(process.cwd(), process.env.STORAGE_LOCAL_DIR ?? "./.storage");
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

async function store(key: string, body: Buffer) {
  const full = path.join(STORAGE_DIR, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, body);
}

async function makePdf(title: string, lines: string[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  page.drawText("RENCANA PEMBELAJARAN SEMESTER (RPS)", { x: 60, y: 780, size: 14, font: bold, color: rgb(0.03, 0.37, 0.61) });
  page.drawText(title, { x: 60, y: 758, size: 11, font: bold });
  let y = 720;
  for (const line of lines) {
    page.drawText(line, { x: 60, y, size: 10, font });
    y -= 18;
  }
  page.drawText("Blok Pengesahan:", { x: 60, y: y - 20, size: 10, font: bold });
  return Buffer.from(await doc.save());
}

async function main() {
  console.log("🌱 Seeding RPS Sign...");

  // Clean (idempotent reseed) — order respects FKs.
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.reviewChecklist.deleteMany(),
    prisma.revisionRequest.deleteMany(),
    prisma.verificationCertificate.deleteMany(),
    prisma.approval.deleteMany(),
    prisma.validationResult.deleteMany(),
    prisma.documentMetadata.deleteMany(),
  ]);
  await prisma.document.updateMany({ data: { currentVersionId: null } });
  await prisma.$transaction([
    prisma.documentVersion.deleteMany(),
    prisma.document.deleteMany(),
    prisma.signaturePlacement.deleteMany(),
    prisma.signaturePlacementTemplate.deleteMany(),
    prisma.signature.deleteMany(),
    prisma.workflowStep.deleteMany(),
    prisma.workflow.deleteMany(),
    prisma.userAssignment.deleteMany(),
    prisma.passwordResetToken.deleteMany(),
    prisma.systemSetting.deleteMany(),
    prisma.course.deleteMany(),
    prisma.courseCluster.deleteMany(),
    prisma.academicPeriod.deleteMany(),
    prisma.studyProgram.deleteMany(),
    prisma.faculty.deleteMany(),
    prisma.user.deleteMany(),
    prisma.organization.deleteMany(),
  ]);

  const passwordHash = await argon2(DEMO_PASSWORD, { memoryCost: 19456, timeCost: 2, parallelism: 1 });

  // Organization & academic structure
  const org = await prisma.organization.create({
    data: { name: "Universitas YPPI Rembang", code: "UYR" },
  });
  const faculty = await prisma.faculty.create({
    data: { organizationId: org.id, code: "FEB", name: "Fakultas Ekonomi dan Bisnis" },
  });
  const prodi = await prisma.studyProgram.create({
    data: { facultyId: faculty.id, code: "AKT", name: "S1 Akuntansi", level: StudyProgramLevel.S1 },
  });
  const cluster = await prisma.courseCluster.create({
    data: { studyProgramId: prodi.id, code: "SIA", name: "Sistem Informasi & Akuntansi" },
  });
  const period = await prisma.academicPeriod.create({
    data: {
      organizationId: org.id,
      name: "Semester Ganjil 2026/2027",
      academicYear: "2026/2027",
      term: AcademicTerm.GANJIL,
      startDate: new Date("2026-09-01"),
      endDate: new Date("2027-01-31"),
      isActive: true,
    },
  });
  const [sim, ak, audit] = await Promise.all([
    prisma.course.create({
      data: { organizationId: org.id, studyProgramId: prodi.id, clusterId: cluster.id, code: "AKT301", name: "Sistem Informasi Manajemen", credits: 3, defaultSemester: 5 },
    }),
    prisma.course.create({
      data: { organizationId: org.id, studyProgramId: prodi.id, clusterId: cluster.id, code: "AKT201", name: "Akuntansi Keuangan Menengah", credits: 3, defaultSemester: 3 },
    }),
    prisma.course.create({
      data: { organizationId: org.id, studyProgramId: prodi.id, code: "AKT401", name: "Auditing", credits: 3, defaultSemester: 7 },
    }),
  ]);

  // Users
  const mkUser = (email: string, name: string, role: Role, extra: Record<string, unknown> = {}) =>
    prisma.user.create({
      data: { organizationId: org.id, email, name, role, status: UserStatus.ACTIVE, passwordHash, ...extra },
    });

  const dosen = await mkUser("dosen@yppi-rembang.ac.id", "Rangga Dwi Saputra", Role.DOSEN, { titlePrefix: "Rangga Dwi Saputra,", titleSuffix: "S.E., M.Ak.", employeeNumber: "198801012015041001" });
  const koordinator = await mkUser("koordinator@yppi-rembang.ac.id", "Anisa Fitri Rahmawati", Role.KOORDINATOR_RMK, { titleSuffix: "S.E., M.Si." });
  const kaprodi = await mkUser("kaprodi@yppi-rembang.ac.id", "Bagus Hariyanto", Role.KAPRODI, { titlePrefix: "Dr.", titleSuffix: "S.E., M.Si., Ak." });
  const admin = await mkUser("admin@yppi-rembang.ac.id", "Administrator RPS", Role.ADMIN);
  const auditor = await mkUser("auditor@yppi-rembang.ac.id", "Satuan Penjaminan Mutu", Role.AUDITOR);

  await prisma.courseCluster.update({ where: { id: cluster.id }, data: { coordinatorId: koordinator.id } });

  // Assignments (active)
  await prisma.userAssignment.createMany({
    data: [
      { userId: dosen.id, facultyId: faculty.id, studyProgramId: prodi.id, clusterId: cluster.id },
      { userId: koordinator.id, studyProgramId: prodi.id, clusterId: cluster.id },
      { userId: kaprodi.id, facultyId: faculty.id, studyProgramId: prodi.id },
    ],
  });

  // Workflow (3 stages)
  const workflow = await prisma.workflow.create({
    data: { organizationId: org.id, name: "Alur Pengesahan RPS", isActive: true },
  });
  const [step1, step2, step3] = await Promise.all([
    prisma.workflowStep.create({ data: { workflowId: workflow.id, order: 1, role: Role.DOSEN, label: "Tanda Tangan Dosen Pengembang", slaHours: 48, requiresSignature: true } }),
    prisma.workflowStep.create({ data: { workflowId: workflow.id, order: 2, role: Role.KOORDINATOR_RMK, label: "Persetujuan Koordinator RMK", slaHours: 72, requiresChecklist: true } }),
    prisma.workflowStep.create({ data: { workflowId: workflow.id, order: 3, role: Role.KAPRODI, label: "Pengesahan Ketua Program Studi", slaHours: 72, requiresSignature: true, requiresChecklist: true } }),
  ]);

  // Placement template
  const template = await prisma.signaturePlacementTemplate.create({
    data: { organizationId: org.id, name: "Template Pengesahan RPS", documentType: "RPS", isActive: true },
  });
  await prisma.signaturePlacement.createMany({
    data: [
      { templateId: template.id, role: Role.DOSEN, pageNumber: 1, x: 60, y: 700, width: 120, height: 45 },
      { templateId: template.id, role: Role.KOORDINATOR_RMK, pageNumber: 1, x: 230, y: 700, width: 120, height: 45 },
      { templateId: template.id, role: Role.KAPRODI, pageNumber: 1, x: 400, y: 700, width: 120, height: 45 },
    ],
  });

  // System settings
  await prisma.systemSetting.createMany({
    data: [
      { organizationId: org.id, key: "document.numberPrefix", value: "RPS" as never },
      { organizationId: org.id, key: "sla.warningRatio", value: 0.25 as never },
      { organizationId: org.id, key: "upload.maxBytes", value: 26214400 as never },
    ],
  });

  // Helper to create a document with a version + metadata.
  async function createDoc(opts: {
    course: { id: string; code: string; name: string; credits: number; defaultSemester: number };
    title: string;
    status: DocumentStatus;
    documentNumber?: string;
    withVersion?: boolean;
    convertedKey?: string;
    submittedAt?: Date;
    currentApprovalStep?: number;
  }) {
    const doc = await prisma.document.create({
      data: {
        organizationId: org.id,
        facultyId: faculty.id,
        studyProgramId: prodi.id,
        clusterId: opts.course.id === audit.id ? null : cluster.id,
        courseId: opts.course.id,
        academicPeriodId: period.id,
        ownerId: dosen.id,
        title: opts.title,
        status: opts.status,
        documentNumber: opts.documentNumber,
        submittedAt: opts.submittedAt,
        currentApprovalStep: opts.currentApprovalStep ?? 0,
      },
    });
    if (opts.withVersion) {
      const pdf = await makePdf(opts.title, [
        `Kode MK: ${opts.course.code}`,
        `Nama MK: ${opts.course.name}`,
        `SKS: ${opts.course.credits}   Semester: ${opts.course.defaultSemester}`,
        `Program Studi: S1 Akuntansi`,
        `Dosen Pengembang: ${dosen.name}`,
      ]);
      const key = opts.convertedKey ?? `documents/${doc.id}/v1/converted.pdf`;
      const originalKey = `documents/${doc.id}/v1/source-${opts.course.code}.pdf`;
      await store(key, pdf);
      await store(originalKey, pdf);
      const version = await prisma.documentVersion.create({
        data: {
          documentId: doc.id,
          versionNumber: 1,
          originalFileName: `${opts.course.code}.pdf`,
          originalStorageKey: originalKey,
          convertedPdfStorageKey: key,
          mimeType: "application/pdf",
          fileSize: pdf.byteLength,
          pageCount: 1,
          sourceHash: sha256(pdf),
          processingStatus: ProcessingStatus.COMPLETED,
          uploadedById: dosen.id,
          metadata: {
            create: {
              courseCode: opts.course.code,
              courseName: opts.course.name,
              credits: opts.course.credits,
              semester: opts.course.defaultSemester,
              developerName: dosen.name,
              revisionNumber: "0",
              preparationDate: new Date("2026-08-15"),
            },
          },
        },
      });
      await prisma.document.update({ where: { id: doc.id }, data: { currentVersionId: version.id } });
      return { doc, version };
    }
    return { doc, version: null };
  }

  // Documents across statuses
  await createDoc({ course: sim, title: "RPS Sistem Informasi Manajemen (Draf)", status: DocumentStatus.DRAFT, withVersion: true });
  await createDoc({ course: ak, title: "RPS Akuntansi Keuangan Menengah (Siap Diajukan)", status: DocumentStatus.READY_TO_SUBMIT, withVersion: true });

  // In-progress at RMK stage
  const inProg = await createDoc({
    course: audit,
    title: "RPS Auditing (Menunggu Koordinator RMK)",
    status: DocumentStatus.WAITING_RMK_APPROVAL,
    documentNumber: "RPS-AKT-2026-002",
    withVersion: true,
    submittedAt: new Date(Date.now() - 2 * 864e5),
    currentApprovalStep: 2,
  });
  if (inProg.version) {
    // Step 1 approved by dosen (with signature), step 2 pending, step 3 pending.
    const sigPng = await makeSignaturePng("RDS");
    await store(`signatures/${dosen.id}/seed.png`, sigPng);
    const sig = await prisma.signature.create({
      data: { userId: dosen.id, type: SignatureType.DRAWN, storageKey: `signatures/${dosen.id}/seed.png`, imageHash: sha256(sigPng), isDefault: true },
    });
    await prisma.approval.create({ data: { documentId: inProg.doc.id, documentVersionId: inProg.version.id, workflowStepId: step1.id, approverId: dosen.id, status: ApprovalStatus.APPROVED, actedAt: new Date(Date.now() - 2 * 864e5), startedAt: new Date(Date.now() - 2 * 864e5), signatureId: sig.id } });
    const rmkApproval = await prisma.approval.create({ data: { documentId: inProg.doc.id, documentVersionId: inProg.version.id, workflowStepId: step2.id, status: ApprovalStatus.PENDING, startedAt: new Date(Date.now() - 1 * 864e5), dueAt: new Date(Date.now() + 2 * 864e5) } });
    await prisma.reviewChecklist.createMany({
      data: [
        { approvalId: rmkApproval.id, itemCode: "IDENTITAS", label: "Identitas mata kuliah sesuai", status: ChecklistStatus.OK },
        { approvalId: rmkApproval.id, itemCode: "MATERI", label: "Materi & rencana mingguan lengkap", status: ChecklistStatus.UNCHECKED },
      ],
    });
    await prisma.approval.create({ data: { documentId: inProg.doc.id, documentVersionId: inProg.version.id, workflowStepId: step3.id, status: ApprovalStatus.PENDING } });
    await prisma.notification.create({ data: { userId: koordinator.id, type: NotificationType.APPROVAL_STAGE_ACTIVE, title: "Persetujuan RPS menunggu tindakan", message: "Dokumen RPS-AKT-2026-002 menunggu tindakan Anda.", link: `/documents/${inProg.doc.id}` } });
  }

  // Revision requested
  await createDoc({ course: sim, title: "RPS Sistem Informasi Manajemen (Perlu Revisi)", status: DocumentStatus.REVISION_REQUESTED, documentNumber: "RPS-AKT-2026-003", withVersion: true, submittedAt: new Date(Date.now() - 5 * 864e5) });

  // APPROVED with certificate + final PDF
  const approved = await createDoc({
    course: sim,
    title: "RPS Sistem Informasi Manajemen (Disahkan)",
    status: DocumentStatus.APPROVED,
    documentNumber: "RPS-AKT-2026-001",
    withVersion: true,
    submittedAt: new Date(Date.now() - 10 * 864e5),
    currentApprovalStep: 3,
  });
  let verifyToken = "";
  if (approved.version) {
    await prisma.document.update({ where: { id: approved.doc.id }, data: { approvedAt: new Date(Date.now() - 7 * 864e5) } });
    // Approvals all approved
    for (const [step, who] of [[step1, dosen], [step2, koordinator], [step3, kaprodi]] as const) {
      await prisma.approval.create({ data: { documentId: approved.doc.id, documentVersionId: approved.version.id, workflowStepId: step.id, approverId: who.id, status: ApprovalStatus.APPROVED, startedAt: new Date(Date.now() - 9 * 864e5), actedAt: new Date(Date.now() - 8 * 864e5) } });
    }
    // Final PDF + QR + certificate
    verifyToken = randomBytes(24).toString("base64url");
    const verifyUrl = `${APP_URL}/verify/${verifyToken}`;
    const qrPng = await QRCode.toBuffer(verifyUrl, { width: 220, margin: 1 });
    const finalPdf = await makePdf("RPS Sistem Informasi Manajemen — DISAHKAN", [
      "Kode MK: AKT301   SKS: 3   Semester: 5",
      "Program Studi: S1 Akuntansi",
      `Nomor Dokumen: RPS-AKT-2026-001`,
      `Verifikasi: ${verifyUrl}`,
    ]);
    const finalKey = `documents/${approved.doc.id}/v1/final.pdf`;
    const qrKey = `documents/${approved.doc.id}/v1/qr.png`;
    await store(finalKey, finalPdf);
    await store(qrKey, qrPng);
    const finalHash = sha256(finalPdf);
    await prisma.documentVersion.update({ where: { id: approved.version.id }, data: { finalPdfStorageKey: finalKey, finalHash } });
    await prisma.verificationCertificate.create({
      data: {
        documentId: approved.doc.id,
        documentVersionId: approved.version.id,
        certificateNumber: "CERT-2026-A1B2C3",
        verificationTokenHash: sha256(verifyToken),
        finalDocumentHash: finalHash,
        qrStorageKey: qrKey,
        status: CertificateStatus.ACTIVE,
      },
    });
  }

  // Sample audit events
  await prisma.auditLog.createMany({
    data: [
      { organizationId: org.id, userId: dosen.id, documentId: approved.doc.id, action: "DOCUMENT_CREATED", entityType: "Document", entityId: approved.doc.id },
      { organizationId: org.id, userId: kaprodi.id, documentId: approved.doc.id, action: "DOCUMENT_APPROVED", entityType: "Document", entityId: approved.doc.id },
      { organizationId: org.id, documentId: approved.doc.id, action: "CERTIFICATE_ISSUED", entityType: "VerificationCertificate", entityId: approved.doc.id },
    ],
  });

  console.log("\n✅ Seed selesai.\n");
  console.log("Akun demo (password semua: %s):", DEMO_PASSWORD);
  console.log("  Dosen        : dosen@yppi-rembang.ac.id");
  console.log("  Koordinator  : koordinator@yppi-rembang.ac.id");
  console.log("  Kaprodi      : kaprodi@yppi-rembang.ac.id");
  console.log("  Admin        : admin@yppi-rembang.ac.id");
  console.log("  Auditor      : auditor@yppi-rembang.ac.id");
  if (verifyToken) console.log("\n🔗 Verifikasi publik demo: %s/verify/%s", APP_URL, verifyToken);
}

async function makeSignaturePng(initials: string): Promise<Buffer> {
  // Demo stand-in: a small real PNG (produced by the QR encoder) so pdf-lib can
  // embed it during finalization. Real signatures come from the signature pad.
  return QRCode.toBuffer(`SIG:${initials}`, { width: 120, margin: 0 });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
