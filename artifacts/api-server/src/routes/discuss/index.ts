/**
 * POST /api/discuss — Socratic dialogue mode via Claude AI.
 *
 * ## What this route does
 *
 * Accepts a conversation history (array of {role, content} messages) and
 * returns Claude's next Socratic question designed to guide the user toward
 * their own insight about a thinking pattern.
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
import { anthropic } from "@workspace/integrations-anthropic-ai";

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
});

router.post("/discuss", async (req, res) => {
  const parsed = discussRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "messages array with role/content is required" });
    return;
  }

  const { messages } = parsed.data;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages,
    });

    const block = message.content[0];
    if (block.type !== "text") {
      res.status(500).json({ error: "Unexpected response type from AI" });
      return;
    }

    res.json({ reply: block.text.trim() });
  } catch (err) {
    req.log.error({ err }, "Discuss API error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
