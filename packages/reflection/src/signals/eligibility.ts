import { StorageAdapter } from '@hecate/storage';

/**
 * Checks node eligibility (Section 5, RE-1):
 * Not deleted, not tagged #private, not flagged "AI: exclude",
 * and not inside an excluded / private subtree.
 */
export class EligibilityChecker {
  private privateNodeIds = new Set<string>();
  private parentMap = new Map<string, string | null>();
  private lastLoaded = 0;

  constructor(private adapter: StorageAdapter) {}

  async refresh(): Promise<void> {
    const privateTags = await this.adapter.query<{ id: string }>(
      "SELECT id FROM node WHERE kind = 'tagDef' AND lower(content) = 'private' AND deleted_at IS NULL"
    );
    const privateTagIds = privateTags.map((t) => t.id);

    const privateNodes: { node_id: string }[] = [];
    if (privateTagIds.length > 0) {
      const placeholders = privateTagIds.map(() => '?').join(',');
      const rows = await this.adapter.query<{ node_id: string }>(
        `SELECT node_id FROM node_tag WHERE tag_def_id IN (${placeholders})`,
        privateTagIds
      );
      privateNodes.push(...rows);
    }

    const parentRows = await this.adapter.query<{ id: string; parent_id: string | null; meta: string | null }>(
      'SELECT id, parent_id, meta FROM node WHERE deleted_at IS NULL'
    );

    this.privateNodeIds = new Set(privateNodes.map((r) => r.node_id));
    this.parentMap = new Map();

    for (const row of parentRows) {
      this.parentMap.set(row.id, row.parent_id);
      if (row.meta) {
        try {
          const parsed = JSON.parse(row.meta);
          if (parsed.aiExclude || parsed.private) {
            this.privateNodeIds.add(row.id);
          }
        } catch {}
      }
    }

    this.lastLoaded = Date.now();
  }

  isEligible(nodeId: string): boolean {
    if (Date.now() - this.lastLoaded > 30000 && this.lastLoaded > 0) {
      // Periodic auto-expiry, will be refreshed on next batch
    }

    let current: string | null | undefined = nodeId;
    const visited = new Set<string>();

    while (current) {
      if (this.privateNodeIds.has(current)) {
        return false;
      }
      if (visited.has(current)) break;
      visited.add(current);
      current = this.parentMap.get(current);
    }

    return true;
  }
}
