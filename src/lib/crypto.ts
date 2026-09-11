import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Lowercase hex SHA-256 of a buffer/string. */
export function sha256Hex(input: Buffer | Uint8Array | string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Generate an opaque, URL-safe verification token (public), returning both the
 * plaintext token (goes into the QR/URL) and its SHA-256 hash (stored in DB).
 * The database never stores the plaintext token.
 */
export function generateVerificationToken(): {
  token: string;
  tokenHash: string;
} {
  const token = randomBytes(24).toString("base64url");
  return { token, tokenHash: sha256Hex(token) };
}

/** Hash a one-time token (e.g. password reset) for storage. */
export function hashToken(token: string): string {
  return sha256Hex(token);
}

/** Constant-time comparison of two hex strings of equal length. */
export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/** Generate a random certificate number suffix (base36, uppercase). */
export function randomSuffix(length = 6): string {
  return randomBytes(16)
    .toString("hex")
    .replace(/[^0-9a-f]/g, "")
    .slice(0, length)
    .toUpperCase();
}
