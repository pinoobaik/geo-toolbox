import { describe, expect, it } from 'vitest'
import { computePolylineLength, formatLength } from './polylineLength'
import { haversineDistanceKm } from './distance'
import type { GeoPoint } from '../types/geo'

describe('Polyline length — validation', () => {
  it('rejects empty and single-point input', () => {
    expect(computePolylineLength([])).toMatchObject({ ok: false })
    expect(
      computePolylineLength([{ latitude: 0, longitude: 0 }]),
    ).toMatchObject({ ok: false })
  })

  it('rejects invalid coordinates', () => {
    const result = computePolylineLength([
      { latitude: 0, longitude: 0 },
      { latitude: 91, longitude: 0 },
    ])
    expect(result.ok).toBe(false)
  })
})

describe('Polyline length — measurement', () => {
  it('measures a two-point line', () => {
    const result = computePolylineLength([
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 1 },
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.segments).toHaveLength(1)
    expect(result.totalM).toBeGreaterThan(0)
    expect(result.totalM).toBeCloseTo(
      haversineDistanceKm(
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 1 },
      ) * 1000,
      6,
    )
  })

  it('sums segments and accumulates cumulative distance', () => {
    const points: GeoPoint[] = [
      { latitude: 0, longitude: 0 },
      { latitude: 0.01, longitude: 0 },
      { latitude: 0.01, longitude: 0.01 },
      { latitude: 0.02, longitude: 0.03 },
    ]
    const result = computePolylineLength(points)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.segments).toHaveLength(3)
    const sum = result.segments.reduce((total, s) => total + s.lengthM, 0)
    expect(sum).toBeCloseTo(result.totalM, 6)
    expect(result.segments[2].cumulativeM).toBeCloseTo(result.totalM, 9)
    expect(result.segments[0].index).toBe(1)
    expect(result.segments[0].from).toEqual(points[0])
    expect(result.segments[0].to).toEqual(points[1])
  })

  it('returns zero length for identical consecutive points', () => {
    const result = computePolylineLength([
      { latitude: 5, longitude: 5 },
      { latitude: 5, longitude: 5 },
      { latitude: 5, longitude: 6 },
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.segments[0].lengthM).toBe(0)
    expect(result.totalM).toBeGreaterThan(0)
  })

  it('preserves the total length when the order is reversed', () => {
    const points: GeoPoint[] = [
      { latitude: 10, longitude: 10 },
      { latitude: 11, longitude: 12 },
      { latitude: 12, longitude: 13 },
      { latitude: 13, longitude: 14 },
    ]
    const forward = computePolylineLength(points)
    const reverse = computePolylineLength([...points].reverse())
    expect(forward.ok && reverse.ok).toBe(true)
    if (!forward.ok || !reverse.ok) return
    expect(reverse.totalM).toBeCloseTo(forward.totalM, 6)
  })

  it('handles an antimeridian crossing without NaN or Infinity', () => {
    const result = computePolylineLength([
      { latitude: 0, longitude: 179.9 },
      { latitude: 0, longitude: -179.9 },
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Number.isFinite(result.totalM)).toBe(true)
    // Roughly 0.2° of longitude near the equator, ~22 km, not ~40,000 km.
    expect(result.totalM).toBeGreaterThan(10000)
    expect(result.totalM).toBeLessThan(30000)
  })
})

describe('Polyline length — formatting and units', () => {
  it('formats lengths in each unit', () => {
    expect(formatLength(1000, 'kilometers')).toBe('1.000 km')
    expect(formatLength(1000, 'meters')).toBe('1000.0 m')
    expect(formatLength(1609.344, 'miles')).toBe('1.000 mi')
    expect(formatLength(1852, 'nauticalMiles')).toBe('1.000 nmi')
  })

  it('keeps numeric values separate from formatted strings', () => {
    const result = computePolylineLength([
      { latitude: 0, longitude: 0 },
      { latitude: 1, longitude: 0 },
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(typeof result.totalM).toBe('number')
    expect(typeof formatLength(result.totalM, 'kilometers')).toBe('string')
  })
})
