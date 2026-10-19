import type { GeoPoint } from '../types/geo'
import { assertValidPoint } from './validation'

/** Mean Earth radius in kilometres, as recommended by IUGG. */
export const EARTH_RADIUS_KM = 6371.0088

export const METERS_PER_KILOMETER = 1000
export const KILOMETERS_PER_MILE = 1.609344
export const KILOMETERS_PER_NAUTICAL_MILE = 1.852

export type DistanceUnit = 'kilometers' | 'meters' | 'miles' | 'nauticalMiles'

export interface DistanceUnitOption {
  readonly id: DistanceUnit
  readonly label: string
  readonly symbol: string
  readonly precision: number
}

export const DISTANCE_UNITS: readonly DistanceUnitOption[] = [
  { id: 'kilometers', label: 'Kilometers', symbol: 'km', precision: 3 },
  { id: 'meters', label: 'Meters', symbol: 'm', precision: 1 },
  { id: 'miles', label: 'Miles', symbol: 'mi', precision: 3 },
  { id: 'nauticalMiles', label: 'Nautical miles', symbol: 'nmi', precision: 3 },
]

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/**
 * Great-circle distance between two WGS84 points using the haversine formula.
 * The result is expressed in kilometres. Coordinates are validated first and
 * invalid input throws a RangeError rather than returning a misleading value.
 */
export function haversineDistanceKm(a: GeoPoint, b: GeoPoint): number {
  assertValidPoint(a, 'Point A')
  assertValidPoint(b, 'Point B')

  const latitude1 = toRadians(a.latitude)
  const latitude2 = toRadians(b.latitude)
  const deltaLatitude = toRadians(b.latitude - a.latitude)
  const deltaLongitude = toRadians(b.longitude - a.longitude)

  const sinLatitude = Math.sin(deltaLatitude / 2)
  const sinLongitude = Math.sin(deltaLongitude / 2)

  const haversine =
    sinLatitude * sinLatitude +
    Math.cos(latitude1) * Math.cos(latitude2) * sinLongitude * sinLongitude

  const clampedHaversine = Math.min(1, Math.max(0, haversine))

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(clampedHaversine))
}

/** Converts a distance in kilometres into the requested display unit. */
export function convertDistance(
  kilometers: number,
  unit: DistanceUnit,
): number {
  switch (unit) {
    case 'kilometers':
      return kilometers
    case 'meters':
      return kilometers * METERS_PER_KILOMETER
    case 'miles':
      return kilometers / KILOMETERS_PER_MILE
    case 'nauticalMiles':
      return kilometers / KILOMETERS_PER_NAUTICAL_MILE
  }
}

export function getDistanceUnit(unit: DistanceUnit): DistanceUnitOption {
  const option = DISTANCE_UNITS.find((candidate) => candidate.id === unit)
  if (!option) {
    throw new Error(`Unknown distance unit: ${unit}`)
  }
  return option
}

/**
 * Formats a distance for display. The numeric result stays in kilometres
 * internally; this only shapes the presentation string.
 */
export function formatDistance(
  kilometers: number,
  unit: DistanceUnit,
  precision?: number,
): string {
  const option = getDistanceUnit(unit)
  const value = convertDistance(kilometers, unit)
  const decimals = precision ?? option.precision
  return `${value.toFixed(decimals)} ${option.symbol}`
}
