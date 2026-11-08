import { describe, expect, it } from 'vitest';
import {
  clampScale,
  graphZoomLevel,
  labelAlpha,
  MAX_GRAPH_SCALE,
  MIN_GRAPH_SCALE,
  zoomTransform,
} from '../src/components/graph/camera';
import { isCurrentGraphRevision } from '../src/components/graph/protocol';

describe('Graph camera and worker revisions', () => {
  it('keeps the zoom anchor on the same world point', () => {
    const transform = { x: 40, y: 60, k: 0.8 };
    const anchor = { x: 320, y: 240 };
    const next = zoomTransform(transform, 1.6, anchor);
    const before = { x: (anchor.x - transform.x) / transform.k, y: (anchor.y - transform.y) / transform.k };
    const after = { x: (anchor.x - next.x) / next.k, y: (anchor.y - next.y) / next.k };
    expect(after.x).toBeCloseTo(before.x, 10);
    expect(after.y).toBeCloseTo(before.y, 10);
  });

  it('clamps both zoom extremes', () => {
    expect(clampScale(0)).toBe(MIN_GRAPH_SCALE);
    expect(clampScale(100)).toBe(MAX_GRAPH_SCALE);
  });

  it('fades labels logarithmically and supports the fade control', () => {
    expect(labelAlpha(1)).toBe(1);
    expect(labelAlpha(0.5)).toBe(0);
    expect(labelAlpha(0.25, 2)).toBe(0);
    expect(labelAlpha(0.5, -1)).toBe(1);
  });

  it('uses hysteresis around semantic zoom boundaries', () => {
    expect(graphZoomLevel(0.59)).toBe('universe');
    expect(graphZoomLevel(0.62, 'universe')).toBe('universe');
    expect(graphZoomLevel(0.67, 'universe')).toBe('community');
    expect(graphZoomLevel(1.44, 'details')).toBe('details');
    expect(graphZoomLevel(1.41, 'details')).toBe('community');
  });

  it('accepts only the current worker revision', () => {
    expect(isCurrentGraphRevision(4, 4)).toBe(true);
    expect(isCurrentGraphRevision(3, 4)).toBe(false);
    expect(isCurrentGraphRevision(5, 4)).toBe(false);
  });
});
