/**
 * Nebula renderer (2D canvas).
 * Warm charcoal background, star dust, logarithmic node sizes, thin
 * low-opacity edges, and zoom-progressive label revelation.
 * Glow is reserved for hubs, hovered nodes, and the selected node.
 */

import { GraphData } from './layout';
import { CommunityMap } from './communities';
import { Point, nodeRadius } from './physics';

export interface Transform {
  x: number;
  y: number;
  k: number;
}

export interface RenderState {
  data: GraphData;
  positions: Map<string, Point>;
  communities: CommunityMap;
  transform: Transform;
  hoveredId: string | null;
  selectedId: string | null;
  focusSet: Set<string> | null;
  activeTag: string | null;
  searchMatches: Set<string>;
  stardust: Array<{ x: number; y: number; r: number; alpha: number }>;
  width: number;
  height: number;
  accent: string;
  textColor: string;
}

const TAG_COLORS: Record<string, string> = {
  task: '#8fd18b',
  book: '#e8b86a',
  person: '#8cc4f0',
  meeting: '#e8856a',
  project: '#c4b2ff',
  idea: '#c4b2ff',
  habit: '#8fd18b',
  goal: '#e8b86a',
};
const DEFAULT_NODE = '#9a948a';
const EDGE_GREY = '#9aa3a8';

export function nodeColor(n: { kind: string; tagNames: string[]; hasChildren: boolean }, accent: string): string {
  if (n.kind === 'day') return accent;
  for (const t of n.tagNames) {
    if (TAG_COLORS[t]) return TAG_COLORS[t];
  }
  return DEFAULT_NODE;
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  return g;
}

export function drawGraph(ctx: CanvasRenderingContext2D, state: RenderState) {
  const {
    data, positions, communities, transform, hoveredId, selectedId,
    focusSet, activeTag, searchMatches, stardust, width, height, accent, textColor,
  } = state;

  // Warm charcoal background (graph-specific per visual direction)
  ctx.fillStyle = '#100F12';
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(transform.x, transform.y);
  ctx.scale(transform.k, transform.k);

  // Star dust: decorative depth, not data
  for (const d of stardust) {
    ctx.globalAlpha = d.alpha;
    ctx.fillStyle = textColor;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const nodeById = new Map(data.nodes.map((n) => [n.id, n]));
  const dimmed = (id: string): number => {
    if (focusSet && !focusSet.has(id)) return 0.05;
    if (activeTag) {
      const n = nodeById.get(id);
      if (!n || !n.tagNames.includes(activeTag)) return 0.07;
    }
    return 1;
  };

  // Edges
  for (const l of data.links) {
    const a = positions.get(l.source);
    const b = positions.get(l.target);
    if (!a || !b) continue;
    const dim = Math.min(dimmed(l.source), dimmed(l.target));
    if (dim < 0.2) continue;

    const crossCommunity =
      communities.communityOf.get(l.source) !== communities.communityOf.get(l.target);
    const isHovered = hoveredId === l.source || hoveredId === l.target;
    const isSelected = selectedId === l.source || selectedId === l.target;

    let alpha = crossCommunity ? 0.2 : 0.11;
    let color = EDGE_GREY;
    if (isSelected) {
      alpha = 0.85;
      color = accent;
    } else if (isHovered) {
      alpha = 0.75;
      color = nodeColor(nodeById.get(l.source)!, accent);
    }
    ctx.globalAlpha = alpha * dim;
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.65;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Nodes
  for (const n of data.nodes) {
    const p = positions.get(n.id);
    if (!p) continue;
    const dim = dimmed(n.id);
    const color = nodeColor(n, accent);
    const isSelected = selectedId === n.id;
    const isHovered = hoveredId === n.id;
    const isHub = n.degree >= 6;
    const r = isSelected ? Math.min(11, nodeRadius(n.degree) + 3) : nodeRadius(n.degree);

    // Glow only for hubs, hover, and selection — never every node
    if (isSelected || isHovered || isHub) {
      ctx.globalAlpha = (isSelected ? 0.5 : isHovered ? 0.35 : 0.12) * dim;
      ctx.fillStyle = glow(ctx, p.x, p.y, r * (isSelected ? 5 : 3.5), color);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * (isSelected ? 5 : 3.5), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = (n.hasChildren ? 1 : 0.85) * dim;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();

    if (isSelected || searchMatches.has(n.id)) {
      ctx.globalAlpha = dim;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.4 / transform.k;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  // Zoom-progressive labels (positions never change between zoom levels)
  const k = transform.k;
  const zoomLevel = k < 0.6 ? 'universe' : k < 1.5 ? 'community' : 'details';

  if (zoomLevel === 'universe') {
    // Community labels at their centers of gravity
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    for (const c of communities.communities.slice(0, 12)) {
      const center = communitiesCenter(c.nodeIds, positions);
      if (!center) continue;
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = textColor;
      ctx.fillText(c.label, center.x, center.y);
    }
  }

  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'center';
  let drawn = 0;
  for (const n of data.nodes) {
    if (dimmed(n.id) < 0.2) continue;
    const isHubLabel = n.degree >= (zoomLevel === 'universe' ? 10 : 3);
    const show =
      zoomLevel === 'details'
        ? true
        : zoomLevel === 'community'
          ? isHubLabel || n.hasChildren
          : n.degree >= 10;
    if (!show) continue;
    if (zoomLevel === 'details' && ++drawn > 400) break;

    const p = positions.get(n.id);
    if (!p) continue;
    const r = nodeRadius(n.degree);
    ctx.globalAlpha = n.hasChildren ? 0.95 : 0.7;
    ctx.fillStyle = textColor;
    ctx.fillText(n.title.slice(0, 30), p.x, p.y + r + 12 / Math.sqrt(k));
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function communitiesCenter(nodeIds: string[], positions: Map<string, Point>): Point | null {
  let x = 0;
  let y = 0;
  let count = 0;
  for (const id of nodeIds) {
    const p = positions.get(id);
    if (!p) continue;
    x += p.x;
    y += p.y;
    count++;
  }
  return count > 0 ? { x: x / count, y: y / count } : null;
}
