/**
 * Search Repository
 * Executes live queries and global full-text search.
 */

import { NodeRecord, SearchQuery, compileQueryToSql } from '@hecate/core';
import { StorageAdapter } from '../adapters/storage-adapter';
import { TagRepository } from './tag-repo';

export class SearchRepository {
  constructor(
    private adapter: StorageAdapter,
    private tagRepo: TagRepository
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

  async executeSearch(query: SearchQuery, contextNodeId?: string): Promise<NodeRecord[]> {
    const allTags = await this.tagRepo.getAllTags();
    const tagChildrenMap = new Map<string, string[]>();

    for (const t of allTags) {
      const extendsList: string[] = (t.meta as any)?.extends || [];
      for (const parentId of extendsList) {
        if (!tagChildrenMap.has(parentId)) {
          tagChildrenMap.set(parentId, []);
        }
        tagChildrenMap.get(parentId)!.push(t.id);
      }
    }

    const getTagDescendants = (tagId: string): string[] => {
      const descendants: string[] = [];
      const queue = [tagId];
      const visited = new Set<string>();
      while (queue.length > 0) {
        const cur = queue.shift()!;
        if (visited.has(cur)) continue;
        visited.add(cur);
        const children = tagChildrenMap.get(cur) || [];
        for (const child of children) {
          descendants.push(child);
          queue.push(child);
        }
      }
      return descendants;
    };

    const compiled = compileQueryToSql(query, {
      contextNodeId,
      getTagDescendants,
    });

    const rows = await this.adapter.query<any>(compiled.sql, compiled.params);
    return rows.map((r) => this.parseNode(r));
  }

  async globalSearch(searchTerm: string): Promise<NodeRecord[]> {
    const term = searchTerm.trim();
    if (!term) return [];

    const rows = await this.adapter.query<any>(
      `SELECT * FROM node
       WHERE deleted_at IS NULL AND (content LIKE ? OR kind LIKE ?)
       ORDER BY updated_at DESC
       LIMIT 50`,
      [`%${term}%`, `%${term}%`]
    );
    return rows.map((r) => this.parseNode(r));
  }
}
