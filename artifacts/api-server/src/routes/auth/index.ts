/**
 * Authentication routes — self-hosted signup / login / profile.
 *
 *   POST /api/auth/signup   — create account, return JWT
 *   POST /api/auth/login    — authenticate, return JWT
 *   GET  /api/auth/me       — get current user profile (requires token)
 *   DELETE /api/auth/me     — delete account (requires token)
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, users } from "@workspace/db";
import { createToken, hashPassword, verifyPassword, verifyToken } from "../../lib/auth";

const router: IRouter = Router();

const signupSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(6).max(128),
  displayName: z.string().max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// ── POST /api/auth/signup ───────────────────────────────────────────────

router.post("/auth/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }

  const { email, password, displayName } = parsed.data;

  try {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const passwordHash = await hashPassword(password);

    const [user] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        passwordHash,
        displayName: displayName || null,
      })
      .returning({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
      });

    const token = createToken(user.id, user.email);

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, displayName: user.displayName },
    });
  } catch (err: any) {
    // Handle race condition: two concurrent signups with same email both
    // pass the SELECT check but one fails at the DB unique constraint.
    // PostgreSQL error code 23505 = unique_violation.
    if (err?.code === "23505") {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }
    req.log.error({ err }, "Signup error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/auth/login ────────────────────────────────────────────────

router.post("/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { email, password } = parsed.data;

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = createToken(user.id, user.email);

    res.json({
      token,
      user: { id: user.id, email: user.email, displayName: user.displayName },
    });
  } catch (err) {
    req.log.error({ err }, "Login error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/auth/me ────────────────────────────────────────────────────

router.get("/auth/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const payload = verifyToken(authHeader.slice(7));
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  try {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ user });
  } catch (err) {
    req.log.error({ err }, "Get profile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── DELETE /api/auth/me ─────────────────────────────────────────────────

router.delete("/auth/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const payload = verifyToken(authHeader.slice(7));
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  try {
    await db.delete(users).where(eq(users.id, payload.sub));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Delete account error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
