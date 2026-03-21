/**
 * POST /api/discuss — Socratic dialogue mode via Claude AI.
 *
 * ## What this route does
 *
 * Accepts a conversation history (array of {role, content} messages) and
 * returns Claude's next Socratic question designed to guide the user toward
 * their own insight about a thinking pattern. Each exchange is persisted to
 * the `conversations` and `messages` tables via Drizzle/PostgreSQL.
 *
 * ## Prompt engineering
 *
 * Claude is instructed to:
 *  - Only ask one question at a time
 *  - Never name or diagnose a cognitive distortion
 *  - Use empathetic, curious, non-judgmental language
 *  - Guide the user to self-discovery through open-ended questions
 *
 * ## Why no JSON parsing here
 *
 * Unlike the reframe route, the discuss response is plain text — a single
 * question. There is no structured schema to validate; the reply is returned
 * as-is from Claude's text block.
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db, conversations, messages } from "@workspace/db";

const router: IRouter = Router();

const SYSTEM_PROMPT = `You are a warm, empathetic Socratic coach helping someone explore their own thoughts and feelings. Your role is to gently guide them toward their own insights — not to label, diagnose, or tell them what is wrong.

Your rules:
1. Respond with ONE open-ended question only. Never multiple questions in one reply.
2. Never name or diagnose a cognitive distortion (e.g. do not say "that sounds like catastrophising" or "this is black-and-white thinking").
3. Use curious, caring, non-judgmental language — you are not a therapist, you are a thoughtful friend asking the right questions.
4. Ask questions that invite the person to examine their assumptions, consider evidence, or reflect on past experiences.
5. Keep your question concise — one or two sentences at most.
6. Do not offer advice, reassurances, or interpretations. Only ask questions.

Begin by asking what is on their mind if this is the start of a conversation.`;

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
});

const discussRequestSchema = z.object({
  messages: z.array(messageSchema).min(1),
  conversationId: z.number().int().positive().optional(),
});

router.post("/discuss", async (req, res) => {
  const parsed = discussRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "messages array with role/content is required" });
    return;
  }

  const { messages: msgHistory, conversationId: incomingConversationId } = parsed.data;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: msgHistory,
    });

    const block = message.content[0];
    if (block.type !== "text") {
      res.status(500).json({ error: "Unexpected response type from AI" });
      return;
    }

    const reply = block.text.trim();

    let conversationId = incomingConversationId;

    if (!conversationId) {
      const firstUserMsg = msgHistory.find((m) => m.role === "user");
      const title = firstUserMsg
        ? firstUserMsg.content.slice(0, 60)
        : "Discuss session";
      const [newConversation] = await db
        .insert(conversations)
        .values({ title })
        .returning({ id: conversations.id });
      conversationId = newConversation.id;
    } else {
      const existing = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);
      if (existing.length === 0) {
        res.status(404).json({ error: "Conversation not found" });
        return;
      }
    }

    const lastUserMsg = msgHistory[msgHistory.length - 1];
    if (lastUserMsg && lastUserMsg.role === "user") {
      await db.insert(messages).values({
        conversationId,
        role: "user",
        content: lastUserMsg.content,
      });
    }

    await db.insert(messages).values({
      conversationId,
      role: "assistant",
      content: reply,
    });

    res.json({ reply, conversationId });
  } catch (err) {
    req.log.error({ err }, "Discuss API error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/conversations", async (req, res) => {
  try {
    const rows = await db
      .select({
        id: conversations.id,
        title: conversations.title,
        createdAt: conversations.createdAt,
      })
      .from(conversations)
      .orderBy(desc(conversations.createdAt));
    res.json({ conversations: rows });
  } catch (err) {
    req.log.error({ err }, "GET /conversations error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/conversations/:id/messages", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid conversation id" });
    return;
  }

  try {
    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(messages.createdAt);
    res.json({ messages: rows });
  } catch (err) {
    req.log.error({ err }, "GET /conversations/:id/messages error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
