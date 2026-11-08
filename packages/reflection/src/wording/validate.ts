import { z } from 'zod';

export const WordingSchema = z.object({
  title: z.string().min(8).max(80),
  rationale: z.string().min(8).max(200),
  steps: z.array(z.string().min(3).max(120)).min(2).max(4),
  durationMin: z.number().int().min(5).max(30),
});

export type ValidatedWording = z.infer<typeof WordingSchema>;

const BLOCKED_TERMS = [
  'suicide',
  'self-harm',
  'cutting',
  'kill yourself',
  'overdose',
  'medication dosage',
  'prescription mg',
  'extreme fast',
  'anorexia',
];

export function checkSafety(text: string): boolean {
  const lower = text.toLowerCase();
  for (const term of BLOCKED_TERMS) {
    if (lower.includes(term)) return false;
  }
  return true;
}

/**
 * Rejects wording with quoted names / entities not present in facts (Section 9.2)
 */
export function checkNoHallucinatedEntities(wording: ValidatedWording, facts: Record<string, any>): boolean {
  const factStrings = JSON.stringify(facts).toLowerCase();
  const allText = `${wording.title} ${wording.rationale} ${wording.steps.join(' ')}`;

  // Find quoted strings
  const quotedMatches = allText.match(/['"]([^'"]{4,30})['"]/g);
  if (quotedMatches) {
    for (const q of quotedMatches) {
      const clean = q.slice(1, -1).toLowerCase();
      if (!factStrings.includes(clean)) {
        return false;
      }
    }
  }

  return true;
}
