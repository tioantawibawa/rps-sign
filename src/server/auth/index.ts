import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { writeAudit } from "@/server/audit/audit-service";
import { AuditAction } from "@/server/audit/actions";
import { authConfig } from "./config";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Kata sandi", type: "password" },
      },
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase();

        // Login throttling: 5 attempts / 5 minutes per email.
        const limit = rateLimit(`login:${email}`, 5, 300);
        if (!limit.ok) {
          throw new Error("Terlalu banyak percobaan. Coba lagi nanti.");
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) {
          return null;
        }

        const valid = await verifyPassword(user.passwordHash, parsed.data.password);
        if (!valid || user.status !== UserStatus.ACTIVE) {
          await writeAudit({
            organizationId: user.organizationId,
            userId: user.id,
            action: AuditAction.LOGIN_FAILED,
            entityType: "User",
            entityId: user.id,
            metadata: { reason: !valid ? "bad_password" : "inactive" },
          });
          return null;
        }

        resetRateLimit(`login:${email}`);
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
        await writeAudit({
          organizationId: user.organizationId,
          userId: user.id,
          action: AuditAction.LOGIN_SUCCESS,
          entityType: "User",
          entityId: user.id,
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
        };
      },
    }),
  ],
});
