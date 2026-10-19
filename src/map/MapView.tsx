import { useEffect, useState } from 'react'
import { MapContainer, ScaleControl, TileLayer, useMap } from 'react-leaflet'
import type { LatLngTuple, Map as LeafletMap } from 'leaflet'
import MapControls from '../components/map/MapControls'

const DEFAULT_CENTER: LatLngTuple = [-7.7956, 110.3695]
const DEFAULT_ZOOM = 12

interface MapBridgeProps {
  onMapReady: (map: LeafletMap) => void
}

function MapBridge({ onMapReady }: MapBridgeProps) {
  const map = useMap()

  useEffect(() => {
    onMapReady(map)
  }, [map, onMapReady])

  return null
}

export default function MapView() {
  const [map, setMap] = useState<LeafletMap | null>(null)

  return (
    <div className="map-view">
      <MapContainer
        className="map-view__canvas"
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        zoomControl={false}
        minZoom={3}
        maxZoom={19}
        worldCopyJump
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />
        <ScaleControl position="bottomleft" imperial={false} />
        <MapBridge onMapReady={setMap} />
      </MapContainer>
      <MapControls map={map} />
    </div>
  )
}
