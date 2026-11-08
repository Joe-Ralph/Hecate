import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceX,
  forceY,
  forceCollide,
  Simulation,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from 'd3-force';
import { GraphData, GraphLink, graphEdges } from './layout';
import { CommunityMap } from './communities';

export interface GraphForceSettings {
  repulsion: number;
  linkDistance: number;
  linkStrength: number;
  collisionPadding: number;
  communityAttraction: number;
  communitySeparation: number;
  centerGravity: number;
}

export const DEFAULT_GRAPH_FORCES: GraphForceSettings = {
  repulsion: -65,
  linkDistance: 55,
  linkStrength: 0.12,
  collisionPadding: 8,
  communityAttraction: 0.025,
  communitySeparation: 0.08,
  centerGravity: 0.008,
};

export const TUNING = {
  ...DEFAULT_GRAPH_FORCES,
  velocityDecay: 0.4,
  settleAlpha: 0.005,
};

interface SimNode extends SimulationNodeDatum {
  id: string;
  community: string;
  radius: number;
}

export interface SimNodeState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number | null;
  fy: number | null;
}

export interface Point {
  x: number;
  y: number;
}

export function nodeRadius(degree: number): number {
  return Math.min(9, 2 + Math.log1p(degree) * 1.6);
}

function idNoise(id: string, salt: number): number {
  let hash = salt;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return hash / 4294967295;
}

export class ForceEngine {
  private sim: Simulation<SimNode, SimulationLinkDatum<SimNode>>;
  private centers = new Map<string, Point>();
  private members = new Map<string, SimNode[]>();
  private tuning: typeof TUNING;
  positions = new Map<string, Point>();

  constructor(
    data: GraphData,
    communityMap: CommunityMap,
    previousState?: Map<string, SimNodeState>,
    forces: Partial<GraphForceSettings> = {}
  ) {
    this.tuning = { ...TUNING, ...forces };
    const { communityOf } = communityMap;
    const edges = graphEdges(data);
    const adjacency = new Map<string, string[]>();
    for (const edge of edges) {
      if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
      if (!adjacency.has(edge.target)) adjacency.set(edge.target, []);
      adjacency.get(edge.source)!.push(edge.target);
      adjacency.get(edge.target)!.push(edge.source);
    }
    const placed = previousState ? [...previousState.values()] : [];
    const maxR = placed.reduce((max, point) => Math.max(max, Math.hypot(point.x, point.y)), 0);

    const nodes: SimNode[] = data.nodes.map((node) => {
      const previous = previousState?.get(node.id);
      if (previous) return { ...previous, id: node.id, community: communityOf.get(node.id) || node.id, radius: nodeRadius(node.degree) };
      const seeded: Partial<SimNode> = {};
      if (previousState && previousState.size > 0) {
        const neighbors = (adjacency.get(node.id) || [])
          .map((id) => previousState.get(id))
          .filter((point): point is SimNodeState => Boolean(point));
        const angle = idNoise(node.id, 17) * Math.PI * 2;
        const jitter = 8 + Math.sqrt(data.nodes.length) * 2;
        if (neighbors.length > 0) {
          seeded.x = neighbors.reduce((sum, point) => sum + point.x, 0) / neighbors.length + Math.cos(angle) * jitter;
          seeded.y = neighbors.reduce((sum, point) => sum + point.y, 0) / neighbors.length + Math.sin(angle) * jitter;
        } else {
          const radius = maxR + 30 + idNoise(node.id, 41) * jitter;
          seeded.x = Math.cos(angle) * radius;
          seeded.y = Math.sin(angle) * radius;
        }
      }
      return {
        ...seeded,
        id: node.id,
        community: communityOf.get(node.id) || node.id,
        radius: nodeRadius(node.degree),
      };
    });

    const links = data.links.map((l: GraphLink) => ({ source: l.source, target: l.target }));
    for (const n of nodes) {
      if (!this.members.has(n.community)) this.members.set(n.community, []);
      this.members.get(n.community)!.push(n);
    }

    const centerOf = (id: string): Point => this.centers.get(id) || { x: 0, y: 0 };
    const separation = (alpha: number) => {
      const communities = [...this.members.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 30);
      for (let i = 0; i < communities.length; i++) {
        for (let j = i + 1; j < communities.length; j++) {
          const [idA, nodesA] = communities[i];
          const [idB, nodesB] = communities[j];
          const ca = centerOf(idA);
          const cb = centerOf(idB);
          let dx = ca.x - cb.x;
          let dy = ca.y - cb.y;
          let dist = Math.hypot(dx, dy);
          if (dist < 1) {
            dx = 0.5;
            dy = 0.5;
            dist = Math.SQRT1_2;
          }
          const strength = (this.tuning.communitySeparation * alpha * alpha) / (dist * dist);
          const fx = (dx / dist) * strength;
          const fy = (dy / dist) * strength;
          for (const n of nodesA) {
            n.vx = (n.vx || 0) + fx;
            n.vy = (n.vy || 0) + fy;
          }
          for (const n of nodesB) {
            n.vx = (n.vx || 0) - fx;
            n.vy = (n.vy || 0) - fy;
          }
        }
      }
    };

    this.sim = forceSimulation<SimNode>(nodes)
      .force(
        'link',
        forceLink<SimNode, SimulationLinkDatum<SimNode>>(links)
          .id((d) => d.id)
          .distance(this.tuning.linkDistance)
          .strength(this.tuning.linkStrength)
      )
      .force('charge', forceManyBody().strength(this.tuning.repulsion))
      .force('collide', forceCollide<SimNode>((d) => d.radius + this.tuning.collisionPadding))
      .force('clusterX', forceX<SimNode>((d) => centerOf(d.community).x).strength(this.tuning.communityAttraction))
      .force('clusterY', forceY<SimNode>((d) => centerOf(d.community).y).strength(this.tuning.communityAttraction))
      .force('separation', separation)
      .force('centerX', forceX(0).strength(this.tuning.centerGravity))
      .force('centerY', forceY(0).strength(this.tuning.centerGravity))
      .velocityDecay(this.tuning.velocityDecay)
      .stop();

    this.syncPositions(nodes);
    this.updateCenters();
  }

  private syncPositions(nodes: SimNode[]) {
    this.positions.clear();
    for (const n of nodes) {
      this.positions.set(n.id, { x: n.x || 0, y: n.y || 0 });
    }
  }

  private updateCenters() {
    for (const [id, members] of this.members) {
      let sx = 0;
      let sy = 0;
      for (const m of members) {
        sx += m.x || 0;
        sy += m.y || 0;
      }
      this.centers.set(id, { x: sx / members.length, y: sy / members.length });
    }
  }

  snapshotState(): Map<string, SimNodeState> {
    return new Map(
      this.sim.nodes().map((node) => [
        node.id,
        {
          x: node.x || 0,
          y: node.y || 0,
          vx: node.vx || 0,
          vy: node.vy || 0,
          fx: node.fx ?? null,
          fy: node.fy ?? null,
        },
      ])
    );
  }

  tick(): boolean {
    this.sim.tick();
    this.syncPositions(this.sim.nodes());
    this.updateCenters();
    return this.sim.alpha() > this.tuning.settleAlpha;
  }

  reheat(alpha = 0.3) {
    this.sim.alpha(Math.max(this.sim.alpha(), alpha));
  }

  get alpha(): number {
    return this.sim.alpha();
  }

  setFixed(id: string, x: number, y: number) {
    const node = this.sim.nodes().find((n) => n.id === id);
    if (node) {
      node.fx = x;
      node.fy = y;
      this.positions.set(id, { x, y });
    }
  }

  clearFixed(id: string) {
    const node = this.sim.nodes().find((n) => n.id === id);
    if (node) {
      node.fx = null;
      node.fy = null;
    }
  }

  getCenter(communityId: string): Point {
    return this.centers.get(communityId) || { x: 0, y: 0 };
  }

  bounds(): { minX: number; maxX: number; minY: number; maxY: number } {
    if (this.positions.size === 0) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const point of this.positions.values()) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
    return { minX, maxX, minY, maxY };
  }
}
