"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Role, UserStatus } from "@prisma/client";
import { requireCapability } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { writeAudit } from "@/server/audit/audit-service";
import { AuditAction } from "@/server/audit/actions";

export interface UserActionState {
  ok: boolean;
  message: string;
}

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.nativeEnum(Role),
  password: z.string().min(8),
});

export async function createUserAction(_prev: UserActionState, formData: FormData): Promise<UserActionState> {
  const subject = await requireCapability("users:manage");
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { ok: false, message: "Data pengguna tidak valid (kata sandi min 8)." };

  const exists = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (exists) return { ok: false, message: "Email sudah terdaftar." };

  const user = await prisma.user.create({
    data: {
      organizationId: subject.organizationId,
      email: parsed.data.email.toLowerCase(),
      name: parsed.data.name,
      role: parsed.data.role,
      status: UserStatus.ACTIVE,
      passwordHash: await hashPassword(parsed.data.password),
    },
  });
  await writeAudit({
    organizationId: subject.organizationId,
    userId: subject.userId,
    action: AuditAction.USER_CREATED,
    entityType: "User",
    entityId: user.id,
    newValues: { email: user.email, role: user.role },
  });
  revalidatePath("/admin/users");
  return { ok: true, message: "Pengguna dibuat." };
}

export async function changeRoleAction(formData: FormData) {
  const subject = await requireCapability("users:manage");
  const userId = String(formData.get("userId"));
  const role = String(formData.get("role")) as Role;
  const before = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, organizationId: true } });
  if (!before || before.organizationId !== subject.organizationId) return;
  await prisma.user.update({ where: { id: userId }, data: { role } });
  await writeAudit({
    organizationId: subject.organizationId,
    userId: subject.userId,
    action: AuditAction.ROLE_CHANGED,
    entityType: "User",
    entityId: userId,
    oldValues: { role: before.role },
    newValues: { role },
  });
  revalidatePath("/admin/users");
}
