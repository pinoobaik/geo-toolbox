/**
 * Pure GeoJSON parsing, validation, normalisation and export helpers.
 *
 * This module is deliberately independent of React and Leaflet so the same
 * logic can be unit tested and reused. It follows RFC 7946 semantics:
 * coordinates are always `[longitude, latitude, ...]` on the WGS84 datum.
 *
 * Validation is strict and never silently repairs invalid data. Rings that are
 * too short or not closed, coordinates that are non-numeric or out of range,
 * unsupported geometry types and unsupported `crs` declarations all produce a
 * specific, actionable error instead of a misleading result.
 */

/** Maximum accepted file size: 10 MB. */
export const MAX_GEOJSON_BYTES = 10 * 1024 * 1024

export type GeoJsonPosition = readonly number[]

export interface GeoJsonPoint {
  readonly type: 'Point'
  readonly coordinates: GeoJsonPosition
}

export interface GeoJsonMultiPoint {
  readonly type: 'MultiPoint'
  readonly coordinates: readonly GeoJsonPosition[]
}

export interface GeoJsonLineString {
  readonly type: 'LineString'
  readonly coordinates: readonly GeoJsonPosition[]
}

export interface GeoJsonMultiLineString {
  readonly type: 'MultiLineString'
  readonly coordinates: readonly (readonly GeoJsonPosition[])[]
}

export interface GeoJsonPolygon {
  readonly type: 'Polygon'
  readonly coordinates: readonly (readonly GeoJsonPosition[])[]
}

export interface GeoJsonMultiPolygon {
  readonly type: 'MultiPolygon'
  readonly coordinates: readonly (readonly (readonly GeoJsonPosition[])[])[]
}

export interface GeoJsonGeometryCollection {
  readonly type: 'GeometryCollection'
  readonly geometries: readonly GeoJsonGeometry[]
}

export type GeoJsonGeometry =
  | GeoJsonPoint
  | GeoJsonMultiPoint
  | GeoJsonLineString
  | GeoJsonMultiLineString
  | GeoJsonPolygon
  | GeoJsonMultiPolygon
  | GeoJsonGeometryCollection

export interface GeoJsonFeature {
  readonly type: 'Feature'
  readonly id?: string | number
  readonly geometry: GeoJsonGeometry | null
  readonly properties: Readonly<Record<string, unknown>> | null
}

export interface GeoJsonFeatureCollection {
  readonly type: 'FeatureCollection'
  readonly features: readonly GeoJsonFeature[]
}

export type GeoJsonObject =
  | GeoJsonGeometry
  | GeoJsonFeature
  | GeoJsonFeatureCollection

export type GeoJsonValidationCode =
  | 'json'
  | 'structure'
  | 'unsupported-type'
  | 'coordinates'
  | 'range'
  | 'ring'
  | 'crs'
  | 'size'

export interface GeoJsonValidationError {
  readonly code: GeoJsonValidationCode
  readonly message: string
}

/** How the source document was structured, so it can be exported faithfully. */
export type GeoJsonSourceKind = 'geometry' | 'feature' | 'featureCollection'

export interface GeoJsonBounds {
  readonly minLongitude: number
  readonly minLatitude: number
  readonly maxLongitude: number
  readonly maxLatitude: number
}

/**
 * A single manageable unit inside a dataset. A standalone geometry becomes one
 * entry with no invented feature metadata; a FeatureCollection yields one entry
 * per feature. Entries with a `null` geometry are kept so they can be listed
 * and re-exported without loss.
 */
export interface GeoJsonEntry {
  readonly index: number
  readonly id?: string | number
  readonly label: string
  readonly geometryType: string
  readonly geometry: GeoJsonGeometry | null
  readonly properties: Readonly<Record<string, unknown>> | null
  readonly bounds: GeoJsonBounds | null
}

export interface GeoJsonDataset {
  readonly sourceKind: GeoJsonSourceKind
  /** The validated object, structure preserved for faithful re-export. */
  readonly source: GeoJsonObject
  readonly entries: readonly GeoJsonEntry[]
  /** Top-level features (0 for a standalone geometry). */
  readonly featureCount: number
  /** Leaf geometries, excluding GeometryCollection wrappers. */
  readonly geometryCount: number
  /** Union of every entry bounds, or null when nothing is renderable. */
  readonly bounds: GeoJsonBounds | null
  readonly isEmpty: boolean
  readonly hasGeometry: boolean
}

export type GeoJsonParseResult =
  | { readonly ok: true; readonly dataset: GeoJsonDataset }
  | { readonly ok: false; readonly error: GeoJsonValidationError }

export type GeoJsonExportMode = 'source' | 'feature-collection'

/* -------------------------------------------------------------------------- */
/* Internal validation helpers                                                 */
/* -------------------------------------------------------------------------- */

interface Valid<T> {
  readonly ok: true
  readonly value: T
}

interface Invalid {
  readonly ok: false
  readonly error: GeoJsonValidationError
}

type Check<T> = Valid<T> | Invalid

interface MutableBounds {
  minLongitude: number
  minLatitude: number
  maxLongitude: number
  maxLatitude: number
}

function ok<T>(value: T): Valid<T> {
  return { ok: true, value }
}

function invalid(
  code: GeoJsonValidationCode,
  message: string,
): Invalid {
  return { ok: false, error: { code, message } }
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function describe(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return 'unknown error'
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${bytes} B`
}

const SUPPORTED_TYPES =
  'Point, MultiPoint, LineString, MultiLineString, Polygon, MultiPolygon, GeometryCollection, Feature, FeatureCollection'

/* -------------------------------------------------------------------------- */
/* Legacy CRS handling                                                         */
/* -------------------------------------------------------------------------- */

const WGS84_CRS_NAMES = new Set([
  'urn:ogc:def:crs:ogc:1.3:crs84',
  'urn:ogc:def:crs:ogc:2:4326',
  'urn:ogc:def:crs:epsg::4326',
  'epsg:4326',
  'crs84',
  'wgs84',
  'wgs 84',
])

/**
 * RFC 7946 removed the `crs` member and mandates WGS84. If a legacy `crs`
 * declaration names anything other than WGS84 we refuse to import rather than
 * misreading the coordinates.
 */
function checkCrs(object: Record<string, unknown>): GeoJsonValidationError | null {
  if (!('crs' in object)) {
    return null
  }
  const crs = object.crs
  if (crs === null || crs === undefined) {
    return null
  }
  if (!isPlainObject(crs)) {
    return {
      code: 'crs',
      message: 'The "crs" member must be an object when present.',
    }
  }

  const properties = isPlainObject(crs.properties) ? crs.properties : null
  const name = properties ? properties.name : undefined
  const code = properties ? properties.code : undefined
  const normalizedName = typeof name === 'string' ? name.trim().toLowerCase() : ''
  const normalizedType =
    typeof crs.type === 'string' ? crs.type.trim().toLowerCase() : ''

  if (WGS84_CRS_NAMES.has(normalizedName)) {
    return null
  }
  if (
    normalizedType === 'epsg' &&
    (code === 4326 || code === '4326' || code === 'epsg:4326')
  ) {
    return null
  }

  return {
    code: 'crs',
    message:
      'This file declares a non-WGS84 coordinate reference system in its "crs" member. Only WGS84 (CRS84 / EPSG:4326) is supported, so the coordinates were not imported to avoid misinterpretation. Re-project the data to WGS84 first.',
  }
}

/* -------------------------------------------------------------------------- */
/* Coordinate builders                                                         */
/* -------------------------------------------------------------------------- */

function buildPosition(value: unknown, path: string): Check<GeoJsonPosition> {
  if (!isArray(value)) {
    return invalid(
      'coordinates',
      `${path} must be an array in [longitude, latitude] order.`,
    )
  }
  if (value.length < 2) {
    return invalid(
      'coordinates',
      `${path} must contain at least a longitude and a latitude.`,
    )
  }
  const numbers: number[] = []
  for (let i = 0; i < value.length; i += 1) {
    const component = value[i]
    if (typeof component !== 'number' || !Number.isFinite(component)) {
      return invalid(
        'coordinates',
        `${path}[${i}] must be a finite number (received ${String(component)}).`,
      )
    }
    numbers.push(component)
  }
  const longitude = numbers[0]
  const latitude = numbers[1]
  if (longitude < -180 || longitude > 180) {
    return invalid(
      'range',
      `${path} longitude ${longitude} is outside the valid range -180 to 180.`,
    )
  }
  if (latitude < -90 || latitude > 90) {
    return invalid(
      'range',
      `${path} latitude ${latitude} is outside the valid range -90 to 90.`,
    )
  }
  return ok(numbers)
}

function buildPositionArray(
  value: unknown,
  path: string,
  minimum: number,
): Check<GeoJsonPosition[]> {
  if (!isArray(value)) {
    return invalid('coordinates', `${path} must be an array of positions.`)
  }
  if (value.length < minimum) {
    return invalid(
      'coordinates',
      `${path} must contain at least ${minimum} position${minimum === 1 ? '' : 's'}.`,
    )
  }
  const positions: GeoJsonPosition[] = []
  for (let i = 0; i < value.length; i += 1) {
    const built = buildPosition(value[i], `${path}[${i}]`)
    if (!built.ok) {
      return built
    }
    positions.push(built.value)
  }
  return ok(positions)
}

function buildRingArray(value: unknown, path: string): Check<GeoJsonPosition[][]> {
  if (!isArray(value)) {
    return invalid('coordinates', `${path} must be an array of linear rings.`)
  }
  const rings: GeoJsonPosition[][] = []
  for (let i = 0; i < value.length; i += 1) {
    const built = buildPositionArray(value[i], `${path}[${i}]`, 0)
    if (!built.ok) {
      return built
    }
    rings.push(built.value)
  }
  return ok(rings)
}

function positionsEqual(a: GeoJsonPosition, b: GeoJsonPosition): boolean {
  if (a.length !== b.length) {
    return false
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false
    }
  }
  return true
}

function validateRing(
  ring: GeoJsonPosition[],
  path: string,
): GeoJsonValidationError | null {
  if (ring.length < 4) {
    return {
      code: 'ring',
      message: `${path} must contain at least 4 positions forming a closed ring.`,
    }
  }
  if (!positionsEqual(ring[0], ring[ring.length - 1])) {
    return {
      code: 'ring',
      message: `${path} is not closed: the first and last positions must be identical.`,
    }
  }
  return null
}

/* -------------------------------------------------------------------------- */
/* Geometry builders                                                           */
/* -------------------------------------------------------------------------- */

function buildPoint(
  value: Record<string, unknown>,
  path: string,
): Check<GeoJsonPoint> {
  const coordinates = buildPosition(value.coordinates, `${path}.coordinates`)
  if (!coordinates.ok) {
    return coordinates
  }
  return ok({ type: 'Point', coordinates: coordinates.value })
}

function buildMultiPoint(
  value: Record<string, unknown>,
  path: string,
): Check<GeoJsonMultiPoint> {
  const coordinates = buildPositionArray(value.coordinates, `${path}.coordinates`, 0)
  if (!coordinates.ok) {
    return coordinates
  }
  return ok({ type: 'MultiPoint', coordinates: coordinates.value })
}

function buildLineString(
  value: Record<string, unknown>,
  path: string,
): Check<GeoJsonLineString> {
  const coordinates = buildPositionArray(value.coordinates, `${path}.coordinates`, 2)
  if (!coordinates.ok) {
    return coordinates
  }
  return ok({ type: 'LineString', coordinates: coordinates.value })
}

function buildMultiLineString(
  value: Record<string, unknown>,
  path: string,
): Check<GeoJsonMultiLineString> {
  if (!isArray(value.coordinates)) {
    return invalid('coordinates', `${path}.coordinates must be an array of linestrings.`)
  }
  const lines: GeoJsonPosition[][] = []
  for (let i = 0; i < value.coordinates.length; i += 1) {
    const built = buildPositionArray(
      value.coordinates[i],
      `${path}.coordinates[${i}]`,
      2,
    )
    if (!built.ok) {
      return built
    }
    lines.push(built.value)
  }
  return ok({ type: 'MultiLineString', coordinates: lines })
}

function buildPolygon(
  value: Record<string, unknown>,
  path: string,
): Check<GeoJsonPolygon> {
  const ringsResult = buildRingArray(value.coordinates, `${path}.coordinates`)
  if (!ringsResult.ok) {
    return ringsResult
  }
  const rings = ringsResult.value
  for (let i = 0; i < rings.length; i += 1) {
    const error = validateRing(rings[i], `${path}.coordinates[${i}]`)
    if (error) {
      return { ok: false, error }
    }
  }
  return ok({ type: 'Polygon', coordinates: rings })
}

function buildMultiPolygon(
  value: Record<string, unknown>,
  path: string,
): Check<GeoJsonMultiPolygon> {
  if (!isArray(value.coordinates)) {
    return invalid('coordinates', `${path}.coordinates must be an array of polygons.`)
  }
  const polygons: GeoJsonPosition[][][] = []
  for (let i = 0; i < value.coordinates.length; i += 1) {
    const ringsResult = buildRingArray(
      value.coordinates[i],
      `${path}.coordinates[${i}]`,
    )
    if (!ringsResult.ok) {
      return ringsResult
    }
    const rings = ringsResult.value
    for (let j = 0; j < rings.length; j += 1) {
      const error = validateRing(rings[j], `${path}.coordinates[${i}][${j}]`)
      if (error) {
        return { ok: false, error }
      }
    }
    polygons.push(rings)
  }
  return ok({ type: 'MultiPolygon', coordinates: polygons })
}

function buildGeometryCollection(
  value: Record<string, unknown>,
  path: string,
): Check<GeoJsonGeometryCollection> {
  if (!isArray(value.geometries)) {
    return invalid('structure', `${path}.geometries must be an array of geometries.`)
  }
  const geometries: GeoJsonGeometry[] = []
  for (let i = 0; i < value.geometries.length; i += 1) {
    const built = buildGeometry(
      value.geometries[i],
      `${path}.geometries[${i}]`,
    )
    if (!built.ok) {
      return built
    }
    geometries.push(built.value)
  }
  return ok({ type: 'GeometryCollection', geometries })
}

function buildGeometry(value: unknown, path: string): Check<GeoJsonGeometry> {
  if (!isPlainObject(value)) {
    return invalid('structure', `${path} must be a GeoJSON geometry object.`)
  }
  const type = value.type
  if (typeof type !== 'string') {
    return invalid('structure', `${path} is missing a string "type" member.`)
  }
  switch (type) {
    case 'Point':
      return buildPoint(value, path)
    case 'MultiPoint':
      return buildMultiPoint(value, path)
    case 'LineString':
      return buildLineString(value, path)
    case 'MultiLineString':
      return buildMultiLineString(value, path)
    case 'Polygon':
      return buildPolygon(value, path)
    case 'MultiPolygon':
      return buildMultiPolygon(value, path)
    case 'GeometryCollection':
      return buildGeometryCollection(value, path)
    default:
      return invalid(
        'unsupported-type',
        `Unsupported geometry type "${type}". Supported types are: ${SUPPORTED_TYPES}.`,
      )
  }
}

/* -------------------------------------------------------------------------- */
/* Feature builders                                                            */
/* -------------------------------------------------------------------------- */

function buildFeature(
  value: Record<string, unknown>,
  path: string,
): Check<GeoJsonFeature> {
  const crsError = checkCrs(value)
  if (crsError) {
    return { ok: false, error: crsError }
  }

  const geometryValue = value.geometry
  let geometry: GeoJsonGeometry | null
  if (geometryValue === null || geometryValue === undefined) {
    geometry = null
  } else {
    const built = buildGeometry(geometryValue, `${path}.geometry`)
    if (!built.ok) {
      return built
    }
    geometry = built.value
  }

  const propertiesValue = value.properties
  let properties: Readonly<Record<string, unknown>> | null
  if (propertiesValue === null || propertiesValue === undefined) {
    properties = null
  } else if (isPlainObject(propertiesValue)) {
    properties = propertiesValue
  } else {
    return invalid(
      'structure',
      `${path}.properties must be an object or null.`,
    )
  }

  const id = value.id
  if (id !== undefined && typeof id !== 'string' && typeof id !== 'number') {
    return invalid(
      'structure',
      `${path}.id must be a string or a number when present.`,
    )
  }

  if (id === undefined) {
    return ok({ type: 'Feature', geometry, properties })
  }
  return ok({ type: 'Feature', id, geometry, properties })
}

function buildFeatureCollection(
  value: Record<string, unknown>,
  path: string,
): Check<GeoJsonFeatureCollection> {
  const crsError = checkCrs(value)
  if (crsError) {
    return { ok: false, error: crsError }
  }

  const features = value.features
  if (!isArray(features)) {
    return invalid('structure', `${path}.features must be an array of features.`)
  }
  const built: GeoJsonFeature[] = []
  for (let i = 0; i < features.length; i += 1) {
    const featureValue = features[i]
    if (!isPlainObject(featureValue)) {
      return invalid(
        'structure',
        `${path}.features[${i}] must be a GeoJSON Feature object.`,
      )
    }
    if (featureValue.type !== 'Feature') {
      return invalid(
        'structure',
        `${path}.features[${i}].type must be "Feature".`,
      )
    }
    const feature = buildFeature(featureValue, `${path}.features[${i}]`)
    if (!feature.ok) {
      return feature
    }
    built.push(feature.value)
  }
  return ok({ type: 'FeatureCollection', features: built })
}

function buildObject(value: unknown): Check<GeoJsonObject> {
  if (!isPlainObject(value)) {
    return invalid(
      'structure',
      'GeoJSON must be a JSON object (a geometry, Feature or FeatureCollection).',
    )
  }
  const crsError = checkCrs(value)
  if (crsError) {
    return { ok: false, error: crsError }
  }
  const type = value.type
  if (typeof type !== 'string') {
    return invalid('structure', 'The GeoJSON object is missing a string "type" member.')
  }
  switch (type) {
    case 'Feature':
      return buildFeature(value, '$')
    case 'FeatureCollection':
      return buildFeatureCollection(value, '$')
    case 'Point':
    case 'MultiPoint':
    case 'LineString':
    case 'MultiLineString':
    case 'Polygon':
    case 'MultiPolygon':
    case 'GeometryCollection':
      return buildGeometry(value, '$')
    default:
      return invalid(
        'unsupported-type',
        `Unsupported GeoJSON type "${type}". Supported types are: ${SUPPORTED_TYPES}.`,
      )
  }
}

/* -------------------------------------------------------------------------- */
/* Bounds, counting and dataset construction                                   */
/* -------------------------------------------------------------------------- */

function walkPositions(
  geometry: GeoJsonGeometry,
  visit: (position: GeoJsonPosition) => void,
): void {
  switch (geometry.type) {
    case 'Point':
      visit(geometry.coordinates)
      return
    case 'MultiPoint':
    case 'LineString':
      for (const position of geometry.coordinates) {
        visit(position)
      }
      return
    case 'MultiLineString':
    case 'Polygon':
      for (const ring of geometry.coordinates) {
        for (const position of ring) {
          visit(position)
        }
      }
      return
    case 'MultiPolygon':
      for (const polygon of geometry.coordinates) {
        for (const ring of polygon) {
          for (const position of ring) {
            visit(position)
          }
        }
      }
      return
    case 'GeometryCollection':
      for (const child of geometry.geometries) {
        walkPositions(child, visit)
      }
      return
    default:
      return
  }
}

function aggregateBounds(
  geometries: readonly (GeoJsonGeometry | null)[],
): GeoJsonBounds | null {
  const bounds: MutableBounds = {
    minLongitude: Infinity,
    minLatitude: Infinity,
    maxLongitude: -Infinity,
    maxLatitude: -Infinity,
  }
  let seen = false

  const visit = (position: GeoJsonPosition) => {
    const longitude = position[0]
    const latitude = position[1]
    seen = true
    if (longitude < bounds.minLongitude) bounds.minLongitude = longitude
    if (latitude < bounds.minLatitude) bounds.minLatitude = latitude
    if (longitude > bounds.maxLongitude) bounds.maxLongitude = longitude
    if (latitude > bounds.maxLatitude) bounds.maxLatitude = latitude
  }

  for (const geometry of geometries) {
    if (geometry) {
      walkPositions(geometry, visit)
    }
  }

  return seen ? { ...bounds } : null
}

function countGeometries(geometry: GeoJsonGeometry | null): number {
  if (geometry === null) {
    return 0
  }
  if (geometry.type === 'GeometryCollection') {
    return geometry.geometries.reduce(
      (total, child) => total + countGeometries(child),
      0,
    )
  }
  return 1
}

function featureLabel(feature: GeoJsonFeature, index: number): string {
  const properties = feature.properties
  if (properties) {
    const name = properties.name
    if (typeof name === 'string' && name.trim() !== '') {
      return name
    }
  }
  if (feature.id !== undefined) {
    return `Feature ${feature.id}`
  }
  return `Feature ${index + 1}`
}

function makeEntry(
  index: number,
  id: string | number | undefined,
  geometry: GeoJsonGeometry | null,
  properties: Readonly<Record<string, unknown>> | null,
  label: string,
): GeoJsonEntry {
  const entry: GeoJsonEntry = {
    index,
    label,
    geometryType: geometry ? geometry.type : 'No geometry',
    geometry,
    properties,
    bounds: aggregateBounds([geometry]),
  }
  if (id === undefined) {
    return entry
  }
  return { ...entry, id }
}

function createDataset(object: GeoJsonObject): GeoJsonDataset {
  let sourceKind: GeoJsonSourceKind
  let entries: GeoJsonEntry[]
  let featureCount: number

  if (object.type === 'FeatureCollection') {
    sourceKind = 'featureCollection'
    featureCount = object.features.length
    entries = object.features.map((feature, index) =>
      makeEntry(
        index,
        feature.id,
        feature.geometry,
        feature.properties,
        featureLabel(feature, index),
      ),
    )
  } else if (object.type === 'Feature') {
    sourceKind = 'feature'
    featureCount = 1
    entries = [
      makeEntry(
        0,
        object.id,
        object.geometry,
        object.properties,
        featureLabel(object, 0),
      ),
    ]
  } else {
    sourceKind = 'geometry'
    featureCount = 0
    entries = [makeEntry(0, undefined, object, null, 'Geometry')]
  }

  const geometryCount = entries.reduce(
    (total, entry) => total + countGeometries(entry.geometry),
    0,
  )
  const bounds = aggregateBounds(entries.map((entry) => entry.geometry))

  return {
    sourceKind,
    source: object,
    entries,
    featureCount,
    geometryCount,
    bounds,
    isEmpty: entries.length === 0,
    hasGeometry: geometryCount > 0,
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

/** A specific, actionable error when a file exceeds the size limit. */
export function checkByteSize(byteLength: number): GeoJsonValidationError | null {
  if (!Number.isFinite(byteLength) || byteLength < 0) {
    return {
      code: 'size',
      message: 'The file size could not be determined.',
    }
  }
  if (byteLength > MAX_GEOJSON_BYTES) {
    return {
      code: 'size',
      message: `The file is ${formatBytes(byteLength)}, which exceeds the 10 MB limit. Reduce the dataset and try again.`,
    }
  }
  return null
}

/** Parses and validates a GeoJSON object that has already been JSON-decoded. */
export function parseGeoJsonValue(value: unknown): GeoJsonParseResult {
  const built = buildObject(value)
  if (!built.ok) {
    return built
  }
  return { ok: true, dataset: createDataset(built.value) }
}

/** Parses and validates a GeoJSON string, reporting JSON syntax errors clearly. */
export function parseGeoJsonText(text: string): GeoJsonParseResult {
  if (text.trim() === '') {
    return {
      ok: false,
      error: { code: 'json', message: 'The file is empty.' },
    }
  }
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'json',
        message: `The file is not valid JSON: ${describe(error)}.`,
      },
    }
  }
  return parseGeoJsonValue(value)
}

/** Human-readable text for a property value, without interpreting it as HTML. */
export function formatPropertyValue(value: unknown): string {
  if (value === null) {
    return 'null'
  }
  if (value === undefined) {
    return 'undefined'
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/**
 * Normalises any validated object into a FeatureCollection. A standalone
 * geometry becomes a Feature with `properties: null`; a Feature is kept as-is.
 */
export function toFeatureCollection(
  dataset: GeoJsonDataset,
): GeoJsonFeatureCollection {
  const features = dataset.entries.map((entry): GeoJsonFeature => {
    if (entry.id === undefined) {
      return {
        type: 'Feature',
        geometry: entry.geometry,
        properties: entry.properties ?? null,
      }
    }
    return {
      type: 'Feature',
      id: entry.id,
      geometry: entry.geometry,
      properties: entry.properties ?? null,
    }
  })
  return { type: 'FeatureCollection', features }
}

/**
 * Serialises a dataset for download. `source` preserves the imported
 * structure; `feature-collection` normalises everything into a
 * FeatureCollection.
 */
export function buildGeoJsonExport(
  dataset: GeoJsonDataset,
  mode: GeoJsonExportMode,
): string {
  const value =
    mode === 'feature-collection' ? toFeatureCollection(dataset) : dataset.source
  return `${JSON.stringify(value, null, 2)}\n`
}

/** Derives a download filename from the imported file, with a safe default. */
export function suggestedExportFilename(importedName: string | null): string {
  const fallback = 'geo-toolbox-export.geojson'
  if (!importedName) {
    return fallback
  }
  const base = importedName.replace(/\.(geojson|json)$/i, '').trim()
  if (base === '') {
    return fallback
  }
  return `${base}-export.geojson`
}
