/**
 * Migration runner for Hecate
 */

import { StorageAdapter } from './adapters/storage-adapter';
import { seedStarterWorkspace } from './seeds';

const INITIAL_SCHEMA = `
CREATE TABLE IF NOT EXISTS node (
  id TEXT PRIMARY KEY,
  parent_id TEXT NULL,
  position TEXT NOT NULL,
  kind TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  collapsed INTEGER NOT NULL DEFAULT 0,
  done_at INTEGER NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER NULL,
  meta TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_node_parent ON node (parent_id, position);
CREATE INDEX IF NOT EXISTS idx_node_kind ON node (kind);
CREATE INDEX IF NOT EXISTS idx_node_updated ON node (updated_at);
CREATE INDEX IF NOT EXISTS idx_node_deleted ON node (deleted_at);

CREATE TABLE IF NOT EXISTS node_tag (
  node_id TEXT NOT NULL,
  tag_def_id TEXT NOT NULL,
  PRIMARY KEY (node_id, tag_def_id)
);

CREATE INDEX IF NOT EXISTS idx_node_tag_tag ON node_tag (tag_def_id);

CREATE TABLE IF NOT EXISTS ref (
  source_node_id TEXT NOT NULL,
  target_node_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  PRIMARY KEY (source_node_id, target_node_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_ref_target ON ref (target_node_id);
CREATE INDEX IF NOT EXISTS idx_ref_source ON ref (source_node_id);

CREATE TABLE IF NOT EXISTS command (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NULL,
  steps TEXT NOT NULL,
  scope TEXT NULL
);

CREATE TABLE IF NOT EXISTS mini_task (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  rationale TEXT NOT NULL,
  category TEXT NOT NULL,
  duration_min INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'suggested',
  source_summary_id TEXT NULL,
  created_at INTEGER NOT NULL,
  due_at INTEGER NULL,
  done_at INTEGER NULL,
  snoozed_until INTEGER NULL,
  feedback TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_mini_task_status ON mini_task (status, due_at);

CREATE TABLE IF NOT EXISTS ai_summary (
  id TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  window_end INTEGER NOT NULL,
  text TEXT NOT NULL,
  topics TEXT NOT NULL,
  node_count INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS migration_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);
`;

const REFLECTION_SCHEMA = `
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
`;

export async function runMigrations(adapter: StorageAdapter): Promise<void> {
  const statements = (INITIAL_SCHEMA + '\n' + REFLECTION_SCHEMA)
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    await adapter.execute(stmt);
  }

  // FTS5 full-text index over node.content (external content, trigger-synced).
  // Executed as whole statements: trigger bodies contain semicolons, so these
  // must not go through the naive ';' split above.
  const ftsStatements = [
    `CREATE VIRTUAL TABLE IF NOT EXISTS fts_node USING fts5(content, content='node', content_rowid='rowid')`,
    `CREATE TRIGGER IF NOT EXISTS fts_node_ai AFTER INSERT ON node BEGIN
       INSERT INTO fts_node(rowid, content) VALUES (new.rowid, new.content);
     END`,
    `CREATE TRIGGER IF NOT EXISTS fts_node_ad AFTER DELETE ON node BEGIN
       INSERT INTO fts_node(fts_node, rowid, content) VALUES ('delete', old.rowid, old.content);
     END`,
    `CREATE TRIGGER IF NOT EXISTS fts_node_au AFTER UPDATE OF content ON node BEGIN
       INSERT INTO fts_node(fts_node, rowid, content) VALUES ('delete', old.rowid, old.content);
       INSERT INTO fts_node(rowid, content) VALUES (new.rowid, new.content);
     END`,
  ];
  for (const stmt of ftsStatements) {
    await adapter.execute(stmt);
  }

  // Check version
  const rows = await adapter.query<{ version: number }>('SELECT max(version) as version FROM migration_version');
  const currentVersion = rows[0]?.version || 0;

  if (currentVersion < 1) {
    await adapter.execute('INSERT INTO migration_version (version, applied_at) VALUES (1, ?)', [Date.now()]);
    await seedStarterWorkspace(adapter);
  }

  if (currentVersion < 2) {
    await adapter.execute('INSERT INTO migration_version (version, applied_at) VALUES (2, ?)', [Date.now()]);
  }

  if (currentVersion >= 1 && currentVersion < 3) {
    // Backfill only for pre-existing databases; on fresh databases the triggers
    // already indexed the seed content, so a backfill would double-index it.
    await adapter.execute('INSERT INTO fts_node(rowid, content) SELECT rowid, content FROM node');
  }
  if (currentVersion < 3) {
    await adapter.execute('INSERT INTO migration_version (version, applied_at) VALUES (3, ?)', [Date.now()]);
  }
}
