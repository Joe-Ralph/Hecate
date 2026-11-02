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

export async function runMigrations(adapter: StorageAdapter): Promise<void> {
  const statements = INITIAL_SCHEMA.split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    await adapter.execute(stmt);
  }

  // Check version
  const rows = await adapter.query<{ version: number }>('SELECT max(version) as version FROM migration_version');
  const currentVersion = rows[0]?.version || 0;

  if (currentVersion < 1) {
    await adapter.execute('INSERT INTO migration_version (version, applied_at) VALUES (1, ?)', [Date.now()]);
    await seedStarterWorkspace(adapter);
  }
}
