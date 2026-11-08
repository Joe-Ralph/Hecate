/**
 * Reflection Engine Configuration & Defaults (Section 14)
 */

export interface EngineConfig {
  slots: number;
  reserve: number;
  trackedTags: string[];
  seedMinAgeDays: number;
  stalledDays: number;
  unrevisitedDaysCreated: number;
  unrevisitedDaysNotOpened: number;
  maxDurationMin: number;
  mmrLambda: number;
  decayPerDay: number;
  refreshPerDay: number;
  evergreenCooldownDays: number;
  skipMuteNodeDays: number;
  embeddingSimilarityThreshold: number;
  llmConcurrency: number;
  aiEnabled: boolean;
}

export const DEFAULT_CONFIG: EngineConfig = {
  slots: 4,
  reserve: 4,
  trackedTags: ['#idea', '#goal', '#project'],
  seedMinAgeDays: 2,
  stalledDays: 14,
  unrevisitedDaysCreated: 14,
  unrevisitedDaysNotOpened: 21,
  maxDurationMin: 30,
  mmrLambda: 0.4,
  decayPerDay: 0.98,
  refreshPerDay: 5,
  evergreenCooldownDays: 2,
  skipMuteNodeDays: 30,
  embeddingSimilarityThreshold: 0.82,
  llmConcurrency: 2,
  aiEnabled: false,
};
