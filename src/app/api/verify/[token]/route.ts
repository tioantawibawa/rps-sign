import { verifyByToken } from "@/server/verification/verification-service";
import { rateLimit } from "@/lib/rate-limit";
import { fail, getRequestMeta, handleRoute, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  return handleRoute(async () => {
    const { token } = await params;
    const { ipAddress } = getRequestMeta(req);
    const limit = rateLimit(`verify-api:${ipAddress ?? "anon"}`, 30, 60);
    if (!limit.ok) return fail("RATE_LIMITED", "Terlalu banyak permintaan", 429);
    const view = await verifyByToken(token);
    return ok(view);
  });
}
