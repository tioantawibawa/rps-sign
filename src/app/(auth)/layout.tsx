import { ShieldCheck } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, #14a6b8 0, transparent 40%), radial-gradient(circle at 80% 60%, #f5a623 0, transparent 35%)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-white/15">
            <ShieldCheck className="size-6" />
          </div>
          <div>
            <div className="text-lg font-semibold">RPS Sign</div>
            <div className="text-sm text-white/70">Pengesahan & Tanda Tangan Digital</div>
          </div>
        </div>
        <div className="relative space-y-4">
          <h1 className="text-3xl font-semibold leading-tight">
            Persetujuan digital internal RPS yang aman dan terverifikasi.
          </h1>
          <p className="max-w-md text-white/80">
            Alur pengesahan berurutan — Dosen Pengembang, Koordinator RMK, hingga
            Ketua Program Studi — dengan audit trail, QR verifikasi, dan integritas SHA-256.
          </p>
        </div>
        <div className="relative text-sm text-white/60">
          Universitas YPPI Rembang · Fakultas Ekonomi dan Bisnis
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
