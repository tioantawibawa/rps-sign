"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-danger/10 text-danger">
        <AlertTriangle className="size-7" />
      </div>
      <h2 className="text-lg font-semibold">Terjadi kesalahan</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        Maaf, terjadi kendala saat memuat halaman ini. Silakan coba lagi.
      </p>
      <Button className="mt-5" onClick={reset}>
        Coba lagi
      </Button>
    </div>
  );
}
