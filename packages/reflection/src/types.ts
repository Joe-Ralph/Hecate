/**
 * Reflection Engine Core Types (Section 1, 4, 13)
 */

export type ReflectionKind =
  | 'seed_to_plan'
  | 'explore_to_plan'
  | 'plan_to_start'
  | 'unblock'
  | 'close_loop'
  | 'connect'
  | 'revisit'
  | 'pattern'
  | 'balance'
  | 'journal'
  | 'evergreen';

export type MaturityRung = 'seed' | 'explored' | 'planned' | 'active' | 'done';

export type SkipReason = 'not_relevant' | 'not_interested' | 'already_did' | 'not_now' | 'too_big';

export type ReflectionStatus =
  | 'queued'
  | 'shown'
  | 'started'
  | 'done'
  | 'skipped'
  | 'snoozed'
  | 'expired';

export interface Reflection {
  id: string;
  kind: ReflectionKind;
  status: ReflectionStatus;
  slot: number | null;
  title: string;
  rationale: string;
  steps: string[];
  category: string;
  durationMin: number;
  sourceNodeIds: string[];
  evergreenId?: string;
  wording: 'template' | 'llm';
  score: number;
  scoreBreakdown?: Record<string, number>;
  createdAt?: number;
  shownAt?: number;
  resolvedAt?: number;
  snoozedUntil?: number;
  skipReason?: string;
  savedNodeId?: string;
}

export type UserAction =
  | { type: 'start' }
  | { type: 'done'; notes?: string }
  | { type: 'skip'; reason?: SkipReason }
  | { type: 'snooze'; until: number }
  | { type: 'undo' }
  | { type: 'save_as_node' };

export interface Rollup {
  id: string;
  period: 'day' | 'week' | 'month';
  start_at: number;
  end_at: number;
  text: string;
  topics: string[];
  node_count: number;
  source: 'extractive' | 'llm';
  input_hash?: string;
  created_at: number;
}

export interface Mute {
  id: string;
  scope: 'node' | 'topic' | 'kind' | 'evergreen';
  target_id: string;
  until: number | null;
  reason?: string;
  created_at: number;
}

export interface KindStats {
  kind: ReflectionKind;
  shownCount: number;
  doneCount: number;
  skipCount: number;
  doneRate: number;
}

export interface Candidate {
  id?: string;
  kind: ReflectionKind;
  sourceNodeIds: string[];
  facts: Record<string, any>;
  category: string;
  durationMin: number;
  baseScoreHints?: {
    maturityGap?: number;
    importance?: number;
  };
  evergreenId?: string;
}

export interface NodeSignalRecord {
  node_id: string;
  rung: MaturityRung | null;
  last_activity_at: number;
  last_opened_at: number | null;
  child_count: number;
  actionable_child_count: number;
  done_child_count: number;
  ref_count: number;
  importance: number;
  category: string;
  computed_at: number;
  dirty: number;
}

export interface ReflectionEngine {
  getToday(): Promise<Reflection[]>;
  refresh(opts?: { reason: 'open' | 'manual' | 'settings' }): Promise<Reflection[]>;
  act(id: string, action: UserAction): Promise<{ replacement?: Reflection; undoToken?: string }>;
  explain(id: string): Promise<{ breakdown: Record<string, number>; sources: string[]; sent?: unknown }>;
  getRollups(period: 'day' | 'week' | 'month'): Promise<Rollup[]>;
  getLearning(): Promise<{ mutes: Mute[]; stats: KindStats[] }>;
  unmute(muteId: string): Promise<void>;
  resetLearning(): Promise<void>;
  markNodeDirty(nodeId: string): void;
  markNodeOpened(nodeId: string): void;
  on(event: 'changed' | 'wording-upgraded' | 'run-failed', cb: (p: unknown) => void): () => void;
}
