import type { GeoPoint } from '../types/geo'
import { EARTH_RADIUS_KM, haversineDistanceKm } from './distance'

/**
 * Geodesic polygon measurement on a sphere using the spherical-excess
 * (triangle-decomposition) formula:
 *
 *   A = R²/2 · Σ (λᵢ₊₂ − λᵢ) · sin(φᵢ₊₁)
 *
 * Edges are treated as great-circle arcs, so this is accurate for polygons
 * that do not straddle the antimeridian. A planar shoelace formula on
 * degrees is deliberately not used. The Earth radius matches the Haversine
 * convention used by the distance and polyline modules.
 *
 * Limitations (documented, not silently ignored):
 * - Longitudes are used as supplied. A ring that crosses the antimeridian
 *   should be unwrapped (e.g. 179° → 181°) so edge deltas stay small; the
 *   UI shows a warning when an edge spans more than 180° of longitude.
 * - Self-intersecting rings are detected and reported, but the numeric result
 *   is not meaningful for them.
 */

export type AreaUnit = 'm2' | 'ha' | 'km2' | 'ac'

export interface PolygonRing {
  readonly points: readonly GeoPoint[]
}

export interface PolygonGeometry {
  readonly outer: PolygonRing
  readonly holes?: readonly PolygonRing[]
}

export interface PolygonAreaResult {
  readonly areaM2: number
  readonly areaHa: number
  readonly areaKm2: number
  readonly areaAc: number
  readonly perimeterM: number
  readonly perimeterKm: number
  readonly vertexCount: number
  readonly hasHoles: boolean
  readonly selfIntersecting: boolean
  readonly antimeridianWarning: boolean
}

export interface PolygonAreaError {
  readonly ok: false
  readonly error: string
}

export interface PolygonAreaSuccess extends PolygonAreaResult {
  readonly ok: true
}

export type PolygonAreaComputeResult = PolygonAreaSuccess | PolygonAreaError

export const SQUARE_METERS_PER_HECTARE = 10000
export const SQUARE_METERS_PER_KILOMETER = 1_000_000
export const SQUARE_METERS_PER_ACRE = 4046.8564224

const METERS_PER_KM = 1000
const ANTIMERIDIAN_EDGE_DEG = 180

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

function isValidPoint(point: GeoPoint): boolean {
  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    point.longitude >= -180 &&
    point.longitude <= 180
  )
}

function samePoint(a: GeoPoint, b: GeoPoint): boolean {
  return (
    Math.abs(a.latitude - b.latitude) < 1e-12 &&
    Math.abs(a.longitude - b.longitude) < 1e-12
  )
}

function distinctVertexCount(points: readonly GeoPoint[]): number {
  const unique = new Set<string>()
  for (const point of points) {
    unique.add(`${point.latitude.toFixed(12)},${point.longitude.toFixed(12)}`)
  }
  return unique.size
}

/** Closes a ring logically, removing a duplicate closing vertex if present. */
export function normalizeRing(points: readonly GeoPoint[]): GeoPoint[] {
  if (points.length === 0) {
    return []
  }
  const ring = [...points]
  if (ring.length > 1 && samePoint(ring[0], ring[ring.length - 1])) {
    ring.pop()
  }
  return ring
}

/** Perimeter of an open or closed ring, without double counting the seam. */
export function ringPerimeterMeters(points: readonly GeoPoint[]): number {
  const ring = normalizeRing(points)
  if (ring.length < 2) {
    return 0
  }
  let sum = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    sum += haversineDistanceKm(a, b) * METERS_PER_KM
  }
  return sum
}

/**
 * Signed area (square metres) of a ring via spherical excess. Returns null when
 * the ring cannot form a polygon (fewer than three distinct vertices).
 *
 * Uses the triangle-decomposition form
 *   A = R²/2 · Σ (λᵢ₊₂ − λᵢ) · sin(φᵢ₊₁)
 * which is exact for spherical polygons bounded by great-circle arcs.
 */
export function ringAreaSquareMeters(
  points: readonly GeoPoint[],
  radiusKm: number = EARTH_RADIUS_KM,
): number | null {
  const ring = normalizeRing(points)
  if (ring.length < 3 || distinctVertexCount(ring) < 3) {
    return null
  }

  const radiusMeters = radiusKm * METERS_PER_KM
  let sum = 0
  for (let i = 0; i < ring.length; i++) {
    const previous = ring[i]
    const current = ring[(i + 1) % ring.length]
    const next = ring[(i + 2) % ring.length]
    sum +=
      toRadians(next.longitude - previous.longitude) *
      Math.sin(toRadians(current.latitude))
  }
  return Math.abs((radiusMeters * radiusMeters * sum) / 2)
}

/** True when any ring edge spans more than 180° of longitude. */
export function hasAntimeridianSpan(points: readonly GeoPoint[]): boolean {
  const ring = normalizeRing(points)
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    if (Math.abs(b.longitude - a.longitude) > ANTIMERIDIAN_EDGE_DEG) {
      return true
    }
  }
  return false
}

function orientation(
  a: GeoPoint,
  b: GeoPoint,
  c: GeoPoint,
): number {
  return (
    (b.longitude - a.longitude) * (c.latitude - a.latitude) -
    (b.latitude - a.latitude) * (c.longitude - a.longitude)
  )
}

function onSegment(a: GeoPoint, b: GeoPoint, c: GeoPoint): boolean {
  return (
    Math.min(a.longitude, b.longitude) <= c.longitude &&
    c.longitude <= Math.max(a.longitude, b.longitude) &&
    Math.min(a.latitude, b.latitude) <= c.latitude &&
    c.latitude <= Math.max(a.latitude, b.latitude)
  )
}

function segmentsIntersect(
  p1: GeoPoint,
  p2: GeoPoint,
  p3: GeoPoint,
  p4: GeoPoint,
): boolean {
  const d1 = orientation(p3, p4, p1)
  const d2 = orientation(p3, p4, p2)
  const d3 = orientation(p1, p2, p3)
  const d4 = orientation(p1, p2, p4)

  if (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  ) {
    return true
  }
  if (d1 === 0 && onSegment(p3, p4, p1)) return true
  if (d2 === 0 && onSegment(p3, p4, p2)) return true
  if (d3 === 0 && onSegment(p1, p2, p3)) return true
  if (d4 === 0 && onSegment(p1, p2, p4)) return true
  return false
}

/**
 * Detects whether a ring's edges cross. Uses a planar test on lon/lat, which is
 * an approximation but reliable for the moderate-size polygons this tool
 * targets. Adjacent edges sharing a vertex are ignored.
 */
export function isSelfIntersecting(points: readonly GeoPoint[]): boolean {
  const ring = normalizeRing(points)
  const n = ring.length
  if (n < 4) {
    return false
  }
  for (let i = 0; i < n; i++) {
    const a1 = ring[i]
    const a2 = ring[(i + 1) % n]
    for (let j = i + 1; j < n; j++) {
      if (j === i || (j + 1) % n === i || (i + 1) % n === j) {
        continue
      }
      const b1 = ring[j]
      const b2 = ring[(j + 1) % n]
      if (segmentsIntersect(a1, a2, b1, b2)) {
        return true
      }
    }
  }
  return false
}

function validateRing(
  ring: PolygonRing,
  label: string,
): PolygonAreaError | null {
  const vertices = normalizeRing(ring.points)
  if (vertices.length < 3 || distinctVertexCount(vertices) < 3) {
    return { ok: false, error: `${label} requires at least 3 distinct vertices.` }
  }
  if (!vertices.every(isValidPoint)) {
    return { ok: false, error: `${label} contains an invalid coordinate.` }
  }
  return null
}

export function convertArea(areaM2: number, unit: AreaUnit): number {
  switch (unit) {
    case 'm2':
      return areaM2
    case 'ha':
      return areaM2 / SQUARE_METERS_PER_HECTARE
    case 'km2':
      return areaM2 / SQUARE_METERS_PER_KILOMETER
    case 'ac':
      return areaM2 / SQUARE_METERS_PER_ACRE
  }
}

export function computePolygonArea(
  geometry: PolygonGeometry,
): PolygonAreaComputeResult {
  const outerError = validateRing(geometry.outer, 'Polygon')
  if (outerError) {
    return outerError
  }

  const outerArea = ringAreaSquareMeters(geometry.outer.points)
  if (outerArea === null) {
    return { ok: false, error: 'Polygon requires at least 3 distinct vertices.' }
  }

  let areaM2 = outerArea
  let perimeterM = ringPerimeterMeters(geometry.outer.points)
  let antimeridianWarning = hasAntimeridianSpan(geometry.outer.points)
  let selfIntersecting = isSelfIntersecting(geometry.outer.points)

  const holes = geometry.holes ?? []
  for (let i = 0; i < holes.length; i++) {
    const holeError = validateRing(holes[i], `Hole ${i + 1}`)
    if (holeError) {
      return holeError
    }
    const holeArea = ringAreaSquareMeters(holes[i].points)
    if (holeArea === null) {
      return { ok: false, error: `Hole ${i + 1} is not a valid ring.` }
    }
    areaM2 -= holeArea
    perimeterM += ringPerimeterMeters(holes[i].points)
    antimeridianWarning = antimeridianWarning || hasAntimeridianSpan(holes[i].points)
    selfIntersecting = selfIntersecting || isSelfIntersecting(holes[i].points)
  }

  areaM2 = Math.max(0, areaM2)

  return {
    ok: true,
    areaM2,
    areaHa: areaM2 / SQUARE_METERS_PER_HECTARE,
    areaKm2: areaM2 / SQUARE_METERS_PER_KILOMETER,
    areaAc: areaM2 / SQUARE_METERS_PER_ACRE,
    perimeterM,
    perimeterKm: perimeterM / METERS_PER_KM,
    vertexCount: normalizeRing(geometry.outer.points).length,
    hasHoles: holes.length > 0,
    selfIntersecting,
    antimeridianWarning,
  }
}

export function areaUnitSymbol(unit: AreaUnit): string {
  switch (unit) {
    case 'm2':
      return 'm²'
    case 'ha':
      return 'ha'
    case 'km2':
      return 'km²'
    case 'ac':
      return 'ac'
  }
}

export function areaUnitLabel(unit: AreaUnit): string {
  switch (unit) {
    case 'm2':
      return 'Square meters'
    case 'ha':
      return 'Hectares'
    case 'km2':
      return 'Square kilometers'
    case 'ac':
      return 'Acres'
  }
}

export function areaUnitPrecision(unit: AreaUnit): number {
  switch (unit) {
    case 'm2':
      return 1
    case 'ha':
      return 4
    case 'km2':
      return 6
    case 'ac':
      return 4
  }
}
