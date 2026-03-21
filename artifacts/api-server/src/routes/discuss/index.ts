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

/**
 * GET /api/discuss/insights — Extract key affirmations and reframes from discuss sessions.
 *
 * Queries up to the 5 most recent conversations, fetches their messages, and uses
 * Claude to extract 3–5 key affirmations or reframes the user expressed. The result
 * is a list of { front, back } flashcard pairs.
 *
 * Results are cached per conversation set (using a hash of the conversation IDs) to
 * avoid redundant LLM calls. The cache lives in-process and is cleared on restart.
 */

const INSIGHTS_SYSTEM_PROMPT = `You are a compassionate CBT coach reviewing journal/discussion transcripts.

Your task: Extract 3–5 key positive reframes, affirmations, or healthy insights that the USER (not the assistant) expressed during the conversation. Focus on moments where the user demonstrated growth, challenged a limiting belief, or articulated something healthy about themselves.

Return a JSON array of objects in this exact format:
[
  { "front": "A short label for the insight or original thought (≤10 words)", "back": "The full positive reframe or affirmation the user expressed (1–2 sentences)" },
  ...
]

Rules:
- Only capture things the USER said, not the assistant's questions
- front should be a concise, memorable label (like a card title)
- back should be the actual healthy insight or affirmation in the user's own words or a close paraphrase
- If there are fewer than 3 meaningful insights, return fewer — never fabricate
- Return ONLY the JSON array, no other text`;

const INSIGHTS_CACHE_MAX = 50;
const insightsCache = new Map<string, { front: string; back: string }[]>();

/** Evict the oldest entry when the cache exceeds the cap. */
function cacheSet(key: string, value: { front: string; back: string }[]): void {
  if (insightsCache.size >= INSIGHTS_CACHE_MAX) {
    const firstKey = insightsCache.keys().next().value;
    if (firstKey !== undefined) insightsCache.delete(firstKey);
  }
  insightsCache.set(key, value);
}

router.get("/discuss/insights", async (req, res) => {
  try {
    const recentConvs = await db
      .select({ id: conversations.id, title: conversations.title })
      .from(conversations)
      .orderBy(desc(conversations.createdAt))
      .limit(5);

    if (recentConvs.length === 0) {
      res.json({ insights: [] });
      return;
    }

    const allMessages: { role: string; content: string }[] = [];
    const msgCountByConvId: Record<number, number> = {};

    for (const conv of recentConvs) {
      const msgs = await db
        .select({ role: messages.role, content: messages.content })
        .from(messages)
        .where(eq(messages.conversationId, conv.id))
        .orderBy(messages.createdAt);

      msgCountByConvId[conv.id] = msgs.length;
      for (const m of msgs) {
        allMessages.push(m);
      }
    }

    // Build cache key from conversation IDs + per-conversation message count so that
    // new messages added to existing conversations correctly bust the cache.
    const cacheKey = recentConvs
      .map((c) => `${c.id}:${msgCountByConvId[c.id] ?? 0}`)
      .join(",");

    const cached = insightsCache.get(cacheKey);
    if (cached) {
      res.json({ insights: cached });
      return;
    }

    if (allMessages.length === 0) {
      res.json({ insights: [] });
      return;
    }

    // Cap transcript to last 60 messages (≈ 30 user turns) and truncate each
    // message to 500 chars to stay well within Claude's context window even
    // if conversations are lengthy.
    const cappedMessages = allMessages.slice(-60);
    const transcript = cappedMessages
      .map((m) => {
        const label = m.role === "user" ? "User" : "Coach";
        const text = m.content.length > 500 ? `${m.content.slice(0, 500)}…` : m.content;
        return `${label}: ${text}`;
      })
      .join("\n");

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: INSIGHTS_SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Transcript:\n${transcript}` }],
    });

    const block = message.content[0];
    if (block.type !== "text") {
      res.status(500).json({ error: "Unexpected response type from AI" });
      return;
    }

    let insights: { front: string; back: string }[];
    try {
      insights = JSON.parse(block.text.trim());
      if (!Array.isArray(insights)) throw new Error("Not an array");
      insights = insights
        .filter(
          (i): i is { front: string; back: string } =>
            typeof i === "object" &&
            i !== null &&
            typeof i.front === "string" &&
            typeof i.back === "string"
        )
        .slice(0, 5);
    } catch {
      insights = [];
    }

    cacheSet(cacheKey, insights);

    res.json({ insights });
  } catch (err) {
    req.log.error({ err }, "GET /discuss/insights error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
