/**
 * Hecate AI Module Types
 */

import { MiniTaskCategory } from '@hecate/core';

export interface AiCompletionRequest {
  system: string;
  user: string;
  maxTokens: number;
  json?: boolean;
}

export interface AiProvider {
  id: 'anthropic' | 'openai-compatible' | 'ollama' | 'mock';
  complete(req: AiCompletionRequest): Promise<string>;
}

export interface DigestRow {
  tags: string[];
  text: string;
  fields: Record<string, string>;
}

export interface DigestPayload {
  digest: DigestRow[];
  windowDays: number;
  recentTasks: string[];
  categoryStats: Record<string, { done: number; snoozed: number; dismissed: number }>;
  locale: string;
  today: string;
}

export interface GeneratedMiniTask {
  title: string;
  rationale: string;
  category: MiniTaskCategory;
  duration_min: number;
}

export interface CoachGenerationResult {
  summary: string;
  topics: string[];
  tasks: GeneratedMiniTask[];
}
