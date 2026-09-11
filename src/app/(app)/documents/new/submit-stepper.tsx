"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  Upload,
  FileCheck2,
  PenLine,
  SendHorizontal,
  Loader2,
  AlertTriangle,
  Info as InfoIcon,
  CircleCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { cn, formatBytes } from "@/lib/utils";

interface CourseOpt {
  id: string;
  code: string;
  name: string;
  credits: number;
  defaultSemester: number;
  studyProgram: string;
}
interface PeriodOpt {
  id: string;
  label: string;
}
interface Existing {
  id: string;
  courseId: string;
  academicPeriodId: string;
  title: string;
  hasVersion: boolean;
  status: string;
  metadata: {
    courseCode: string;
    courseName: string;
    credits: number;
    semester: number;
    developerName: string;
    revisionNumber: string;
  } | null;
}

interface Finding {
  ruleCode: string;
  severity: "ERROR" | "WARNING" | "INFO";
  status: "PASSED" | "FAILED" | "RESOLVED";
  title: string;
  description: string;
}

const STEPS = [
  { n: 1, label: "Identitas", icon: FileCheck2 },
  { n: 2, label: "Unggah", icon: Upload },
  { n: 3, label: "Validasi", icon: FileCheck2 },
  { n: 4, label: "Penandatangan", icon: PenLine },
  { n: 5, label: "Review & Ajukan", icon: SendHorizontal },
];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = await res.json();
  if (!res.ok || json.ok === false) {
    throw new Error(json?.error?.message ?? "Terjadi kesalahan");
  }
  return json.data as T;
}

export function SubmitStepper({
  courses,
  periods,
  developerName,
  existing,
}: {
  courses: CourseOpt[];
  periods: PeriodOpt[];
  developerName: string;
  existing: Existing | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [documentId, setDocumentId] = useState<string | null>(existing?.id ?? null);
  const [busy, setBusy] = useState(false);

  const [courseId, setCourseId] = useState(existing?.courseId ?? "");
  const [academicPeriodId, setAcademicPeriodId] = useState(
    existing?.academicPeriodId ?? periods[0]?.id ?? "",
  );
  const [title, setTitle] = useState(existing?.title ?? "");
  const [credits, setCredits] = useState(existing?.metadata?.credits ?? 3);
  const [semester, setSemester] = useState(existing?.metadata?.semester ?? 1);
  const [developer, setDeveloper] = useState(existing?.metadata?.developerName ?? developerName);
  const [revisionNumber, setRevisionNumber] = useState(existing?.metadata?.revisionNumber ?? "0");
  const [preparationDate, setPreparationDate] = useState(
    new Date().toISOString().slice(0, 10),
  );

  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploaded, setUploaded] = useState<{ versionId: string; pageCount: number; duplicateOf: string | null } | null>(
    existing?.hasVersion ? { versionId: "existing", pageCount: 0, duplicateOf: null } : null,
  );

  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [blocking, setBlocking] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const selectedCourse = useMemo(() => courses.find((c) => c.id === courseId), [courses, courseId]);

  function onCourseChange(id: string) {
    setCourseId(id);
    const c = courses.find((x) => x.id === id);
    if (c) {
      setCredits(c.credits);
      setSemester(c.defaultSemester);
      if (!title) setTitle(`RPS ${c.name}`);
    }
  }

  function metadataPayload() {
    return {
      courseCode: selectedCourse?.code ?? "",
      courseName: selectedCourse?.name ?? "",
      credits,
      semester,
      developerName: developer,
      revisionNumber,
      preparationDate,
    };
  }

  async function ensureDraftAndMetadata(): Promise<string> {
    let id = documentId;
    if (!id) {
      const created = await api<{ id: string }>("/api/documents", {
        method: "POST",
        body: JSON.stringify({ courseId, academicPeriodId, title }),
      });
      id = created.id;
      setDocumentId(id);
    }
    if (uploaded && uploaded.versionId !== "existing") {
      await api(`/api/documents/${id}`, {
        method: "PATCH",
        body: JSON.stringify(metadataPayload()),
      });
    }
    return id;
  }

  async function next() {
    setBusy(true);
    try {
      if (step === 1) {
        if (!courseId || !academicPeriodId || title.trim().length < 3) {
          toast.error("Lengkapi mata kuliah, periode, dan judul (min 3 karakter).");
          return;
        }
        await ensureDraftAndMetadata();
        setStep(2);
      } else if (step === 2) {
        if (!uploaded) {
          toast.error("Unggah berkas RPS terlebih dahulu.");
          return;
        }
        // Persist metadata now that a version exists.
        if (documentId) {
          await api(`/api/documents/${documentId}`, {
            method: "PATCH",
            body: JSON.stringify(metadataPayload()),
          });
        }
        setStep(3);
      } else if (step === 3) {
        setStep(4);
      } else if (step === 4) {
        setStep(5);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function doUpload() {
    if (!file) return;
    const id = await ensureDraftAndMetadata();
    setProgress(0);
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/documents/${id}/upload`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        try {
          const json = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && json.ok !== false) {
            setUploaded(json.data);
            setProgress(100);
            if (json.data.duplicateOf) {
              toast.warning("Berkas identik terdeteksi (hash sama) pada dokumen lain.");
            } else {
              toast.success("Berkas berhasil diunggah dan dikonversi.");
            }
            resolve();
          } else {
            reject(new Error(json?.error?.message ?? "Gagal mengunggah"));
          }
        } catch {
          reject(new Error("Gagal mengunggah"));
        }
      };
      xhr.onerror = () => reject(new Error("Kesalahan jaringan saat mengunggah"));
      const fd = new FormData();
      fd.append("file", file);
      xhr.send(fd);
    }).catch((err) => toast.error((err as Error).message));
  }

  async function runValidation() {
    if (!documentId) return;
    setBusy(true);
    try {
      const res = await api<{ findings: Finding[]; summary: { blocking: boolean; errors: number; warnings: number } }>(
        `/api/documents/${documentId}/validate`,
        { method: "POST" },
      );
      setFindings(res.findings);
      setBlocking(res.summary.blocking);
      if (res.summary.blocking) toast.error(`Ditemukan ${res.summary.errors} kesalahan yang memblokir.`);
      else toast.success("Validasi lolos. Dokumen siap diajukan.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function doSubmit() {
    if (!documentId) return;
    setBusy(true);
    try {
      await api(`/api/documents/${documentId}/submit`, { method: "POST" });
      toast.success("Dokumen berhasil diajukan.");
      router.push(`/documents/${documentId}`);
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Stepper header */}
      <ol className="flex items-center gap-2 overflow-x-auto pb-1">
        {STEPS.map((s, i) => {
          const active = s.n === step;
          const done = s.n < step;
          return (
            <li key={s.n} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                  done ? "bg-success text-success-foreground" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="size-4" /> : s.n}
              </div>
              <span className={cn("hidden text-sm font-medium sm:block", active ? "text-foreground" : "text-muted-foreground")}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && <span className="h-px flex-1 bg-border" />}
            </li>
          );
        })}
      </ol>

      <Card>
        <CardContent className="p-6">
          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Mata Kuliah</Label>
                <Select value={courseId} onChange={(e) => onCourseChange(e.target.value)}>
                  <option value="">Pilih mata kuliah</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name} ({c.studyProgram})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Judul Dokumen</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="RPS Sistem Informasi Manajemen" />
              </div>
              <div className="space-y-1.5">
                <Label>Periode Akademik</Label>
                <Select value={academicPeriodId} onChange={(e) => setAcademicPeriodId(e.target.value)}>
                  {periods.length === 0 && <option value="">Tidak ada periode aktif</option>}
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Dosen Pengembang</Label>
                <Input value={developer} onChange={(e) => setDeveloper(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>SKS</Label>
                <Input type="number" min={1} max={12} value={credits} onChange={(e) => setCredits(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Semester</Label>
                <Input type="number" min={1} max={14} value={semester} onChange={(e) => setSemester(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Nomor Revisi</Label>
                <Input value={revisionNumber} onChange={(e) => setRevisionNumber(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Tanggal Penyusunan</Label>
                <Input type="date" value={preparationDate} onChange={(e) => setPreparationDate(e.target.value)} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 px-6 py-10 text-center hover:bg-muted/50">
                <Upload className="mb-2 size-8 text-muted-foreground" />
                <span className="text-sm font-medium">Klik untuk memilih berkas RPS</span>
                <span className="mt-1 text-xs text-muted-foreground">Format PDF atau DOCX, maksimal 25 MB</span>
                <input
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setFile(f);
                    setUploaded(null);
                    setProgress(0);
                  }}
                />
              </label>

              {file && (
                <div className="rounded-md border border-border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{file.name}</span>
                    <span className="text-muted-foreground">{formatBytes(file.size)}</span>
                  </div>
                  {progress > 0 && (
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  )}
                  {!uploaded && (
                    <Button className="mt-3" size="sm" onClick={doUpload}>
                      <Upload className="size-4" /> Unggah & Konversi
                    </Button>
                  )}
                  {uploaded && (
                    <p className="mt-2 flex items-center gap-1.5 text-success">
                      <CircleCheck className="size-4" /> Terunggah
                      {uploaded.pageCount > 0 && ` · ${uploaded.pageCount} halaman`}
                    </p>
                  )}
                </div>
              )}
              {existing?.hasVersion && !file && (
                <p className="text-sm text-muted-foreground">
                  Versi sebelumnya sudah terunggah. Unggah berkas baru hanya jika ingin menggantinya.
                </p>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Jalankan validasi kelengkapan metadata dan dokumen.
                </p>
                <Button onClick={runValidation} disabled={busy} variant="secondary" size="sm">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />}
                  Jalankan Validasi
                </Button>
              </div>
              {findings && (
                <ul className="space-y-2">
                  {findings.map((f) => {
                    const passed = f.status === "PASSED";
                    return (
                      <li
                        key={f.ruleCode}
                        className={cn(
                          "flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
                          passed
                            ? "border-success/25 bg-success/5"
                            : f.severity === "ERROR"
                              ? "border-danger/25 bg-danger/5"
                              : "border-warning/30 bg-warning/5",
                        )}
                      >
                        {passed ? (
                          <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" />
                        ) : f.severity === "ERROR" ? (
                          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
                        ) : (
                          <InfoIcon className="mt-0.5 size-4 shrink-0 text-[#8a5a00]" />
                        )}
                        <div>
                          <p className="font-medium">{f.title}</p>
                          <p className="text-muted-foreground">{f.description}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Dokumen akan melewati alur persetujuan berurutan berikut:
              </p>
              <ol className="space-y-2">
                {["Dosen Pengembang (tanda tangan)", "Koordinator RMK", "Ketua Program Studi (tanda tangan)"].map((s, i) => (
                  <li key={s} className="flex items-center gap-3 rounded-md border border-border p-3">
                    <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium">{s}</span>
                  </li>
                ))}
              </ol>
              <p className="text-xs text-muted-foreground">
                Setiap tahap tercatat pada audit trail. Persetujuan bersifat persetujuan digital internal.
              </p>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div className="grid gap-3 rounded-md border border-border p-4 text-sm sm:grid-cols-2">
                <Info label="Mata Kuliah" value={selectedCourse ? `${selectedCourse.code} — ${selectedCourse.name}` : "—"} />
                <Info label="Judul" value={title} />
                <Info label="SKS / Semester" value={`${credits} SKS · Semester ${semester}`} />
                <Info label="Dosen Pengembang" value={developer} />
              </div>
              {blocking && (
                <p className="flex items-center gap-2 text-sm text-danger">
                  <AlertTriangle className="size-4" /> Validasi masih memblokir. Perbaiki sebelum mengajukan.
                </p>
              )}
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1" />
                <span>
                  Saya menyatakan data telah benar dan memahami bahwa setelah diajukan dokumen tidak dapat
                  diedit tanpa alur revisi.
                </span>
              </label>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1 || busy}>
              Kembali
            </Button>
            {step < 5 ? (
              <Button onClick={next} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null} Lanjut
              </Button>
            ) : (
              <Button onClick={doSubmit} disabled={busy || blocking || !confirmed}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
                Ajukan Dokumen
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}
