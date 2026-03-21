const NEGATIVE_WORDS: Record<string, number> = {
  hate: 3, hopeless: 3, worthless: 3, suicide: 3, die: 3, kill: 3,
  terrified: 3, devastated: 3, despair: 3, agony: 3, broken: 3,
  trapped: 2, alone: 2, scared: 2, anxious: 2, panic: 2, shame: 2,
  guilty: 2, angry: 2, furious: 2, disgusted: 2, miserable: 2,
  helpless: 2, useless: 2, failure: 2, stupid: 2, ugly: 2,
  awful: 2, horrible: 2, terrible: 2, dread: 2, nightmare: 2,
  sad: 1, upset: 1, stressed: 1, worried: 1, tired: 1, exhausted: 1,
  frustrated: 1, annoyed: 1, hurt: 1, lost: 1, confused: 1,
  overwhelmed: 1, afraid: 1, nervous: 1, insecure: 1, lonely: 1,
  regret: 1, disappointed: 1, embarrassed: 1, stuck: 1,
  never: 1, always: 1, nobody: 1, nothing: 1, cant: 1, wont: 1,
};

const POSITIVE_DAMPENERS: Record<string, number> = {
  happy: -1, grateful: -1, love: -1, joy: -1, hope: -1,
  proud: -1, excited: -1, calm: -1, peaceful: -1, better: -1,
  good: -0.5, okay: -0.5, fine: -0.5,
};

export function scoreText(text: string): number {
  const words = text.toLowerCase().replace(/[^a-z\s']/g, "").split(/\s+/);
  let score = 0;
  for (const word of words) {
    const cleaned = word.replace(/'/g, "");
    if (NEGATIVE_WORDS[cleaned] != null) {
      score += NEGATIVE_WORDS[cleaned];
    }
    if (POSITIVE_DAMPENERS[cleaned] != null) {
      score += POSITIVE_DAMPENERS[cleaned];
    }
  }
  return Math.max(0, score);
}

export function cumulativeEmotionalScore(turns: Array<{ rawText: string }>): number {
  return turns.reduce((sum, t) => sum + scoreText(t.rawText), 0);
}

export const CHECKIN_THRESHOLD = 12;
