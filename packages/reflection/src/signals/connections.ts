import { StorageAdapter } from '@hecate/storage';

export interface UnlinkedConnectionPair {
  nodeAId: string;
  nodeATitle: string;
  nodeBId: string;
  nodeBTitle: string;
  similarity: number;
}

function tokenize(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  return new Set(words);
}

function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * S5 Connections (Section 5)
 */
export async function findUnlinkedConnections(
  adapter: StorageAdapter,
  now: number = Date.now(),
  similarityThreshold = 0.35 // Token jaccard threshold (or 0.82 for embeddings)
): Promise<UnlinkedConnectionPair[]> {
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  // Nodes edited in the last 30 days
  const nodes = await adapter.query<{ id: string; content: string; parent_id: string | null }>(
    `SELECT id, content, parent_id FROM node
     WHERE deleted_at IS NULL AND kind != 'field' AND kind != 'workspace' AND kind != 'tagDef'
       AND updated_at >= ? AND length(content) >= 15
     ORDER BY updated_at DESC LIMIT 50`,
    [thirtyDaysAgo]
  );

  if (nodes.length < 2) return [];

  // Existing references
  const refs = await adapter.query<{ source_node_id: string; target_node_id: string }>(
    'SELECT source_node_id, target_node_id FROM ref'
  );
  const refSet = new Set<string>();
  for (const r of refs) {
    refSet.add(`${r.source_node_id}:${r.target_node_id}`);
    refSet.add(`${r.target_node_id}:${r.source_node_id}`);
  }

  const tokenSets = new Map<string, Set<string>>();
  for (const n of nodes) {
    tokenSets.set(n.id, tokenize(n.content));
  }

  const pairs: UnlinkedConnectionPair[] = [];

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];

      // Not parent-child
      if (a.parent_id === b.id || b.parent_id === a.id) continue;
      // Not already linked
      if (refSet.has(`${a.id}:${b.id}`)) continue;

      const sim = jaccardSimilarity(tokenSets.get(a.id)!, tokenSets.get(b.id)!);
      if (sim >= similarityThreshold) {
        pairs.push({
          nodeAId: a.id,
          nodeATitle: a.content.slice(0, 70),
          nodeBId: b.id,
          nodeBTitle: b.content.slice(0, 70),
          similarity: sim,
        });
      }
    }
  }

  return pairs.sort((x, y) => y.similarity - x.similarity).slice(0, 20);
}
