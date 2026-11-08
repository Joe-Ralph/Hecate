/**
 * Multi-scale force engine.
 * F = local link attraction + community attraction + global centering,
 * plus many-body repulsion, collision, and community separation.
 *
 * The simulation is never run continuously: tick() until settled, then stop.
 * reheat() wakes it for drags, filter changes, or new relationships.
 */

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
import { GraphData, GraphLink } from './layout';
import { CommunityMap } from './communities';

export const TUNING = {
  repulsion: -65,
  linkDistance: 55,
  linkStrength: 0.12,
  collisionPadding: 8,
  communityAttraction: 0.025,
  communitySeparation: 0.08,
  centerGravity: 0.008,
  velocityDecay: 0.4,
  settleAlpha: 0.005,
};

interface SimNode extends SimulationNodeDatum {
  id: string;
  community: string;
  radius: number;
}

export interface Point {
  x: number;
  y: number;
}

export function nodeRadius(degree: number): number {
  // Logarithmic scale: 2–3px peripheral, 3–5px regular, 6–9px hubs
  return Math.min(9, 2 + Math.log1p(degree) * 1.6);
}

export class ForceEngine {
  private sim: Simulation<SimNode, SimulationLinkDatum<SimNode>>;
  private centers = new Map<string, Point>();
  private members = new Map<string, SimNode[]>();
  positions = new Map<string, Point>();

  constructor(data: GraphData, communityMap: CommunityMap) {
    const { communityOf } = communityMap;

    const nodes: SimNode[] = data.nodes.map((n) => ({
      id: n.id,
      community: communityOf.get(n.id) || n.id,
      radius: nodeRadius(n.degree),
    }));

    const links = data.links.map((l: GraphLink) => ({
      source: l.source,
      target: l.target,
    }));

    for (const n of nodes) {
      if (!this.members.has(n.community)) this.members.set(n.community, []);
      this.members.get(n.community)!.push(n);
    }

    const centerOf = (id: string): Point => this.centers.get(id) || { x: 0, y: 0 };

    // Community separation: centers of different communities repel each other,
    // pushing their members apart along the center-to-center axis.
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
          const strength =
            (TUNING.communitySeparation * alpha * alpha) / (dist * dist);
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
          .distance(TUNING.linkDistance)
          .strength(TUNING.linkStrength)
      )
      .force('charge', forceManyBody().strength(TUNING.repulsion))
      .force('collide', forceCollide<SimNode>((d) => d.radius + TUNING.collisionPadding))
      .force('clusterX', forceX<SimNode>((d) => centerOf(d.community).x).strength(TUNING.communityAttraction))
      .force('clusterY', forceY<SimNode>((d) => centerOf(d.community).y).strength(TUNING.communityAttraction))
      .force('separation', separation)
      .force('centerX', forceX(0).strength(TUNING.centerGravity))
      .force('centerY', forceY(0).strength(TUNING.centerGravity))
      .velocityDecay(TUNING.velocityDecay)
      .stop();

    this.syncPositions(nodes);
    this.updateCenters();
  }

  private syncPositions(nodes: SimNode[]) {
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

  /** Advance one tick. Returns true while the simulation is still hot. */
  tick(): boolean {
    this.sim.tick();
    this.syncPositions(this.sim.nodes());
    this.updateCenters();
    return this.sim.alpha() > TUNING.settleAlpha;
  }

  reheat(alpha = 0.3) {
    this.sim.alpha(alpha);
  }

  get alpha(): number {
    return this.sim.alpha();
  }

  setFixed(id: string, x: number, y: number) {
    const node = this.sim.nodes().find((n) => n.id === id);
    if (node) {
      node.fx = x;
      node.fy = y;
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

  /** Bounding box of all positions (for fit-to-view). */
  bounds(): { minX: number; maxX: number; minY: number; maxY: number } {
    const pts = [...this.positions.values()];
    if (pts.length === 0) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
    return {
      minX: Math.min(...pts.map((p) => p.x)),
      maxX: Math.max(...pts.map((p) => p.x)),
      minY: Math.min(...pts.map((p) => p.y)),
      maxY: Math.max(...pts.map((p) => p.y)),
    };
  }
}
