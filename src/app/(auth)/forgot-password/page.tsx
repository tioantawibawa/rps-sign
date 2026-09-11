import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requestPasswordReset } from "@/server/auth/password-reset-service";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

async function requestReset(formData: FormData) {
  "use server";
  const email = z.string().email().safeParse(formData.get("email"));
  if (email.success) await requestPasswordReset(email.data);
  redirect("/forgot-password?sent=1");
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const sent = (await searchParams).sent;
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-semibold">Lupa kata sandi</h2>
        <p className="text-sm text-muted-foreground">
          Masukkan email Anda. Jika terdaftar, kami kirim tautan atur ulang.
        </p>
      </div>
      {sent && (
        <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2.5 text-sm text-success">
          Jika email terdaftar, tautan atur ulang telah dikirim. Periksa Mailpit
          pada pengembangan lokal.
        </div>
      )}
      <form action={requestReset} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="nama@yppi-rembang.ac.id"
          />
        </div>
        <Button type="submit" className="w-full">
          Kirim tautan atur ulang
        </Button>
      </form>
      <p className="text-center text-xs text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Kembali ke halaman masuk
        </Link>
      </p>
    </div>
  );
}
