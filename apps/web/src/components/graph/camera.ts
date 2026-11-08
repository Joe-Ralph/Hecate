import type { Point } from './physics';
import type { Transform } from './renderer';

export const MIN_GRAPH_SCALE = 1 / 128;
export const MAX_GRAPH_SCALE = 8;

export type GraphZoomLevel = 'universe' | 'community' | 'details';

export function clampScale(scale: number): number {
  return Math.min(MAX_GRAPH_SCALE, Math.max(MIN_GRAPH_SCALE, scale));
}

export function zoomTransform(transform: Transform, scale: number, anchor: Point): Transform {
  const nextScale = clampScale(scale);
  const ratio = nextScale / transform.k;
  return {
    k: nextScale,
    x: anchor.x - (anchor.x - transform.x) * ratio,
    y: anchor.y - (anchor.y - transform.y) * ratio,
  };
}

export function labelAlpha(scale: number, fade = 0): number {
  return Math.min(1, Math.max(0, Math.log2(scale) + 1 - fade));
}

export function graphZoomLevel(scale: number, previous?: GraphZoomLevel): GraphZoomLevel {
  const lower = previous === 'community' ? 0.54 : 0.6;
  const upper = previous === 'community' ? 1.58 : 1.5;
  if (previous === 'universe') return scale >= 0.66 ? 'community' : 'universe';
  if (previous === 'details') return scale <= 1.42 ? 'community' : 'details';
  if (scale < lower) return 'universe';
  if (scale >= upper) return 'details';
  return 'community';
}

export class GraphCamera {
  transform: Transform = { x: 0, y: 0, k: 1 };
  private target: Transform = { x: 0, y: 0, k: 1 };

  get scale(): number {
    return this.transform.k;
  }

  nodeScale(): number {
    return Math.sqrt(1 / this.transform.k);
  }

  screenToWorld(point: Point): Point {
    return {
      x: (point.x - this.transform.x) / this.transform.k,
      y: (point.y - this.transform.y) / this.transform.k,
    };
  }

  wheel(event: WheelEvent, anchor: Point, width: number, height: number) {
    let delta = event.deltaY;
    if (event.deltaMode === 1) delta *= 40;
    else if (event.deltaMode === 2) delta *= 800;
    const scale = clampScale(this.target.k * Math.pow(1.5, -delta / 120));
    this.target = zoomTransform(
      this.target,
      scale,
      scale < this.target.k ? { x: width / 2, y: height / 2 } : anchor
    );
  }

  zoomAt(scale: number, anchor: Point, immediate = false) {
    this.target = zoomTransform(this.target, scale, anchor);
    if (immediate) this.transform = { ...this.target };
  }

  panBy(dx: number, dy: number) {
    this.transform.x += dx;
    this.transform.y += dy;
    this.target.x += dx;
    this.target.y += dy;
  }

  fit(bounds: { minX: number; maxX: number; minY: number; maxY: number }, width: number, height: number, immediate = false) {
    const graphWidth = Math.max(1, bounds.maxX - bounds.minX);
    const graphHeight = Math.max(1, bounds.maxY - bounds.minY);
    const scale = clampScale(Math.min(width / (graphWidth + 120), height / (graphHeight + 120), 1.2));
    this.target = {
      k: scale,
      x: width / 2 - ((bounds.minX + bounds.maxX) / 2) * scale,
      y: height / 2 - ((bounds.minY + bounds.maxY) / 2) * scale,
    };
    if (immediate) this.transform = { ...this.target };
  }

  resize(oldWidth: number, oldHeight: number, width: number, height: number) {
    this.panBy((width - oldWidth) / 2, (height - oldHeight) / 2);
  }

  update(reducedMotion = false): boolean {
    const before = this.transform;
    if (reducedMotion) {
      this.transform = { ...this.target };
    } else {
      this.transform = {
        k: before.k * 0.85 + this.target.k * 0.15,
        x: before.x * 0.85 + this.target.x * 0.15,
        y: before.y * 0.85 + this.target.y * 0.15,
      };
    }
    return (
      Math.abs(this.transform.k - this.target.k) > 0.0001 ||
      Math.abs(this.transform.x - this.target.x) > 0.01 ||
      Math.abs(this.transform.y - this.target.y) > 0.01
    );
  }
}
