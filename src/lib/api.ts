import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/server/errors";
import { logger } from "@/lib/logger";

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}
export interface ApiFailure {
  ok: false;
  error: { code: string; message: string; details?: unknown };
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiSuccess<T>>({ ok: true, data }, init);
}

export function fail(
  code: string,
  message: string,
  status: number,
  details?: unknown,
) {
  return NextResponse.json<ApiFailure>(
    { ok: false, error: { code, message, details } },
    { status },
  );
}

/**
 * Wrap a route handler, converting known errors into the standard envelope.
 * A correlation id is attached to every response for traceability.
 */
export async function handleRoute<T>(
  fn: () => Promise<NextResponse<ApiSuccess<T>> | NextResponse>,
): Promise<NextResponse> {
  const correlationId = crypto.randomUUID();
  try {
    const res = await fn();
    res.headers.set("x-correlation-id", correlationId);
    return res;
  } catch (err) {
    if (err instanceof ZodError) {
      return fail("VALIDATION_ERROR", "Data tidak valid", 422, err.flatten());
    }
    if (err instanceof AppError) {
      return fail(err.code, err.message, err.status);
    }
    logger.error({ err, correlationId }, "unhandled route error");
    return fail(
      "INTERNAL_ERROR",
      "Terjadi kesalahan pada server",
      500,
    );
  }
}

export function getRequestMeta(req: Request) {
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;
  const userAgent = req.headers.get("user-agent");
  return { ipAddress, userAgent };
}
