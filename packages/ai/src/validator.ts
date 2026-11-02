/**
 * Zod validation schema for AI Coach output
 */

import { z } from 'zod';
import { CoachGenerationResult } from './types';

export const MiniTaskCategoryEnum = z.enum([
  'learning',
  'health',
  'relationships',
  'finance',
  'creativity',
  'mindfulness',
  'rest',
  'home',
]);

export const GeneratedMiniTaskSchema = z.object({
  title: z.string().min(3).max(150),
  rationale: z.string().min(3).max(300),
  category: MiniTaskCategoryEnum,
  duration_min: z.number().int().min(5).max(60),
});

export const CoachGenerationSchema = z.object({
  summary: z.string().min(5),
  topics: z.array(z.string()).max(8),
  tasks: z.array(GeneratedMiniTaskSchema).min(3).max(5),
});

export function parseAndValidateCoachResponse(raw: string): CoachGenerationResult {
  let cleaned = raw.trim();

  // Strip markdown code fences ```json ... ``` if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
  }

  const parsed = JSON.parse(cleaned);
  const validated = CoachGenerationSchema.parse(parsed);

  // Clamp word count if needed
  const words = validated.summary.split(/\s+/);
  if (words.length > 120) {
    validated.summary = words.slice(0, 120).join(' ') + '…';
  }

  return validated;
}
