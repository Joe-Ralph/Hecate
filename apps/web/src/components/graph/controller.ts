import { GraphCamera, GraphZoomLevel, graphZoomLevel } from './camera';
import { detectCommunities } from './communities';
import {
  DEFAULT_GRAPH_FILTERS,
  GraphData,
  GraphFilterOptions,
  GraphNode,
  filterGraphData,
} from './layout';
import { createGraphModel, GraphModel } from './model';
import { DEFAULT_GRAPH_FORCES, GraphForceSettings, Point, nodeRadius } from './physics';
import { GraphPositionsMessage, GraphWorkerRequest, isCurrentGraphRevision } from './protocol';
import {
  communityAtPoint,
  DEFAULT_GRAPH_DISPLAY,
  drawGraph,
  GraphDisplaySettings,
} from './renderer';

export interface GraphHover {
  node: GraphNode;
  x: number;
  y: number;
}

interface ControllerCallbacks {
  onHover: (hover: GraphHover | null) => void;
  onOpenNode: (node: GraphNode, sidePanel: boolean) => void;
  onSelect: (id: string | null) => void;
  onCommunityFocus: (id: string | null) => void;
  onZoomLevel: (level: GraphZoomLevel) => void;
  onReady: () => void;
}

interface DragState {
  start: Point;
  last: Point;
  moved: boolean;
  nodeId: string | null;
  communityId: string | null;
}

export class GraphController {
  readonly camera = new GraphCamera();
  private worker: Worker;
  private rawData: GraphData = { nodes: [], links: [], childrenOf: new Map() };
  private model: GraphModel;
  private filters: GraphFilterOptions = { ...DEFAULT_GRAPH_FILTERS };
  private forces: GraphForceSettings = { ...DEFAULT_GRAPH_FORCES };
  private display: GraphDisplaySettings = { ...DEFAULT_GRAPH_DISPLAY };
  private positions = new Map<string, Point>();
  private revision = 0;
  private raf: number | null = null;
  private idleFrames = 0;
  private disposed = false;
  private ready = false;
  private width = 0;
  private height = 0;
  private accent = '#c4b2ff';
  private textColor = '#d8d2c8';
  private zoomLevel: GraphZoomLevel = 'community';
  private previousZoomLevel: GraphZoomLevel | null = null;
  private zoomTransition = 1;
  private focusedCommunityId: string | null = null;
  private previousFocusedCommunityId: string | null = null;
  private selectedId: string | null = null;
  private hoveredId: string | null = null;
  private pointers = new Map<number, Point>();
  private drag: DragState | null = null;
  private resizeObserver: ResizeObserver;
  private themeObserver: MutationObserver;

  constructor(
    private canvas: HTMLCanvasElement,
    private container: HTMLElement,
    private callbacks: ControllerCallbacks
  ) {
    this.model = createGraphModel(this.rawData, detectCommunities(this.rawData));
    this.canvas.style.touchAction = 'none';
    this.canvas.tabIndex = 0;
    this.worker = new Worker(new URL('./graphWorker.ts', import.meta.url), {
      type: 'module',
      name: 'Graph Worker',
    });
    this.worker.onmessage = (event: MessageEvent<GraphPositionsMessage>) => this.receivePositions(event.data);
    this.readColors();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.themeObserver = new MutationObserver(() => {
      this.readColors();
      this.wake();
    });
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'style'],
    });
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
    this.canvas.addEventListener('pointerleave', this.onPointerLeave);
    this.canvas.addEventListener('keydown', this.onKeyDown);
    this.resize();
  }

  setData(data: GraphData, reset = false) {
    this.rawData = data;
    if (reset) {
      this.ready = false;
      this.positions.clear();
    }
    this.applyData(reset);
  }

  setFilters(filters: GraphFilterOptions) {
    this.filters = { ...filters };
    this.applyData(false);
  }

  setForces(forces: GraphForceSettings) {
    this.forces = { ...forces };
    this.revision++;
    this.post({
      type: 'set-forces',
      revision: this.revision,
      data: this.model.data,
      communities: this.model.communities,
      forces: this.forces,
    });
    this.wake();
  }

  setDisplay(display: GraphDisplaySettings) {
    this.display = { ...display };
    this.wake();
  }

  setSelected(id: string | null) {
    this.selectedId = id;
    this.wake();
  }

  reheat(alpha = 0.15) {
    this.post({ type: 'reheat', alpha });
  }

  fitToView = () => {
    this.setCommunityFocus(null);
    const bounds = this.positionBounds();
    if (bounds) this.camera.fit(bounds, this.width, this.height);
    this.wake();
  };

  focusCommunity(id: string) {
    this.setCommunityFocus(id);
    const model = this.model;
    const ids = model.communityById.get(id)?.nodeIds || [];
    const bounds = this.positionBounds(ids);
    if (bounds) this.camera.fit(bounds, this.width, this.height);
    this.wake();
  }

  dispose() {
    this.disposed = true;
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.post({ type: 'dispose' });
    this.worker.terminate();
    this.resizeObserver.disconnect();
    this.themeObserver.disconnect();
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    this.canvas.removeEventListener('keydown', this.onKeyDown);
  }

  private applyData(reset: boolean) {
    const visible = filterGraphData(this.rawData, this.filters);
    const communities = detectCommunities(visible);
    this.model = createGraphModel(visible, communities);
    const visibleIds = new Set(visible.nodes.map((node) => node.id));
    for (const id of [...this.positions.keys()]) if (!visibleIds.has(id)) this.positions.delete(id);
    if (this.focusedCommunityId && !communities.communities.some((community) => community.id === this.focusedCommunityId)) {
      this.setCommunityFocus(null);
    }
    this.revision++;
    this.post({
      type: 'set-data',
      revision: this.revision,
      data: visible,
      communities,
      forces: this.forces,
      reset,
    });
    if (visible.nodes.length === 0) {
      this.ready = true;
      this.callbacks.onReady();
    }
    this.wake();
  }

  private post(message: GraphWorkerRequest) {
    if (!this.disposed) this.worker.postMessage(message);
  }

  private receivePositions(message: GraphPositionsMessage) {
    if (!isCurrentGraphRevision(message.revision, this.revision) || this.disposed) return;
    this.positions.clear();
    const coordinates = new Float32Array(message.buffer);
    message.ids.forEach((id, index) => {
      this.positions.set(id, { x: coordinates[index * 2], y: coordinates[index * 2 + 1] });
    });
    if (!this.ready) {
      this.ready = true;
      const bounds = this.positionBounds();
      if (bounds) this.camera.fit(bounds, this.width, this.height, true);
      this.callbacks.onReady();
    }
    this.wake();
  }

  private positionBounds(ids?: string[]) {
    const points = ids ? ids.map((id) => this.positions.get(id)).filter((point): point is Point => Boolean(point)) : [...this.positions.values()];
    if (points.length === 0) return null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const point of points) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
    const padding = ids ? 30 : 0;
    return { minX: minX - padding, maxX: maxX + padding, minY: minY - padding, maxY: maxY + padding };
  }

  private setCommunityFocus(id: string | null) {
    if (this.focusedCommunityId === id) return;
    this.previousZoomLevel = this.zoomLevel;
    this.previousFocusedCommunityId = this.focusedCommunityId;
    this.zoomTransition = 0;
    this.focusedCommunityId = id;
    this.callbacks.onCommunityFocus(id);
  }

  private readColors() {
    const css = getComputedStyle(document.documentElement);
    this.accent = css.getPropertyValue('--accent').trim() || '#c4b2ff';
    this.textColor = css.getPropertyValue('--text-secondary').trim() || '#d8d2c8';
  }

  private resize() {
    const nextWidth = this.container.clientWidth;
    const nextHeight = this.container.clientHeight;
    if (nextWidth === 0 || nextHeight === 0) return;
    if (this.width && this.height) this.camera.resize(this.width, this.height, nextWidth, nextHeight);
    this.width = nextWidth;
    this.height = nextHeight;
    const dpr = window.devicePixelRatio || 1;
    const pixelWidth = Math.round(nextWidth * dpr);
    const pixelHeight = Math.round(nextHeight * dpr);
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
      this.canvas.style.width = `${nextWidth}px`;
      this.canvas.style.height = `${nextHeight}px`;
    }
    this.wake();
  }

  private wake() {
    this.idleFrames = 0;
    if (!this.disposed && this.raf === null) this.raf = requestAnimationFrame(this.frame);
  }

  private frame = () => {
    this.raf = null;
    if (this.disposed) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cameraMoving = this.camera.update(reducedMotion);
    const nextLevel = graphZoomLevel(this.camera.scale, this.zoomLevel);
    if (nextLevel !== this.zoomLevel) {
      this.previousZoomLevel = this.zoomLevel;
      this.previousFocusedCommunityId = this.focusedCommunityId;
      this.zoomTransition = reducedMotion ? 1 : 0;
      this.zoomLevel = nextLevel;
      this.callbacks.onZoomLevel(nextLevel);
    }
    this.zoomTransition = reducedMotion ? 1 : Math.min(1, this.zoomTransition + 0.12);
    const ctx = this.canvas.getContext('2d');
    if (ctx) {
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawGraph(ctx, {
        model: this.model,
        positions: this.positions,
        transform: this.camera.transform,
        zoomLevel: this.zoomLevel,
        previousZoomLevel: this.previousZoomLevel,
        zoomTransition: this.zoomTransition,
        hoveredId: this.hoveredId,
        selectedId: this.selectedId,
        focusedCommunityId: this.focusedCommunityId,
        previousFocusedCommunityId: this.previousFocusedCommunityId,
        display: this.display,
        stardust: this.stardust,
        width: this.width,
        height: this.height,
        accent: this.accent,
        textColor: this.textColor,
      });
    }
    if (cameraMoving || this.zoomTransition < 1) this.idleFrames = 0;
    else this.idleFrames++;
    if (this.idleFrames <= 60) this.raf = requestAnimationFrame(this.frame);
  };

  private stardust = Array.from({ length: 160 }, (_, index) => {
    const noise = (salt: number) => {
      const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
      return value - Math.floor(value);
    };
    return {
      x: (noise(1) - 0.5) * 4000,
      y: (noise(2) - 0.5) * 4000,
      r: noise(3) * 1.1 + 0.3,
      alpha: noise(4) * 0.16 + 0.03,
    };
  });

  private localPoint(event: PointerEvent | WheelEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private nodeAt(point: Point): GraphNode | null {
    const world = this.camera.screenToWorld(point);
    let best: GraphNode | null = null;
    let bestDistance = Infinity;
    for (const node of this.model.data.nodes) {
      const communityId = this.model.communities.communityOf.get(node.id) || node.id;
      if (this.zoomLevel === 'universe' && this.focusedCommunityId !== communityId) continue;
      const position = this.positions.get(node.id);
      if (!position) continue;
      const radius = nodeRadius(node.degree) * this.display.nodeSize * this.camera.nodeScale();
      const distance = Math.hypot(position.x - world.x, position.y - world.y);
      if (distance <= Math.max(radius + 4 / this.camera.scale, 12 / this.camera.scale) && distance < bestDistance) {
        best = node;
        bestDistance = distance;
      }
    }
    return best;
  }

  private onWheel = (event: WheelEvent) => {
    event.preventDefault();
    this.camera.wheel(event, this.localPoint(event), this.width, this.height);
    this.wake();
  };

  private onPointerDown = (event: PointerEvent) => {
    this.canvas.focus({ preventScroll: true });
    this.canvas.setPointerCapture(event.pointerId);
    const point = this.localPoint(event);
    this.pointers.set(event.pointerId, point);
    if (this.pointers.size > 1) {
      if (this.drag?.nodeId) this.post({ type: 'unpin', id: this.drag.nodeId });
      if (this.drag) this.drag.moved = true;
      return;
    }
    const node = this.nodeAt(point);
    const world = this.camera.screenToWorld(point);
    const communityId = this.zoomLevel === 'universe'
      ? communityAtPoint(this.model, this.positions, world, this.camera.scale, this.focusedCommunityId)
      : null;
    this.drag = { start: point, last: point, moved: false, nodeId: node?.id || null, communityId };
  };

  private onPointerMove = (event: PointerEvent) => {
    const point = this.localPoint(event);
    const previous = this.pointers.get(event.pointerId);
    if (previous && this.pointers.size === 2) {
      const otherEntry = [...this.pointers.entries()].find(([id]) => id !== event.pointerId);
      if (otherEntry) {
        const other = otherEntry[1];
        const previousMid = { x: (previous.x + other.x) / 2, y: (previous.y + other.y) / 2 };
        const nextMid = { x: (point.x + other.x) / 2, y: (point.y + other.y) / 2 };
        const previousDistance = Math.hypot(previous.x - other.x, previous.y - other.y);
        const nextDistance = Math.hypot(point.x - other.x, point.y - other.y);
        this.camera.panBy(nextMid.x - previousMid.x, nextMid.y - previousMid.y);
        if (previousDistance > 0 && nextDistance > 0) {
          this.camera.zoomAt(this.camera.scale * nextDistance / previousDistance, nextMid);
        }
        if (this.drag) this.drag.moved = true;
        this.pointers.set(event.pointerId, point);
        this.wake();
        return;
      }
    }
    this.pointers.set(event.pointerId, point);
    const drag = this.drag;
    if (drag && this.pointers.has(event.pointerId)) {
      if (Math.abs(point.x - drag.start.x) + Math.abs(point.y - drag.start.y) > 4) drag.moved = true;
      if (drag.moved) {
        if (drag.nodeId) {
          const world = this.camera.screenToWorld(point);
          this.positions.set(drag.nodeId, world);
          this.post({ type: 'pin', id: drag.nodeId, x: world.x, y: world.y });
        } else {
          this.camera.panBy(point.x - drag.last.x, point.y - drag.last.y);
        }
        drag.last = point;
        this.wake();
        return;
      }
    }
    if (event.pointerType === 'mouse') {
      const node = this.nodeAt(point);
      const nextId = node?.id || null;
      this.hoveredId = nextId;
      this.callbacks.onHover(node ? { node, x: event.clientX, y: event.clientY } : null);
      this.wake();
    }
  };

  private onPointerUp = (event: PointerEvent) => {
    const drag = this.drag;
    this.pointers.delete(event.pointerId);
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    if (drag?.nodeId) this.post({ type: 'unpin', id: drag.nodeId });
    if (this.pointers.size > 0) {
      this.drag = null;
      return;
    }
    this.drag = null;
    if (event.type === 'pointercancel' || drag?.moved) return;
    if (drag?.communityId) {
      this.focusCommunity(drag.communityId);
      return;
    }
    if (drag?.nodeId) {
      const node = this.model.nodeById.get(drag.nodeId);
      if (node) {
        this.selectedId = node.id;
        this.callbacks.onSelect(node.id);
        this.callbacks.onOpenNode(node, event.ctrlKey || event.metaKey);
      }
    } else if (drag) {
      this.selectedId = null;
      this.callbacks.onSelect(null);
    }
    this.wake();
  };

  private onPointerLeave = (event: PointerEvent) => {
    if (this.drag) return;
    this.hoveredId = null;
    this.callbacks.onHover(null);
    this.wake();
  };

  private onKeyDown = (event: KeyboardEvent) => {
    const speed = event.shiftKey ? 72 : 24;
    if (event.key === 'ArrowLeft') this.camera.panBy(speed, 0);
    else if (event.key === 'ArrowRight') this.camera.panBy(-speed, 0);
    else if (event.key === 'ArrowUp') this.camera.panBy(0, speed);
    else if (event.key === 'ArrowDown') this.camera.panBy(0, -speed);
    else if (event.key === '+' || event.key === '=') this.camera.zoomAt(this.camera.scale * (event.shiftKey ? 1.1 : 1.03), { x: this.width / 2, y: this.height / 2 });
    else if (event.key === '-') this.camera.zoomAt(this.camera.scale / (event.shiftKey ? 1.1 : 1.03), { x: this.width / 2, y: this.height / 2 });
    else return;
    event.preventDefault();
    this.wake();
  };
}
