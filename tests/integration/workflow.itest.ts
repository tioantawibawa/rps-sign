import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  ApprovalStatus,
  DocumentStatus,
  PrismaClient,
  Role,
  SignatureType,
  StudyProgramLevel,
  AcademicTerm,
} from "@prisma/client";
import type { Subject } from "@/domain/permissions";
import {
  createDraft,
  uploadVersion,
  saveMetadata,
  validateDocument,
  submitDocument,
} from "@/server/documents/document-service";
import {
  approve,
  requestRevision,
  startReview,
} from "@/server/approvals/approval-service";
import { createSignature } from "@/server/signatures/signature-service";
import { verifyByToken } from "@/server/verification/verification-service";
import { hashToken } from "@/lib/crypto";

/**
 * Opt-in: requires a disposable PostgreSQL DB.
 *   RUN_INTEGRATION=1 DATABASE_URL=... pnpm test:integration
 */
const enabled = process.env.RUN_INTEGRATION === "1";
const prisma = new PrismaClient();

async function pdfBuffer(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.addPage([595, 842]).drawText("RPS test");
  return Buffer.from(await doc.save());
}

function subjectFor(user: { id: string; role: Role; organizationId: string }, scope: Partial<Subject> = {}): Subject {
  return {
    userId: user.id,
    role: user.role,
    organizationId: user.organizationId,
    facultyIds: [],
    studyProgramIds: [],
    clusterIds: [],
    ...scope,
  };
}

describe.skipIf(!enabled)("RPS approval workflow (integration)", () => {
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    const org = await prisma.organization.create({ data: { name: "Test Org", code: `T${Date.now()}` } });
    const faculty = await prisma.faculty.create({ data: { organizationId: org.id, code: "FEB", name: "FEB" } });
    const prodi = await prisma.studyProgram.create({ data: { facultyId: faculty.id, code: "AKT", name: "S1 Akuntansi", level: StudyProgramLevel.S1 } });
    const cluster = await prisma.courseCluster.create({ data: { studyProgramId: prodi.id, code: "SIA", name: "SIA" } });
    const course = await prisma.course.create({ data: { organizationId: org.id, studyProgramId: prodi.id, clusterId: cluster.id, code: "AKT301", name: "SIM", credits: 3, defaultSemester: 5 } });
    const period = await prisma.academicPeriod.create({ data: { organizationId: org.id, name: "Ganjil", academicYear: "2026/2027", term: AcademicTerm.GANJIL, startDate: new Date(), endDate: new Date(Date.now() + 1e10), isActive: true } });

    const mk = (email: string, role: Role) => prisma.user.create({ data: { organizationId: org.id, email, name: email, role, passwordHash: "x" } });
    const dosen = await mk(`dosen${Date.now()}@t.id`, Role.DOSEN);
    const koord = await mk(`koord${Date.now()}@t.id`, Role.KOORDINATOR_RMK);
    const kaprodi = await mk(`kaprodi${Date.now()}@t.id`, Role.KAPRODI);
    await prisma.userAssignment.createMany({
      data: [
        { userId: dosen.id, studyProgramId: prodi.id, clusterId: cluster.id },
        { userId: koord.id, clusterId: cluster.id, studyProgramId: prodi.id },
        { userId: kaprodi.id, studyProgramId: prodi.id },
      ],
    });

    const wf = await prisma.workflow.create({ data: { organizationId: org.id, name: "WF", isActive: true } });
    await prisma.workflowStep.createMany({
      data: [
        { workflowId: wf.id, order: 1, role: Role.DOSEN, label: "TTD Dosen", slaHours: 48, requiresSignature: true },
        { workflowId: wf.id, order: 2, role: Role.KOORDINATOR_RMK, label: "RMK", slaHours: 48 },
        { workflowId: wf.id, order: 3, role: Role.KAPRODI, label: "Kaprodi", slaHours: 48, requiresSignature: true },
      ],
    });
    const tpl = await prisma.signaturePlacementTemplate.create({ data: { organizationId: org.id, name: "T", isActive: true } });
    await prisma.signaturePlacement.createMany({
      data: [
        { templateId: tpl.id, role: Role.DOSEN, x: 60, y: 700, width: 100, height: 40 },
        { templateId: tpl.id, role: Role.KAPRODI, x: 400, y: 700, width: 100, height: 40 },
      ],
    });

    Object.assign(ids, { org: org.id, prodi: prodi.id, cluster: cluster.id, course: course.id, period: period.id, dosen: dosen.id, koord: koord.id, kaprodi: kaprodi.id });
  });

  afterAll(async () => {
    if (enabled && ids.org) {
      await prisma.organization.delete({ where: { id: ids.org } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it("runs submit → sequential approval → finalize with a valid certificate", async () => {
    const dosen = subjectFor({ id: ids.dosen, role: Role.DOSEN, organizationId: ids.org }, { studyProgramIds: [ids.prodi], clusterIds: [ids.cluster] });

    const draft = await createDraft(dosen, { courseId: ids.course, academicPeriodId: ids.period, title: "RPS SIM" });
    await uploadVersion(dosen, draft.id, { fileName: "rps.pdf", buffer: await pdfBuffer() });
    await saveMetadata(dosen, draft.id, {
      courseCode: "AKT301", courseName: "SIM", credits: 3, semester: 5, developerName: "Dosen", preparationDate: new Date(),
    });
    const { summary } = await validateDocument(dosen, draft.id);
    expect(summary.blocking).toBe(false);
    await submitDocument(dosen, draft.id);

    let doc = await prisma.document.findUniqueOrThrow({ where: { id: draft.id }, include: { approvals: { include: { workflowStep: true } } } });
    expect(doc.status).toBe(DocumentStatus.WAITING_LECTURER_SIGNATURE);
    expect(doc.documentNumber).toMatch(/^RPS-AKT-\d{4}-\d{3}$/);

    // Step 1 — developer signs.
    const sig = await createSignature(dosen, { type: SignatureType.DRAWN, buffer: await pngBuffer() });
    const step1 = doc.approvals.find((a) => a.workflowStep.order === 1)!;
    await approve(dosen, draft.id, step1.id, { signatureId: sig.id });

    // Step 2 — coordinator.
    const koord = subjectFor({ id: ids.koord, role: Role.KOORDINATOR_RMK, organizationId: ids.org }, { clusterIds: [ids.cluster], studyProgramIds: [ids.prodi] });
    doc = await prisma.document.findUniqueOrThrow({ where: { id: draft.id }, include: { approvals: { include: { workflowStep: true } } } });
    expect(doc.status).toBe(DocumentStatus.WAITING_RMK_APPROVAL);
    const step2 = doc.approvals.find((a) => a.workflowStep.order === 2)!;
    await startReview(koord, draft.id, step2.id);
    await approve(koord, draft.id, step2.id, {});

    // Step 3 — kaprodi signs; finalization runs.
    const kaprodi = subjectFor({ id: ids.kaprodi, role: Role.KAPRODI, organizationId: ids.org }, { studyProgramIds: [ids.prodi] });
    const kSig = await createSignature(kaprodi, { type: SignatureType.DRAWN, buffer: await pngBuffer() });
    doc = await prisma.document.findUniqueOrThrow({ where: { id: draft.id }, include: { approvals: { include: { workflowStep: true } } } });
    const step3 = doc.approvals.find((a) => a.workflowStep.order === 3)!;
    await approve(kaprodi, draft.id, step3.id, { signatureId: kSig.id });

    const finalDoc = await prisma.document.findUniqueOrThrow({ where: { id: draft.id } });
    expect(finalDoc.status).toBe(DocumentStatus.APPROVED);

    const cert = await prisma.verificationCertificate.findFirstOrThrow({ where: { documentId: draft.id } });
    // We cannot recover the plaintext token here (only its hash is stored), so
    // assert the certificate is active and hash-addressable.
    expect(cert.status).toBe("ACTIVE");
    expect(cert.finalDocumentHash).toHaveLength(64);
    const view = await verifyByToken("definitely-not-the-real-token");
    expect(view.outcome).toBe("NOT_FOUND");
    void hashToken; // token hashing covered by unit tests
  });

  it("rejects an out-of-scope / wrong-role approver", async () => {
    const dosen = subjectFor({ id: ids.dosen, role: Role.DOSEN, organizationId: ids.org }, { studyProgramIds: [ids.prodi], clusterIds: [ids.cluster] });
    const draft = await createDraft(dosen, { courseId: ids.course, academicPeriodId: ids.period, title: "RPS 2" });
    await uploadVersion(dosen, draft.id, { fileName: "rps.pdf", buffer: await pdfBuffer() });
    await saveMetadata(dosen, draft.id, { courseCode: "AKT301", courseName: "SIM", credits: 3, semester: 5, developerName: "Dosen", preparationDate: new Date() });
    await validateDocument(dosen, draft.id);
    await submitDocument(dosen, draft.id);
    const doc = await prisma.document.findUniqueOrThrow({ where: { id: draft.id }, include: { approvals: { include: { workflowStep: true } } } });
    const step1 = doc.approvals.find((a) => a.workflowStep.order === 1)!;

    // Kaprodi tries to act on the lecturer signature step.
    const kaprodi = subjectFor({ id: ids.kaprodi, role: Role.KAPRODI, organizationId: ids.org }, { studyProgramIds: [ids.prodi] });
    await expect(approve(kaprodi, draft.id, step1.id, {})).rejects.toThrow();
  });

  it("invalidates pending approvals when a revision is requested", async () => {
    const dosen = subjectFor({ id: ids.dosen, role: Role.DOSEN, organizationId: ids.org }, { studyProgramIds: [ids.prodi], clusterIds: [ids.cluster] });
    const draft = await createDraft(dosen, { courseId: ids.course, academicPeriodId: ids.period, title: "RPS 3" });
    await uploadVersion(dosen, draft.id, { fileName: "rps.pdf", buffer: await pdfBuffer() });
    await saveMetadata(dosen, draft.id, { courseCode: "AKT301", courseName: "SIM", credits: 3, semester: 5, developerName: "Dosen", preparationDate: new Date() });
    await validateDocument(dosen, draft.id);
    await submitDocument(dosen, draft.id);
    const sig = await createSignature(dosen, { type: SignatureType.DRAWN, buffer: await pngBuffer() });
    let doc = await prisma.document.findUniqueOrThrow({ where: { id: draft.id }, include: { approvals: { include: { workflowStep: true } } } });
    await approve(dosen, draft.id, doc.approvals.find((a) => a.workflowStep.order === 1)!.id, { signatureId: sig.id });

    doc = await prisma.document.findUniqueOrThrow({ where: { id: draft.id }, include: { approvals: { include: { workflowStep: true } } } });
    const koord = subjectFor({ id: ids.koord, role: Role.KOORDINATOR_RMK, organizationId: ids.org }, { clusterIds: [ids.cluster], studyProgramIds: [ids.prodi] });
    const step2 = doc.approvals.find((a) => a.workflowStep.order === 2)!;
    await requestRevision(koord, draft.id, step2.id, { category: "CONTENT", notes: "Perbaiki CPMK" });

    const revDoc = await prisma.document.findUniqueOrThrow({ where: { id: draft.id }, include: { approvals: true } });
    expect(revDoc.status).toBe(DocumentStatus.REVISION_REQUESTED);
    const stillPending = revDoc.approvals.filter((a) => a.status === ApprovalStatus.PENDING);
    expect(stillPending).toHaveLength(0);
  });
});

async function pngBuffer(): Promise<Buffer> {
  // 1x1 transparent PNG.
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );
}
