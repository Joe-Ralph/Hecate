import { Community, CommunityMap } from './communities';
import { GraphData, GraphLink, GraphNode, graphEdges } from './layout';
import { Point } from './physics';

export interface CommunityEdge {
  source: string;
  target: string;
  count: number;
}

export interface GraphModel {
  data: GraphData;
  communities: CommunityMap;
  nodeById: Map<string, GraphNode>;
  edges: GraphLink[];
  adjacency: Map<string, Set<string>>;
  communityById: Map<string, Community>;
  communityEdges: CommunityEdge[];
}

export function createGraphModel(data: GraphData, communities: CommunityMap): GraphModel {
  const nodeById = new Map(data.nodes.map((node) => [node.id, node]));
  const edges = graphEdges(data).filter(
    (edge) => nodeById.has(edge.source) && nodeById.has(edge.target)
  );
  const adjacency = new Map<string, Set<string>>();
  const addAdjacency = (a: string, b: string) => {
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    adjacency.get(a)!.add(b);
  };
  const aggregate = new Map<string, CommunityEdge>();
  for (const edge of edges) {
    addAdjacency(edge.source, edge.target);
    addAdjacency(edge.target, edge.source);
    const source = communities.communityOf.get(edge.source);
    const target = communities.communityOf.get(edge.target);
    if (!source || !target || source === target) continue;
    const key = source < target ? `${source}:${target}` : `${target}:${source}`;
    const existing = aggregate.get(key);
    if (existing) existing.count++;
    else aggregate.set(key, { source, target, count: 1 });
  }
  return {
    data,
    communities,
    nodeById,
    edges,
    adjacency,
    communityById: new Map(communities.communities.map((community) => [community.id, community])),
    communityEdges: [...aggregate.values()],
  };
}

export interface CommunityView {
  community: Community;
  center: Point;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

export function communityViews(model: GraphModel, positions: Map<string, Point>): Map<string, CommunityView> {
  const views = new Map<string, CommunityView>();
  for (const community of model.communities.communities) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let count = 0;
    for (const id of community.nodeIds) {
      const point = positions.get(id);
      if (!point) continue;
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
      count++;
    }
    if (count === 0) continue;
    views.set(community.id, {
      community,
      center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
      bounds: { minX, maxX, minY, maxY },
    });
  }
  return views;
}
