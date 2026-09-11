import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { hashToken } from "@/lib/crypto";
import { hashPassword } from "@/lib/password";
import { mailer } from "@/server/notifications/mailer";
import { logger } from "@/lib/logger";

/**
 * Request a password reset. Always resolves the same way regardless of whether
 * the email exists (no account enumeration). The plaintext token is emailed;
 * only its hash is stored.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, email: true, name: true },
  });
  if (!user) return;

  const token = randomBytes(32).toString("base64url");
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  const url = `${env.APP_URL}/reset-password?token=${token}`;
  await mailer
    .send({
      to: user.email,
      subject: "[RPS Sign] Atur ulang kata sandi",
      text: `Tautan atur ulang kata sandi (berlaku 1 jam): ${url}`,
      html: `<p>Halo ${user.name},</p><p>Klik tautan berikut untuk mengatur ulang kata sandi (berlaku 1 jam):</p><p><a href="${url}">${url}</a></p>`,
    })
    .catch((err) => logger.warn({ err }, "reset email failed"));
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<{ ok: boolean; message: string }> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { ok: false, message: "Token tidak valid atau kedaluwarsa." };
  }
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);
  return { ok: true, message: "Kata sandi berhasil diperbarui." };
}
