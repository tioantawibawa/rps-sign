import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Liveness probe — process is up. */
export function GET() {
  return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() });
}
