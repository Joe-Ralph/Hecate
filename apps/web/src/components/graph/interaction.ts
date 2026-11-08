import { Transform } from './renderer';

export function zoomAtPoint(transform: Transform, deltaY: number, x: number, y: number): Transform {
  const factor = Math.exp(-deltaY * 0.0012);
  const k = Math.min(6, Math.max(0.1, transform.k * factor));
  const scale = k / transform.k;
  return {
    k,
    x: x - (x - transform.x) * scale,
    y: y - (y - transform.y) * scale,
  };
}

export function interpolateTransform(current: Transform, target: Transform, amount: number): Transform {
  return {
    k: current.k + (target.k - current.k) * amount,
    x: current.x + (target.x - current.x) * amount,
    y: current.y + (target.y - current.y) * amount,
  };
}
