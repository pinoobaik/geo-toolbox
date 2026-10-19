import type { GeoPoint } from '../types/geo'
import { assertValidPoint } from './validation'

export const CARDINAL_DIRECTIONS = [
  'N',
  'NE',
  'E',
  'SE',
  'S',
  'SW',
  'W',
  'NW',
] as const

export type CardinalDirection = (typeof CARDINAL_DIRECTIONS)[number]

/** Two points closer than this (in degrees) are treated as identical. */
const IDENTICAL_POINT_TOLERANCE = 1e-9

export interface BearingValues {
  readonly initial: number
  readonly final: number
  readonly reverseInitial: number
  readonly initialCardinal: CardinalDirection
  readonly finalCardinal: CardinalDirection
  readonly reverseCardinal: CardinalDirection
}

export type BearingResult =
  | { readonly defined: true; readonly value: BearingValues }
  | { readonly defined: false; readonly reason: 'identical-points' }

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI
}

/** Normalizes an azimuth into the interval [0, 360). */
export function normalizeAzimuth(degrees: number): number {
  const normalized = degrees % 360
  return normalized < 0 ? normalized + 360 : normalized + 0
}

export function isSamePoint(a: GeoPoint, b: GeoPoint): boolean {
  return (
    Math.abs(a.latitude - b.latitude) < IDENTICAL_POINT_TOLERANCE &&
    Math.abs(a.longitude - b.longitude) < IDENTICAL_POINT_TOLERANCE
  )
}

/**
 * Initial bearing (forward azimuth) in degrees from A to B along the
 * great-circle path, normalized to [0, 360).
 */
export function initialBearing(a: GeoPoint, b: GeoPoint): number {
  assertValidPoint(a, 'Point A')
  assertValidPoint(b, 'Point B')
  if (isSamePoint(a, b)) {
    throw new RangeError('Bearing is undefined for identical points.')
  }

  const latitude1 = toRadians(a.latitude)
  const latitude2 = toRadians(b.latitude)
  const deltaLongitude = toRadians(b.longitude - a.longitude)

  const y = Math.sin(deltaLongitude) * Math.cos(latitude2)
  const x =
    Math.cos(latitude1) * Math.sin(latitude2) -
    Math.sin(latitude1) * Math.cos(latitude2) * Math.cos(deltaLongitude)

  return normalizeAzimuth(toDegrees(Math.atan2(y, x)))
}

/** Initial bearing from B to A (the heading back towards the origin). */
export function reverseInitialBearing(a: GeoPoint, b: GeoPoint): number {
  return initialBearing(b, a)
}

/**
 * Final bearing on arrival at B when travelling from A to B along the
 * great-circle path. This equals the reverse initial bearing rotated by 180°
 * and is a distinct value from the reverse initial bearing.
 */
export function finalBearing(a: GeoPoint, b: GeoPoint): number {
  return normalizeAzimuth(reverseInitialBearing(a, b) + 180)
}

/**
 * Maps an azimuth to one of eight cardinal/intercardinal directions.
 *
 * Each sector spans 45°, centred on its cardinal direction, so N covers
 * [337.5, 360) ∪ [0, 22.5), NE covers [22.5, 67.5), and so on.
 */
export function azimuthToCardinal(azimuth: number): CardinalDirection {
  const normalized = normalizeAzimuth(azimuth)
  const index = Math.round(normalized / 45) % CARDINAL_DIRECTIONS.length
  return CARDINAL_DIRECTIONS[index]
}

/**
 * Computes all bearing values at once, treating identical points as an
 * explicit undefined result instead of returning NaN.
 */
export function computeBearing(a: GeoPoint, b: GeoPoint): BearingResult {
  assertValidPoint(a, 'Point A')
  assertValidPoint(b, 'Point B')
  if (isSamePoint(a, b)) {
    return { defined: false, reason: 'identical-points' }
  }

  const initial = initialBearing(a, b)
  const reverseInitial = reverseInitialBearing(a, b)
  const final = normalizeAzimuth(reverseInitial + 180)

  return {
    defined: true,
    value: {
      initial,
      final,
      reverseInitial,
      initialCardinal: azimuthToCardinal(initial),
      finalCardinal: azimuthToCardinal(final),
      reverseCardinal: azimuthToCardinal(reverseInitial),
    },
  }
}
