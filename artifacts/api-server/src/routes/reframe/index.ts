import { Router, type IRouter } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router: IRouter = Router();

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

    res.json(parsed);
  } catch (err) {
    req.log.error({ err }, "Reframe API error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
