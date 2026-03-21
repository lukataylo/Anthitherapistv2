/**
 * POST /api/reframe — CBT word-by-word thought analysis via Claude AI.
 *
 * ## What this route does
 *
 * Takes a free-text thought submitted by the user and asks Claude to analyse
 * every word, categorising it as one of:
 *
 *  - "neutral"       — filler words with no distortion significance
 *  - "absolute"      — absolute language (always, never, everyone…)
 *  - "belief"        — negative core belief words (worthless, useless…)
 *  - "fear"          — fear-driven language (terrified, dreading…)
 *  - "self_judgment" — harsh self-critical phrases (pathetic, loser…)
 *
 * For each non-neutral word, Claude also returns:
 *  - `reframes`   — 3–5 softer, more accurate replacement words
 *  - `hint`       — one gentle nudge toward a good reframe
 *  - `fiftyFifty` — exactly [correct_reframe, plausible_decoy] for a 50/50 game
 *  - `explainer`  — one sentence explaining why this word is a distortion
 *
 * ## Why prompt engineering this way
 *
 * Structuring the output as a strict JSON array keyed to every word (including
 * neutral ones) means the mobile app can reliably map words back to the original
 * thought text without doing fuzzy matching on Claude's response. The system
 * prompt forbids any text outside the JSON block to eliminate parsing ambiguity.
 *
 * ## Validation strategy
 *
 * After receiving Claude's response the handler:
 *  1. Extracts the JSON object with a regex — Claude occasionally wraps output
 *     in markdown code fences even when instructed not to.
 *  2. Parses the JSON.
 *  3. Runs the parsed value through a Zod schema to guarantee the shape matches
 *     what the mobile app expects. An AI model update could silently break the
 *     schema; Zod catches that immediately rather than letting bad data reach users.
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router: IRouter = Router();

/**
 * System prompt sent to Claude on every request.
 *
 * Key design decisions:
 * - Asking for word-by-word analysis (including neutral words) ensures the
 *   resulting array aligns positionally with the original thought string.
 * - The `fiftyFifty` field is designed specifically for the 50/50 game mode
 *   in the GamePanel: one correct reframe paired with a convincing but still
 *   distorted decoy.
 * - Keeping responses "concise and positive" maintains a supportive tone
 *   appropriate for a mental-wellness context.
 */
const SYSTEM_PROMPT = `You are a cognitive behavioural therapy (CBT) assistant specialising in identifying and reframing cognitive distortions.

Given a thought, analyse each word and categorise it:
- "neutral": common filler words, prepositions, articles, conjunctions, or words with no cognitive distortion significance
- "absolute": absolute words that leave no room for nuance (always, never, everyone, nobody, everything, nothing, completely, totally, forever, impossible)
- "belief": core belief words that reflect fixed negative schemas (worthless, useless, stupid, incompetent, unlovable, failure, broken, hopeless)
- "fear": fear-related words (afraid, scared, terrified, worried, anxious, dreading, panic)
- "self_judgment": harsh self-critical judgements (I'm a loser, I can't do anything right, I'm pathetic — key words in such phrases)

For each significant word (non-neutral), provide:
- "reframes": 3-5 alternative, softer, more accurate replacement words or short phrases
- "hint": one gentle softening clue (e.g. for "always" → "sometimes")
- "fiftyFifty": exactly 2 items — [correct_reframe, decoy] where the correct one is the best reframe and the decoy sounds plausible but is still distorted or inaccurate
- "explainer": 1 sentence explaining why this word is a cognitive distortion

Return ONLY valid JSON with this exact structure:
{
  "words": [
    {
      "word": "string",
      "category": "neutral" | "absolute" | "belief" | "fear" | "self_judgment",
      "reframes": [],
      "hint": null,
      "fiftyFifty": [],
      "explainer": null
    }
  ]
}

For neutral words, reframes should be [], hint should be null, fiftyFifty should be [], explainer should be null.
Keep all responses concise and positive. Do not add any text outside the JSON.`;

/**
 * Zod schema for a single word returned by Claude.
 * Default values ensure neutral words (which have null hints and empty arrays)
 * deserialise cleanly without special-casing in the mobile app.
 */
const wordSchema = z.object({
  word: z.string().min(1),
  category: z.enum(["neutral", "absolute", "belief", "fear", "self_judgment"]),
  reframes: z.array(z.string()).default([]),
  hint: z.string().nullable().default(null),
  fiftyFifty: z.array(z.string()).default([]),
  explainer: z.string().nullable().default(null),
});

/**
 * Top-level response schema. Requiring at least one word (min(1)) guards
 * against Claude returning an empty array for very short inputs.
 */
const reframeResponseSchema = z.object({
  words: z.array(wordSchema).min(1),
});

router.post("/reframe", async (req, res) => {
  const { thought } = req.body as { thought?: string };

  if (!thought || typeof thought !== "string" || thought.trim().length === 0) {
    res.status(400).json({ error: "thought is required" });
    return;
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Analyse this thought word by word: "${thought.trim()}"`,
        },
      ],
    });

    const block = message.content[0];
    if (block.type !== "text") {
      res.status(500).json({ error: "Unexpected response type from AI" });
      return;
    }

    let parsed: unknown;
    try {
      const rawText = block.text.trim();
      // Claude occasionally wraps JSON in markdown code fences (```json ... ```)
      // even when the system prompt forbids it. The regex extracts just the JSON
      // object, ignoring any surrounding text.
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      req.log.error({ text: block.text }, "Failed to parse AI response as JSON");
      res.status(500).json({ error: "Failed to parse AI response" });
      return;
    }

    // Validate the parsed object against the expected schema. If Claude returns
    // an unexpected shape (e.g., after a model update), this surfaces the error
    // immediately with structured error details rather than crashing downstream.
    const validated = reframeResponseSchema.safeParse(parsed);
    if (!validated.success) {
      req.log.error({ errors: validated.error.flatten(), parsed }, "AI response failed schema validation");
      res.status(500).json({ error: "AI response did not match expected schema" });
      return;
    }

    res.json(validated.data);
  } catch (err) {
    req.log.error({ err }, "Reframe API error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
