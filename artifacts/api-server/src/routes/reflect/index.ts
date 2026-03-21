/**
 * POST /api/reflect — LLM-generated narrative insight for a completed reframing session.
 *
 * ## What this route does
 *
 * Accepts the original thought, the full word analysis array, and the map of
 * reframed words chosen by the user, then asks Claude to synthesise a short
 * (3–5 sentence) narrative paragraph that:
 *  - Names which cognitive distortions were identified
 *  - Describes what was shifted and how the reframes change the meaning
 *  - Articulates the psychological benefit the user gains from the reframing
 *
 * The insight is generated fresh on every request (not cached) so it always
 * reflects the exact state of the session at the time of viewing.
 *
 * ## Validation
 *
 * The request is validated with Zod before hitting the AI — bad input returns
 * a 400 rather than wasting an API call.
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router: IRouter = Router();

const wordAnalysisSchema = z.object({
  word: z.string(),
  category: z.enum(["neutral", "absolute", "belief", "fear", "self_judgment"]),
  reframes: z.array(z.string()).default([]),
  hint: z.string().nullable().default(null),
  fiftyFifty: z.array(z.string()).default([]),
  explainer: z.string().nullable().default(null),
});

const reflectRequestSchema = z.object({
  thought: z.string().min(1),
  words: z.array(wordAnalysisSchema).min(1),
  reframedWords: z.record(z.string(), z.string()),
});

const SYSTEM_PROMPT = `You are a compassionate cognitive behavioural therapy (CBT) coach writing brief, encouraging reflections for people working on reframing their thoughts.

Given:
- The original thought the user wrote
- The cognitive distortions identified in the words
- The reframes the user chose for each distorted word

Write a warm, insightful paragraph (3–5 sentences) that:
1. Acknowledges what distortions were found and why they matter
2. Celebrates what the user shifted and how the reframes change the meaning
3. Names the psychological benefit — what this practice builds over time

Keep the tone supportive, grounded in CBT principles, and personalised to their specific words and choices. Write in second person ("you"). Do not use bullet points or headers — just a flowing paragraph. Do not add any text outside the paragraph.`;

router.post("/reflect", async (req, res) => {
  const parsed = reflectRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
    return;
  }

  const { thought, words, reframedWords } = parsed.data;

  const significantWords = words.filter((w) => w.category !== "neutral");

  if (significantWords.length === 0) {
    res.json({ insight: "Great awareness — you captured a thought and looked at it closely. Even when a thought doesn't contain obvious distortions, the act of pausing to reflect builds the mindfulness habit that supports long-term wellbeing." });
    return;
  }

  const distortionSummary = significantWords
    .map((w, i) => {
      const originalIdx = words.indexOf(w);
      const reframe = reframedWords[String(originalIdx)];
      const changed = reframe && reframe !== w.word;
      return `"${w.word}" (${w.category})${changed ? ` → reframed as "${reframe}"` : " (kept original)"}${w.explainer ? ` — ${w.explainer}` : ""}`;
    })
    .join("\n");

  const userMessage = `Original thought: "${thought}"

Distortions identified and reframes chosen:
${distortionSummary}

Write the insight paragraph for this person's reframing session.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const block = message.content[0];
    if (block.type !== "text") {
      res.status(500).json({ error: "Unexpected response type from AI" });
      return;
    }

    res.json({ insight: block.text.trim() });
  } catch (err) {
    req.log.error({ err }, "Reflect API error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
