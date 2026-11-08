import { AiProvider } from '@hecate/ai';
import { Candidate } from '../types';
import { generateTemplateWording, WordingResult } from './templates';
import { WordingSchema, checkSafety, checkNoHallucinatedEntities } from './validate';

export const SYSTEM_PROMPT = `You write one Reflection for a personal knowledge app. Return JSON only. Use only the facts provided; never invent details about the user. title is an imperative sentence of at most 70 characters that includes the duration. rationale is one sentence that names the user's note when facts has one. steps has 2 to 4 short steps. Keep it safe, non-medical, and doable in the given duration. Do not repeat the style of anything in avoid.`;

export async function generateWording(
  candidate: Candidate,
  provider?: AiProvider,
  options: {
    avoidTitles?: string[];
  } = {}
): Promise<{ result: WordingResult; wording: 'template' | 'llm' }> {
  // If no provider or evergreen, use template
  if (!provider || candidate.kind === 'evergreen') {
    return {
      result: generateTemplateWording(candidate),
      wording: 'template',
    };
  }

  const payload = {
    kind: candidate.kind,
    facts: candidate.facts,
    durationMin: candidate.durationMin,
    category: candidate.category,
    style: 'warm, concrete, second person',
    avoid: options.avoidTitles || [],
    locale: 'en',
  };

  const userPrompt = JSON.stringify(payload, null, 2);

  // Helper for single attempt & validation
  const attempt = async (extraPrompt?: string): Promise<WordingResult | null> => {
    try {
      const response = await provider.complete({
        system: SYSTEM_PROMPT,
        user: extraPrompt ? `${userPrompt}\n\nNote previous error: ${extraPrompt}` : userPrompt,
        maxTokens: 250,
        json: true,
      });

      const parsedJson = JSON.parse(response);
      const validated = WordingSchema.parse(parsedJson);

      const allText = `${validated.title} ${validated.rationale} ${validated.steps.join(' ')}`;
      if (!checkSafety(allText)) {
        return null;
      }

      if (!checkNoHallucinatedEntities(validated, candidate.facts)) {
        return null;
      }

      return validated;
    } catch {
      return null;
    }
  };

  // Attempt 1
  let res = await attempt();
  if (res) {
    return { result: res, wording: 'llm' };
  }

  // Attempt 2 (Retry once with repair message per Section 9.2)
  res = await attempt('JSON must match schema with title (<=70 chars), rationale (1 sentence), steps (2-4), durationMin (5-30).');
  if (res) {
    return { result: res, wording: 'llm' };
  }

  // Fallback to deterministic template
  return {
    result: generateTemplateWording(candidate),
    wording: 'template',
  };
}
