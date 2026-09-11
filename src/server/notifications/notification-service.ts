import type { NotificationType, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { mailer } from "./mailer";

type Db = PrismaClient | Prisma.TransactionClient;

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  /** Also send an email for this notification. */
  email?: boolean;
}

/**
 * Notification service. Writes the in-app notification synchronously (inside the
 * caller's transaction when provided) and dispatches email best-effort. New
 * channels (e.g. WhatsApp) can be added here without touching call sites.
 */
export async function notify(input: NotifyInput, db: Db = prisma) {
  const notification = await db.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link,
    },
  });

  if (input.email) {
    // Fire-and-forget: email failures must not roll back the workflow.
    void dispatchEmail(input.userId, input).catch((err) =>
      logger.warn({ err, userId: input.userId }, "email dispatch failed"),
    );
  }

  return notification;
}

async function dispatchEmail(userId: string, input: NotifyInput) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  if (!user?.email) return;
  const url = input.link ? `${env.APP_URL}${input.link}` : env.APP_URL;
  await mailer.send({
    to: user.email,
    subject: `[RPS Sign] ${input.title}`,
    text: `${input.message}\n\n${url}`,
    html: emailTemplate(user.name, input.title, input.message, url),
  });
}

function emailTemplate(
  name: string,
  title: string,
  message: string,
  url: string,
): string {
  return `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;background:#f4f7fa;padding:24px;color:#0f1f2e">
  <div style="max-width:560px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #dbe3ec">
    <div style="background:#075e9b;color:#fff;padding:16px 24px;font-weight:600">RPS Sign</div>
    <div style="padding:24px">
      <p>Halo ${escapeHtml(name)},</p>
      <h2 style="font-size:18px;margin:12px 0">${escapeHtml(title)}</h2>
      <p style="color:#5b6b7a;line-height:1.6">${escapeHtml(message)}</p>
      <p style="margin-top:24px">
        <a href="${url}" style="background:#075e9b;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;display:inline-block">Buka RPS Sign</a>
      </p>
    </div>
    <div style="padding:16px 24px;color:#94a3b8;font-size:12px;border-top:1px solid #eef2f6">
      Email ini dikirim otomatis oleh sistem RPS Sign. Mohon tidak membalas.
    </div>
  </div></body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[c] ?? c;
  });
}
