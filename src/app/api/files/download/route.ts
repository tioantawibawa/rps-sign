import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { storage, verifySignedDownload } from "@/server/storage";

export const dynamic = "force-dynamic";

/**
 * Streams a stored object only when: (1) the HMAC signature is valid and
 * unexpired, and (2) the current session user matches the user the URL was
 * issued to. Files are always served as downloads/inline through this gate —
 * never from a permanent public URL.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const t = url.searchParams.get("t");
  const s = url.searchParams.get("s");
  if (!t || !s) return new NextResponse("Bad request", { status: 400 });

  const payload = verifySignedDownload(t, s);
  if (!payload) return new NextResponse("Tautan tidak valid atau kedaluwarsa", { status: 403 });

  const user = await getSessionUser();
  if (!user || user.id !== payload.uid) {
    return new NextResponse("Tidak diizinkan", { status: 403 });
  }

  let body: Buffer;
  try {
    body = await storage.getObject(payload.key);
  } catch {
    return new NextResponse("Berkas tidak ditemukan", { status: 404 });
  }

  const isPdf = payload.key.toLowerCase().endsWith(".pdf");
  const contentType = isPdf
    ? "application/pdf"
    : payload.key.endsWith(".png")
      ? "image/png"
      : "application/octet-stream";
  const disposition =
    payload.disp === "attachment"
      ? `attachment; filename="${(payload.name ?? "berkas").replace(/"/g, "")}"`
      : "inline";

  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": disposition,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
