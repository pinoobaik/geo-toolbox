import { describe, expect, it } from 'vitest'
import type { ParseResult } from '../types/geo'
import {
  dmsComponentsToDecimal,
  decimalToDms,
  formatDecimalDegrees,
  formatDms,
  isValidCoordinate,
  isValidLatitude,
  isValidLongitude,
  parseDecimalDegrees,
  parseDms,
  parseDmsToDecimal,
} from './coordinates'

function unwrap<T>(result: ParseResult<T>): T {
  if (!result.ok) {
    throw new Error(`Expected ok result, received: ${result.error.message}`)
  }
  return result.value
}

function expectError<T>(result: ParseResult<T>): void {
  expect(result.ok).toBe(false)
}

describe('parseDecimalDegrees', () => {
  it('parses positive, negative and zero values', () => {
    expect(unwrap(parseDecimalDegrees('110.3695'))).toBeCloseTo(110.3695, 6)
    expect(unwrap(parseDecimalDegrees('-7.7956'))).toBeCloseTo(-7.7956, 6)
    expect(unwrap(parseDecimalDegrees('0'))).toBe(0)
    expect(unwrap(parseDecimalDegrees('+7.5'))).toBeCloseTo(7.5, 6)
  })

  it('rejects empty and malformed input', () => {
    expectError(parseDecimalDegrees(''))
    expectError(parseDecimalDegrees('   '))
    expectError(parseDecimalDegrees('abc'))
    expectError(parseDecimalDegrees('7,5'))
    expectError(parseDecimalDegrees('7.5.5'))
    expectError(parseDecimalDegrees('7.5 N'))
  })
})

describe('parseDms formats', () => {
  it('parses degree, minute and second symbols with a suffix hemisphere', () => {
    const value = unwrap(parseDmsToDecimal('7°47\'44.16" S', 'latitude'))
    expect(value).toBeCloseTo(-7.7956, 4)
  })

  it('parses whitespace separated values', () => {
    const value = unwrap(parseDmsToDecimal('7 47 44.16 S', 'latitude'))
    expect(value).toBeCloseTo(-7.7956, 4)
  })

  it('parses a prefix hemisphere', () => {
    const value = unwrap(parseDmsToDecimal('N 7 47 44.16', 'latitude'))
    expect(value).toBeCloseTo(7.7956, 4)
  })

  it('parses prime symbols', () => {
    const value = unwrap(parseDmsToDecimal('7°47′44.16″ S', 'latitude'))
    expect(value).toBeCloseTo(-7.7956, 4)
  })

  it('parses hemisphere attached without a space', () => {
    const value = unwrap(parseDmsToDecimal('110°22\'10"E', 'longitude'))
    expect(value).toBeCloseTo(110.369444, 5)
  })

  it('parses a bare decimal as a single degree component', () => {
    expect(unwrap(parseDmsToDecimal('7.7956', 'latitude'))).toBeCloseTo(
      7.7956,
      6,
    )
    expect(unwrap(parseDmsToDecimal('-7.7956', 'latitude'))).toBeCloseTo(
      -7.7956,
      6,
    )
  })

  it('derives the hemisphere from the sign when omitted', () => {
    expect(unwrap(parseDmsToDecimal('7 47 44.16', 'latitude'))).toBeGreaterThan(
      0,
    )
    expect(
      unwrap(parseDmsToDecimal('-7 47 44.16', 'latitude')),
    ).toBeLessThan(0)
    expect(unwrap(parseDmsToDecimal('110 22 10', 'longitude'))).toBeGreaterThan(
      0,
    )
  })

  it('identity is preserved for zero degrees (equator / prime meridian)', () => {
    const latitude = unwrap(parseDms('0', 'latitude'))
    expect(latitude.degrees).toBe(0)
    expect(latitude.hemisphere).toBe('N')
    expect(dmsComponentsToDecimal(latitude)).toBe(0)

    const longitude = unwrap(parseDms('0°0\'0"', 'longitude'))
    expect(longitude.hemisphere).toBe('E')
    expect(dmsComponentsToDecimal(longitude)).toBe(0)
  })
})

describe('parseDms sea level extremes', () => {
  it('accepts maximum latitude and longitude', () => {
    expect(
      unwrap(parseDmsToDecimal('90°0\'0" N', 'latitude')),
    ).toBeCloseTo(90, 6)
    expect(
      unwrap(parseDmsToDecimal('90°0\'0" S', 'latitude')),
    ).toBeCloseTo(-90, 6)
    expect(
      unwrap(parseDmsToDecimal('180°0\'0" E', 'longitude')),
    ).toBeCloseTo(180, 6)
    expect(
      unwrap(parseDmsToDecimal('180°0\'0" W', 'longitude')),
    ).toBeCloseTo(-180, 6)
  })

  it('rejects values beyond the maximum', () => {
    expectError(parseDms('90°0\'1" N', 'latitude'))
    expectError(parseDms('180°0\'1" E', 'longitude'))
    expectError(parseDms('91 0 0', 'latitude'))
    expectError(parseDms('181', 'longitude'))
  })
})

describe('parseDms validation', () => {
  it('rejects minutes and seconds outside their range', () => {
    expectError(parseDms('7°60\'0"', 'latitude'))
    expectError(parseDms('7°30\'60"', 'latitude'))
    expectError(parseDms('7 75 0', 'latitude'))
    expectError(parseDms('7 30 75', 'latitude'))
  })

  it('rejects hemisphere mismatches for the axis', () => {
    expectError(parseDms('7 0 0 S', 'longitude'))
    expectError(parseDms('110 0 0 E', 'latitude'))
  })

  it('rejects a negative value combined with a hemisphere', () => {
    expectError(parseDms('-7 S', 'latitude'))
  })

  it('rejects conflicting hemispheres', () => {
    expectError(parseDms('N 7 S', 'latitude'))
  })

  it('rejects empty and malformed input', () => {
    expectError(parseDms('', 'latitude'))
    expectError(parseDms('   ', 'latitude'))
    expectError(parseDms('abc', 'latitude'))
    expectError(parseDms('7°xx\'0"', 'latitude'))
    expectError(parseDms('1 2 3 4', 'latitude'))
  })

  it('requires whole degrees when minutes or seconds are present', () => {
    expectError(parseDms('7.5 30', 'latitude'))
  })
})

describe('decimalToDms and formatting', () => {
  it('converts positive and negative values with hemispheres', () => {
    const south = unwrap(decimalToDms(-7.7956, 'latitude'))
    expect(south.hemisphere).toBe('S')
    expect(south.degrees).toBe(7)

    const west = unwrap(decimalToDms(-110.3695, 'longitude'))
    expect(west.hemisphere).toBe('W')
    expect(west.degrees).toBe(110)
  })

  it('carries rounded seconds into minutes', () => {
    const result = unwrap(decimalToDms(0.9999999, 'latitude', 0))
    expect(result).toEqual({
      degrees: 1,
      minutes: 0,
      seconds: 0,
      hemisphere: 'N',
    })
  })

  it('never renders minutes or seconds as 60', () => {
    const result = unwrap(
      decimalToDms(7 + 47 / 60 + 44.9999999 / 3600, 'latitude', 3),
    )
    expect(result.seconds).toBeLessThan(60)
    expect(result.minutes).toBeLessThan(60)

    const text = formatDms(result, 3)
    expect(text).not.toContain("60'")
    expect(text).not.toContain('60.000"')
  })

  it('formats decimal degrees with configurable precision', () => {
    expect(formatDecimalDegrees(110.3695)).toBe('110.369500')
    expect(formatDecimalDegrees(110.3695, 2)).toBe('110.37')
    expect(formatDecimalDegrees(-7.7956, 4)).toBe('-7.7956')
  })

  it('round trips decimal -> DMS -> decimal within tolerance', () => {
    const samples: readonly { value: number; axis: 'latitude' | 'longitude' }[] =
      [
        { value: 0, axis: 'latitude' },
        { value: 0, axis: 'longitude' },
        { value: 7.7956, axis: 'latitude' },
        { value: -7.7956, axis: 'latitude' },
        { value: 110.3695, axis: 'longitude' },
        { value: -110.3695, axis: 'longitude' },
        { value: 89.9999, axis: 'latitude' },
        { value: 179.9999, axis: 'longitude' },
        { value: -45, axis: 'latitude' },
        { value: -179.9999, axis: 'longitude' },
      ]
    for (const { value, axis } of samples) {
      const dms = unwrap(decimalToDms(value, axis, 6))
      expect(dmsComponentsToDecimal(dms)).toBeCloseTo(value, 6)
    }
  })

  it('rejects out-of-range decimals', () => {
    expectError(decimalToDms(91, 'latitude'))
    expectError(decimalToDms(181, 'longitude'))
  })
})

describe('coordinate validity helpers', () => {
  it('validates latitude and longitude ranges', () => {
    expect(isValidLatitude(90)).toBe(true)
    expect(isValidLatitude(-90)).toBe(true)
    expect(isValidLatitude(90.0001)).toBe(false)
    expect(isValidLongitude(180)).toBe(true)
    expect(isValidLongitude(-180)).toBe(true)
    expect(isValidLongitude(180.0001)).toBe(false)
    expect(isValidCoordinate({ latitude: 0, longitude: 0 })).toBe(true)
    expect(isValidCoordinate({ latitude: 95, longitude: 0 })).toBe(false)
  })
})
