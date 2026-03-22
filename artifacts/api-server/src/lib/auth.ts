/**
 * Self-hosted authentication helpers — JWT tokens and password hashing using
 * only Node.js built-in crypto. Zero external dependencies.
 *
 * Tokens are HMAC-SHA256 JWTs signed with JWT_SECRET (env var).
 * Passwords are hashed with scrypt (64-byte key, 16-byte random salt).
 */

import crypto from "node:crypto";
import { logger } from "./logger";

const JWT_SECRET: string = process.env.JWT_SECRET ?? (() => {
  const fallback = crypto.randomBytes(32).toString("hex");
  logger.warn("JWT_SECRET not set — using ephemeral key (tokens will not survive restarts)");
  return fallback;
})();

const TOKEN_EXPIRY_SECONDS = 30 * 24 * 60 * 60; // 30 days

export interface TokenPayload {
  sub: number;
  email: string;
  iat: number;
  exp: number;
}

// ── JWT ─────────────────────────────────────────────────────────────────

export function createToken(userId: number, email: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = { sub: userId, email, iat: now, exp: now + TOKEN_EXPIRY_SECONDS };
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;

    const expected = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
    // Compare the raw HMAC bytes (decode base64url → binary) for a
    // constant-time check that doesn't leak signature length via encoding.
    const sigBuf = Buffer.from(sig, "base64url");
    const expectedBuf = Buffer.from(expected, "base64url");
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as TokenPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── Password hashing ────────────────────────────────────────────────────

export function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, key) => {
      if (err) return reject(err);
      resolve(`${salt}:${key.toString("hex")}`);
    });
  });
}

export function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, key) => {
      if (err) return reject(err);
      const hashBuf = Buffer.from(hash, "hex");
      const keyBuf = key;
      if (hashBuf.length !== keyBuf.length) return resolve(false);
      resolve(crypto.timingSafeEqual(hashBuf, keyBuf));
    });
  });
}
