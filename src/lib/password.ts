import { hash, verify } from "@node-rs/argon2";

/**
 * Argon2id password hashing. Parameters follow OWASP guidance
 * (m=19456 KiB, t=2, p=1). Secrets never appear in logs.
 */
const OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function verifyPassword(
  storedHash: string,
  plain: string,
): Promise<boolean> {
  try {
    return await verify(storedHash, plain);
  } catch {
    return false;
  }
}
