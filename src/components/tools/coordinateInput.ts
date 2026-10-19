import type { GeoPoint } from '../../types/geo'
import type { CoordinateAxis } from '../../core/coordinates'
import {
  dmsComponentsToDecimal,
  isValidLatitude,
  isValidLongitude,
  parseDecimalDegrees,
  parseDms,
} from '../../core/coordinates'
import type { CoordinateInput } from '../ui/CoordinatePair'

export const EMPTY_COORDINATE_INPUT: CoordinateInput = {
  latitude: '',
  longitude: '',
}

/** Validation message for a single decimal axis, or undefined when blank/valid. */
export function decimalAxisError(
  text: string,
  axis: CoordinateAxis,
): string | undefined {
  if (text.trim() === '') {
    return undefined
  }
  const parsed = parseDecimalDegrees(text)
  if (!parsed.ok) {
    return parsed.error.message
  }
  const valid =
    axis === 'latitude'
      ? isValidLatitude(parsed.value)
      : isValidLongitude(parsed.value)
  if (!valid) {
    return axis === 'latitude'
      ? 'Latitude must be between -90 and 90 degrees.'
      : 'Longitude must be between -180 and 180 degrees.'
  }
  return undefined
}

/** Validation message for a single DMS axis, or undefined when blank/valid. */
export function dmsAxisError(
  text: string,
  axis: CoordinateAxis,
): string | undefined {
  if (text.trim() === '') {
    return undefined
  }
  const parsed = parseDms(text, axis)
  return parsed.ok ? undefined : parsed.error.message
}

/** Parses a decimal degree pair into a valid point, or null when incomplete. */
export function parseDecimalCoordinate(
  input: CoordinateInput,
): GeoPoint | null {
  const latitude = parseDecimalDegrees(input.latitude)
  const longitude = parseDecimalDegrees(input.longitude)
  if (!latitude.ok || !longitude.ok) {
    return null
  }
  if (!isValidLatitude(latitude.value) || !isValidLongitude(longitude.value)) {
    return null
  }
  return { latitude: latitude.value, longitude: longitude.value }
}

/** Parses a DMS pair into a valid point, or null when incomplete. */
export function parseDmsCoordinate(input: CoordinateInput): GeoPoint | null {
  const latitude = parseDms(input.latitude, 'latitude')
  const longitude = parseDms(input.longitude, 'longitude')
  if (!latitude.ok || !longitude.ok) {
    return null
  }
  return {
    latitude: dmsComponentsToDecimal(latitude.value),
    longitude: dmsComponentsToDecimal(longitude.value),
  }
}

/** Formats a point into a fixed-precision decimal degree pair. */
export function formatCoordinateInput(
  point: GeoPoint,
  precision: number,
): CoordinateInput {
  return {
    latitude: point.latitude.toFixed(precision),
    longitude: point.longitude.toFixed(precision),
  }
}
