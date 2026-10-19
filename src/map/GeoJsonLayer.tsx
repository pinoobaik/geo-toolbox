import { memo } from 'react'
import { CircleMarker, Polygon, Polyline } from 'react-leaflet'
import type { LatLngTuple, PathOptions } from 'leaflet'
import { useMapWorkspace } from './workspace'
import type { GeoJsonGeometry, GeoJsonPosition } from '../core/geojson'

/**
 * Renders the imported GeoJSON dataset on the map. It is mounted once inside
 * the persistent `MapContainer` and driven entirely by workspace context, so
 * switching tools or opening/closing the floating panel never remounts or
 * duplicates the imported geometry. It is intentionally kept separate from the
 * transient measurement overlay.
 *
 * Coordinates are stored as `[longitude, latitude]` (GeoJSON / RFC 7946) and
 * converted to Leaflet's `[latitude, longitude]` here.
 */

const IMPORT_COLOR = '#285c45'
const IMPORT_FILL = '#c5e86c'
const SELECTED_COLOR = '#1f4a37'

function toLatLng(position: GeoJsonPosition): LatLngTuple {
  return [position[1], position[0]]
}

function toLatLngRing(ring: readonly GeoJsonPosition[]): LatLngTuple[] {
  return ring.map(toLatLng)
}

function lineStyle(selected: boolean): PathOptions {
  return {
    color: selected ? SELECTED_COLOR : IMPORT_COLOR,
    weight: selected ? 4 : 2.5,
    opacity: 0.95,
    interactive: false,
  }
}

function areaStyle(selected: boolean): PathOptions {
  return {
    color: selected ? SELECTED_COLOR : IMPORT_COLOR,
    weight: selected ? 3 : 2,
    opacity: 0.95,
    fillColor: IMPORT_FILL,
    fillOpacity: selected ? 0.45 : 0.22,
    interactive: false,
  }
}

function markerStyle(selected: boolean): PathOptions {
  return {
    color: selected ? SELECTED_COLOR : IMPORT_COLOR,
    weight: 2,
    fillColor: IMPORT_FILL,
    fillOpacity: 1,
    interactive: false,
  }
}

interface GeometryShapeProps {
  geometry: GeoJsonGeometry
  selected: boolean
}

function GeometryShapeImpl({ geometry, selected }: GeometryShapeProps) {
  switch (geometry.type) {
    case 'Point':
      return (
        <CircleMarker
          center={toLatLng(geometry.coordinates)}
          radius={selected ? 7 : 5}
          pathOptions={markerStyle(selected)}
        />
      )
    case 'MultiPoint':
      return (
        <>
          {geometry.coordinates.map((position, index) => (
            <CircleMarker
              key={index}
              center={toLatLng(position)}
              radius={selected ? 7 : 5}
              pathOptions={markerStyle(selected)}
            />
          ))}
        </>
      )
    case 'LineString':
      return (
        <Polyline
          positions={toLatLngRing(geometry.coordinates)}
          pathOptions={lineStyle(selected)}
        />
      )
    case 'MultiLineString':
      return (
        <>
          {geometry.coordinates.map((line, index) => (
            <Polyline
              key={index}
              positions={toLatLngRing(line)}
              pathOptions={lineStyle(selected)}
            />
          ))}
        </>
      )
    case 'Polygon':
      return (
        <Polygon
          positions={geometry.coordinates.map(toLatLngRing)}
          pathOptions={areaStyle(selected)}
        />
      )
    case 'MultiPolygon':
      return (
        <>
          {geometry.coordinates.map((polygon, index) => (
            <Polygon
              key={index}
              positions={polygon.map(toLatLngRing)}
              pathOptions={areaStyle(selected)}
            />
          ))}
        </>
      )
    case 'GeometryCollection':
      return (
        <>
          {geometry.geometries.map((child, index) => (
            <GeometryShape
              key={index}
              geometry={child}
              selected={selected}
            />
          ))}
        </>
      )
    default:
      return null
  }
}

/**
 * Memoised so that selecting a feature (which flips the `selected` flag for at
 * most two entries) does not re-create Leaflet layers for every other entry in
 * a large imported dataset. Geometry references are stable for the lifetime of
 * a dataset, so the shallow comparison is sufficient.
 */
const GeometryShape = memo(GeometryShapeImpl)

export default function GeoJsonLayer() {
  const { geoJson, selectedGeoJsonEntry } = useMapWorkspace()

  if (geoJson === null || !geoJson.hasGeometry) {
    return null
  }

  return (
    <>
      {geoJson.entries.map((entry) =>
        entry.geometry === null ? null : (
          <GeometryShape
            key={entry.index}
            geometry={entry.geometry}
            selected={entry.index === selectedGeoJsonEntry}
          />
        ),
      )}
    </>
  )
}
