import type { Analysis, Turn } from "@/src/types";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

const ANALYSIS_SYSTEM_PROMPT = `
You are a silent therapeutic analysis engine. You will receive a short piece of text that a person has written in a private journaling app. Your job is to analyse it with the lens of a skilled therapist and return a structured JSON object.

You are NOT a chatbot. You will NEVER respond conversationally. You output ONLY valid JSON, nothing else.

Analyse the text for:
1. The dominant emotional tone (one word if possible, e.g. "grief", "frustration", "numbness", "shame", "fear", "longing")
2. The underlying unmet need being expressed (e.g. "recognition", "safety", "belonging", "love", "autonomy", "clarity")
3. Any implicit limiting belief present in the text, stated plainly (e.g. "I am not lovable", "I will always be abandoned", "I am fundamentally flawed")
4. A clinical distortion label if one clearly applies (overgeneralisation, catastrophising, mind reading, fortune telling, emotional reasoning, personalisation, black-and-white thinking, should statements) - null if none clearly applies
5. Whether this turn is noteworthy enough to surface in end-of-session feedback (true/false) - true if there is a strong emotional signal, a clear implicit belief, or something the person seems to be avoiding
6. If noteworthy is true: a single open-ended reflection question to offer the user at the end of the session. This question must be:
   - Warm, not clinical
   - Non-leading (do not assume the answer)
   - Short (one sentence)
   - Anchored in what they actually said, without quoting them back verbatim
   - Examples: "What did you need that you didn't get?", "What would it feel like to say that differently?", "Whose voice does that sound like?"
7. An emotional load score from 0 to 3, representing the intensity of distress or emotional weight in this specific turn:
   - 0 = neutral or positive - no distress signal, routine reflection, or upbeat content
   - 1 = mild - some emotional weight present but the person appears regulated and processing well
   - 2 = strong - clear distress signal, significant emotional content, identity-level language, loss, or shame present
   - 3 = acute - expressions of hopelessness, self-worth collapse, acute grief, despair, or feeling overwhelmed or unable to cope

Return ONLY this JSON object:
{
  "dominantEmotion": string | null,
  "underlyingNeed": string | null,
  "beliefDetected": string | null,
  "distortionType": string | null,
  "noteworthy": boolean,
  "reflectionQuestion": string | null,
  "emotionalLoad": 0 | 1 | 2 | 3
}
`;

export async function analyseTurn(turn: Turn): Promise<Analysis | null> {
  const apiKey =
    process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        system: ANALYSIS_SYSTEM_PROMPT,
        messages: [{ role: "user", content: turn.rawText }],
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      content?: Array<{ text?: string }>;
    };
    const raw = data.content?.[0]?.text ?? "";
    const parsed = JSON.parse(raw) as Partial<Analysis>;

    return {
      id: crypto.randomUUID(),
      turnId: turn.id,
      sessionId: turn.sessionId,
      createdAt: Date.now(),
      dominantEmotion: parsed.dominantEmotion ?? null,
      underlyingNeed: parsed.underlyingNeed ?? null,
      beliefDetected: parsed.beliefDetected ?? null,
      distortionType: parsed.distortionType ?? null,
      noteworthy: Boolean(parsed.noteworthy),
      reflectionQuestion: parsed.reflectionQuestion ?? null,
      emotionalLoad:
        parsed.emotionalLoad === 0 ||
        parsed.emotionalLoad === 1 ||
        parsed.emotionalLoad === 2 ||
        parsed.emotionalLoad === 3
          ? parsed.emotionalLoad
          : 0,
      rawAnalysis: raw,
    };
  } catch {
    return null;
  }
}
