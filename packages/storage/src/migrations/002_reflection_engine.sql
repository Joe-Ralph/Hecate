-- Hecate Reflection Engine Migration (Section 4)

CREATE TABLE IF NOT EXISTS node_signal (
  node_id TEXT PRIMARY KEY,
  rung TEXT,
  last_activity_at INTEGER,
  last_opened_at INTEGER,
  child_count INTEGER,
  actionable_child_count INTEGER,
  done_child_count INTEGER,
  ref_count INTEGER,
  importance REAL,
  category TEXT,
  computed_at INTEGER,
  dirty INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_node_signal_dirty ON node_signal (dirty);

CREATE TABLE IF NOT EXISTS node_embedding (
  node_id TEXT PRIMARY KEY,
  model TEXT,
  dim INTEGER,
  vec BLOB,
  text_hash TEXT,
  computed_at INTEGER
);

CREATE TABLE IF NOT EXISTS topic (
  id TEXT PRIMARY KEY,
  label TEXT,
  kind TEXT,
  weekly_counts TEXT,
  trend REAL
);

CREATE TABLE IF NOT EXISTS node_topic (
  node_id TEXT,
  topic_id TEXT,
  weight REAL,
  PRIMARY KEY (node_id, topic_id)
);

CREATE TABLE IF NOT EXISTS node_pair (
  a TEXT,
  b TEXT,
  similarity REAL,
  computed_at INTEGER,
  PRIMARY KEY (a, b)
);

CREATE TABLE IF NOT EXISTS rollup (
  id TEXT PRIMARY KEY,
  period TEXT,
  start_at INTEGER,
  end_at INTEGER,
  text TEXT,
  topics TEXT,
  node_count INTEGER,
  source TEXT,
  input_hash TEXT,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS reflection (
  id TEXT PRIMARY KEY,
  kind TEXT,
  status TEXT,
  slot INTEGER,
  title TEXT,
  rationale TEXT,
  steps TEXT,
  category TEXT,
  duration_min INTEGER,
  source_node_ids TEXT,
  evergreen_id TEXT,
  score REAL,
  score_breakdown TEXT,
  wording TEXT,
  run_id TEXT,
  created_at INTEGER,
  shown_at INTEGER,
  resolved_at INTEGER,
  snoozed_until INTEGER,
  skip_reason TEXT,
  saved_node_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_reflection_status ON reflection (status, slot);

CREATE TABLE IF NOT EXISTS reflection_event (
  id TEXT PRIMARY KEY,
  reflection_id TEXT,
  type TEXT,
  reason TEXT,
  payload TEXT,
  at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_reflection_event_ref ON reflection_event (reflection_id, at);

CREATE TABLE IF NOT EXISTS preference_weight (
  key TEXT PRIMARY KEY,
  alpha REAL DEFAULT 2,
  beta REAL DEFAULT 2,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS mute (
  id TEXT PRIMARY KEY,
  scope TEXT,
  target_id TEXT,
  until INTEGER,
  reason TEXT,
  created_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_mute_scope ON mute (scope, target_id);

CREATE TABLE IF NOT EXISTS engine_run (
  id TEXT PRIMARY KEY,
  trigger TEXT,
  started_at INTEGER,
  finished_at INTEGER,
  candidates INTEGER,
  llm_calls INTEGER,
  tokens_in INTEGER,
  tokens_out INTEGER,
  error TEXT
);
