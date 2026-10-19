import type { GeoPoint } from '../types/geo'
import { convertDistance, haversineDistanceKm } from './distance'
import type { DistanceUnit } from './distance'

/**
 * Polyline measurement reusing the Haversine model and Earth radius from the
 * distance module so the polyline, distance and area tools all agree on the
 * geodesic convention.
 */

const METERS_PER_KM = 1000

export interface PolylineSegment {
  /** 1-based segment number for display. */
  readonly index: number
  readonly fromIndex: number
  readonly toIndex: number
  readonly from: GeoPoint
  readonly to: GeoPoint
  readonly lengthM: number
  readonly lengthKm: number
  /** Distance from the start of the line to the end of this segment. */
  readonly cumulativeM: number
}

export interface PolylineLengthResult {
  readonly segments: readonly PolylineSegment[]
  readonly totalM: number
  readonly totalKm: number
  readonly vertexCount: number
}

export interface PolylineLengthError {
  readonly ok: false
  readonly error: string
}

export interface PolylineLengthSuccess extends PolylineLengthResult {
  readonly ok: true
}

export type PolylineLengthComputeResult =
  | PolylineLengthSuccess
  | PolylineLengthError

function isValidPoint(point: GeoPoint): boolean {
  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    point.longitude >= -180 &&
    point.longitude <= 180
  )
}

export function computePolylineLength(
  points: readonly GeoPoint[],
): PolylineLengthComputeResult {
  if (!points || points.length < 2) {
    return { ok: false, error: 'Polyline requires at least 2 points.' }
  }
  if (!points.every(isValidPoint)) {
    return { ok: false, error: 'Polyline contains an invalid coordinate.' }
  }

  const segments: PolylineSegment[] = []
  let cumulativeM = 0
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i]
    const to = points[i + 1]
    const lengthKm = haversineDistanceKm(from, to)
    const lengthM = lengthKm * METERS_PER_KM
    cumulativeM += lengthM
    segments.push({
      index: i + 1,
      fromIndex: i,
      toIndex: i + 1,
      from,
      to,
      lengthKm,
      lengthM,
      cumulativeM,
    })
  }

  return {
    ok: true,
    segments,
    totalM: cumulativeM,
    totalKm: cumulativeM / METERS_PER_KM,
    vertexCount: points.length,
  }
}

/** Formats a length given in metres using the shared distance unit options. */
export function formatLength(
  meters: number,
  unit: DistanceUnit,
  precision?: number,
): string {
  const km = meters / METERS_PER_KM
  const value = convertDistance(km, unit)
  const decimals =
    precision ?? (unit === 'meters' ? 1 : 3)
  const symbol =
    unit === 'meters'
      ? 'm'
      : unit === 'kilometers'
        ? 'km'
        : unit === 'miles'
          ? 'mi'
          : 'nmi'
  return `${value.toFixed(decimals)} ${symbol}`
}
