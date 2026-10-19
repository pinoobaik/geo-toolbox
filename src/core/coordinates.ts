import type {
  GeoPoint,
  ParseResult,
} from '../types/geo'
import { parseError, parseOk } from '../types/geo'

/** Maximum absolute value for a latitude in decimal degrees. */
export const MAX_LATITUDE = 90

/** Maximum absolute value for a longitude in decimal degrees. */
export const MAX_LONGITUDE = 180

/** Default number of decimal places used when formatting decimal degrees. */
export const DEFAULT_DECIMAL_PRECISION = 6

/** Default number of decimal places used when formatting DMS seconds. */
export const DEFAULT_SECONDS_PRECISION = 3

export type CoordinateAxis = 'latitude' | 'longitude'

export const HEMISPHERES = ['N', 'S', 'E', 'W'] as const

export type Hemisphere = (typeof HEMISPHERES)[number]

/** An absolute DMS value paired with a hemisphere. */
export interface DmsComponents {
  readonly degrees: number
  readonly minutes: number
  readonly seconds: number
  readonly hemisphere: Hemisphere
}

const NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/
const INTEGER_PATTERN = /^[+-]?\d+$/
const PRIME_CHARACTERS = /[°º′″'"]/g
const LEADING_HEMISPHERE = /^([NSEWnsew])(?=\s|[\d.°º′″'"+-]|$)/
const TRAILING_HEMISPHERE = /([NSEWnsew])\s*$/

function axisLabel(axis: CoordinateAxis): string {
  return axis === 'latitude' ? 'Latitude' : 'Longitude'
}

function axisMaximum(axis: CoordinateAxis): number {
  return axis === 'latitude' ? MAX_LATITUDE : MAX_LONGITUDE
}

function isHemisphere(value: string): value is Hemisphere {
  return (HEMISPHERES as readonly string[]).includes(value)
}

export function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value) <= MAX_LATITUDE
}

export function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value) <= MAX_LONGITUDE
}

export function isValidCoordinate(point: GeoPoint): boolean {
  return isValidLatitude(point.latitude) && isValidLongitude(point.longitude)
}

/**
 * Parses a plain decimal degree string. Range is not validated here because
 * the valid range depends on whether the value is a latitude or a longitude.
 */
export function parseDecimalDegrees(input: string): ParseResult<number> {
  const trimmed = input.trim()
  if (trimmed === '') {
    return parseError('empty', 'Enter a decimal degree value.')
  }
  if (!NUMBER_PATTERN.test(trimmed)) {
    return parseError('format', 'Enter a valid number, for example 110.3695.')
  }
  const value = Number(trimmed)
  if (!Number.isFinite(value)) {
    return parseError('range', 'The value must be a finite number.')
  }
  return parseOk(value)
}

/**
 * Parses a DMS string (with degree/minute/second symbols or whitespace
 * separated values) into absolute components plus a hemisphere.
 *
 * The axis must be supplied so that hemisphere letters can be validated
 * (latitude only accepts N/S, longitude only accepts E/W).
 */
export function parseDms(
  input: string,
  axis: CoordinateAxis,
): ParseResult<DmsComponents> {
  const raw = input.trim()
  if (raw === '') {
    return parseError('empty', `Enter a ${axis} value.`)
  }

  let body = raw
  let hemisphere: Hemisphere | null = null
  let conflict = false

  const applyHemisphere = (character: string): void => {
    const upper = character.toUpperCase()
    if (!isHemisphere(upper)) {
      return
    }
    if (hemisphere !== null && hemisphere !== upper) {
      conflict = true
      return
    }
    hemisphere = upper
  }

  const leading = LEADING_HEMISPHERE.exec(body)
  if (leading) {
    applyHemisphere(leading[1])
    body = body.slice(leading[0].length)
  }

  const trailing = TRAILING_HEMISPHERE.exec(body)
  if (trailing) {
    applyHemisphere(trailing[1])
    body = body.slice(0, trailing.index)
  }

  if (conflict) {
    return parseError('hemisphere', 'Conflicting hemispheres were provided.')
  }

  if (hemisphere !== null) {
    const allowed: readonly Hemisphere[] =
      axis === 'latitude' ? ['N', 'S'] : ['E', 'W']
    if (!allowed.includes(hemisphere)) {
      return parseError(
        'hemisphere',
        `${hemisphere} is not valid for ${axis}. Use ${allowed.join(' or ')}.`,
      )
    }
  }

  const normalized = body.replace(PRIME_CHARACTERS, ' ')
  const parts = normalized.split(/\s+/).filter((part) => part.length > 0)

  if (parts.length === 0) {
    return parseError('empty', `Enter a ${axis} value.`)
  }
  if (parts.length > 3) {
    return parseError('format', 'Use degrees, minutes and seconds only.')
  }

  const [degreesText, minutesText = '0', secondsText = '0'] = parts

  for (const part of parts) {
    if (!NUMBER_PATTERN.test(part)) {
      return parseError(
        'format',
        'Enter numbers separated by degree, minute and second symbols.',
      )
    }
  }

  if (parts.length > 1 && !INTEGER_PATTERN.test(degreesText)) {
    return parseError(
      'format',
      'Whole degrees are required when minutes or seconds are provided.',
    )
  }

  const degrees = Number(degreesText)
  const minutes = Number(minutesText)
  const seconds = Number(secondsText)

  if (minutes < 0 || minutes >= 60) {
    return parseError('range', 'Minutes must be between 0 and 59.')
  }
  if (seconds < 0 || seconds >= 60) {
    return parseError('range', 'Seconds must be between 0 and 59.')
  }

  let sign = 1
  if (degrees < 0) {
    if (hemisphere !== null) {
      return parseError(
        'hemisphere',
        'Do not combine a negative value with a hemisphere.',
      )
    }
    sign = -1
  }

  const magnitude = Math.abs(degrees) + minutes / 60 + seconds / 3600

  if (magnitude > axisMaximum(axis)) {
    return parseError(
      'range',
      `${axisLabel(axis)} must be between -${axisMaximum(axis)} and ${axisMaximum(axis)} degrees.`,
    )
  }

  const resolvedHemisphere =
    hemisphere ??
    (sign < 0
      ? axis === 'latitude'
        ? 'S'
        : 'W'
      : axis === 'latitude'
        ? 'N'
        : 'E')

  return parseOk({
    degrees: Math.abs(degrees),
    minutes,
    seconds,
    hemisphere: resolvedHemisphere,
  })
}

/** Convenience wrapper returning signed decimal degrees directly. */
export function parseDmsToDecimal(
  input: string,
  axis: CoordinateAxis,
): ParseResult<number> {
  const result = parseDms(input, axis)
  if (!result.ok) {
    return result
  }
  return parseOk(dmsComponentsToDecimal(result.value))
}

/** Converts absolute DMS components into signed decimal degrees. */
export function dmsComponentsToDecimal(components: DmsComponents): number {
  const magnitude =
    components.degrees + components.minutes / 60 + components.seconds / 3600
  const negative =
    components.hemisphere === 'S' || components.hemisphere === 'W'
  return negative ? -magnitude : magnitude
}

function decomposeSeconds(
  totalSeconds: number,
  precision: number,
): { degrees: number; minutes: number; seconds: number } {
  const factor = 10 ** precision
  const rounded = Math.round(totalSeconds * factor) / factor
  const degrees = Math.floor(rounded / 3600)
  const remainder = rounded - degrees * 3600
  const minutes = Math.floor(remainder / 60)
  const seconds = Math.round((remainder - minutes * 60) * factor) / factor
  return { degrees, minutes, seconds }
}

function resolveHemisphere(
  decimal: number,
  axis: CoordinateAxis,
): Hemisphere {
  if (axis === 'latitude') {
    return decimal < 0 ? 'S' : 'N'
  }
  return decimal < 0 ? 'W' : 'E'
}

/**
 * Converts signed decimal degrees into normalized DMS components. Rounding is
 * performed on the total number of seconds so minutes and seconds can never
 * display as 60.
 */
export function decimalToDms(
  decimal: number,
  axis: CoordinateAxis,
  secondsPrecision: number = DEFAULT_SECONDS_PRECISION,
): ParseResult<DmsComponents> {
  if (!Number.isFinite(decimal)) {
    return parseError('range', 'The value must be a finite number.')
  }
  const maximum = axisMaximum(axis)
  const magnitude = Math.abs(decimal)
  if (magnitude > maximum) {
    return parseError(
      'range',
      `${axisLabel(axis)} must be between -${maximum} and ${maximum} degrees.`,
    )
  }
  const { degrees, minutes, seconds } = decomposeSeconds(
    magnitude * 3600,
    secondsPrecision,
  )
  return parseOk({
    degrees,
    minutes,
    seconds,
    hemisphere: resolveHemisphere(decimal, axis),
  })
}

/** Formats a decimal degree value with a fixed number of decimal places. */
export function formatDecimalDegrees(
  value: number,
  precision: number = DEFAULT_DECIMAL_PRECISION,
): string {
  return value.toFixed(precision)
}

function padSeconds(seconds: number, precision: number): string {
  const text = seconds.toFixed(precision)
  const minimumLength = precision > 0 ? 3 + precision : 2
  return text.padStart(minimumLength, '0')
}

/** Formats DMS components as `degrees°minutes'seconds" hemisphere`. */
export function formatDms(
  components: DmsComponents,
  secondsPrecision: number = DEFAULT_SECONDS_PRECISION,
): string {
  const totalSeconds =
    components.degrees * 3600 + components.minutes * 60 + components.seconds
  const { degrees, minutes, seconds } = decomposeSeconds(
    totalSeconds,
    secondsPrecision,
  )
  const minutesText = String(minutes).padStart(2, '0')
  return `${degrees}°${minutesText}'${padSeconds(seconds, secondsPrecision)}" ${components.hemisphere}`
}
