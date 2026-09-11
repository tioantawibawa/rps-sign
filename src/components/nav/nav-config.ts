import type { Role } from "@prisma/client";
import {
  LayoutDashboard,
  FileText,
  ClipboardCheck,
  BarChart3,
  Archive,
  Bell,
  User,
  PenLine,
  Users,
  GitBranch,
  ScrollText,
  Building2,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  /** Show in the mobile bottom bar. */
  mobile?: boolean;
}

const ALL: Role[] = ["DOSEN", "KOORDINATOR_RMK", "KAPRODI", "ADMIN", "AUDITOR"];

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Utama",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ALL, mobile: true },
      { href: "/documents", label: "Dokumen RPS", icon: FileText, roles: ALL, mobile: true },
      {
        href: "/approvals",
        label: "Persetujuan Saya",
        icon: ClipboardCheck,
        roles: ["KOORDINATOR_RMK", "KAPRODI", "DOSEN"],
        mobile: true,
      },
      { href: "/monitoring", label: "Monitoring", icon: BarChart3, roles: ["KAPRODI", "ADMIN", "AUDITOR"] },
      { href: "/archive", label: "Arsip", icon: Archive, roles: ALL },
    ],
  },
  {
    title: "Akun",
    items: [
      { href: "/notifications", label: "Notifikasi", icon: Bell, roles: ALL, mobile: true },
      { href: "/signatures", label: "Tanda Tangan", icon: PenLine, roles: ["DOSEN", "KOORDINATOR_RMK", "KAPRODI"] },
      { href: "/profile", label: "Profil", icon: User, roles: ALL },
    ],
  },
  {
    title: "Administrasi",
    items: [
      { href: "/admin/users", label: "Pengguna & Peran", icon: Users, roles: ["ADMIN"] },
      { href: "/admin/organization", label: "Struktur Akademik", icon: Building2, roles: ["ADMIN"] },
      { href: "/admin/workflow", label: "Workflow & SLA", icon: GitBranch, roles: ["ADMIN"] },
      { href: "/admin/audit", label: "Audit Log", icon: ScrollText, roles: ["ADMIN", "AUDITOR"] },
      { href: "/admin/settings", label: "Pengaturan", icon: Settings, roles: ["ADMIN"] },
    ],
  },
];

export function navItemsForRole(role: Role): { title: string; items: NavItem[] }[] {
  return NAV_SECTIONS.map((s) => ({
    title: s.title,
    items: s.items.filter((i) => i.roles.includes(role)),
  })).filter((s) => s.items.length > 0);
}

export function mobileNavForRole(role: Role): NavItem[] {
  return NAV_SECTIONS.flatMap((s) => s.items).filter(
    (i) => i.mobile && i.roles.includes(role),
  );
}
