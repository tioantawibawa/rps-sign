import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/** Readiness probe — dependencies (database) are reachable. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ready", db: "up" });
  } catch (err) {
    logger.error({ err }, "readiness check failed");
    return NextResponse.json({ status: "not-ready", db: "down" }, { status: 503 });
  }
}
