import { useEffect } from 'react'
import { CircleMarker, Polyline, Tooltip, useMap } from 'react-leaflet'
import type { LatLngTuple, LeafletMouseEvent } from 'leaflet'
import type { GeoPoint } from '../types/geo'
import { useMapWorkspace } from './workspace'

const PATH_COLOR = '#285c45'
const POINT_STROKE = '#ffffff'

function toLatLng(point: GeoPoint): LatLngTuple {
  return [point.latitude, point.longitude]
}

/**
 * Renders the active tool's geometry and captures map clicks while a point is
 * being picked. Rendered inside MapContainer so it can access the map instance.
 */
export default function WorkspaceMapOverlay() {
  const map = useMap()
  const { visualization, picking, cancelPicking } = useMapWorkspace()

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
    const container = map.getContainer()
    if (picking === null) {
      container.classList.remove('is-picking')
      return
    }
    container.classList.add('is-picking')
    return () => {
      container.classList.remove('is-picking')
    }
  }, [map, picking])

  if (visualization === null) {
    return null
  }

  return (
    <>
      {visualization.line ? (
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
      {visualization.points.map((point) => (
        <CircleMarker
          key={point.id}
          center={toLatLng(point)}
          radius={7}
          pathOptions={{
            color: POINT_STROKE,
            weight: 2,
            fillColor: PATH_COLOR,
            fillOpacity: 1,
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
      ))}
    </>
  )
}
