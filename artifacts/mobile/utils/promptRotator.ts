const EXPANSION_PROMPTS = [
  "Tell me more about that.",
  "What else comes up when you think about this?",
  "Keep going.",
  "What's the first thing that comes to mind?",
  "Is there more to this than you've written?",
];

const FEELING_PROMPTS = [
  "What does that feel like in your body?",
  "What emotion is closest to what you're describing?",
  "How long have you been carrying this?",
];

const DEPTH_PROMPTS = [
  "When did you first feel this way?",
  "Does this remind you of anything from earlier in your life?",
  "What did you need in that moment?",
  "What were you trying to protect yourself from?",
  "Whose voice does that sound like to you?",
];

const ASCENT_PROMPTS = [
  "What's something you know about yourself that this situation doesn't change?",
  "What would feel like a small act of care for yourself today?",
  "If a close friend described what you've just shared, what would you want them to know?",
  "What's one thing that still feels solid or true for you right now?",
  "Is there anything from today's conversation you want to carry with you?",
  "What does a good next few hours look like for you?",
  "What's the smallest thing that might help right now?",
];

export function getNextPrompt(
  turnIndex: number,
  lastAnalysisNoteworthy: boolean,
  sessionPhase: 'descent' | 'ascent',
): string {
  if (sessionPhase === 'ascent') {
    return ASCENT_PROMPTS[turnIndex % ASCENT_PROMPTS.length];
  }
  if (lastAnalysisNoteworthy) {
    return DEPTH_PROMPTS[turnIndex % DEPTH_PROMPTS.length];
  }
  if (turnIndex % 6 === 5) {
    return DEPTH_PROMPTS[Math.floor(turnIndex / 6) % DEPTH_PROMPTS.length];
  }
  if (turnIndex % 3 === 2) {
    return FEELING_PROMPTS[Math.floor(turnIndex / 3) % FEELING_PROMPTS.length];
  }
  return EXPANSION_PROMPTS[turnIndex % EXPANSION_PROMPTS.length];
}
