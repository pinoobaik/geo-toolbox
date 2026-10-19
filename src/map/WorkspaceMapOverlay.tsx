import { useEffect } from 'react'
import { CircleMarker, Polygon, Polyline, Tooltip, useMap } from 'react-leaflet'
import type { LatLngTuple, LeafletMouseEvent } from 'leaflet'
import type { GeoPoint } from '../types/geo'
import { useMapWorkspace } from './workspace'
import type { MapPolygon, VisualizationPoint } from './workspace'

const PATH_COLOR = '#285c45'
const POINT_STROKE = '#ffffff'
const FILL_COLOR = '#285c45'

function toLatLng(point: GeoPoint): LatLngTuple {
  return [point.latitude, point.longitude]
}

function closeRing(ring: readonly GeoPoint[]): LatLngTuple[] {
  const positions = ring.map(toLatLng)
  if (positions.length > 2) {
    const first = positions[0]
    const last = positions[positions.length - 1]
    if (first[0] !== last[0] || first[1] !== last[1]) {
      positions.push(first)
    }
  }
  return positions
}

function PolygonOverlay({ polygon }: { polygon: MapPolygon }) {
  if (!polygon.closed) {
    return (
      <Polyline
        positions={polygon.ring.map(toLatLng)}
        pathOptions={{
          color: PATH_COLOR,
          weight: 3,
          opacity: 0.9,
          dashArray: '6 6',
        }}
      />
    )
  }

  const positions: LatLngTuple[][] = [closeRing(polygon.ring)]
  if (polygon.holes) {
    for (const hole of polygon.holes) {
      positions.push(closeRing(hole))
    }
  }

  return (
    <Polygon
      positions={positions}
      pathOptions={{
        color: PATH_COLOR,
        weight: 2,
        opacity: 0.95,
        fillColor: FILL_COLOR,
        fillOpacity: 0.14,
      }}
    />
  )
}

function VertexMarker({ point }: { point: VisualizationPoint }) {
  const removable = point.onRemove !== undefined
  return (
    <CircleMarker
      center={toLatLng(point)}
      radius={7}
      eventHandlers={
        removable
          ? {
              click: (event) => {
                event.originalEvent.stopPropagation()
                point.onRemove?.()
              },
            }
          : undefined
      }
      pathOptions={{
        color: POINT_STROKE,
        weight: 2,
        fillColor: PATH_COLOR,
        fillOpacity: 1,
        bubblingMouseEvents: !removable,
      }}
    >
      {point.label ? (
        <Tooltip
          permanent
          direction="top"
          offset={[0, -8]}
          className="map-point-label"
        >
          {point.label}
        </Tooltip>
      ) : null}
    </CircleMarker>
  )
}

/**
 * Renders the active tool's geometry and captures map clicks while a point is
 * being picked or a vertex is being collected. Rendered inside MapContainer so
 * it can access the map instance.
 */
export default function WorkspaceMapOverlay() {
  const map = useMap()
  const { visualization, picking, cancelPicking, collecting } = useMapWorkspace()

  useEffect(() => {
    if (picking === null) {
      return
    }
    const handleClick = (event: LeafletMouseEvent) => {
      picking.onPick({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      })
      cancelPicking()
    }
    map.on('click', handleClick)
    return () => {
      map.off('click', handleClick)
    }
  }, [map, picking, cancelPicking])

  useEffect(() => {
    if (collecting === null) {
      return
    }
    const handleClick = (event: LeafletMouseEvent) => {
      collecting.onVertex({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      })
    }
    map.on('click', handleClick)
    return () => {
      map.off('click', handleClick)
    }
  }, [map, collecting])

  useEffect(() => {
    const container = map.getContainer()
    const active = picking !== null || collecting !== null
    if (!active) {
      container.classList.remove('is-picking')
      return
    }
    container.classList.add('is-picking')
    return () => {
      container.classList.remove('is-picking')
    }
  }, [map, picking, collecting])

  if (visualization === null) {
    return null
  }

  return (
    <>
      {visualization.line && visualization.line.length > 1 ? (
        <Polyline
          positions={visualization.line.map(toLatLng)}
          pathOptions={{
            color: PATH_COLOR,
            weight: 3,
            opacity: 0.9,
            dashArray: '6 6',
          }}
        />
      ) : null}
      {visualization.polygon ? (
        <PolygonOverlay polygon={visualization.polygon} />
      ) : null}
      {visualization.points.map((point) => (
        <VertexMarker key={point.id} point={point} />
      ))}
    </>
  )
}
