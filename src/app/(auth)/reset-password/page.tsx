import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { resetPassword } from "@/server/auth/password-reset-service";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

const schema = z.object({
  token: z.string().min(10),
  password: z.string().min(8),
});

async function submit(formData: FormData) {
  "use server";
  const parsed = schema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) redirect("/reset-password?error=1");
  const res = await resetPassword(parsed.data.token, parsed.data.password);
  redirect(res.ok ? "/login?reset=1" : "/reset-password?error=1");
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-semibold">Atur ulang kata sandi</h2>
        <p className="text-sm text-muted-foreground">
          Masukkan kata sandi baru minimal 8 karakter.
        </p>
      </div>
      {sp.error && (
        <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger">
          Token tidak valid/kedaluwarsa atau kata sandi terlalu pendek.
        </div>
      )}
      <form action={submit} className="space-y-4">
        <input type="hidden" name="token" defaultValue={sp.token ?? ""} />
        <div className="space-y-1.5">
          <Label htmlFor="password">Kata sandi baru</Label>
          <Input id="password" name="password" type="password" required minLength={8} />
        </div>
        <Button type="submit" className="w-full">
          Simpan kata sandi
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
