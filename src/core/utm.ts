import proj4 from 'proj4'
import type { GeoPoint } from '../types/geo'

/**
 * UTM (Universal Transverse Mercator) conversion on the WGS84 ellipsoid.
 *
 * The forward and inverse projection maths are delegated to `proj4`, which
 * implements the exact Transverse Mercator series used by PROJ. This keeps the
 * projection itself independent from any UI formatting while giving sub-
 * millimetre round-trip accuracy inside a zone.
 *
 * Coverage is limited to the standard UTM latitude band of 80°S to 84°N.
 * Beyond that band UTM is not defined (UPS would be required), so invalid
 * latitudes are rejected instead of returning a plausible-looking value.
 */

export type UtmHemisphere = 'N' | 'S'

export interface UtmCoordinate {
  readonly zone: number
  readonly hemisphere: UtmHemisphere
  readonly easting: number
  readonly northing: number
}

export interface UtmZoneInfo {
  readonly zone: number
  readonly centralMeridian: number
}

export interface UtmZoneFit {
  /** Absolute longitude difference between the point and the zone's CM. */
  readonly deviationDeg: number
  /** True when the point lies outside the nominal 6° zone width. */
  readonly outsideNominalZone: boolean
  readonly warning?: string
}

export const UTM_MIN_ZONE = 1
export const UTM_MAX_ZONE = 60
export const UTM_MIN_LATITUDE = -80
export const UTM_MAX_LATITUDE = 84
export const UTM_WIDTH_DEG = 6
export const UTM_FALSE_EASTING = 500000
export const UTM_FALSE_NORTHING_SOUTH = 10000000
export const UTM_SCALE_FACTOR = 0.9996
export const UTM_MAX_EASTING = 1000000
export const UTM_MAX_NORTHING = 10000000

const WGS84_DEF = '+proj=longlat +datum=WGS84 +no_defs'

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number.`)
  }
}

/** Normalizes a longitude into the closed interval [-180, 180]. */
export function normalizeLongitude(longitude: number): number {
  let value = longitude
  while (value > 180) {
    value -= 360
  }
  while (value < -180) {
    value += 360
  }
  return value
}

export function isValidUtmZone(zone: number): boolean {
  return (
    Number.isInteger(zone) && zone >= UTM_MIN_ZONE && zone <= UTM_MAX_ZONE
  )
}

export function isWithinUtmLatitude(latitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    latitude >= UTM_MIN_LATITUDE &&
    latitude <= UTM_MAX_LATITUDE
  )
}

/** Central meridian (degrees) of a UTM zone. */
export function utmCentralMeridian(zone: number): number {
  if (!isValidUtmZone(zone)) {
    throw new RangeError('UTM zone must be an integer between 1 and 60.')
  }
  return zone * UTM_WIDTH_DEG - 183
}

export function utmZoneInfo(zone: number): UtmZoneInfo {
  return { zone, centralMeridian: utmCentralMeridian(zone) }
}

/**
 * Automatic UTM zone from a longitude, including the Norway (32V) and
 * Svalbard (31X-37X) exceptions when a latitude is supplied.
 *
 * The base rule is `floor((lon + 180) / 6) + 1`; points exactly on a boundary
 * fall into the eastern zone, which is the conventional behaviour.
 */
export function utmZoneFromLongitude(longitude: number, latitude = 0): number {
  assertFinite(longitude, 'Longitude')
  const lon = normalizeLongitude(longitude)

  if (Number.isFinite(latitude)) {
    if (latitude >= 72 && latitude < 84) {
      if (lon >= 0 && lon < 9) return 31
      if (lon >= 9 && lon < 21) return 33
      if (lon >= 21 && lon < 33) return 35
      if (lon >= 33 && lon < 42) return 37
    }
    if (latitude >= 56 && latitude < 64 && lon >= 3 && lon < 12) {
      return 32
    }
  }

  const zone = Math.floor((lon + 180) / UTM_WIDTH_DEG) + 1
  return Math.min(UTM_MAX_ZONE, Math.max(UTM_MIN_ZONE, zone))
}

/**
 * Describes how well a longitude fits a given zone's nominal 6° extent. A
 * point outside the zone is still convertible (UTM overlaps) but distortion
 * grows, so the caller can surface a warning rather than silently re-zoning.
 */
export function assessZoneFit(longitude: number, zone: number): UtmZoneFit {
  const lon = normalizeLongitude(longitude)
  const centralMeridian = utmCentralMeridian(zone)
  let deviation = Math.abs(lon - centralMeridian)
  if (deviation > 180) {
    deviation = 360 - deviation
  }
  const outsideNominalZone = deviation > UTM_WIDTH_DEG / 2
  return {
    deviationDeg: deviation,
    outsideNominalZone,
    warning:
      deviation > UTM_WIDTH_DEG
        ? `The point is ${deviation.toFixed(1)}° from zone ${zone}'s central meridian; choose the nearest zone for best accuracy.`
        : undefined,
  }
}

function utmProjString(zone: number, hemisphere: UtmHemisphere): string {
  const south = hemisphere === 'S' ? ' +south' : ''
  return `+proj=utm +zone=${zone} +ellps=WGS84 +datum=WGS84 +units=m +no_defs${south}`
}

export interface UtmForwardOptions {
  /** Force a specific zone instead of the automatic one. */
  readonly zone?: number
}

export interface UtmForwardResult {
  readonly utm: UtmCoordinate
  /** The zone automatic selection would have produced. */
  readonly automaticZone: number
  readonly manualZoneOverride: boolean
  readonly zoneFit: UtmZoneFit
}

/**
 * Projects a geographic point to UTM. Throws a RangeError for invalid
 * coordinates, out-of-coverage latitudes, or invalid zones.
 */
export function geographicToUtm(
  point: GeoPoint,
  options: UtmForwardOptions = {},
): UtmForwardResult {
  assertFinite(point.latitude, 'Latitude')
  assertFinite(point.longitude, 'Longitude')
  const longitude = normalizeLongitude(point.longitude)

  if (!isWithinUtmLatitude(point.latitude)) {
    throw new RangeError(
      `Latitude must be between ${UTM_MIN_LATITUDE} and ${UTM_MAX_LATITUDE} degrees for UTM conversion.`,
    )
  }

  const automaticZone = utmZoneFromLongitude(longitude, point.latitude)
  const manualZoneOverride = options.zone !== undefined
  const zone = manualZoneOverride ? (options.zone as number) : automaticZone

  if (!isValidUtmZone(zone)) {
    throw new RangeError('UTM zone must be an integer between 1 and 60.')
  }

  const hemisphere: UtmHemisphere = point.latitude < 0 ? 'S' : 'N'
  const projected = proj4(WGS84_DEF, utmProjString(zone, hemisphere), [
    longitude,
    point.latitude,
  ]) as [number, number]
  const [easting, northing] = projected

  if (!Number.isFinite(easting) || !Number.isFinite(northing)) {
    throw new RangeError('UTM projection produced a non-finite result.')
  }

  return {
    utm: { zone, hemisphere, easting, northing },
    automaticZone,
    manualZoneOverride,
    zoneFit: assessZoneFit(longitude, zone),
  }
}

/**
 * Converts a UTM coordinate back to a geographic point. Throws a RangeError
 * for invalid zones, hemispheres, or easting/northing values.
 */
export function utmToGeographic(utm: UtmCoordinate): GeoPoint {
  if (!isValidUtmZone(utm.zone)) {
    throw new RangeError('UTM zone must be an integer between 1 and 60.')
  }
  if (utm.hemisphere !== 'N' && utm.hemisphere !== 'S') {
    throw new RangeError('UTM hemisphere must be N or S.')
  }
  assertFinite(utm.easting, 'Easting')
  assertFinite(utm.northing, 'Northing')
  if (utm.easting < 0 || utm.easting > UTM_MAX_EASTING) {
    throw new RangeError(
      `Easting must be between 0 and ${UTM_MAX_EASTING} metres.`,
    )
  }
  if (utm.northing < 0 || utm.northing > UTM_MAX_NORTHING) {
    throw new RangeError(
      `Northing must be between 0 and ${UTM_MAX_NORTHING} metres.`,
    )
  }

  const projected = proj4(
    utmProjString(utm.zone, utm.hemisphere),
    WGS84_DEF,
    [utm.easting, utm.northing],
  ) as [number, number]
  const [longitude, latitude] = projected

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new RangeError('UTM conversion produced a non-finite result.')
  }

  const normalizedLongitude = normalizeLongitude(longitude)
  if (latitude < -90 || latitude > 90) {
    throw new RangeError('UTM conversion produced a latitude outside -90..90.')
  }

  return { latitude, longitude: normalizedLongitude }
}
