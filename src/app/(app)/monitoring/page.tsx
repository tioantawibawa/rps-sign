import { redirect } from "next/navigation";
import { BarChart3, Clock, CheckCircle2, Gauge, Download } from "lucide-react";
import { requireSubject } from "@/server/auth/session";
import { hasCapability } from "@/domain/permissions";
import { getReportSummary } from "@/server/reporting/reporting-service";
import { DOCUMENT_STATUS_LABELS } from "@/domain/document-status";
import { roleLabel } from "@/domain/roles";
import { DocumentStatus } from "@prisma/client";
import { fmtHours, fmtPercent } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBarChart, AgingBarChart } from "./monitoring-charts";

export const dynamic = "force-dynamic";

export default async function MonitoringPage() {
  const subject = await requireSubject();
  if (!hasCapability(subject.role, "reporting:read") || subject.role === "DOSEN") {
    redirect("/dashboard");
  }
  const summary = await getReportSummary({ organizationId: subject.organizationId });

  const statusData = Object.entries(summary.byStatus).map(([k, v]) => ({
    name: DOCUMENT_STATUS_LABELS[k as DocumentStatus] ?? k,
    value: v,
  }));
  const agingData = Object.entries(summary.aging).map(([k, v]) => ({ name: k + " jam", value: v }));

  return (
    <div>
      <PageHeader
        title="Monitoring"
        description="Metrik pengesahan RPS pada institusi Anda."
        actions={
          <Button asChild variant="outline" size="sm">
            <a href="/api/reports/export">
              <Download className="size-4" /> Ekspor CSV
            </a>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total RPS" value={summary.total} icon={BarChart3} tone="primary" />
        <StatCard label="Dalam Proses" value={summary.submitted} icon={Clock} tone="warning" />
        <StatCard label="Disahkan" value={summary.approved} icon={CheckCircle2} tone="success" />
        <StatCard
          label="Kepatuhan SLA"
          value={fmtPercent(summary.slaCompliance)}
          icon={Gauge}
          tone="info"
          hint={`Rata-rata turnaround ${fmtHours(summary.averageTurnaroundHours)}`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle>Distribusi Status</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.total === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Belum ada data.</p>
            ) : (
              <>
                <StatusBarChart data={statusData} />
                <p className="mt-3 text-sm text-muted-foreground">
                  Dari {summary.total} dokumen: {summary.draft} draf, {summary.submitted} dalam proses,{" "}
                  {summary.needsRevision} perlu revisi, dan {summary.approved} telah disahkan. Tingkat
                  persetujuan {fmtPercent(summary.approvalRate)}.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Aging Dokumen Berjalan</CardTitle>
          </CardHeader>
          <CardContent>
            <AgingBarChart data={agingData} />
            <p className="mt-3 text-sm text-muted-foreground">
              Distribusi lama dokumen yang masih menunggu persetujuan sejak diajukan.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="pb-2">
          <CardTitle>Rata-rata Waktu per Tahap</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.stageAverages.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada data tahap.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-3">
              {summary.stageAverages.map((s) => (
                <li key={s.role} className="rounded-md border border-border p-4">
                  <p className="text-sm font-medium">{roleLabel(s.role as never)}</p>
                  <p className="text-2xl font-semibold">{fmtHours(s.averageHours)}</p>
                  <p className="text-xs text-muted-foreground">{s.count} persetujuan</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
