import nodemailer from "nodemailer";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Email transport abstraction. `console` driver logs instead of sending
 * (useful for tests/CI); `smtp` targets Mailpit locally or a real relay in prod.
 */
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

class ConsoleMailer implements Mailer {
  async send(message: MailMessage): Promise<void> {
    logger.info(
      { to: message.to, subject: message.subject },
      "[mail:console] email dispatched (not actually sent)",
    );
  }
}

class SmtpMailer implements Mailer {
  private transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER
      ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
      : undefined,
  });

  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail({
      from: env.MAIL_FROM,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  }
}

export const mailer: Mailer =
  env.MAIL_DRIVER === "smtp" ? new SmtpMailer() : new ConsoleMailer();
