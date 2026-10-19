import { describe, expect, it } from 'vitest'
import {
  MAX_GEOJSON_BYTES,
  buildGeoJsonExport,
  checkByteSize,
  formatPropertyValue,
  parseGeoJsonText,
  parseGeoJsonValue,
  suggestedExportFilename,
  toFeatureCollection,
} from './geojson'
import type { GeoJsonDataset } from './geojson'

function parseOk(text: string): GeoJsonDataset {
  const result = parseGeoJsonText(text)
  if (!result.ok) {
    throw new Error(`Expected valid GeoJSON but got: ${result.error.message}`)
  }
  return result.dataset
}

function errorCode(value: unknown): string {
  const result = parseGeoJsonValue(value)
  if (result.ok) {
    throw new Error('Expected validation to fail')
  }
  return result.error.code
}

describe('GeoJSON — geometry types and coordinate order', () => {
  it('parses a Point with [longitude, latitude] ordering', () => {
    const dataset = parseOk('{"type":"Point","coordinates":[110.3695,-7.7956]}')
    expect(dataset.sourceKind).toBe('geometry')
    expect(dataset.geometryCount).toBe(1)
    const entry = dataset.entries[0]
    expect(entry.geometryType).toBe('Point')
    if (entry.geometry?.type !== 'Point') throw new Error('expected point')
    expect(entry.geometry.coordinates[0]).toBe(110.3695)
    expect(entry.geometry.coordinates[1]).toBe(-7.7956)
    expect(dataset.bounds).toEqual({
      minLongitude: 110.3695,
      minLatitude: -7.7956,
      maxLongitude: 110.3695,
      maxLatitude: -7.7956,
    })
  })

  it('parses LineString and MultiLineString', () => {
    const line = parseOk(
      '{"type":"LineString","coordinates":[[0,0],[1,1],[2,2]]}',
    )
    expect(line.geometryCount).toBe(1)

    const multi = parseOk(
      '{"type":"MultiLineString","coordinates":[[[0,0],[1,1]],[[2,2],[3,3]]]}',
    )
    expect(multi.geometryCount).toBe(1)
    if (multi.entries[0].geometry?.type !== 'MultiLineString') {
      throw new Error('expected multiline')
    }
    expect(multi.entries[0].geometry.coordinates).toHaveLength(2)
  })

  it('parses a Polygon with an exterior ring and a hole', () => {
    const dataset = parseOk(
      JSON.stringify({
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [4, 0],
            [4, 4],
            [0, 4],
            [0, 0],
          ],
          [
            [1, 1],
            [2, 1],
            [2, 2],
            [1, 2],
            [1, 1],
          ],
        ],
      }),
    )
    const entry = dataset.entries[0]
    if (entry.geometry?.type !== 'Polygon') throw new Error('expected polygon')
    expect(entry.geometry.coordinates).toHaveLength(2)
    expect(dataset.bounds).toEqual({
      minLongitude: 0,
      minLatitude: 0,
      maxLongitude: 4,
      maxLatitude: 4,
    })
  })

  it('parses MultiPoint and MultiPolygon', () => {
    const points = parseOk(
      '{"type":"MultiPoint","coordinates":[[10,20],[30,40]]}',
    )
    expect(points.geometryCount).toBe(1)

    const polygons = parseOk(
      JSON.stringify({
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 0],
            ],
          ],
          [
            [
              [5, 5],
              [6, 5],
              [6, 6],
              [5, 5],
            ],
          ],
        ],
      }),
    )
    expect(polygons.geometryCount).toBe(1)
  })

  it('parses a GeometryCollection and counts leaf geometries', () => {
    const dataset = parseOk(
      JSON.stringify({
        type: 'GeometryCollection',
        geometries: [
          { type: 'Point', coordinates: [0, 0] },
          {
            type: 'GeometryCollection',
            geometries: [{ type: 'Point', coordinates: [1, 1] }],
          },
        ],
      }),
    )
    expect(dataset.geometryCount).toBe(2)
    expect(dataset.bounds).toEqual({
      minLongitude: 0,
      minLatitude: 0,
      maxLongitude: 1,
      maxLatitude: 1,
    })
  })
})

describe('GeoJSON — features and metadata', () => {
  it('parses a Feature and preserves id and properties', () => {
    const dataset = parseOk(
      JSON.stringify({
        type: 'Feature',
        id: 'road-1',
        properties: { name: 'Main Road', lanes: 4 },
        geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
      }),
    )
    expect(dataset.sourceKind).toBe('feature')
    expect(dataset.featureCount).toBe(1)
    const entry = dataset.entries[0]
    expect(entry.id).toBe('road-1')
    expect(entry.label).toBe('Main Road')
    expect(entry.properties).toEqual({ name: 'Main Road', lanes: 4 })
  })

  it('parses a FeatureCollection with mixed geometry types', () => {
    const dataset = parseOk(
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: 1,
            properties: { kind: 'point' },
            geometry: { type: 'Point', coordinates: [0, 0] },
          },
          {
            type: 'Feature',
            properties: null,
            geometry: {
              type: 'LineString',
              coordinates: [[0, 0], [1, 1]],
            },
          },
          {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [0, 0],
                  [1, 0],
                  [1, 1],
                  [0, 0],
                ],
              ],
            },
          },
        ],
      }),
    )
    expect(dataset.sourceKind).toBe('featureCollection')
    expect(dataset.featureCount).toBe(3)
    expect(dataset.geometryCount).toBe(3)
    expect(dataset.entries.map((entry) => entry.geometryType)).toEqual([
      'Point',
      'LineString',
      'Polygon',
    ])
  })

  it('preserves ids, properties and geometry through an export round-trip', () => {
    const source = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'a',
          properties: { name: 'Alpha', tags: ['x', 'y'] },
          geometry: { type: 'Point', coordinates: [12.5, -7.5] },
        },
        {
          type: 'Feature',
          id: 2,
          properties: null,
          geometry: null,
        },
      ],
    }
    const dataset = parseOk(JSON.stringify(source))
    const serialized = buildGeoJsonExport(dataset, 'source')
    const reparsed = parseOk(serialized)
    expect(reparsed.entries.map((entry) => entry.id)).toEqual(['a', 2])
    expect(reparsed.entries[0].properties).toEqual({
      name: 'Alpha',
      tags: ['x', 'y'],
    })
    expect(reparsed.entries[0].geometry).toEqual(source.features[0].geometry)
    expect(reparsed.source).toEqual(source)
  })

  it('keeps a standalone geometry distinct on export via source structure', () => {
    const dataset = parseOk('{"type":"Point","coordinates":[1,2]}')
    const sourceExport = JSON.parse(buildGeoJsonExport(dataset, 'source'))
    expect(sourceExport.type).toBe('Point')

    const featureExport = JSON.parse(
      buildGeoJsonExport(dataset, 'feature-collection'),
    )
    expect(featureExport.type).toBe('FeatureCollection')
    expect(featureExport.features).toHaveLength(1)
    expect(featureExport.features[0].geometry.type).toBe('Point')
  })
})

describe('GeoJSON — empty and null geometry handling', () => {
  it('accepts a null feature geometry without inventing coordinates', () => {
    const dataset = parseOk(
      '{"type":"Feature","properties":{},"geometry":null}',
    )
    expect(dataset.featureCount).toBe(1)
    expect(dataset.entries[0].geometry).toBeNull()
    expect(dataset.entries[0].geometryType).toBe('No geometry')
    expect(dataset.entries[0].bounds).toBeNull()
    expect(dataset.bounds).toBeNull()
    expect(dataset.hasGeometry).toBe(false)
  })

  it('accepts an empty FeatureCollection and a GeometryCollection with no geometries', () => {
    const empty = parseOk('{"type":"FeatureCollection","features":[]}')
    expect(empty.isEmpty).toBe(true)
    expect(empty.featureCount).toBe(0)
    expect(empty.bounds).toBeNull()

    const emptyCollection = parseOk(
      '{"type":"GeometryCollection","geometries":[]}',
    )
    expect(emptyCollection.geometryCount).toBe(0)
    expect(emptyCollection.bounds).toBeNull()
  })

  it('does not crash export or normalisation for empty data', () => {
    const empty = parseOk('{"type":"FeatureCollection","features":[]}')
    expect(() => buildGeoJsonExport(empty, 'source')).not.toThrow()
    expect(() => buildGeoJsonExport(empty, 'feature-collection')).not.toThrow()
    expect(toFeatureCollection(empty).features).toEqual([])
  })
})

describe('GeoJSON — malformed and unsupported input', () => {
  it('reports malformed JSON with a specific message', () => {
    const result = parseGeoJsonText('{ not json ]')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('json')
    expect(result.error.message).toContain('not valid JSON')
  })

  it('reports empty files', () => {
    const result = parseGeoJsonText('   ')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('json')
  })

  it('rejects unsupported types and invalid root structure', () => {
    const unsupported = parseGeoJsonValue({ type: 'CircularString', coordinates: [] })
    expect(unsupported.ok).toBe(false)
    if (!unsupported.ok) expect(unsupported.error.code).toBe('unsupported-type')

    expect(errorCode([1, 2, 3])).toBe('structure')
    expect(errorCode({ coordinates: [0, 0] })).toBe('structure')
    expect(errorCode({ type: 'Point' })).toBe('coordinates')
  })

  it('rejects missing, non-numeric, NaN and infinite coordinates', () => {
    expect(errorCode({ type: 'Point', coordinates: [] })).toBe('coordinates')
    expect(errorCode({ type: 'Point', coordinates: [0] })).toBe('coordinates')
    expect(errorCode({ type: 'Point', coordinates: ['a', 0] })).toBe(
      'coordinates',
    )
    expect(errorCode({ type: 'Point', coordinates: [Number.NaN, 0] })).toBe(
      'coordinates',
    )
    expect(
      errorCode({ type: 'Point', coordinates: [0, Number.POSITIVE_INFINITY] }),
    ).toBe('coordinates')
  })

  it('rejects out-of-range WGS84 coordinates', () => {
    expect(errorCode({ type: 'Point', coordinates: [181, 0] })).toBe('range')
    expect(errorCode({ type: 'Point', coordinates: [0, -91] })).toBe('range')
  })

  it('rejects polygon rings that are too short or not closed', () => {
    const tooShort = parseGeoJsonValue({
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    })
    expect(tooShort.ok).toBe(false)
    if (!tooShort.ok) expect(tooShort.error.code).toBe('ring')

    const notClosed = parseGeoJsonValue({
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ],
      ],
    })
    expect(notClosed.ok).toBe(false)
    if (!notClosed.ok) {
      expect(notClosed.error.code).toBe('ring')
      expect(notClosed.error.message).toContain('not closed')
    }
  })

  it('rejects LineStrings with fewer than two positions', () => {
    expect(
      errorCode({ type: 'LineString', coordinates: [[0, 0]] }),
    ).toBe('coordinates')
  })

  it('rejects unsupported legacy CRS declarations but accepts WGS84 ones', () => {
    const unsupported = parseGeoJsonValue({
      type: 'Point',
      coordinates: [0, 0],
      crs: {
        type: 'name',
        properties: { name: 'urn:ogc:def:crs:EPSG::3857' },
      },
    })
    expect(unsupported.ok).toBe(false)
    if (!unsupported.ok) expect(unsupported.error.code).toBe('crs')

    const wgs84 = parseGeoJsonValue({
      type: 'Point',
      coordinates: [0, 0],
      crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } },
    })
    expect(wgs84.ok).toBe(true)
  })
})

describe('GeoJSON — file size limit', () => {
  it('accepts files at or below the limit and rejects larger ones', () => {
    expect(checkByteSize(MAX_GEOJSON_BYTES)).toBeNull()
    expect(checkByteSize(1024)).toBeNull()
    const error = checkByteSize(MAX_GEOJSON_BYTES + 1)
    expect(error?.code).toBe('size')
    expect(error?.message).toContain('10 MB')
  })
})

describe('GeoJSON — helpers', () => {
  it('formats property values as plain text', () => {
    expect(formatPropertyValue('hello')).toBe('hello')
    expect(formatPropertyValue(42)).toBe('42')
    expect(formatPropertyValue(false)).toBe('false')
    expect(formatPropertyValue(null)).toBe('null')
    expect(formatPropertyValue({ a: 1 })).toBe('{"a":1}')
  })

  it('derives safe export filenames', () => {
    expect(suggestedExportFilename(null)).toBe('geo-toolbox-export.geojson')
    expect(suggestedExportFilename('data.geojson')).toBe('data-export.geojson')
    expect(suggestedExportFilename('DATA.JSON')).toBe('DATA-export.geojson')
    expect(suggestedExportFilename('.geojson')).toBe(
      'geo-toolbox-export.geojson',
    )
  })
})

describe('GeoJSON — bounds aggregation', () => {
  it('unions bounds across entries and ignores null geometries', () => {
    const dataset = parseOk(
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: null,
            geometry: { type: 'Point', coordinates: [0, 0] },
          },
          {
            type: 'Feature',
            properties: null,
            geometry: null,
          },
          {
            type: 'Feature',
            properties: null,
            geometry: {
              type: 'LineString',
              coordinates: [
                [10, 5],
                [-4, -6],
              ],
            },
          },
        ],
      }),
    )
    expect(dataset.bounds).toEqual({
      minLongitude: -4,
      minLatitude: -6,
      maxLongitude: 10,
      maxLatitude: 5,
    })
  })

  it('reports no bounds when no entry has valid positions', () => {
    const dataset = parseOk(
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', properties: null, geometry: null },
          {
            type: 'Feature',
            properties: null,
            geometry: { type: 'GeometryCollection', geometries: [] },
          },
        ],
      }),
    )
    expect(dataset.bounds).toBeNull()
    expect(dataset.hasGeometry).toBe(false)
  })
})

describe('GeoJSON — interoperability of metadata and coordinate order', () => {
  const source = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'poly-1',
        properties: { name: 'With hole', area: 12.5, flag: true },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [100, 0],
              [101, 0],
              [101, 1],
              [100, 1],
              [100, 0],
            ],
            [
              [100.2, 0.2],
              [100.4, 0.2],
              [100.4, 0.4],
              [100.2, 0.2],
            ],
          ],
        },
      },
    ],
  }

  it('preserves polygon holes and metadata in the source export', () => {
    const dataset = parseOk(JSON.stringify(source))
    const exported = JSON.parse(buildGeoJsonExport(dataset, 'source'))
    expect(exported).toEqual(source)
  })

  it('preserves polygon holes and metadata when normalised to a FeatureCollection', () => {
    const dataset = parseOk(JSON.stringify(source))
    const exported = JSON.parse(
      buildGeoJsonExport(dataset, 'feature-collection'),
    )
    expect(exported.features[0].id).toBe('poly-1')
    expect(exported.features[0].properties).toEqual(source.features[0].properties)
    expect(exported.features[0].geometry).toEqual(
      source.features[0].geometry,
    )
  })

  it('keeps [longitude, latitude] order through both export modes', () => {
    const dataset = parseOk(
      '{"type":"Point","coordinates":[110.3695,-7.7956]}',
    )
    for (const mode of ['source', 'feature-collection'] as const) {
      const exported = JSON.parse(buildGeoJsonExport(dataset, mode))
      const coordinates =
        mode === 'source'
          ? exported.coordinates
          : exported.features[0].geometry.coordinates
      expect(coordinates).toEqual([110.3695, -7.7956])
    }
  })
})
