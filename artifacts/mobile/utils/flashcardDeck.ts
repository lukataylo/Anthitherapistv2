/**
 * flashcardDeck — assembles the full belief flashcard deck from two sources:
 *
 * 1. **Journal cards** — insights extracted from discuss/journal sessions by
 *    the API's GET /api/discuss/insights endpoint. Each insight becomes a card
 *    with its own front/back pair.
 *
 * 2. **Seed cards** — pre-filled "recall your wins" prompts across life
 *    categories (social, career, resilience, etc.). The front asks the user to
 *    recall a time they succeeded; the back lists 2-3 concrete example wins to
 *    remind them they have proof they can do it.
 *
 * Deduplication is done by a content hash of `type|front` (lowercased, trimmed)
 * so the same card won't appear twice even across different sessions.
 */


export type CardType = "journal" | "seed";

export interface FlashCard {
  id: string;
  type: CardType;
  front: string;
  back: string;
}

const SEED_CARDS: FlashCard[] = [
  {
    id: "seed-boundaries-1",
    type: "seed",
    front: "Think of a time you stood up for your boundaries",
    back: "• You said no to extra work when your plate was already full\n• You told a friend their comment crossed a line — and they respected it\n• You walked away from a situation that didn't feel right, even when it was hard",
  },
  {
    id: "seed-social-1",
    type: "seed",
    front: "Think of a time you successfully navigated a difficult social situation",
    back: "• You struck up a conversation with a stranger and it turned into a real connection\n• You resolved a conflict with a friend by staying calm and honest\n• You showed up to an event alone and left having met new people",
  },
  {
    id: "seed-challenge-1",
    type: "seed",
    front: "Think of a time you overcame a major challenge",
    back: "• You pushed through a project that felt impossible and delivered it on time\n• You recovered from a setback that knocked you down and came back stronger\n• You handled a crisis at work without falling apart",
  },
  {
    id: "seed-career-1",
    type: "seed",
    front: "Think of a time you accomplished something meaningful in your career",
    back: "• You landed a job after a tough interview process\n• You received recognition or a promotion you had been working toward\n• You solved a problem at work that nobody else could figure out",
  },
  {
    id: "seed-money-1",
    type: "seed",
    front: "Think of a time you handled your finances or business successfully",
    back: "• You saved up for something important and actually followed through\n• You negotiated a raise or a better deal for yourself\n• You built something from scratch that earned money",
  },
  {
    id: "seed-emotions-1",
    type: "seed",
    front: "Think of a time you regulated your emotions in a tough moment",
    back: "• You stayed calm during an argument instead of escalating it\n• You paused before reacting and chose a thoughtful response\n• You let yourself feel something painful without trying to numb it",
  },
  {
    id: "seed-relocation-1",
    type: "seed",
    front: "Think of a time you adapted successfully to a big life change",
    back: "• You moved to a new city or country and built a life there\n• You started over after a relationship ended and found your footing\n• You changed careers and proved you could learn something completely new",
  },
  {
    id: "seed-friends-1",
    type: "seed",
    front: "Think of a time you built a meaningful new friendship",
    back: "• You reached out to someone new and turned an acquaintance into a real friend\n• You showed up for someone when they needed it and they did the same for you\n• You joined a group or community and became a valued part of it",
  },
  {
    id: "seed-fear-1",
    type: "seed",
    front: "Think of a time you did something you were afraid of",
    back: "• You had the conversation you'd been dreading — and it went better than you thought\n• You tried something new despite feeling completely out of your depth\n• You put yourself out there knowing you might fail, and you survived either way",
  },
  {
    id: "seed-helping-1",
    type: "seed",
    front: "Think of a time you made a real difference for someone else",
    back: "• You helped a friend through a hard time just by listening and being there\n• You mentored or taught someone something that changed their path\n• You stood up for someone who couldn't stand up for themselves",
  },
  {
    id: "seed-perseverance-1",
    type: "seed",
    front: "Think of a time you kept going even when you wanted to quit",
    back: "• You stuck with a goal long after the excitement wore off and actually finished it\n• You failed multiple times and still got back up to try again\n• You pushed through exhaustion or doubt and came out the other side proud",
  },
  {
    id: "seed-selfcare-1",
    type: "seed",
    front: "Think of a time you prioritised your well-being — and it paid off",
    back: "• You set time aside for rest when everything felt urgent, and you were better for it\n• You started a healthy habit that genuinely improved how you feel\n• You cut something toxic out of your life even though it was comfortable",
  },
];

async function fetchJournalCards(baseUrl: string): Promise<FlashCard[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const url = `${baseUrl}/api/discuss/insights`;
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) {
      clearTimeout(timeoutId);
      return [];
    }
    const data = (await resp.json()) as { insights?: { front: string; back: string }[] };
    if (!Array.isArray(data.insights)) {
      clearTimeout(timeoutId);
      return [];
    }
    const cards = data.insights
      .filter((i) => typeof i.front === "string" && typeof i.back === "string")
      .map((i, idx) => ({
        id: `journal-${idx}-${i.front.slice(0, 20).replace(/\s/g, "-")}`,
        type: "journal" as CardType,
        front: i.front,
        back: i.back,
      }));
    clearTimeout(timeoutId);
    return cards;
  } catch {
    clearTimeout(timeoutId);
    return [];
  }
}

export interface DeckResult {
  deck: FlashCard[];
  isEmpty: boolean;
}

export async function buildDeck(
  _entries: unknown,
  baseUrl: string
): Promise<DeckResult> {
  const journalCards = await fetchJournalCards(baseUrl);

  const seen = new Set<string>();
  const dedupe = (card: FlashCard): FlashCard | null => {
    const key = `${card.type}|${card.front.toLowerCase().trim()}`;
    if (seen.has(key)) return null;
    seen.add(key);
    return card;
  };

  const pool = [...journalCards, ...SEED_CARDS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const shuffled: FlashCard[] = [];
  for (const card of pool) {
    const unique = dedupe(card);
    if (unique) shuffled.push(unique);
  }

  return { deck: shuffled, isEmpty: false };
}
