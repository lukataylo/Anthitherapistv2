/**
 * POST /api/analyse-turn — Background therapeutic analysis of a journal turn.
 *
 * Accepts { turnId, sessionId, rawText } and calls Claude with a therapeutic
 * analysis system prompt. Returns an Analysis-shaped object or null on failure.
 * All failures are silent — the session is unaffected.
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router: IRouter = Router();

const ANALYSIS_SYSTEM_PROMPT = `You are a silent therapeutic analysis engine. You will receive a short piece of text that a person has written in a private journaling app. Your job is to analyse it with the lens of a skilled therapist and return a structured JSON object.
You are NOT a chatbot. You will NEVER respond conversationally. You output ONLY valid JSON, nothing else.
Analyse the text for:
1. The dominant emotional tone (one word if possible, e.g. "grief", "frustration", "numbness", "shame", "fear", "longing")
2. The underlying unmet need being expressed (e.g. "recognition", "safety", "belonging", "love", "autonomy", "clarity")
3. Any implicit limiting belief present in the text, stated plainly (e.g. "I am not lovable", "I will always be abandoned", "I am fundamentally flawed")
4. A clinical distortion label if one clearly applies (overgeneralisation, catastrophising, mind reading, fortune telling, emotional reasoning, personalisation, black-and-white thinking, should statements) — null if none clearly applies
5. Whether this turn is noteworthy enough to surface in end-of-session feedback (true/false) — true if there is a strong emotional signal, a clear implicit belief, or something the person seems to be avoiding
6. If noteworthy is true: a single open-ended reflection question to offer the user at the end of the session. This question must be:
   - Warm, not clinical
   - Non-leading (do not assume the answer)
   - Short (one sentence)
   - Anchored in what they actually said, without quoting them back verbatim
   - Examples: "What did you need that you didn't get?", "What would it feel like to say that differently?", "Whose voice does that sound like?"
7. An emotional load score from 0 to 3, representing the intensity of distress or emotional weight in this specific turn:
   - 0 = neutral or positive — no distress signal, routine reflection, or upbeat content
   - 1 = mild — some emotional weight present but the person appears regulated and processing well
   - 2 = strong — clear distress signal, significant emotional content, identity-level language, loss, or shame present
   - 3 = acute — expressions of hopelessness, self-worth collapse, acute grief, despair, or feeling overwhelmed or unable to cope
Return ONLY this JSON object:
{
  "dominantEmotion": string | null,
  "underlyingNeed": string | null,
  "beliefDetected": string | null,
  "distortionType": string | null,
  "noteworthy": boolean,
  "reflectionQuestion": string | null,
  "emotionalLoad": 0 | 1 | 2 | 3
}`;

const requestSchema = z.object({
  turnId: z.string().min(1),
  sessionId: z.string().min(1),
  rawText: z.string().min(1).max(2000),
});

const analysisResponseSchema = z.object({
  dominantEmotion: z.string().nullable().default(null),
  underlyingNeed: z.string().nullable().default(null),
  beliefDetected: z.string().nullable().default(null),
  distortionType: z.string().nullable().default(null),
  noteworthy: z.boolean().default(false),
  reflectionQuestion: z.string().nullable().default(null),
  emotionalLoad: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).default(0),
});

router.post("/analyse-turn", async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "turnId, sessionId, and rawText are required" });
    return;
  }

  const { turnId, sessionId, rawText } = parsed.data;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: ANALYSIS_SYSTEM_PROMPT,
      messages: [{ role: "user", content: rawText }],
    });

    const block = message.content[0];
    if (block.type !== "text") {
      res.status(500).json(null);
      return;
    }

    let parsedResponse: unknown;
    try {
      const rawResponse = block.text.trim();
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      parsedResponse = JSON.parse(jsonMatch[0]);
    } catch {
      req.log.error({ turnId }, "Failed to parse analyse-turn AI response");
      res.status(500).json(null);
      return;
    }

    const validated = analysisResponseSchema.safeParse(parsedResponse);
    if (!validated.success) {
      req.log.error({ errors: validated.error.flatten(), turnId }, "analyse-turn schema validation failed");
      res.status(500).json(null);
      return;
    }

    const analysis = {
      id: crypto.randomUUID(),
      turnId,
      sessionId,
      createdAt: Date.now(),
      ...validated.data,
      rawAnalysis: block.text.trim(),
    };

    res.json(analysis);
  } catch (err) {
    req.log.error({ err, turnId }, "analyse-turn API error");
    res.status(500).json(null);
  }
});

export default router;
