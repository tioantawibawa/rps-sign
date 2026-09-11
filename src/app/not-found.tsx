import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
      <p className="text-5xl font-bold text-primary">404</p>
      <h1 className="mt-3 text-lg font-semibold">Halaman tidak ditemukan</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Halaman yang Anda cari tidak tersedia atau Anda tidak memiliki akses.
      </p>
      <Button asChild className="mt-6">
        <Link href="/dashboard">Kembali ke Dashboard</Link>
      </Button>
    </div>
  );
}
