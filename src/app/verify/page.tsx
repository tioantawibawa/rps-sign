import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

async function goVerify(formData: FormData) {
  "use server";
  const raw = String(formData.get("token") ?? "").trim();
  // Accept either a raw token or a full verify URL pasted in.
  const token = raw.includes("/verify/") ? raw.split("/verify/")[1]!.split(/[?#]/)[0] : raw;
  if (token) redirect(`/verify/${encodeURIComponent(token)}`);
  redirect("/verify");
}

export default function VerifyLandingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md text-center">
        <div className="mb-4 flex items-center justify-center gap-2 text-primary">
          <ShieldCheck className="size-7" />
          <span className="text-xl font-semibold">RPS Sign</span>
        </div>
        <h1 className="text-2xl font-semibold">Verifikasi Keaslian Dokumen</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pindai QR pada dokumen RPS, atau tempel token/tautan verifikasi di bawah ini.
        </p>
        <form action={goVerify} className="mt-6 flex gap-2">
          <Input name="token" placeholder="Token atau tautan verifikasi" required />
          <Button type="submit">Verifikasi</Button>
        </form>
        <p className="mt-6 text-xs text-muted-foreground">
          Halaman ini bersifat publik dan hanya menampilkan metadata minimum.
        </p>
      </div>
    </div>
  );
}
