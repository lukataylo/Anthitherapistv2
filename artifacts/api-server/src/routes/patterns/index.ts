/**
 * POST /api/patterns — AI-generated pattern observations from a user's history.
 *
 * ## What this route does
 *
 * Accepts a summary of the user's overall category distribution and a sample of
 * their thought texts grouped by dominant distortion, then asks Claude to return
 * 2–3 short natural-language pattern observations like:
 *   "You tend to use self-judgment language around work topics"
 *
 * ## Input
 *
 * - `categoryCounts` — map of category → total word count across all entries
 * - `thoughtSamples` — up to 10 sample thoughts with their dominant category
 *
 * ## Output
 *
 * - `patterns` — array of 2–3 string observations
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router: IRouter = Router();

const patternsRequestSchema = z.object({
  categoryCounts: z.record(
    z.enum(["belief", "fear", "absolute", "self_judgment"]),
    z.number().int().nonnegative()
  ),
  thoughtSamples: z.array(
    z.object({
      thought: z.string().min(1),
      dominantCategory: z.enum(["belief", "fear", "absolute", "self_judgment"]),
    })
  ).max(10),
});

const SYSTEM_PROMPT = `You are an insightful cognitive-behavioural therapy (CBT) coach analyzing patterns in someone's thinking over time.

Given a summary of the cognitive distortions found in their journal entries and sample thoughts, generate 2–3 concise natural-language observations about their thinking patterns.

Guidelines:
- Be specific and personalised to the actual data provided — reference the actual distortion types and themes in their thoughts
- Use gentle, non-judgmental, supportive language
- Each observation should be one sentence, 15–30 words
- Focus on patterns that are actionable and insightful
- Use second person ("You tend to...", "Your thinking often...", "You frequently...")
- Do NOT use bullet points or numbered lists in your response
- Return ONLY a JSON array of strings, no other text, no markdown
- Example output format: ["You tend to use absolute language when discussing work.", "Self-judgment patterns often appear in social situations.", "Your fear-based thinking frequently involves future outcomes."]`;

router.post("/patterns", async (req, res) => {
  const parsed = patternsRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
    return;
  }

  const { categoryCounts, thoughtSamples } = parsed.data;

  const totalWords = Object.values(categoryCounts).reduce((a, b) => a + b, 0);

  if (totalWords === 0 || thoughtSamples.length === 0) {
    res.json({ patterns: [] });
    return;
  }

  const categoryLines = Object.entries(categoryCounts)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([cat, count]) => {
      const pct = Math.round((count / totalWords) * 100);
      return `  ${cat}: ${count} words (${pct}%)`;
    })
    .join("\n");

  const sampleLines = thoughtSamples
    .map((s) => `  [${s.dominantCategory}] "${s.thought}"`)
    .join("\n");

  const userMessage = `Category breakdown across all journal entries (${totalWords} distorted words total):
${categoryLines}

Sample thoughts (showing dominant distortion category):
${sampleLines}

Generate 2–3 pattern observations for this person.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const block = message.content[0];
    if (block.type !== "text") {
      res.status(500).json({ error: "Unexpected response type from AI" });
      return;
    }

    let patterns: string[];
    try {
      patterns = JSON.parse(block.text.trim());
      if (!Array.isArray(patterns)) throw new Error("Not an array");
      patterns = patterns.filter((p): p is string => typeof p === "string").slice(0, 3);
    } catch {
      // Fallback: split by newlines if Claude didn't return JSON
      patterns = block.text
        .trim()
        .split("\n")
        .map((l: string) => l.replace(/^[-•*\d.]\s*/, "").trim())
        .filter((l: string) => l.length > 0)
        .slice(0, 3);
    }

    res.json({ patterns });
  } catch (err) {
    req.log.error({ err }, "Patterns API error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
