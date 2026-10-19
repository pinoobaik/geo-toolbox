import { useEffect } from 'react'
import { MapContainer, ScaleControl, TileLayer, useMap } from 'react-leaflet'
import type { LatLngTuple, Map as LeafletMap } from 'leaflet'
import MapControls from '../components/map/MapControls'
import WorkspaceMapOverlay from './WorkspaceMapOverlay'
import { useMapWorkspace } from './workspace'

const DEFAULT_CENTER: LatLngTuple = [-7.7956, 110.3695]
const DEFAULT_ZOOM = 12

interface MapBridgeProps {
  onMapReady: (map: LeafletMap | null) => void
}

function MapBridge({ onMapReady }: MapBridgeProps) {
  const map = useMap()

  useEffect(() => {
    onMapReady(map)
    return () => {
      onMapReady(null)
    }
  }, [map, onMapReady])

  return null
}

export default function MapView() {
  const { map, registerMap } = useMapWorkspace()

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
        <MapBridge onMapReady={registerMap} />
        <WorkspaceMapOverlay />
      </MapContainer>
      <MapControls map={map} />
    </div>
  )
}
