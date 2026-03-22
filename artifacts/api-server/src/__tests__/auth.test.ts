/**
 * Tests for the self-hosted auth crypto helpers (lib/auth.ts).
 *
 * These are the security-critical functions — JWT creation/verification and
 * password hashing/verification. All tests are pure unit tests with no
 * mocking or database required.
 *
 * Run: pnpm --filter @workspace/api-server test
 *
 * ## What is tested
 *
 * ### Password hashing (hashPassword + verifyPassword)
 * - Correct password verifies as true
 * - Wrong password verifies as false
 * - Each hash has a unique random salt (same password → different hashes)
 * - Hash format is "<32-char-hex-salt>:<128-char-hex-hash>"
 *
 * ### JWT tokens (createToken + verifyToken)
 * - Valid token round-trips correctly
 * - Payload contains correct sub, email, iat, exp fields
 * - Token has exactly 3 dot-separated parts (header.payload.signature)
 * - Tampered signature is rejected
 * - Tampered payload is rejected
 * - Expired tokens are rejected
 * - Malformed strings are rejected (empty, no dots, too many dots)
 * - Empty string token returns null (not a crash)
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  type TokenPayload,
} from "../lib/auth";

// ── Password hashing ──────────────────────────────────────────────────

describe("hashPassword + verifyPassword", () => {
  it("verifies a correct password", async () => {
    const hash = await hashPassword("my-secure-password");
    const result = await verifyPassword("my-secure-password", hash);
    expect(result).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct-password");
    const result = await verifyPassword("wrong-password", hash);
    expect(result).toBe(false);
  });

  it("produces unique hashes for the same password (random salt)", async () => {
    const hash1 = await hashPassword("same-password");
    const hash2 = await hashPassword("same-password");
    expect(hash1).not.toBe(hash2);

    // But both should still verify
    expect(await verifyPassword("same-password", hash1)).toBe(true);
    expect(await verifyPassword("same-password", hash2)).toBe(true);
  });

  it("produces the expected storage format: <hex-salt>:<hex-hash>", async () => {
    const hash = await hashPassword("test");
    const parts = hash.split(":");
    expect(parts).toHaveLength(2);

    const [salt, derived] = parts;
    // Salt: 16 random bytes → 32 hex chars
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
    // Hash: 64-byte scrypt key → 128 hex chars
    expect(derived).toMatch(/^[0-9a-f]{128}$/);
  });

  it("handles unicode passwords", async () => {
    const hash = await hashPassword("p@$$w0rd-mit-umlauten-aou");
    expect(await verifyPassword("p@$$w0rd-mit-umlauten-aou", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});

// ── JWT tokens ────────────────────────────────────────────────────────

describe("createToken + verifyToken", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a valid token that verifyToken accepts", () => {
    const token = createToken(42, "alice@example.com");
    const payload = verifyToken(token);

    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe(42);
    expect(payload!.email).toBe("alice@example.com");
  });

  it("includes correct iat and exp fields", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));

    const token = createToken(1, "test@test.com");
    const payload = verifyToken(token)!;

    const expectedIat = Math.floor(new Date("2026-06-15T12:00:00Z").getTime() / 1000);
    expect(payload.iat).toBe(expectedIat);
    // 30 days = 2,592,000 seconds
    expect(payload.exp).toBe(expectedIat + 30 * 24 * 60 * 60);
  });

  it("produces a 3-part dot-separated JWT string", () => {
    const token = createToken(1, "a@b.com");
    const parts = token.split(".");
    expect(parts).toHaveLength(3);

    // Header should decode to { alg: "HS256", typ: "JWT" }
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    expect(header).toEqual({ alg: "HS256", typ: "JWT" });
  });

  it("rejects a token with a tampered signature", () => {
    const token = createToken(1, "a@b.com");
    // Flip the last character of the signature
    const tampered = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    expect(verifyToken(tampered)).toBeNull();
  });

  it("rejects a token with a tampered payload", () => {
    const token = createToken(1, "a@b.com");
    const [header, , sig] = token.split(".");
    // Replace the payload with a different one
    const fakePayload = Buffer.from(
      JSON.stringify({ sub: 999, email: "hacker@evil.com", iat: 0, exp: 9999999999 }),
    ).toString("base64url");
    const tampered = `${header}.${fakePayload}.${sig}`;
    expect(verifyToken(tampered)).toBeNull();
  });

  it("rejects an expired token", () => {
    vi.useFakeTimers();
    // Create token on Jan 1
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const token = createToken(1, "a@b.com");

    // Fast-forward 31 days (past 30-day expiry)
    vi.setSystemTime(new Date("2026-02-01T00:00:00Z"));
    expect(verifyToken(token)).toBeNull();
  });

  it("accepts a token that is not yet expired", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const token = createToken(1, "a@b.com");

    // Fast-forward 29 days (still within 30-day window)
    vi.setSystemTime(new Date("2026-01-30T00:00:00Z"));
    expect(verifyToken(token)).not.toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(verifyToken("")).toBeNull();
    expect(verifyToken("not-a-jwt")).toBeNull();
    expect(verifyToken("one.two")).toBeNull();
    expect(verifyToken("one.two.three.four")).toBeNull();
    expect(verifyToken("...")).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    // createToken uses the module-level JWT_SECRET ("test-secret-key-do-not-use-in-production").
    // We manually construct a token signed with a different key.
    const crypto = require("node:crypto");
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(
      JSON.stringify({ sub: 1, email: "a@b.com", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 9999 }),
    ).toString("base64url");
    const sig = crypto
      .createHmac("sha256", "completely-different-secret")
      .update(`${header}.${body}`)
      .digest("base64url");
    const foreignToken = `${header}.${body}.${sig}`;

    expect(verifyToken(foreignToken)).toBeNull();
  });
});
