"use server";

import { revalidatePath } from "next/cache";
import { getSubjectOrThrow } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";

export async function markAllRead() {
  const subject = await getSubjectOrThrow();
  await prisma.notification.updateMany({
    where: { userId: subject.userId, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}

export async function markRead(formData: FormData) {
  const subject = await getSubjectOrThrow();
  const id = String(formData.get("id"));
  await prisma.notification.updateMany({
    where: { id, userId: subject.userId },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
}
