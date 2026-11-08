/**
 * Graph data assembly and neighborhood queries.
 * Layout lives in physics.ts, communities in communities.ts, drawing in renderer.ts.
 */

import { HecateDatabase } from '@hecate/storage';

export interface GraphNode {
  id: string;
  title: string;
  kind: string;
  tagIds: string[];
  tagNames: string[];
  hasChildren: boolean;
  degree: number;
}

export interface GraphLink {
  source: string;
  target: string;
  kind: 'reference' | 'hierarchy';
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  childrenOf: Map<string | null, string[]>;
}

export async function buildGraphData(db: HecateDatabase): Promise<GraphData> {
  const rows = await db.adapter.query<any>(
    `SELECT id, parent_id, kind, content FROM node
     WHERE deleted_at IS NULL AND kind IN ('content', 'day', 'search')`
  );
  const tagRows = await db.adapter.query<any>(
    `SELECT nt.node_id, nt.tag_def_id, t.content AS tag_name FROM node_tag nt
     JOIN node t ON t.id = nt.tag_def_id`
  );
  const refRows = await db.adapter.query<any>(
    'SELECT source_node_id, target_node_id FROM ref'
  );

  const idSet = new Set(rows.map((r: any) => r.id));
  const tagsByNode = new Map<string, { ids: string[]; names: string[] }>();
  for (const t of tagRows) {
    if (!tagsByNode.has(t.node_id)) tagsByNode.set(t.node_id, { ids: [], names: [] });
    tagsByNode.get(t.node_id)!.ids.push(t.tag_def_id);
    tagsByNode.get(t.node_id)!.names.push(t.tag_name);
  }

  const childrenOf = new Map<string | null, string[]>();
  for (const r of rows) {
    const pid = r.parent_id && idSet.has(r.parent_id) ? r.parent_id : null;
    if (!childrenOf.has(pid)) childrenOf.set(pid, []);
    childrenOf.get(pid)!.push(r.id);
  }

  const degree = new Map<string, number>();
  const links: GraphLink[] = [];
  for (const r of refRows) {
    if (!idSet.has(r.source_node_id) || !idSet.has(r.target_node_id)) continue;
    links.push({ source: r.source_node_id, target: r.target_node_id, kind: 'reference' });
    degree.set(r.source_node_id, (degree.get(r.source_node_id) || 0) + 1);
    degree.set(r.target_node_id, (degree.get(r.target_node_id) || 0) + 1);
  }

  const nodes: GraphNode[] = rows.map((r: any) => ({
    id: r.id,
    title: r.content || 'Untitled',
    kind: r.kind,
    tagIds: tagsByNode.get(r.id)?.ids || [],
    tagNames: tagsByNode.get(r.id)?.names || [],
    hasChildren: (childrenOf.get(r.id) || []).length > 0,
    degree: degree.get(r.id) || 0,
  }));

  return { nodes, links, childrenOf };
}

/** All node ids within `hops` of `startId` (references + hierarchy). */
export function neighborhood(data: GraphData, startId: string, hops: number): Set<string> {
  const adj = new Map<string, Set<string>>();
  const add = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  };
  for (const l of data.links) add(l.source, l.target);
  for (const [parent, children] of data.childrenOf) {
    if (!parent) continue;
    for (const c of children) add(parent, c);
  }

  const visited = new Set<string>([startId]);
  let frontier = [startId];
  for (let i = 0; i < hops; i++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const n of adj.get(id) || []) {
        if (!visited.has(n)) {
          visited.add(n);
          next.push(n);
        }
      }
    }
    frontier = next;
  }
  return visited;
}
