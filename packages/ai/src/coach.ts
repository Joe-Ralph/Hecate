/**
 * Hecate Mini-Task Coach Engine
 * Coordinates digest creation, AI completion, retry repairs, and persistence.
 */

import { HecateDatabase } from '@hecate/storage';
import { AiProvider, CoachGenerationResult, DigestPayload } from './types';
import { buildKnowledgeDigest } from './digest';
import { HECATE_SYSTEM_PROMPT, REPAIR_JSON_PROMPT } from './prompts';
import { parseAndValidateCoachResponse } from './validator';
import { MiniTaskRecord, AiSummaryRecord } from '@hecate/core';

export interface CoachingRunResult {
  summary: AiSummaryRecord;
  tasks: MiniTaskRecord[];
  digestPayload: DigestPayload;
}

export class CoachEngine {
  constructor(private db: HecateDatabase) {}

  async runCoaching(provider: AiProvider): Promise<CoachingRunResult> {
    const settings = await this.db.settings.getSettings();
    if (!settings.aiEnabled) {
      throw new Error('AI Coach is not enabled. User consent required.');
    }

    const digestPayload = await buildKnowledgeDigest(this.db, settings.aiWindowDays || 7);

    // Initial completion attempt
    let rawResponse = await provider.complete({
      system: HECATE_SYSTEM_PROMPT,
      user: JSON.stringify(digestPayload),
      maxTokens: 1200,
      json: true,
    });

    let validated: CoachGenerationResult;

    try {
      validated = parseAndValidateCoachResponse(rawResponse);
    } catch (parseError) {
      // Retry once with repair prompt per REQ-AI-9
      const repairPrompt = `${REPAIR_JSON_PROMPT}\n\nMalformed Output Was:\n${rawResponse}`;
      const repairedResponse = await provider.complete({
        system: HECATE_SYSTEM_PROMPT,
        user: repairPrompt,
        maxTokens: 1200,
        json: true,
      });

      validated = parseAndValidateCoachResponse(repairedResponse);
    }

    // Persist summary
    const summary = await this.db.ai.saveSummary({
      window_start: Date.now() - (settings.aiWindowDays || 7) * 24 * 60 * 60 * 1000,
      window_end: Date.now(),
      text: validated.summary,
      topics: validated.topics,
      node_count: digestPayload.digest.length,
      provider: provider.id,
      model: settings.aiModel || 'default',
    });

    // Persist mini-tasks
    const tasks = await this.db.ai.saveMiniTasks(
      validated.tasks.map((t) => ({
        title: t.title,
        rationale: t.rationale,
        category: t.category,
        duration_min: t.duration_min,
        source_summary_id: summary.id,
        status: 'suggested',
      }))
    );

    return {
      summary,
      tasks,
      digestPayload,
    };
  }
}
