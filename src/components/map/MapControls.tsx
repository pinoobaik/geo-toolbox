import { useEffect, useState } from 'react'
import type { LeafletMouseEvent, Map as LeafletMap } from 'leaflet'

interface MapControlsProps {
  map: LeafletMap | null
}

interface CursorPosition {
  lat: number
  lng: number
}

function formatCoordinate(value: number): string {
  return value.toFixed(5)
}

export default function MapControls({ map }: MapControlsProps) {
  const [cursor, setCursor] = useState<CursorPosition | null>(null)
  const [, setZoomTick] = useState(0)

  useEffect(() => {
    if (!map) {
      return
    }

    const handleMouseMove = (event: LeafletMouseEvent) => {
      setCursor({ lat: event.latlng.lat, lng: event.latlng.lng })
    }
    const handleMouseOut = () => {
      setCursor(null)
    }
    const handleZoomEnd = () => {
      setZoomTick((tick) => tick + 1)
    }

    map.on('mousemove', handleMouseMove)
    map.on('mouseout', handleMouseOut)
    map.on('zoomend', handleZoomEnd)

    return () => {
      map.off('mousemove', handleMouseMove)
      map.off('mouseout', handleMouseOut)
      map.off('zoomend', handleZoomEnd)
    }
  }, [map])

  const zoom = map ? map.getZoom() : null

  const coordinateLabel = cursor
    ? `${formatCoordinate(cursor.lat)}, ${formatCoordinate(cursor.lng)}`
    : 'Move cursor over map'

  return (
    <>
      <div className="map-zoom" role="group" aria-label="Map zoom controls">
        <button
          type="button"
          className="map-zoom__button"
          aria-label="Zoom in"
          title="Zoom in"
          disabled={!map}
          onClick={() => map?.zoomIn()}
        >
          <svg
            viewBox="0 0 24 24"
            width={18}
            height={18}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <button
          type="button"
          className="map-zoom__button"
          aria-label="Zoom out"
          title="Zoom out"
          disabled={!map}
          onClick={() => map?.zoomOut()}
        >
          <svg
            viewBox="0 0 24 24"
            width={18}
            height={18}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            aria-hidden="true"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <div className="map-status">
        <span className="map-status__coords">{coordinateLabel}</span>
        <span className="map-status__sep" aria-hidden="true" />
        <span className="map-status__meta">WGS84 · EPSG:4326</span>
        <span className="map-status__sep" aria-hidden="true" />
        <span className="map-status__meta">
          {zoom === null ? 'Z–' : `Z${zoom}`}
        </span>
      </div>
    </>
  )
}
