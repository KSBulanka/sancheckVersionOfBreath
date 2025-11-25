import { Point } from '../types';

export const distance = (p1: Point, p2: Point) => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

export const distToSegment = (p: Point, v: Point, w: Point) => {
  const l2 = distance(v, w) ** 2;
  if (l2 === 0) return distance(p, v);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return distance(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
};

export const getPointOnPath = (points: Point[], progress: number): Point => {
  if (points.length < 2) return points[0] || { x: 0, y: 0 };
  
  // Calculate total length
  let totalLen = 0;
  const segLens = [];
  for (let i = 0; i < points.length - 1; i++) {
    const d = distance(points[i], points[i+1]);
    totalLen += d;
    segLens.push(d);
  }

  const targetDist = totalLen * progress;
  let currentDist = 0;

  for (let i = 0; i < segLens.length; i++) {
    if (currentDist + segLens[i] >= targetDist) {
      const remaining = targetDist - currentDist;
      const ratio = remaining / segLens[i];
      const p1 = points[i];
      const p2 = points[i+1];
      return {
        x: p1.x + (p2.x - p1.x) * ratio,
        y: p1.y + (p2.y - p1.y) * ratio
      };
    }
    currentDist += segLens[i];
  }
  return points[points.length - 1];
};

// Perlin-ish smooth random noise approximation for floating
export const randomDrift = (current: number, target: number, ease: number) => {
  return current + (target - current) * ease;
};
