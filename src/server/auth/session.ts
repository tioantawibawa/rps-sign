import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Subject } from "@/domain/permissions";
import { hasCapability, type Capability } from "@/domain/permissions";
import { auth } from "./index";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Subject["role"];
  organizationId: string;
}

/** The raw session user, or null if unauthenticated. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: session.user.role,
    organizationId: session.user.organizationId,
  };
}

/**
 * Build the authorization Subject, resolving the user's *active* assignment
 * scope (faculty / study program / cluster).
 */
export async function getSubject(): Promise<Subject | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const now = new Date();
  const assignments = await prisma.userAssignment.findMany({
    where: {
      userId: user.id,
      validFrom: { lte: now },
      OR: [{ validUntil: null }, { validUntil: { gte: now } }],
    },
    select: { facultyId: true, studyProgramId: true, clusterId: true },
  });

  return {
    userId: user.id,
    role: user.role,
    organizationId: user.organizationId,
    facultyIds: unique(assignments.map((a) => a.facultyId)),
    studyProgramIds: unique(assignments.map((a) => a.studyProgramId)),
    clusterIds: unique(assignments.map((a) => a.clusterId)),
  };
}

/** Redirect to /login when unauthenticated; otherwise return the Subject. */
export async function requireSubject(): Promise<Subject> {
  const subject = await getSubject();
  if (!subject) redirect("/login");
  return subject;
}

/** API variant: throws UnauthorizedError (mapped to 401) instead of redirecting. */
export async function getSubjectOrThrow(): Promise<Subject> {
  const subject = await getSubject();
  if (!subject) {
    const { UnauthorizedError } = await import("@/server/errors");
    throw new UnauthorizedError();
  }
  return subject;
}

export async function requireCapability(cap: Capability): Promise<Subject> {
  const subject = await requireSubject();
  if (!hasCapability(subject.role, cap)) {
    redirect("/dashboard?forbidden=1");
  }
  return subject;
}

function unique(values: (string | null)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => v !== null)));
}
