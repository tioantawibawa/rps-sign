import Link from "next/link";
import { notFound } from "next/navigation";
import {
  FileText,
  Download,
  ShieldCheck,
  History,
  QrCode,
  ScrollText,
  AlertTriangle,
  Info,
} from "lucide-react";
import {
  ApprovalStatus,
  CertificateStatus,
  DocumentStatus,
  ValidationSeverity,
  ValidationStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSubject } from "@/server/auth/session";
import {
  canActOnActiveStep,
  canArchiveDocument,
  canCancelDocument,
  canEditDocument,
  canReadDocument,
  canSubmitDocument,
} from "@/domain/permissions";
import { isEditable } from "@/domain/document-status";
import { createSignedDownloadUrl } from "@/server/storage";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { shortFingerprint } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DocumentStatusBadge } from "@/components/status-badge";
import { ApprovalTimeline } from "@/components/approval-timeline";
import {
  AdminActions,
  ApproverActions,
  OwnerActions,
  type SignatureOption,
} from "./document-actions";

export const dynamic = "force-dynamic";

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const subject = await requireSubject();

  const doc = await prisma.document.findUnique({
    where: { id },
    include: {
      course: true,
      studyProgram: { include: { faculty: true } },
      academicPeriod: true,
      organization: true,
      owner: true,
      currentVersion: { include: { metadata: true, validations: true } },
      approvals: {
        include: { workflowStep: true, approver: true, signature: true },
        orderBy: { workflowStep: { order: "asc" } },
      },
      certificates: { where: { status: CertificateStatus.ACTIVE }, take: 1 },
    },
  });
  if (!doc) notFound();

  const ctx = {
    organizationId: doc.organizationId,
    studyProgramId: doc.studyProgramId,
    clusterId: doc.clusterId,
    ownerId: doc.ownerId,
    status: doc.status,
  };
  if (!canReadDocument(subject, ctx)) notFound();

  const activeApproval = doc.approvals.find(
    (a) =>
      a.status === ApprovalStatus.PENDING &&
      a.workflowStep.order === doc.currentApprovalStep &&
      a.documentVersionId === doc.currentVersionId,
  );
  const canAct = !!activeApproval && canActOnActiveStep(subject, ctx);

  const signatures: SignatureOption[] = canAct
    ? (
        await prisma.signature.findMany({
          where: { userId: subject.userId, revokedAt: null },
          orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        })
      ).map((s) => ({
        id: s.id,
        isDefault: s.isDefault,
        label: `${s.type === "DRAWN" ? "Gambar" : "Unggahan"}${s.isDefault ? " (default)" : ""} · ${fmtDate(s.createdAt)}`,
      }))
    : [];

  const version = doc.currentVersion;
  const cert = doc.certificates[0];

  // Signed, expiring, user-bound PDF link.
  const pdfKey =
    doc.status === DocumentStatus.APPROVED && version?.finalPdfStorageKey
      ? version.finalPdfStorageKey
      : version?.convertedPdfStorageKey;
  const pdfUrl = pdfKey ? createSignedDownloadUrl(pdfKey, subject.userId, { inline: true }) : null;
  const finalUrl =
    version?.finalPdfStorageKey && doc.status === DocumentStatus.APPROVED
      ? createSignedDownloadUrl(version.finalPdfStorageKey, subject.userId, {
          downloadFilename: `${doc.documentNumber ?? "RPS"}.pdf`,
        })
      : null;

  const errors = version?.validations.filter(
    (v) => v.severity === ValidationSeverity.ERROR && v.status === ValidationStatus.FAILED,
  ) ?? [];
  const warnings = version?.validations.filter(
    (v) => v.severity === ValidationSeverity.WARNING && v.status === ValidationStatus.FAILED,
  ) ?? [];

  return (
    <div>
      <PageHeader
        title={doc.title}
        description={`${doc.documentNumber ?? "Belum bernomor"} · ${doc.course.name} (${doc.course.code})`}
        actions={<DocumentStatusBadge status={doc.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Action bar */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Tindakan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {subject.userId === doc.ownerId && (
                <OwnerActions
                  documentId={doc.id}
                  canEdit={canEditDocument(subject, ctx) && isEditable(doc.status)}
                  canValidate={canEditDocument(subject, ctx) && !!doc.currentVersionId}
                  canSubmit={canSubmitDocument(subject, ctx)}
                  canCancel={canCancelDocument(subject, ctx)}
                />
              )}
              {canAct && activeApproval && (
                <ApproverActions
                  documentId={doc.id}
                  approvalId={activeApproval.id}
                  reviewStarted={!!activeApproval.startedAt}
                  requiresSignature={activeApproval.workflowStep.requiresSignature}
                  signatures={signatures}
                />
              )}
              <AdminActions documentId={doc.id} canArchive={canArchiveDocument(subject, ctx)} />
              {!canAct && subject.userId !== doc.ownerId && !canArchiveDocument(subject, ctx) && (
                <p className="text-sm text-muted-foreground">
                  Tidak ada tindakan yang tersedia untuk Anda pada status saat ini.
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                {pdfUrl && (
                  <Button asChild variant="outline" size="sm">
                    <a href={pdfUrl} target="_blank" rel="noreferrer">
                      <FileText className="size-4" /> Lihat PDF
                    </a>
                  </Button>
                )}
                {finalUrl && (
                  <Button asChild variant="outline" size="sm">
                    <a href={finalUrl}>
                      <Download className="size-4" /> Unduh Final
                    </a>
                  </Button>
                )}
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/documents/${doc.id}/audit`}>
                    <ScrollText className="size-4" /> Audit Trail
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Validation */}
          {(errors.length > 0 || warnings.length > 0) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Hasil Validasi</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {errors.map((v) => (
                  <div key={v.id} className="flex items-start gap-2 rounded-md border border-danger/25 bg-danger/5 px-3 py-2 text-sm">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
                    <div>
                      <p className="font-medium">{v.title}</p>
                      <p className="text-muted-foreground">{v.description}</p>
                    </div>
                  </div>
                ))}
                {warnings.map((v) => (
                  <div key={v.id} className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-sm">
                    <Info className="mt-0.5 size-4 shrink-0 text-[#8a5a00]" />
                    <div>
                      <p className="font-medium">{v.title}</p>
                      <p className="text-muted-foreground">{v.description}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <History className="size-4" /> Alur Persetujuan
              </CardTitle>
            </CardHeader>
            <CardContent>
              {doc.approvals.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Alur persetujuan dimulai setelah dokumen diajukan.
                </p>
              ) : (
                <ApprovalTimeline
                  approvals={doc.approvals
                    .filter((a) => a.documentVersionId === doc.currentVersionId)
                    .map((a) => ({
                      id: a.id,
                      status: a.status,
                      comments: a.comments,
                      actedAt: a.actedAt,
                      dueAt: a.dueAt,
                      workflowStep: a.workflowStep,
                      approver: a.approver ? { name: a.approver.name } : null,
                    }))}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Informasi Dokumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Info2 label="Nomor" value={doc.documentNumber ?? "—"} />
              <Info2 label="Program Studi" value={doc.studyProgram.name} />
              <Info2 label="Fakultas" value={doc.studyProgram.faculty.name} />
              <Info2 label="Periode" value={`${doc.academicPeriod.academicYear} · ${doc.academicPeriod.term}`} />
              <Info2 label="Pemilik" value={doc.owner.name} />
              <Info2 label="SKS" value={String(doc.course.credits)} />
              {version && (
                <>
                  <Info2 label="Versi" value={`v${version.versionNumber} · ${version.pageCount} hal.`} />
                  <Info2 label="Sidik Jari Sumber" value={shortFingerprint(version.sourceHash)} mono />
                  {version.finalHash && (
                    <Info2 label="Sidik Jari Final" value={shortFingerprint(version.finalHash)} mono />
                  )}
                </>
              )}
              <Info2 label="Dibuat" value={fmtDate(doc.createdAt)} />
              {doc.submittedAt && <Info2 label="Diajukan" value={fmtDateTime(doc.submittedAt)} />}
              {doc.approvedAt && <Info2 label="Disahkan" value={fmtDateTime(doc.approvedAt)} />}
            </CardContent>
          </Card>

          {cert && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-success" /> Sertifikat
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Info2 label="Nomor Sertifikat" value={cert.certificateNumber} mono />
                <Info2 label="Diterbitkan" value={fmtDate(cert.issuedAt)} />
                <div className="flex items-center gap-2 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                  <QrCode className="size-4" />
                  Dokumen final memuat QR verifikasi publik dan tautan verifikasi.
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Info2({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "text-right font-mono text-xs" : "text-right font-medium"}>{value}</span>
    </div>
  );
}
