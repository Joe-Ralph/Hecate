import { GraphZoomLevel, labelAlpha } from './camera';
import { CommunityView, GraphModel, communityViews } from './model';
import { GraphNode } from './layout';
import { Point, nodeRadius } from './physics';

export interface Transform {
  x: number;
  y: number;
  k: number;
}

export interface GraphDisplaySettings {
  showArrows: boolean;
  textFade: number;
  nodeSize: number;
  lineSize: number;
}

export const DEFAULT_GRAPH_DISPLAY: GraphDisplaySettings = {
  showArrows: false,
  textFade: 0,
  nodeSize: 1,
  lineSize: 1,
};

export interface RenderState {
  model: GraphModel;
  positions: Map<string, Point>;
  transform: Transform;
  zoomLevel: GraphZoomLevel;
  previousZoomLevel: GraphZoomLevel | null;
  zoomTransition: number;
  hoveredId: string | null;
  selectedId: string | null;
  focusedCommunityId: string | null;
  previousFocusedCommunityId: string | null;
  display: GraphDisplaySettings;
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

export function nodeColor(n: { kind: string; tagNames: string[] }, accent: string): string {
  if (n.kind === 'day') return accent;
  for (const tag of n.tagNames) if (TAG_COLORS[tag]) return TAG_COLORS[tag];
  return DEFAULT_NODE;
}

export function communityRadius(memberCount: number, scale: number): number {
  return Math.min(42, 10 + Math.sqrt(memberCount) * 2.5) * Math.sqrt(1 / scale);
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  return gradient;
}

function outside(
  viewport: { left: number; top: number; right: number; bottom: number },
  left: number,
  top: number,
  right: number,
  bottom: number
): boolean {
  return right < viewport.left || left > viewport.right || bottom < viewport.top || top > viewport.bottom;
}

function communityColor(communityId: string, model: GraphModel, accent: string): string {
  const community = model.communityById.get(communityId);
  for (const id of community?.nodeIds || []) {
    const node = model.nodeById.get(id);
    if (node && node.kind !== 'day' && node.tagNames.some((tag) => TAG_COLORS[tag])) {
      return nodeColor(node, accent);
    }
  }
  return accent;
}

export function drawGraph(ctx: CanvasRenderingContext2D, state: RenderState) {
  const {
    model, positions, transform, zoomLevel, previousZoomLevel, zoomTransition, hoveredId, selectedId,
    focusedCommunityId, previousFocusedCommunityId, display, stardust, width, height, accent, textColor,
  } = state;
  const scale = transform.k;
  const nodeScale = Math.sqrt(1 / scale);
  const viewport = {
    left: -transform.x / scale - 100 / scale,
    top: -transform.y / scale - 100 / scale,
    right: (width - transform.x) / scale + 100 / scale,
    bottom: (height - transform.y) / scale + 100 / scale,
  };
  const views = communityViews(model, positions);
  const neighbors = hoveredId ? model.adjacency.get(hoveredId) : undefined;
  const emphasis = (id: string) => hoveredId && id !== hoveredId && !neighbors?.has(id) ? 0.2 : 1;
  const memberVisibility = (communityId: string) => {
    const expanded = zoomLevel !== 'universe' || focusedCommunityId === communityId;
    if (previousZoomLevel === null || zoomTransition >= 1) return expanded ? 1 : 0;
    const wasExpanded = previousZoomLevel !== 'universe' || previousFocusedCommunityId === communityId;
    return (wasExpanded ? 1 - zoomTransition : 0) + (expanded ? zoomTransition : 0);
  };
  const isExpanded = (communityId: string) => memberVisibility(communityId) > 0.01;

  ctx.fillStyle = '#100F12';
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.translate(transform.x, transform.y);
  ctx.scale(scale, scale);

  for (const dust of stardust) {
    if (outside(viewport, dust.x - 2, dust.y - 2, dust.x + 2, dust.y + 2)) continue;
    ctx.globalAlpha = dust.alpha;
    ctx.fillStyle = textColor;
    ctx.beginPath();
    ctx.arc(dust.x, dust.y, dust.r, 0, Math.PI * 2);
    ctx.fill();
  }

  if (zoomLevel === 'universe') {
    for (const edge of model.communityEdges) {
      const source = views.get(edge.source)?.center;
      const target = views.get(edge.target)?.center;
      if (!source || !target) continue;
      if (outside(viewport, Math.min(source.x, target.x), Math.min(source.y, target.y), Math.max(source.x, target.x), Math.max(source.y, target.y))) continue;
      ctx.globalAlpha = Math.min(0.4, 0.1 + Math.log1p(edge.count) * 0.06);
      ctx.strokeStyle = EDGE_GREY;
      ctx.lineWidth = display.lineSize / scale;
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
    }
  }

  for (const edge of model.edges) {
    const sourceCommunity = model.communities.communityOf.get(edge.source) || edge.source;
    const targetCommunity = model.communities.communityOf.get(edge.target) || edge.target;
    if (!isExpanded(sourceCommunity) && !isExpanded(targetCommunity)) continue;
    if (zoomLevel === 'universe' && focusedCommunityId && sourceCommunity !== focusedCommunityId && targetCommunity !== focusedCommunityId) continue;
    const source = positions.get(edge.source);
    const target = positions.get(edge.target);
    if (!source || !target) continue;
    if (outside(viewport, Math.min(source.x, target.x), Math.min(source.y, target.y), Math.max(source.x, target.x), Math.max(source.y, target.y))) continue;
    const highlighted = hoveredId === edge.source || hoveredId === edge.target || selectedId === edge.source || selectedId === edge.target;
    const visibility = Math.min(memberVisibility(sourceCommunity), memberVisibility(targetCommunity));
    const alpha = (highlighted ? 0.85 : sourceCommunity === targetCommunity ? 0.14 : 0.24) * visibility;
    ctx.globalAlpha = alpha * Math.min(emphasis(edge.source), emphasis(edge.target));
    ctx.strokeStyle = highlighted ? accent : EDGE_GREY;
    ctx.lineWidth = display.lineSize * (highlighted ? 1.1 : 0.65) / scale;
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const length = Math.hypot(dx, dy);
    if (length < 1) continue;
    const sourceNode = model.nodeById.get(edge.source)!;
    const targetNode = model.nodeById.get(edge.target)!;
    const sourceRadius = nodeRadius(sourceNode.degree) * display.nodeSize * nodeScale;
    const targetRadius = nodeRadius(targetNode.degree) * display.nodeSize * nodeScale;
    const startX = source.x + dx * sourceRadius / length;
    const startY = source.y + dy * sourceRadius / length;
    const endX = target.x - dx * targetRadius / length;
    const endY = target.y - dy * targetRadius / length;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    if (display.showArrows && scale > 0.3 && length > sourceRadius + targetRadius + 4 / scale) {
      const size = 5 / scale;
      ctx.globalAlpha = Math.min(0.7, (scale - 0.3) * 2) * emphasis(edge.target) * visibility;
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - dx / length * size - dy / length * size * 0.55, endY - dy / length * size + dx / length * size * 0.55);
      ctx.lineTo(endX - dx / length * size + dy / length * size * 0.55, endY - dy / length * size - dx / length * size * 0.55);
      ctx.closePath();
      ctx.fill();
    }
  }

  for (const [id, view] of views) {
    const metaVisibility = 1 - memberVisibility(id);
    if (metaVisibility < 0.01) continue;
    const radius = communityRadius(view.community.nodeIds.length, scale);
    if (outside(viewport, view.center.x - radius, view.center.y - radius, view.center.x + radius, view.center.y + radius)) continue;
    const color = communityColor(id, model, accent);
    ctx.globalAlpha = 0.16 * metaVisibility;
    ctx.fillStyle = glow(ctx, view.center.x, view.center.y, radius * 2.2, color);
    ctx.beginPath();
    ctx.arc(view.center.x, view.center.y, radius * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.95 * metaVisibility;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(view.center.x, view.center.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.9 * metaVisibility;
    ctx.fillStyle = textColor;
    ctx.font = `${11 / scale}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(`${view.community.label} · ${view.community.nodeIds.length}`, view.center.x, view.center.y + radius + 16 / scale);
  }

  for (const node of model.data.nodes) {
    const point = positions.get(node.id);
    if (!point) continue;
    const communityId = model.communities.communityOf.get(node.id) || node.id;
    if (!isExpanded(communityId)) continue;
    const radius = nodeRadius(node.degree) * display.nodeSize * nodeScale;
    if (outside(viewport, point.x - radius * 5, point.y - radius * 5, point.x + radius * 5, point.y + radius * 5)) continue;
    const selected = selectedId === node.id;
    const hovered = hoveredId === node.id;
    const hub = node.degree >= 6;
    const color = nodeColor(node, accent);
    let alpha = zoomLevel === 'community' && !hub && !node.hasChildren ? 0.68 : 1;
    if (zoomLevel === 'universe') alpha = 0.9;
    alpha *= emphasis(node.id) * memberVisibility(communityId);
    if (selected || hovered || hub) {
      ctx.globalAlpha = (selected ? 0.5 : hovered ? 0.35 : 0.12) * alpha;
      ctx.fillStyle = glow(ctx, point.x, point.y, radius * (selected ? 5 : 3.5), color);
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius * (selected ? 5 : 3.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = alpha * (node.hasChildren ? 1 : 0.85);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
    if (selected || hovered) {
      ctx.globalAlpha = memberVisibility(communityId);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.4 / scale;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius + 4 / scale, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  const fade = labelAlpha(scale, display.textFade);
  for (const node of model.data.nodes) {
    const point = positions.get(node.id);
    if (!point) continue;
    const communityId = model.communities.communityOf.get(node.id) || node.id;
    if (!isExpanded(communityId)) continue;
    const selected = selectedId === node.id;
    const hovered = hoveredId === node.id;
    const important = node.degree >= 3 || node.hasChildren;
    if (zoomLevel !== 'details' && !important && !selected && !hovered) continue;
    const alpha = (selected || hovered ? 1 : fade * (node.hasChildren ? 0.95 : 0.72) * emphasis(node.id)) * memberVisibility(communityId);
    if (alpha < 0.01) continue;
    const radius = nodeRadius(node.degree) * display.nodeSize * nodeScale;
    if (outside(viewport, point.x - 160 / scale, point.y, point.x + 160 / scale, point.y + radius + 30 / scale)) continue;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = textColor;
    const fontScale = selected || hovered ? 1 / scale : nodeScale;
    ctx.font = `${11 * fontScale}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(node.title.slice(0, 40), point.x, point.y + radius + 12 * fontScale);
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}

export function communityAtPoint(
  model: GraphModel,
  positions: Map<string, Point>,
  point: Point,
  scale: number,
  focusedCommunityId: string | null
): string | null {
  const views = communityViews(model, positions);
  for (const [id, view] of views) {
    if (focusedCommunityId === id) continue;
    const radius = communityRadius(view.community.nodeIds.length, scale);
    if (Math.hypot(view.center.x - point.x, view.center.y - point.y) <= radius + 6 / scale) return id;
  }
  return null;
}
