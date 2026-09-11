import { Role } from "@prisma/client";

export const ROLE_LABELS: Record<Role, string> = {
  DOSEN: "Dosen Pengembang",
  KOORDINATOR_RMK: "Koordinator RMK",
  KAPRODI: "Ketua Program Studi",
  ADMIN: "Administrator",
  AUDITOR: "Auditor",
};

export const ROLE_SHORT: Record<Role, string> = {
  DOSEN: "Dosen",
  KOORDINATOR_RMK: "Koordinator",
  KAPRODI: "Kaprodi",
  ADMIN: "Admin",
  AUDITOR: "Auditor",
};

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role] ?? role;
}

/** Roles that participate in the sequential approval workflow, in order. */
export const APPROVAL_ROLE_ORDER: Role[] = [
  Role.DOSEN,
  Role.KOORDINATOR_RMK,
  Role.KAPRODI,
];
