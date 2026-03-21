import { Router, type IRouter } from "express";
import { z } from "zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router: IRouter = Router();

const turnSchema = z.object({
  rawText: z.string(),
  flags: z.array(z.object({
    category: z.string(),
    severity: z.string(),
    matchedText: z.string(),
  })).default([]),
});

const requestSchema = z.object({
  sessionId: z.string().min(1),
  turns: z.array(turnSchema).min(1).max(50),
  dominantEmotions: z.array(z.string()).default([]),
});

const SUMMARY_SYSTEM_PROMPT = `You are a therapeutic session summariser. You will receive the full text of a user's private journaling session (multiple turns). Your job is to analyse the session as a whole and return insight cards.

Return a JSON object with:
{
  "overallSummary": "A warm, 1-2 sentence summary of what the session was about. Speak directly to the person using 'you'. Be specific about the themes, not generic.",
  "insights": [
    {
      "id": "1",
      "title": "Short label for this insight (3-5 words)",
      "body": "A 1-2 sentence observation about a pattern, belief, or emotional theme you noticed. Be specific and reference what they said without quoting verbatim. Use 'you' language.",
      "category": "pattern" | "belief" | "emotion" | "strength"
    }
  ]
}

Rules:
- Return 2-4 insights maximum
- At least one insight should be a "strength" — something positive you noticed (resilience, self-awareness, honesty, etc.)
- Be warm but direct. No platitudes. No "it's okay to feel this way" filler.
- Category "pattern" = a repeated thinking pattern, "belief" = an underlying belief, "emotion" = an emotional theme, "strength" = something positive
- Return ONLY valid JSON, nothing else.`;

router.post("/summarise-session", async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { sessionId, turns, dominantEmotions } = parsed.data;

  const userContent = turns.map((t, i) => {
    const flagInfo = t.flags.length > 0
      ? ` [detected: ${t.flags.map(f => f.category.replace(/_/g, " ")).join(", ")}]`
      : "";
    return `Turn ${i + 1}: ${t.rawText}${flagInfo}`;
  }).join("\n\n");

  const emotionContext = dominantEmotions.length > 0
    ? `\n\nEmotional tones detected during session: ${dominantEmotions.join(", ")}`
    : "";

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SUMMARY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent + emotionContext }],
    });

    const block = message.content[0];
    if (block.type !== "text") {
      res.status(500).json(null);
      return;
    }

    const jsonMatch = block.text.trim().match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      res.status(500).json(null);
      return;
    }

    const result = JSON.parse(jsonMatch[0]);
    res.json({
      sessionId,
      ...result,
    });
  } catch (err) {
    req.log.error({ err, sessionId }, "summarise-session API error");
    res.status(500).json(null);
  }
});

export default router;
