import Link from "next/link";
import { Bell, LogOut, ShieldCheck } from "lucide-react";
import type { Role } from "@prisma/client";
import { roleLabel } from "@/domain/roles";
import { initials } from "@/lib/utils";
import { signOutAction } from "@/server/auth/actions";

export function Topbar({
  name,
  role,
  unreadCount,
}: {
  name: string;
  role: Role;
  unreadCount: number;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-card/80 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-2 md:hidden">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShieldCheck className="size-4" />
        </div>
        <span className="text-sm font-semibold">RPS Sign</span>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2 md:gap-4">
        <Link
          href="/notifications"
          className="relative flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          aria-label="Notifikasi"
        >
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-4 text-danger-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>

        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {initials(name)}
          </div>
          <div className="hidden leading-tight sm:block">
            <div className="text-sm font-medium">{name}</div>
            <div className="text-[11px] text-muted-foreground">{roleLabel(role)}</div>
          </div>
        </div>

        <form action={signOutAction}>
          <button
            type="submit"
            className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            aria-label="Keluar"
            title="Keluar"
          >
            <LogOut className="size-5" />
          </button>
        </form>
      </div>
    </header>
  );
}
