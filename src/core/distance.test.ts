import { describe, expect, it } from 'vitest'
import type { GeoPoint } from '../types/geo'
import {
  KILOMETERS_PER_MILE,
  KILOMETERS_PER_NAUTICAL_MILE,
  convertDistance,
  formatDistance,
  haversineDistanceKm,
} from './distance'

const EQUATOR_A: GeoPoint = { latitude: 0, longitude: 0 }
const EQUATOR_B: GeoPoint = { latitude: 0, longitude: 1 }

describe('haversineDistanceKm', () => {
  it('returns exactly zero for identical points', () => {
    const point: GeoPoint = { latitude: -7.7956, longitude: 110.3695 }
    expect(haversineDistanceKm(point, point)).toBe(0)
  })

  it('measures one degree of longitude along the equator as ~111.195 km', () => {
    expect(haversineDistanceKm(EQUATOR_A, EQUATOR_B)).toBeCloseTo(111.195, 2)
  })

  it('is symmetric', () => {
    const a: GeoPoint = { latitude: 7.7956, longitude: 110.3695 }
    const b: GeoPoint = { latitude: 48.8566, longitude: 2.3522 }
    const forward = haversineDistanceKm(a, b)
    const backward = haversineDistanceKm(b, a)
    expect(backward).toBeCloseTo(forward, 12)
    expect(Math.abs(forward - backward)).toBeLessThan(1e-9)
  })

  it('handles routes crossing the antimeridian', () => {
    const west: GeoPoint = { latitude: 0, longitude: 179 }
    const east: GeoPoint = { latitude: 0, longitude: -179 }
    const across = haversineDistanceKm(west, east)
    const reference = haversineDistanceKm(
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 2 },
    )
    expect(across).toBeCloseTo(reference, 9)
    expect(across).toBeCloseTo(222.39, 1)
  })

  it('remains stable near the poles', () => {
    const pole: GeoPoint = { latitude: 90, longitude: 0 }
    const nearPole: GeoPoint = { latitude: 89.9, longitude: 0 }
    const distance = haversineDistanceKm(pole, nearPole)
    expect(Number.isFinite(distance)).toBe(true)
    expect(distance).toBeCloseTo(11.12, 1)

    const otherSide: GeoPoint = { latitude: 89.9, longitude: 180 }
    expect(Number.isFinite(haversineDistanceKm(nearPole, otherSide))).toBe(true)
    expect(haversineDistanceKm(pole, pole)).toBe(0)
  })

  it('rejects invalid coordinates', () => {
    expect(() =>
      haversineDistanceKm({ latitude: 91, longitude: 0 }, EQUATOR_A),
    ).toThrow(RangeError)
    expect(() =>
      haversineDistanceKm(EQUATOR_A, { latitude: 0, longitude: 181 }),
    ).toThrow(RangeError)
    expect(() =>
      haversineDistanceKm({ latitude: Number.NaN, longitude: 0 }, EQUATOR_A),
    ).toThrow(RangeError)
  })
})

describe('convertDistance', () => {
  it('converts between kilometres, metres, miles and nautical miles', () => {
    expect(convertDistance(1, 'kilometers')).toBe(1)
    expect(convertDistance(1, 'meters')).toBe(1000)
    expect(convertDistance(1, 'miles')).toBeCloseTo(1 / KILOMETERS_PER_MILE, 12)
    expect(convertDistance(1, 'nauticalMiles')).toBeCloseTo(
      1 / KILOMETERS_PER_NAUTICAL_MILE,
      12,
    )
  })

  it('matches known conversion values', () => {
    expect(convertDistance(1, 'miles')).toBeCloseTo(0.621371, 1)
    expect(convertDistance(1, 'nauticalMiles')).toBeCloseTo(0.539957, 1)
    expect(convertDistance(5, 'meters')).toBe(5000)
  })
})

describe('formatDistance', () => {
  it('formats each unit with its own precision and symbol', () => {
    expect(formatDistance(1, 'kilometers')).toBe('1.000 km')
    expect(formatDistance(1, 'meters')).toBe('1000.0 m')
    expect(formatDistance(1, 'miles')).toBe('0.621 mi')
    expect(formatDistance(1, 'nauticalMiles')).toBe('0.540 nmi')
  })
})
