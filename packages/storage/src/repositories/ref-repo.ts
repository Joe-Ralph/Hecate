/**
 * Ref Repository
 * Handles backlinks and outgoing reference queries.
 */

import { NodeRecord } from '@hecate/core';
import { StorageAdapter } from '../adapters/storage-adapter';

export class RefRepository {
  constructor(private adapter: StorageAdapter) {}

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

  async getBacklinks(nodeId: string): Promise<NodeRecord[]> {
    const rows = await this.adapter.query<any>(
      `SELECT DISTINCT n.* FROM node n
       JOIN ref r ON r.source_node_id = n.id
       WHERE r.target_node_id = ? AND n.deleted_at IS NULL
       ORDER BY n.updated_at DESC`,
      [nodeId]
    );
    return rows.map((r) => this.parseNode(r));
  }

  async getOutgoingRefs(nodeId: string): Promise<NodeRecord[]> {
    const rows = await this.adapter.query<any>(
      `SELECT DISTINCT n.* FROM node n
       JOIN ref r ON r.target_node_id = n.id
       WHERE r.source_node_id = ? AND n.deleted_at IS NULL
       ORDER BY n.content ASC`,
      [nodeId]
    );
    return rows.map((r) => this.parseNode(r));
  }
}
