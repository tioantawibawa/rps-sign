import { describe, it, expect } from "vitest";
import {
  sha256Hex,
  generateVerificationToken,
  hashToken,
  safeEqualHex,
} from "@/lib/crypto";
import { formatDocumentNumber, parseDocumentNumber } from "@/domain/document-number";

describe("hashing & tokens", () => {
  it("computes a stable SHA-256", () => {
    expect(sha256Hex("hello")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
    expect(sha256Hex(Buffer.from("hello"))).toBe(sha256Hex("hello"));
  });

  it("generates an opaque token and stores only its hash", () => {
    const { token, tokenHash } = generateVerificationToken();
    expect(token).not.toEqual(tokenHash);
    expect(tokenHash).toBe(hashToken(token));
    expect(token.length).toBeGreaterThan(20);
    // Token is URL-safe.
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("compares hex safely", () => {
    expect(safeEqualHex("abcd", "abcd")).toBe(true);
    expect(safeEqualHex("abcd", "abce")).toBe(false);
    expect(safeEqualHex("ab", "abcd")).toBe(false);
  });
});

describe("document number", () => {
  it("formats with zero padding", () => {
    expect(formatDocumentNumber({ programCode: "AKT", year: 2026, sequence: 1 })).toBe("RPS-AKT-2026-001");
    expect(formatDocumentNumber({ programCode: "akt", year: 2026, sequence: 42 })).toBe("RPS-AKT-2026-042");
  });

  it("round-trips through parse", () => {
    const parsed = parseDocumentNumber("RPS-AKT-2026-007");
    expect(parsed).toMatchObject({ prefix: "RPS", programCode: "AKT", year: 2026, sequence: 7 });
    expect(parseDocumentNumber("invalid")).toBeNull();
  });
});
