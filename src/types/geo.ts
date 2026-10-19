/**
 * Shared geometry primitives used by the pure calculation core and the UI.
 *
 * Coordinates always use signed decimal degrees in the WGS84 geographic
 * coordinate system, independent of React and Leaflet.
 */
export interface GeoPoint {
  readonly latitude: number
  readonly longitude: number
}

/**
 * A result wrapper used by parsing helpers so invalid user input is never
 * silently coerced into a coordinate.
 */
export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ParseError }

export interface ParseError {
  readonly code: ParseErrorCode
  readonly message: string
}

export type ParseErrorCode =
  | 'empty'
  | 'format'
  | 'range'
  | 'hemisphere'
  | 'axis'

export function parseOk<T>(value: T): ParseResult<T> {
  return { ok: true, value }
}

export function parseError(code: ParseErrorCode, message: string): ParseResult<never> {
  return { ok: false, error: { code, message } }
}
