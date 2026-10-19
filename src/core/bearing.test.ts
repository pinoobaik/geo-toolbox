import { describe, expect, it } from 'vitest'
import type { GeoPoint } from '../types/geo'
import {
  azimuthToCardinal,
  computeBearing,
  finalBearing,
  initialBearing,
  isSamePoint,
  normalizeAzimuth,
  reverseInitialBearing,
} from './bearing'

const ORIGIN: GeoPoint = { latitude: 0, longitude: 0 }

describe('initialBearing cardinal directions', () => {
  it('computes N, E, S and W for axis-aligned routes', () => {
    expect(initialBearing(ORIGIN, { latitude: 1, longitude: 0 })).toBeCloseTo(
      0,
      9,
    )
    expect(initialBearing(ORIGIN, { latitude: 0, longitude: 1 })).toBeCloseTo(
      90,
      9,
    )
    expect(initialBearing(ORIGIN, { latitude: -1, longitude: 0 })).toBeCloseTo(
      180,
      9,
    )
    expect(initialBearing(ORIGIN, { latitude: 0, longitude: -1 })).toBeCloseTo(
      270,
      9,
    )
  })

  it('produces the expected intercardinal directions', () => {
    expect(
      azimuthToCardinal(initialBearing(ORIGIN, { latitude: 1, longitude: 1 })),
    ).toBe('NE')
    expect(
      azimuthToCardinal(initialBearing(ORIGIN, { latitude: -1, longitude: 1 })),
    ).toBe('SE')
    expect(
      azimuthToCardinal(
        initialBearing(ORIGIN, { latitude: -1, longitude: -1 }),
      ),
    ).toBe('SW')
    expect(
      azimuthToCardinal(initialBearing(ORIGIN, { latitude: 1, longitude: -1 })),
    ).toBe('NW')
  })
})

describe('normalizeAzimuth', () => {
  it('normalizes negative and large angles into [0, 360)', () => {
    expect(normalizeAzimuth(0)).toBe(0)
    expect(normalizeAzimuth(360)).toBe(0)
    expect(normalizeAzimuth(720)).toBe(0)
    expect(normalizeAzimuth(-10)).toBe(350)
    expect(normalizeAzimuth(-370)).toBe(350)
    expect(normalizeAzimuth(450)).toBe(90)
  })
})

describe('reverse and final bearings', () => {
  it('computes the reverse initial bearing', () => {
    const reverse = reverseInitialBearing(ORIGIN, {
      latitude: 0,
      longitude: 1,
    })
    expect(reverse).toBeCloseTo(270, 9)
  })

  it('rotates the reverse initial bearing by 180 degrees for the final bearing', () => {
    const a: GeoPoint = { latitude: 0, longitude: 0 }
    const b: GeoPoint = { latitude: 45, longitude: 90 }
    const reverse = reverseInitialBearing(a, b)
    expect(finalBearing(a, b)).toBeCloseTo(normalizeAzimuth(reverse + 180), 9)
  })

  it('keeps final and reverse initial bearings distinct on a diagonal route', () => {
    const a: GeoPoint = { latitude: 0, longitude: 0 }
    const b: GeoPoint = { latitude: 45, longitude: 90 }
    const initial = initialBearing(a, b)
    const reverse = reverseInitialBearing(a, b)
    const final = finalBearing(a, b)

    expect(final).not.toBeCloseTo(reverse, 1)
    expect(final).not.toBeCloseTo(initial, 1)
    expect(Math.abs(normalizeAzimuth(final - reverse))).toBeCloseTo(180, 6)
  })
})

describe('azimuthToCardinal sector boundaries', () => {
  it('maps azimuths to eight directions', () => {
    expect(azimuthToCardinal(0)).toBe('N')
    expect(azimuthToCardinal(22.4)).toBe('N')
    expect(azimuthToCardinal(22.5)).toBe('NE')
    expect(azimuthToCardinal(45)).toBe('NE')
    expect(azimuthToCardinal(67.5)).toBe('E')
    expect(azimuthToCardinal(90)).toBe('E')
    expect(azimuthToCardinal(135)).toBe('SE')
    expect(azimuthToCardinal(180)).toBe('S')
    expect(azimuthToCardinal(225)).toBe('SW')
    expect(azimuthToCardinal(270)).toBe('W')
    expect(azimuthToCardinal(315)).toBe('NW')
    expect(azimuthToCardinal(337.4)).toBe('NW')
    expect(azimuthToCardinal(337.5)).toBe('N')
    expect(azimuthToCardinal(359.9)).toBe('N')
    expect(azimuthToCardinal(-10)).toBe('N')
  })
})

describe('computeBearing', () => {
  it('returns all values with cardinal labels for distinct points', () => {
    const result = computeBearing(ORIGIN, { latitude: 0, longitude: 1 })
    expect(result.defined).toBe(true)
    if (!result.defined) {
      throw new Error('Expected defined bearing')
    }
    expect(result.value.initial).toBeCloseTo(90, 9)
    expect(result.value.initialCardinal).toBe('E')
    expect(result.value.reverseInitial).toBeCloseTo(270, 9)
    expect(result.value.final).toBeCloseTo(90, 9)
  })

  it('returns an undefined result for identical points', () => {
    const result = computeBearing(ORIGIN, { latitude: 0, longitude: 0 })
    expect(result.defined).toBe(false)
    if (result.defined) {
      throw new Error('Expected undefined bearing')
    }
    expect(result.reason).toBe('identical-points')
  })

  it('detects identical points with tolerance', () => {
    expect(isSamePoint(ORIGIN, { latitude: 0, longitude: 0 })).toBe(true)
    expect(isSamePoint(ORIGIN, { latitude: 1, longitude: 1 })).toBe(false)
  })
})

describe('invalid input handling', () => {
  it('rejects invalid coordinates instead of returning NaN', () => {
    expect(() =>
      initialBearing({ latitude: 91, longitude: 0 }, ORIGIN),
    ).toThrow(RangeError)
    expect(() =>
      reverseInitialBearing(ORIGIN, { latitude: 0, longitude: 200 }),
    ).toThrow(RangeError)
    expect(() =>
      computeBearing({ latitude: Number.NaN, longitude: 0 }, ORIGIN),
    ).toThrow(RangeError)
  })

  it('throws for identical points when a numeric bearing is requested', () => {
    expect(() => initialBearing(ORIGIN, ORIGIN)).toThrow(RangeError)
    expect(() => finalBearing(ORIGIN, ORIGIN)).toThrow(RangeError)
  })
})
