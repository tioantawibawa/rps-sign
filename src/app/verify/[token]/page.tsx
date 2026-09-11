import Link from "next/link";
import { headers } from "next/headers";
import {
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  ArrowLeft,
} from "lucide-react";
import { verifyByToken } from "@/server/verification/verification-service";
import { rateLimit } from "@/lib/rate-limit";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function VerifyTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";

  const limit = rateLimit(`verify:${ip}`, 30, 60);
  const view = limit.ok ? await verifyByToken(token) : { outcome: "NOT_FOUND" as const };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2 text-primary">
          <ShieldCheck className="size-6" />
          <span className="text-lg font-semibold">RPS Sign · Verifikasi</span>
        </div>

        {view.outcome === "VALID" && (
          <div className="overflow-hidden rounded-xl border border-success/30 bg-card shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-3 bg-success px-5 py-4 text-success-foreground">
              <ShieldCheck className="size-7" />
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide">Dokumen Sah</p>
                <p className="text-xs opacity-90">Sertifikat aktif dan terverifikasi</p>
              </div>
            </div>
            <dl className="divide-y divide-border px-5 text-sm">
              <Row label="Nomor Sertifikat" value={view.certificateNumber} mono />
              <Row label="Nomor Dokumen" value={view.documentNumber ?? "—"} />
              <Row label="Judul" value={view.documentTitle} />
              <Row label="Mata Kuliah" value={view.courseName} />
              <Row label="Program Studi" value={view.studyProgram} />
              <Row label="Fakultas" value={view.faculty} />
              <Row label="Institusi" value={view.organization} />
              <Row label="Diterbitkan" value={fmtDate(view.issuedAt)} />
              <Row label="Sidik Jari" value={view.fingerprint} mono />
            </dl>
            <p className="px-5 py-4 text-xs text-muted-foreground">
              Verifikasi ini merupakan persetujuan digital internal institusi.
            </p>
          </div>
        )}

        {view.outcome === "REVOKED" && (
          <StatusCard
            tone="danger"
            icon={<ShieldX className="size-7" />}
            title="Sertifikat Dicabut"
            description={`Sertifikat ${view.certificateNumber ?? ""} telah dicabut dan tidak berlaku.`}
          />
        )}

        {view.outcome === "NOT_FOUND" && (
          <StatusCard
            tone="neutral"
            icon={<ShieldAlert className="size-7" />}
            title="Tidak Ditemukan"
            description="Token verifikasi tidak dikenali. Pastikan Anda memindai QR dari dokumen resmi."
          />
        )}

        <div className="mt-6 text-center">
          <Link href="/verify" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
            <ArrowLeft className="size-4" /> Verifikasi dokumen lain
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "text-right font-mono text-xs" : "text-right font-medium"}>{value ?? "—"}</dd>
    </div>
  );
}

function StatusCard({
  tone,
  icon,
  title,
  description,
}: {
  tone: "danger" | "neutral";
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  const bg = tone === "danger" ? "bg-danger text-danger-foreground" : "bg-muted text-muted-foreground";
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
      <div className={`flex items-center gap-3 px-5 py-4 ${bg}`}>
        {icon}
        <p className="text-sm font-semibold uppercase tracking-wide">{title}</p>
      </div>
      <p className="px-5 py-5 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
