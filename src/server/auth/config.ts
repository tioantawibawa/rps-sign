import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

/**
 * Edge-safe Auth.js configuration (no Node-only imports). Consumed by both the
 * middleware and the full server instance. Session uses the JWT strategy so it
 * works with the Credentials provider.
 */
export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 }, // 8 hours
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = (user as { role: Role }).role;
        token.organizationId = (user as { organizationId: string }).organizationId;
        token.name = user.name;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = token.role as Role;
        session.user.organizationId = token.organizationId as string;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
