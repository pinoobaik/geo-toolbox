import { describe, expect, it } from 'vitest'
import {
  areaUnitLabel,
  areaUnitSymbol,
  computePolygonArea,
  convertArea,
  isSelfIntersecting,
  normalizeRing,
  ringAreaSquareMeters,
  ringPerimeterMeters,
} from './polygonArea'
import { EARTH_RADIUS_KM } from './distance'
import type { GeoPoint } from '../types/geo'

function ring(coords: readonly [number, number][]): GeoPoint[] {
  return coords.map(([latitude, longitude]) => ({ latitude, longitude }))
}

const R_METERS = EARTH_RADIUS_KM * 1000

/** Analytic area of the lat/lon rectangle R²·Δλ·(sinφ2 − sinφ1). */
function rectangleAreaM2(
  lat1: number,
  lat2: number,
  lon1: number,
  lon2: number,
): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const s1 = Math.sin((lat1 * Math.PI) / 180)
  const s2 = Math.sin((lat2 * Math.PI) / 180)
  return R_METERS * R_METERS * dLon * (s2 - s1)
}

describe('Polygon area — geometry validation', () => {
  it('rejects rings with fewer than three distinct vertices', () => {
    expect(computePolygonArea({ outer: { points: ring([[0, 0], [0, 1]]) } })).toMatchObject({
      ok: false,
    })
    expect(
      computePolygonArea({ outer: { points: ring([[1, 1], [1, 1], [1, 1]]) } }),
    ).toMatchObject({ ok: false })
  })

  it('rejects invalid coordinates', () => {
    const result = computePolygonArea({
      outer: {
        points: [
          { latitude: 0, longitude: 0 },
          { latitude: 0, longitude: 1 },
          { latitude: Number.NaN, longitude: 1 },
        ],
      },
    })
    expect(result.ok).toBe(false)
  })

  it('reports vertex count and hole presence', () => {
    const result = computePolygonArea({
      outer: { points: ring([[0, 0], [0, 1], [1, 1], [1, 0]]) },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.vertexCount).toBe(4)
    expect(result.hasHoles).toBe(false)
  })
})

describe('Polygon area — accuracy', () => {
  it('matches the analytic sphere area for an equatorial degree cell', () => {
    const result = computePolygonArea({
      outer: { points: ring([[0, 0], [0, 1], [1, 1], [1, 0]]) },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const expected = rectangleAreaM2(0, 1, 0, 1)
    expect(Math.abs(result.areaM2 - expected) / expected).toBeLessThan(1e-9)
  })

  it('matches the analytic area at high latitude', () => {
    const result = computePolygonArea({
      outer: { points: ring([[60, 10], [60, 11], [61, 11], [61, 10]]) },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const expected = rectangleAreaM2(60, 61, 10, 11)
    expect(Math.abs(result.areaM2 - expected) / expected).toBeLessThan(1e-9)
  })

  it('treats a closed ring and its open equivalent identically', () => {
    const open = ring([[0, 0], [0, 1], [1, 1], [1, 0]])
    const closed = ring([[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]])
    const openResult = computePolygonArea({ outer: { points: open } })
    const closedResult = computePolygonArea({ outer: { points: closed } })
    expect(openResult.ok && closedResult.ok).toBe(true)
    if (!openResult.ok || !closedResult.ok) return
    expect(closedResult.areaM2).toBeCloseTo(openResult.areaM2, 6)
    expect(closedResult.perimeterM).toBeCloseTo(openResult.perimeterM, 6)
  })

  it('does not change the area when the ring order is reversed', () => {
    const ccw = ring([[0, 0], [0, 1], [1, 1], [1, 0]])
    const cw = [...ccw].reverse()
    const a = computePolygonArea({ outer: { points: ccw } })
    const b = computePolygonArea({ outer: { points: cw } })
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    expect(b.areaM2).toBeCloseTo(a.areaM2, 6)
  })
})

describe('Polygon area — perimeter', () => {
  it('does not double count an explicit closing vertex', () => {
    const open = ring([[0, 0], [0, 1], [1, 1], [1, 0]])
    const closed = ring([[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]])
    expect(ringPerimeterMeters(closed)).toBeCloseTo(
      ringPerimeterMeters(open),
      6,
    )
  })

  it('exposes the perimeter in metres and kilometres', () => {
    const result = computePolygonArea({
      outer: { points: ring([[0, 0], [0, 1], [1, 1], [1, 0]]) },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.perimeterKm).toBeCloseTo(result.perimeterM / 1000, 9)
  })
})

describe('Polygon area — holes', () => {
  it('subtracts hole area and adds hole perimeter', () => {
    const outer = ring([[0, 0], [0, 1], [1, 1], [1, 0]])
    const hole = ring([[0.25, 0.25], [0.25, 0.75], [0.75, 0.75], [0.75, 0.25]])
    const withoutHole = computePolygonArea({ outer: { points: outer } })
    const withHole = computePolygonArea({
      outer: { points: outer },
      holes: [{ points: hole }],
    })
    expect(withoutHole.ok && withHole.ok).toBe(true)
    if (!withoutHole.ok || !withHole.ok) return
    const holeArea = ringAreaSquareMeters(hole)
    expect(holeArea).not.toBeNull()
    expect(withHole.areaM2).toBeCloseTo(
      withoutHole.areaM2 - (holeArea as number),
      6,
    )
    expect(withHole.perimeterM).toBeCloseTo(
      withoutHole.perimeterM + ringPerimeterMeters(hole),
      6,
    )
    expect(withHole.hasHoles).toBe(true)
  })
})

describe('Polygon area — units', () => {
  it('converts square metres into every supported unit', () => {
    const m2 = 10000
    expect(convertArea(m2, 'm2')).toBe(10000)
    expect(convertArea(m2, 'ha')).toBeCloseTo(1, 12)
    expect(convertArea(m2, 'km2')).toBeCloseTo(0.01, 12)
    expect(convertArea(m2, 'ac')).toBeCloseTo(10000 / 4046.8564224, 9)
  })

  it('provides labels, symbols and result fields consistently', () => {
    const result = computePolygonArea({
      outer: { points: ring([[0, 0], [0, 1], [1, 1], [1, 0]]) },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.areaHa).toBeCloseTo(result.areaM2 / 10000, 9)
    expect(result.areaKm2).toBeCloseTo(result.areaM2 / 1_000_000, 9)
    expect(result.areaAc).toBeCloseTo(result.areaM2 / 4046.8564224, 6)
    expect(areaUnitSymbol('km2')).toBe('km²')
    expect(areaUnitLabel('ha')).toBe('Hectares')
  })
})

describe('Polygon area — degenerate and special cases', () => {
  it('detects a self-intersecting (bowtie) ring', () => {
    const bowtie = ring([[0, 0], [0, 1], [1, 0], [1, 1]])
    expect(isSelfIntersecting(bowtie)).toBe(true)
    const result = computePolygonArea({ outer: { points: bowtie } })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.selfIntersecting).toBe(true)
  })

  it('does not flag a simple ring as self-intersecting', () => {
    expect(isSelfIntersecting(ring([[0, 0], [0, 1], [1, 1], [1, 0]]))).toBe(false)
  })

  it('warns when an edge spans the antimeridian', () => {
    const crossing = ring([[0, 179], [0, -179], [1, -179], [1, 179]])
    const result = computePolygonArea({ outer: { points: crossing } })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.antimeridianWarning).toBe(true)
  })

  it('normalizes an explicitly closed ring to unique vertices', () => {
    const closed = ring([[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]])
    expect(normalizeRing(closed)).toHaveLength(4)
  })
})
