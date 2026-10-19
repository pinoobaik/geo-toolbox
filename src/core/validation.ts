import type { GeoPoint } from '../types/geo'
import { isValidCoordinate } from './coordinates'

/**
 * Asserts that a point is a valid WGS84 coordinate, throwing a RangeError with
 * a descriptive message otherwise. Used by the pure calculation core so
 * invalid input can never produce a misleading numeric result.
 */
export function assertValidPoint(point: GeoPoint, name: string): void {
  if (!isValidCoordinate(point)) {
    throw new RangeError(`${name} is not a valid geographic coordinate.`)
  }
}
