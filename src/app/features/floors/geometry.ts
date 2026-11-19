import { Vertex } from '../../core/smart-models';

export function polygonError(vertices: Vertex[]): string | null {
  if (vertices.length < 3 || vertices.length > 64) return 'Use between 3 and 64 vertices.';
  if (
    vertices.some(
      (v) =>
        !Number.isFinite(v.x) || !Number.isFinite(v.y) || v.x < 0 || v.x > 1 || v.y < 0 || v.y > 1,
    )
  )
    return 'Coordinates must be between 0 and 1.';
  if (new Set(vertices.map((v) => `${v.x},${v.y}`)).size !== vertices.length)
    return 'Vertices must be distinct.';
  const cross = (a: Vertex, b: Vertex, c: Vertex) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i],
      b = vertices[(i + 1) % vertices.length];
    area += a.x * b.y - b.x * a.y;
    for (let j = i + 2; j < vertices.length; j++) {
      if (i === 0 && j === vertices.length - 1) continue;
      const c = vertices[j],
        d = vertices[(j + 1) % vertices.length];
      const overlap =
        Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) <=
          Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) &&
        Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)) <=
          Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y));
      if (overlap && cross(a, b, c) * cross(a, b, d) <= 0 && cross(c, d, a) * cross(c, d, b) <= 0)
        return 'Polygon edges must not intersect.';
    }
  }
  return Math.abs(area) < 1e-8 ? 'Polygon must enclose an area.' : null;
}
