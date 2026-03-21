import { PATTERNS } from "@/src/modules/patternLibrary";
import type { PatternFlag } from "@/src/types";

function cloneRegex(regex: RegExp): RegExp {
  return new RegExp(regex.source, regex.flags);
}

export function matchPatterns(rawText: string): PatternFlag[] {
  if (!rawText) return [];

  const flags: PatternFlag[] = [];

  for (const pattern of PATTERNS) {
    const regex = cloneRegex(pattern.regex);
    let match: RegExpExecArray | null = regex.exec(rawText);

    while (match) {
      const matchedText = match[0];
      const startIndex = match.index;
      flags.push({
        matchedText,
        startIndex,
        endIndex: startIndex + matchedText.length,
        patternId: pattern.id,
        severity: pattern.severity,
        category: pattern.category,
      });
      match = regex.exec(rawText);
    }
  }

  return flags;
}
