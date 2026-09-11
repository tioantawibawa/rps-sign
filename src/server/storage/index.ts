import { createHmac } from "node:crypto";
import { env } from "@/lib/env";
import { safeEqualHex } from "@/lib/crypto";
import { LocalStorageDriver } from "./local-driver";
import { S3StorageDriver } from "./s3-driver";
import type { SignedUrlOptions, StorageDriver } from "./types";

export type { StorageDriver, SignedUrlOptions } from "./types";

function createDriver(): StorageDriver {
  return env.STORAGE_DRIVER === "s3"
    ? new S3StorageDriver()
    : new LocalStorageDriver();
}

const globalForStorage = globalThis as unknown as {
  storageDriver?: StorageDriver;
};

export const storage: StorageDriver =
  globalForStorage.storageDriver ?? createDriver();
if (env.NODE_ENV !== "production") globalForStorage.storageDriver = storage;

// ---------------------------------------------------------------------------
// HMAC-signed, expiring, user-bound download URLs.
// Files are NEVER served from a permanent public URL. Every access flows
// through /api/files/download which re-checks the signature and session.
// ---------------------------------------------------------------------------

export interface SignedTokenPayload {
  key: string;
  exp: number; // unix seconds
  uid: string; // bound to a specific user
  disp: "inline" | "attachment";
  name?: string;
}

function sign(payload: string): string {
  return createHmac("sha256", env.AUTH_SECRET).update(payload).digest("hex");
}

export function createSignedDownloadUrl(
  key: string,
  userId: string,
  options: SignedUrlOptions = {},
): string {
  const ttl = options.ttl ?? env.SIGNED_URL_TTL_SECONDS;
  const payload: SignedTokenPayload = {
    key,
    exp: Math.floor(Date.now() / 1000) + ttl,
    uid: userId,
    disp: options.downloadFilename ? "attachment" : options.inline ? "inline" : "attachment",
    name: options.downloadFilename,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = sign(encoded);
  return `/api/files/download?t=${encoded}&s=${sig}`;
}

export function verifySignedDownload(
  encoded: string,
  sig: string,
): SignedTokenPayload | null {
  const expected = sign(encoded);
  if (!safeEqualHex(sig, expected)) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as SignedTokenPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
