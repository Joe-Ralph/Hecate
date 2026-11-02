/**
 * Hecate Starter Tags & Fields Seeds
 * Initialized on first run per REQ-3.7.
 */

import { ulid } from '@hecate/core';
import { StorageAdapter } from './adapters/storage-adapter';

export async function seedStarterWorkspace(adapter: StorageAdapter): Promise<void> {
  const existing = await adapter.query('SELECT count(*) as count FROM node WHERE kind = ?', ['tagDef']);
  if (existing[0]?.count > 0) {
    return; // Already seeded
  }

  const now = Date.now();

  // Root workspace node
  const rootId = ulid(now);
  await adapter.execute(
    `INSERT INTO node (id, parent_id, position, kind, content, collapsed, done_at, created_at, updated_at, meta)
     VALUES (?, NULL, 'a0', 'workspace', 'Hecate Workspace', 0, NULL, ?, ?, NULL)`,
    [rootId, now, now]
  );

  // Helper to create fieldDef
  async function createFieldDef(name: string, meta: any): Promise<string> {
    const id = ulid(now);
    await adapter.execute(
      `INSERT INTO node (id, parent_id, position, kind, content, collapsed, done_at, created_at, updated_at, meta)
       VALUES (?, NULL, 'a0', 'fieldDef', ?, 0, NULL, ?, ?, ?)`,
      [id, name, now, now, JSON.stringify(meta)]
    );
    return id;
  }

  // Field definitions
  const statusFieldId = await createFieldDef('Status', {
    type: 'options',
    options: [
      { id: 'inbox', label: 'Inbox', color: '#888888' },
      { id: 'doing', label: 'Doing', color: '#3b82f6' },
      { id: 'done', label: 'Done', color: '#22c55e' },
    ],
    defaultValue: 'Inbox',
    autoInit: 'default',
  });

  const dueDateFieldId = await createFieldDef('Due', {
    type: 'date',
    autoInit: 'none',
  });

  const priorityFieldId = await createFieldDef('Priority', {
    type: 'options',
    options: [
      { id: 'high', label: 'High', color: '#ef4444' },
      { id: 'medium', label: 'Medium', color: '#eab308' },
      { id: 'low', label: 'Low', color: '#888888' },
    ],
  });

  const authorFieldId = await createFieldDef('Author', {
    type: 'text',
  });

  const bookStatusFieldId = await createFieldDef('Status', {
    type: 'options',
    options: [
      { id: 'want_to_read', label: 'Want to Read', color: '#888888' },
      { id: 'reading', label: 'Reading', color: '#3b82f6' },
      { id: 'completed', label: 'Completed', color: '#22c55e' },
    ],
    defaultValue: 'Want to Read',
    autoInit: 'default',
  });

  const ratingFieldId = await createFieldDef('Rating', {
    type: 'number',
    min: 1,
    max: 5,
  });

  const dateFieldId = await createFieldDef('Date', {
    type: 'date',
    autoInit: 'today',
  });

  // Helper to create tagDef
  async function createTagDef(name: string, meta: any): Promise<string> {
    const id = ulid(now);
    await adapter.execute(
      `INSERT INTO node (id, parent_id, position, kind, content, collapsed, done_at, created_at, updated_at, meta)
       VALUES (?, NULL, 'a0', 'tagDef', ?, 0, NULL, ?, ?, ?)`,
      [id, name, now, now, JSON.stringify(meta)]
    );
    return id;
  }

  const personTagId = await createTagDef('person', {
    color: '#3b82f6',
    extends: [],
    fieldDefs: [],
    showCheckbox: false,
  });

  const attendeesFieldId = await createFieldDef('Attendees', {
    type: 'nodeRef',
    targetTag: personTagId,
    multi: true,
  });

  await createTagDef('task', {
    color: '#22c55e',
    extends: [],
    fieldDefs: [
      { fieldDefId: statusFieldId, default: 'Inbox', pinned: true, required: true },
      { fieldDefId: dueDateFieldId, pinned: true },
      { fieldDefId: priorityFieldId, pinned: false },
    ],
    showCheckbox: true,
  });

  await createTagDef('project', {
    color: '#a855f7',
    extends: [],
    fieldDefs: [{ fieldDefId: statusFieldId, default: 'Doing', pinned: true }],
    showCheckbox: false,
  });

  await createTagDef('meeting', {
    color: '#eab308',
    extends: [],
    fieldDefs: [
      { fieldDefId: dateFieldId, pinned: true },
      { fieldDefId: attendeesFieldId, pinned: true },
    ],
    showCheckbox: false,
  });

  await createTagDef('book', {
    color: '#f97316',
    extends: [],
    fieldDefs: [
      { fieldDefId: authorFieldId, pinned: true },
      { fieldDefId: bookStatusFieldId, default: 'Want to Read', pinned: true },
      { fieldDefId: ratingFieldId, pinned: false },
    ],
    showCheckbox: false,
  });

  await createTagDef('idea', {
    color: '#eab308',
    extends: [],
    fieldDefs: [],
    showCheckbox: false,
  });

  await createTagDef('habit', {
    color: '#22c55e',
    extends: [],
    fieldDefs: [],
    showCheckbox: true,
  });

  await createTagDef('goal', {
    color: '#ef4444',
    extends: [],
    fieldDefs: [],
    showCheckbox: false,
  });

  await createTagDef('private', {
    color: '#888888',
    extends: [],
    fieldDefs: [],
    showCheckbox: false,
    aiExclude: true,
  });

  // Initialize default settings
  await adapter.execute(
    `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`,
    [
      'general',
      JSON.stringify({
        theme: 'dark',
        aiEnabled: false,
        aiProvider: 'mock',
        aiWindowDays: 7,
        aiMaxTasks: 4,
      }),
    ]
  );
}
