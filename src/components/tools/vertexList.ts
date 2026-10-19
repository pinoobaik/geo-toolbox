import type { GeoPoint } from '../../types/geo'

/**
 * Tolerance, in degrees, below which a newly clicked vertex is treated as a
 * repeat of the previous one. It is far smaller than any meaningful map click
 * (about 0.1 mm at the equator) so only genuinely identical clicks are ignored.
 */
export const DUPLICATE_VERTEX_TOLERANCE_DEG = 1e-9

/** True when `point` coincides with the last vertex of `vertices`. */
export function isDuplicateOfLast(
  vertices: readonly GeoPoint[],
  point: GeoPoint,
): boolean {
  if (vertices.length === 0) {
    return false
  }
  const last = vertices[vertices.length - 1]
  return (
    Math.abs(last.latitude - point.latitude) < DUPLICATE_VERTEX_TOLERANCE_DEG &&
    Math.abs(last.longitude - point.longitude) < DUPLICATE_VERTEX_TOLERANCE_DEG
  )
}

/**
 * Appends a vertex, ignoring a click that repeats the previous vertex exactly.
 * A repeat returns the original array reference so React can bail out of the
 * state update and the drawing does not gain a degenerate zero-length segment.
 */
export function appendVertex(
  vertices: GeoPoint[],
  point: GeoPoint,
): GeoPoint[] {
  if (isDuplicateOfLast(vertices, point)) {
    return vertices
  }
  return [...vertices, point]
}
