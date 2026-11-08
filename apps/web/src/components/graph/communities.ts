/**
 * Graph-based community detection (label propagation).
 * Communities emerge from real relationships (references + hierarchy),
 * never from a fixed geometric arrangement.
 */

import { GraphData } from './layout';

export interface Community {
  id: string;
  nodeIds: string[];
  label: string;
}

export interface CommunityMap {
  communityOf: Map<string, string>;
  communities: Community[];
}

export function detectCommunities(data: GraphData): CommunityMap {
  const ids = data.nodes.map((n) => n.id).sort();

  const adj = new Map<string, string[]>();
  const add = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push(b);
    adj.get(b)!.push(a);
  };
  for (const l of data.links) add(l.source, l.target);
  for (const [parent, children] of data.childrenOf) {
    if (!parent) continue;
    for (const c of children) add(parent, c);
  }

  // Each node starts in its own community; labels propagate to the
  // majority-neighbor label (ties broken deterministically by label id).
  let labels = new Map<string, string>(ids.map((id) => [id, id]));
  for (let iter = 0; iter < 12; iter++) {
    const next = new Map<string, string>();
    let changed = false;
    for (const id of ids) {
      const neighbors = adj.get(id) || [];
      if (neighbors.length === 0) {
        next.set(id, labels.get(id)!);
        continue;
      }
      const counts = new Map<string, number>();
      for (const n of neighbors) {
        const l = labels.get(n)!;
        counts.set(l, (counts.get(l) || 0) + 1);
      }
      let best = labels.get(id)!;
      let bestCount = -1;
      for (const [l, c] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        if (c > bestCount) {
          best = l;
          bestCount = c;
        }
      }
      next.set(id, best);
      if (best !== labels.get(id)) changed = true;
    }
    labels = next;
    if (!changed) break;
  }

  const groups = new Map<string, string[]>();
  for (const id of ids) {
    const l = labels.get(id)!;
    if (!groups.has(l)) groups.set(l, []);
    groups.get(l)!.push(id);
  }

  const nodeById = new Map(data.nodes.map((n) => [n.id, n]));
  const communities: Community[] = [...groups.entries()].map(([id, nodeIds]) => {
    // Label: majority supertag in the community, else its highest-degree hub
    const tagCounts = new Map<string, number>();
    for (const nid of nodeIds) {
      for (const t of nodeById.get(nid)?.tagNames || []) {
        tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
      }
    }
    const topTag = [...tagCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const topHub = nodeIds
      .map((nid) => nodeById.get(nid)!)
      .sort((a, b) => b.degree - a.degree)[0];
    return {
      id,
      nodeIds,
      label: topTag ? `#${topTag}` : topHub?.title.slice(0, 24) || 'cluster',
    };
  });

  communities.sort((a, b) => b.nodeIds.length - a.nodeIds.length);

  const communityOf = new Map<string, string>();
  for (const c of communities) {
    for (const nid of c.nodeIds) communityOf.set(nid, c.id);
  }

  return { communityOf, communities };
}
