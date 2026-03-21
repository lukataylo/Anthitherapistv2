import type { PatternFlag } from '@/types/journal';
import { PATTERNS } from './patternLibrary';

export function matchPatterns(rawText: string): PatternFlag[] {
  const flags: PatternFlag[] = [];

  for (const pattern of PATTERNS) {
    const re = new RegExp(pattern.regexSource, pattern.regexFlags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(rawText)) !== null) {
      flags.push({
        matchedText: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        patternId: pattern.id,
        severity: pattern.severity,
        category: pattern.category,
      });
      if (!pattern.regexFlags.includes('g')) break;
    }
  }

  return flags;
}
