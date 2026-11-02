/**
 * Tag Repository
 * Manages supertag definitions, multi-tag associations, and template injection.
 */

import {
  NodeRecord,
  TagDefMeta,
  ulid,
  planTagTemplateInjection,
  wouldCauseTagCycle,
  generateNKeysBetween,
} from '@hecate/core';
import { StorageAdapter } from '../adapters/storage-adapter';
import { NodeRepository } from './node-repo';

export class TagRepository {
  constructor(
    private adapter: StorageAdapter,
    private nodeRepo: NodeRepository
  ) {}

  private parseNode(row: any): NodeRecord {
    return {
      id: row.id,
      parent_id: row.parent_id,
      position: row.position,
      kind: row.kind,
      content: row.content || '',
      collapsed: Number(row.collapsed || 0),
      done_at: row.done_at ? Number(row.done_at) : null,
      created_at: Number(row.created_at),
      updated_at: Number(row.updated_at),
      deleted_at: row.deleted_at ? Number(row.deleted_at) : null,
      meta: row.meta ? JSON.parse(row.meta) : null,
    };
  }

  async getTag(id: string): Promise<NodeRecord | null> {
    const rows = await this.adapter.query<any>(
      "SELECT * FROM node WHERE id = ? AND kind = 'tagDef' AND deleted_at IS NULL",
      [id]
    );
    return rows.length > 0 ? this.parseNode(rows[0]) : null;
  }

  async getTagByName(name: string): Promise<NodeRecord | null> {
    const clean = name.trim().replace(/^#/, '');
    const rows = await this.adapter.query<any>(
      "SELECT * FROM node WHERE content = ? AND kind = 'tagDef' AND deleted_at IS NULL",
      [clean]
    );
    return rows.length > 0 ? this.parseNode(rows[0]) : null;
  }

  async getAllTags(): Promise<NodeRecord[]> {
    const rows = await this.adapter.query<any>(
      "SELECT * FROM node WHERE kind = 'tagDef' AND deleted_at IS NULL ORDER BY content ASC"
    );
    return rows.map((r) => this.parseNode(r));
  }

  async createTag(name: string, meta: Partial<TagDefMeta> = {}): Promise<NodeRecord> {
    const existing = await this.getTagByName(name);
    if (existing) return existing;

    const fullMeta: TagDefMeta = {
      color: meta.color || '#888888',
      extends: meta.extends || [],
      icon: meta.icon,
      fieldDefs: meta.fieldDefs || [],
      defaultContent: meta.defaultContent || [],
      showCheckbox: meta.showCheckbox ?? false,
      buildTitle: meta.buildTitle,
      aiExclude: meta.aiExclude ?? false,
    };

    return this.nodeRepo.create({
      kind: 'tagDef',
      content: name.trim().replace(/^#/, ''),
      meta: fullMeta,
    });
  }

  async updateTagDef(id: string, meta: Partial<TagDefMeta>): Promise<void> {
    const tag = await this.getTag(id);
    if (!tag) throw new Error(`Tag ${id} not found`);

    const currentMeta: TagDefMeta = tag.meta as TagDefMeta;
    const newExtends = meta.extends ?? currentMeta.extends ?? [];

    // Cycle check
    const allTags = await this.getAllTags();
    const tagMap = new Map<string, TagDefMeta>();
    for (const t of allTags) {
      tagMap.set(t.id, t.meta as TagDefMeta);
    }

    if (wouldCauseTagCycle(id, newExtends, (tid) => tagMap.get(tid)?.extends || [])) {
      throw new Error(`Circular inheritance detected: tag ${id} cannot extend cycle`);
    }

    const merged = { ...currentMeta, ...meta };
    const now = Date.now();
    await this.adapter.execute(
      'UPDATE node SET meta = ?, updated_at = ? WHERE id = ?',
      [JSON.stringify(merged), now, id]
    );
  }

  async applyTag(nodeId: string, tagDefId: string): Promise<void> {
    // 1. Associate in node_tag
    await this.adapter.execute(
      'INSERT OR IGNORE INTO node_tag (node_id, tag_def_id) VALUES (?, ?)',
      [nodeId, tagDefId]
    );

    // 2. Fetch all tag definitions for inheritance resolution
    const allTags = await this.getAllTags();
    const tagMap = new Map<string, TagDefMeta>();
    for (const t of allTags) {
      tagMap.set(t.id, t.meta as TagDefMeta);
    }

    // 3. Find existing fields on this node
    const existingFieldNodes = await this.adapter.query<any>(
      "SELECT meta FROM node WHERE parent_id = ? AND kind = 'field' AND deleted_at IS NULL",
      [nodeId]
    );
    const existingFieldDefIds: string[] = [];
    for (const row of existingFieldNodes) {
      if (row.meta) {
        try {
          const parsed = JSON.parse(row.meta);
          if (parsed.fieldDefId) existingFieldDefIds.push(parsed.fieldDefId);
        } catch {}
      }
    }

    // Helper for autoInit lookup
    const allFieldDefs = await this.adapter.query<any>(
      "SELECT id, meta FROM node WHERE kind = 'fieldDef' AND deleted_at IS NULL"
    );
    const fieldDefMap = new Map<string, any>();
    for (const f of allFieldDefs) {
      try {
        fieldDefMap.set(f.id, JSON.parse(f.meta));
      } catch {}
    }

    // 4. Plan template injection
    const plan = planTagTemplateInjection(
      tagDefId,
      (id) => tagMap.get(id),
      existingFieldDefIds,
      Date.now(),
      (fid) => fieldDefMap.get(fid)
    );

    // 5. Inject fields
    const now = Date.now();
    const fieldPositions = generateNKeysBetween(null, null, plan.fieldsToInject.length);
    for (let i = 0; i < plan.fieldsToInject.length; i++) {
      const f = plan.fieldsToInject[i];
      // Create field node
      const fieldNode = await this.nodeRepo.create({
        parent_id: nodeId,
        kind: 'field',
        position: fieldPositions[i],
        meta: { fieldDefId: f.fieldDefId, pinned: f.pinned },
      });

      // Create fieldValue child node
      await this.nodeRepo.create({
        parent_id: fieldNode.id,
        kind: 'fieldValue',
        content: String(f.initialValue || ''),
        position: 'a0',
      });
    }

    // 6. Inject default content if any
    if (plan.contentToInject.length > 0) {
      const contentPositions = generateNKeysBetween(null, null, plan.contentToInject.length);
      for (let i = 0; i < plan.contentToInject.length; i++) {
        const item = plan.contentToInject[i];
        await this.nodeRepo.create({
          parent_id: nodeId,
          kind: item.kind,
          content: item.content,
          position: contentPositions[i],
        });
      }
    }

    // 7. Touch parent node updated_at
    await this.adapter.execute('UPDATE node SET updated_at = ? WHERE id = ?', [now, nodeId]);
  }

  async removeTag(nodeId: string, tagDefId: string): Promise<void> {
    await this.adapter.execute(
      'DELETE FROM node_tag WHERE node_id = ? AND tag_def_id = ?',
      [nodeId, tagDefId]
    );
    await this.adapter.execute('UPDATE node SET updated_at = ? WHERE id = ?', [Date.now(), nodeId]);
  }

  async getTagsForNode(nodeId: string): Promise<NodeRecord[]> {
    const rows = await this.adapter.query<any>(
      `SELECT n.* FROM node n
       JOIN node_tag nt ON nt.tag_def_id = n.id
       WHERE nt.node_id = ? AND n.deleted_at IS NULL
       ORDER BY n.content ASC`,
      [nodeId]
    );
    return rows.map((r) => this.parseNode(r));
  }

  async getNodesWithTag(tagDefId: string): Promise<NodeRecord[]> {
    const rows = await this.adapter.query<any>(
      `SELECT n.* FROM node n
       JOIN node_tag nt ON nt.node_id = n.id
       WHERE nt.tag_def_id = ? AND n.deleted_at IS NULL
       ORDER BY n.position ASC`,
      [tagDefId]
    );
    return rows.map((r) => this.parseNode(r));
  }
}
