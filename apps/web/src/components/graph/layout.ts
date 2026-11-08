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

export interface GraphFilterOptions {
  search: string;
  activeTag: string | null;
  showOrphans: boolean;
  showHierarchy: boolean;
  localNodeId: string | null;
  localDepth: number;
  localBacklinks: boolean;
  localForelinks: boolean;
  localInterlinks: boolean;
}

export const DEFAULT_GRAPH_FILTERS: GraphFilterOptions = {
  search: '',
  activeTag: null,
  showOrphans: true,
  showHierarchy: true,
  localNodeId: null,
  localDepth: 2,
  localBacklinks: true,
  localForelinks: true,
  localInterlinks: false,
};

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

function hierarchyLinks(data: GraphData): GraphLink[] {
  const links: GraphLink[] = [];
  for (const [parent, children] of data.childrenOf) {
    if (!parent) continue;
    for (const child of children) links.push({ source: parent, target: child, kind: 'hierarchy' });
  }
  return links;
}

export function graphEdges(data: GraphData, includeHierarchy = true): GraphLink[] {
  return includeHierarchy ? [...data.links, ...hierarchyLinks(data)] : [...data.links];
}

function linkKey(link: GraphLink): string {
  return `${link.kind}:${link.source}:${link.target}`;
}

export function filterGraphData(data: GraphData, options: GraphFilterOptions): GraphData {
  const query = options.search.trim().toLowerCase();
  const baseIds = new Set(
    data.nodes
      .filter((node) => {
        if (query && !node.title.toLowerCase().includes(query)) return false;
        if (options.activeTag && !node.tagNames.includes(options.activeTag)) return false;
        return true;
      })
      .map((node) => node.id)
  );
  if (options.localNodeId && data.nodes.some((node) => node.id === options.localNodeId)) {
    baseIds.add(options.localNodeId);
  }

  let visibleIds = baseIds;
  let traversalEdges: Set<string> | null = null;
  if (options.localNodeId && baseIds.has(options.localNodeId)) {
    visibleIds = new Set([options.localNodeId]);
    traversalEdges = new Set();
    let frontier = [options.localNodeId];
    const adjacency = new Map<string, Array<{ id: string; key: string }>>();
    const add = (from: string, to: string, key: string) => {
      if (!baseIds.has(from) || !baseIds.has(to)) return;
      if (!adjacency.has(from)) adjacency.set(from, []);
      adjacency.get(from)!.push({ id: to, key });
    };
    for (const link of data.links) {
      const key = linkKey(link);
      if (options.localForelinks) add(link.source, link.target, key);
      if (options.localBacklinks) add(link.target, link.source, key);
    }
    if (options.showHierarchy) {
      for (const link of hierarchyLinks(data)) {
        const key = linkKey(link);
        add(link.source, link.target, key);
        add(link.target, link.source, key);
      }
    }
    for (let depth = 0; depth < Math.max(1, Math.min(5, options.localDepth)); depth++) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const neighbor of adjacency.get(id) || []) {
          if (visibleIds.has(neighbor.id)) continue;
          visibleIds.add(neighbor.id);
          traversalEdges.add(neighbor.key);
          next.push(neighbor.id);
        }
      }
      frontier = next;
      if (frontier.length === 0) break;
    }
  }

  const keepEdge = (link: GraphLink) => {
    if (!visibleIds.has(link.source) || !visibleIds.has(link.target)) return false;
    return !traversalEdges || options.localInterlinks || traversalEdges.has(linkKey(link));
  };
  const links = data.links.filter(keepEdge);
  const childrenOf = new Map<string | null, string[]>();
  for (const node of data.nodes) {
    if (!visibleIds.has(node.id)) continue;
    if (!childrenOf.has(null)) childrenOf.set(null, []);
    childrenOf.get(null)!.push(node.id);
  }
  if (options.showHierarchy) {
    for (const [parent, children] of data.childrenOf) {
      if (!parent) continue;
      for (const child of children) {
        const link = { source: parent, target: child, kind: 'hierarchy' as const };
        if (!keepEdge(link)) continue;
        if (!childrenOf.has(parent)) childrenOf.set(parent, []);
        childrenOf.get(parent)!.push(child);
        const roots = childrenOf.get(null);
        if (roots) childrenOf.set(null, roots.filter((id) => id !== child));
      }
    }
  }

  if (!options.showOrphans) {
    const connected = new Set<string>();
    for (const link of graphEdges({ nodes: [], links, childrenOf }, options.showHierarchy)) {
      if (link.source !== link.target) {
        connected.add(link.source);
        connected.add(link.target);
      }
    }
    for (const id of [...visibleIds]) {
      if (!connected.has(id)) visibleIds.delete(id);
    }
    return pruneToIds(data, visibleIds, links, childrenOf);
  }

  return pruneToIds(data, visibleIds, links, childrenOf);
}

function pruneToIds(
  data: GraphData,
  visibleIds: Set<string>,
  links: GraphLink[],
  childrenOf: Map<string | null, string[]>
): GraphData {
  const degree = new Map<string, number>();
  for (const link of links) {
    degree.set(link.source, (degree.get(link.source) || 0) + 1);
    degree.set(link.target, (degree.get(link.target) || 0) + 1);
  }
  const nodes = data.nodes
    .filter((node) => visibleIds.has(node.id))
    .map((node) => ({ ...node, degree: degree.get(node.id) || 0 }));
  const prunedChildren = new Map<string | null, string[]>();
  for (const [parent, children] of childrenOf) {
    const visibleChildren = children.filter((id) => visibleIds.has(id));
    if (visibleChildren.length > 0 || parent === null) prunedChildren.set(parent, visibleChildren);
  }
  return {
    nodes,
    links: links.filter((link) => visibleIds.has(link.source) && visibleIds.has(link.target)),
    childrenOf: prunedChildren,
  };
}

export function neighborhood(data: GraphData, startId: string, hops: number): Set<string> {
  const adj = new Map<string, Set<string>>();
  const add = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  };
  for (const l of graphEdges(data)) add(l.source, l.target);

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
