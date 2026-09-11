import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/nav/sidebar";
import { MobileNav } from "@/components/nav/mobile-nav";
import { Topbar } from "@/components/nav/topbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const unreadCount = await prisma.notification.count({
    where: { userId: user.id, readAt: null },
  });

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={user.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar name={user.name} role={user.role} unreadCount={unreadCount} />
        <main className="flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
      <MobileNav role={user.role} />
    </div>
  );
}
